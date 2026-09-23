begin;

create table trustleaf_private.dispensary_onboarding_invitations (
  invitation_ref uuid primary key,
  invited_by uuid not null references trustleaf_private.actor_bindings(actor_ref),
  email_hash text not null check(email_hash ~ '^[a-f0-9]{64}$'),
  email_ciphertext text not null,
  token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
  state text not null default 'pending' check(state in ('pending','accepted','cancelled')),
  generation integer not null default 1,
  expires_at timestamptz not null,
  accepted_by uuid references trustleaf_private.actor_bindings(actor_ref),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
create unique index dispensary_onboarding_pending_email
  on trustleaf_private.dispensary_onboarding_invitations(email_hash) where state='pending';

create table trustleaf_private.dispensary_onboarding_applications (
  application_ref uuid primary key default gen_random_uuid(),
  invitation_ref uuid not null references trustleaf_private.dispensary_onboarding_invitations,
  actor_ref uuid not null references trustleaf_private.actor_bindings,
  state text not null default 'draft' check(state in ('draft','submitted','changes_requested','approved','rejected')),
  version integer not null default 1,
  profile jsonb not null default '{"managerName":"","phone":"","businessName":"","commune":"","address":"","activity":"","contactEmail":""}',
  reason text,
  consent_at timestamptz,
  organization_ref uuid references trustleaf_private.pilot_organizations,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check(jsonb_typeof(profile)='object' and octet_length(profile::text)<=8000)
);
create unique index dispensary_onboarding_one_process
  on trustleaf_private.dispensary_onboarding_applications(actor_ref) where state<>'rejected';

create table trustleaf_private.dispensary_onboarding_decisions (
  decision_ref uuid primary key default gen_random_uuid(),
  application_ref uuid not null references trustleaf_private.dispensary_onboarding_applications,
  reviewer_ref uuid not null references trustleaf_private.actor_bindings,
  decision text not null check(decision in ('approve','changes','reject')),
  reason text,
  created_at timestamptz not null default clock_timestamp()
);
create table trustleaf_private.dispensary_onboarding_operations (
  subject text not null, operation_id uuid not null, intent text not null, result jsonb not null,
  primary key(subject,operation_id)
);
create table trustleaf_private.dispensary_onboarding_audit (
  audit_ref uuid primary key default gen_random_uuid(),
  actor_ref uuid not null references trustleaf_private.actor_bindings,
  action text not null, resource_ref uuid not null,
  created_at timestamptz not null default clock_timestamp()
);
create table trustleaf_private.dispensary_onboarding_mail (
  mail_ref uuid primary key default gen_random_uuid(),
  invitation_ref uuid not null references trustleaf_private.dispensary_onboarding_invitations,
  generation integer not null,
  payload_ciphertext text not null,
  state text not null default 'queued' check(state in ('queued','sending','sent','delivered','delayed','failed','uncertain','bounced','cancelled')),
  provider_ref text unique,
  first_attempt_at timestamptz, last_attempt_at timestamptz, lease_until timestamptz, lease_ref uuid,
  attempts integer not null default 0,
  created_at timestamptz not null default clock_timestamp(),
  unique(invitation_ref,generation)
);
create table trustleaf_private.dispensary_onboarding_webhooks (
  event_id text primary key, created_at timestamptz not null default clock_timestamp()
);
do $$ declare t text; begin
  foreach t in array array['invitations','applications','decisions','operations','audit','mail','webhooks'] loop
    execute format('alter table trustleaf_private.dispensary_onboarding_%I enable row level security',t);
    execute format('alter table trustleaf_private.dispensary_onboarding_%I force row level security',t);
    execute format('revoke all on trustleaf_private.dispensary_onboarding_%I from public,anon,authenticated,service_role',t);
  end loop;
end $$;

-- A legacy approval or operator invitation cannot activate an onboarding applicant.
-- The reviewed application must be approved in the same transaction first.
create function trustleaf_private.dispensary_onboarding_activation_guard() returns trigger
language plpgsql security definer set search_path=trustleaf_private,pg_temp as $$
begin
  if new.state='active' and old.state is distinct from 'active'
    and exists(select 1 from dispensary_onboarding_applications where actor_ref=new.actor_ref)
    and not exists(select 1 from dispensary_onboarding_applications where actor_ref=new.actor_ref and state='approved') then
    raise exception 'ONBOARDING_REVIEW_REQUIRED' using errcode='42501';
  end if;
  return new;
end $$;
revoke all on function trustleaf_private.dispensary_onboarding_activation_guard() from public,anon,authenticated,service_role;
create trigger dispensary_onboarding_review_required before update on trustleaf_private.actor_bindings
  for each row execute function trustleaf_private.dispensary_onboarding_activation_guard();

-- Do not show the same applicant in the simulated-profile review queue.
create or replace function public.trustleaf_list_pending_privy_actors(admin_subject text)
returns table(actor_ref uuid,role text,version bigint,requested_at timestamptz,display_name text,
  registration_reference text,review_context text,is_test_data boolean)
language sql security definer set search_path=pg_catalog,public as $$
  select p.actor_ref,p.role::text,p.version,p.requested_at,p.display_name,p.registration_reference,p.review_context,p.is_test_data
  from trustleaf_private.list_pending_privy_actors(admin_subject) p
  where not exists(select 1 from trustleaf_private.dispensary_onboarding_applications a where a.actor_ref=p.actor_ref)
$$;
revoke all on function public.trustleaf_list_pending_privy_actors(text) from public,anon,authenticated;
grant execute on function public.trustleaf_list_pending_privy_actors(text) to service_role;

create function trustleaf_private.dispensary_onboarding_view(p_ref uuid) returns jsonb
language sql stable security definer set search_path=trustleaf_private,pg_temp as $$
  select jsonb_build_object('applicationRef',application_ref,'state',state,'version',version,
    'profile',profile,'reason',reason,'organizationRef',organization_ref,'updatedAt',updated_at)
  from dispensary_onboarding_applications where application_ref=p_ref
$$;
revoke all on function trustleaf_private.dispensary_onboarding_view(uuid) from public,anon,authenticated,service_role;

create function public.trustleaf_dispensary_onboarding(p_subject text,p_action text,p_input jsonb default '{}')
returns jsonb language plpgsql security definer set search_path=trustleaf_private,pg_temp as $$
declare a record; inv dispensary_onboarding_invitations%rowtype; app dispensary_onboarding_applications%rowtype;
  target actor_bindings%rowtype; ident external_identity_bindings%rowtype;
  mail dispensary_onboarding_mail%rowtype; prior dispensary_onboarding_operations%rowtype;
  now_at timestamptz; ref uuid; op uuid; result jsonb; is_admin boolean; field text; new_profile jsonb; organization uuid;
begin
  if p_subject is null or length(p_subject)>510 or p_subject !~ '^did:privy:[A-Za-z0-9._:-]{6,}$'
    or p_input is null or jsonb_typeof(p_input)<>'object' or octet_length(p_input::text)>16000
    or p_action is null or p_action not in ('list','invite','resend','cancel','inspect','accept','read-draft','save-draft','submit','review','claim-send','finish-send') then
    raise exception 'ONBOARDING_INPUT_INVALID' using errcode='22023';
  end if;
  -- Shared with enrollment/team acceptance: one identity and one membership.
  perform pg_advisory_xact_lock(42826004);
  now_at := clock_timestamp();
  select * into a from resolve_privy_actor(p_subject);
  is_admin := coalesce(a.role='admin' and a.actor_state='active' and (a.valid_until is null or a.valid_until>now_at),false);
  if p_action in ('list','invite','resend','cancel','review','claim-send','finish-send') and not is_admin then
    raise exception 'ONBOARDING_FORBIDDEN' using errcode='42501';
  end if;
  if is_admin then
    perform 1 from actor_bindings b join external_identity_bindings e using(actor_ref)
      where b.actor_ref=a.actor_ref and e.provider='privy' and e.state='active' and b.state='active' for share of b,e;
    if not found then raise exception 'ONBOARDING_FORBIDDEN' using errcode='42501'; end if;
  end if;
  if p_action='list' then
    return jsonb_build_object('invitations',(select coalesce(jsonb_agg(jsonb_build_object(
      'invitationRef',i.invitation_ref,'emailCiphertext',i.email_ciphertext,
      'state',case when i.state='pending' and i.expires_at<=now_at then 'expired' else i.state end,
      'expiresAt',i.expires_at,'deliveryState',j.state) order by i.created_at desc),'[]')
      from dispensary_onboarding_invitations i left join dispensary_onboarding_mail j
      on j.invitation_ref=i.invitation_ref and j.generation=i.generation),
      'applications',(select coalesce(jsonb_agg(dispensary_onboarding_view(application_ref) order by updated_at desc),'[]')
        from dispensary_onboarding_applications));
  end if;
  if p_action in ('inspect','accept') then
    select * into inv from dispensary_onboarding_invitations where token_hash=p_input->>'tokenHash' for update;
    if not found or not(coalesce(p_input->'emailHashes','[]') ? inv.email_hash) or inv.state='cancelled' then
      raise exception 'ONBOARDING_INVITATION_UNAVAILABLE' using errcode='42501'; end if;
    if inv.state='accepted' then
      if a.actor_ref is distinct from inv.accepted_by or a.actor_state not in ('pending','active')
        or (a.valid_until is not null and a.valid_until<=now_at) then
        raise exception 'ONBOARDING_INVITATION_UNAVAILABLE' using errcode='42501'; end if;
      select * into app from dispensary_onboarding_applications where actor_ref=inv.accepted_by order by created_at desc limit 1;
      return jsonb_build_object('accepted',true,'application',dispensary_onboarding_view(app.application_ref));
    end if;
    if inv.expires_at<=now_at then raise exception 'ONBOARDING_INVITATION_UNAVAILABLE' using errcode='42501'; end if;
    perform 1 from actor_bindings b join external_identity_bindings e using(actor_ref)
      where b.actor_ref=inv.invited_by and b.role='admin' and b.state='active' and (b.valid_until is null or b.valid_until>now_at)
      and e.provider='privy' and e.state='active' for share of b,e;
    if not found then raise exception 'ONBOARDING_INVITATION_UNAVAILABLE' using errcode='42501'; end if;
    select * into ident from external_identity_bindings where provider='privy' and external_subject=p_subject for update;
    if found then
      select * into target from actor_bindings where actor_ref=ident.actor_ref for update;
      if ident.state<>'active' or target.role<>'dispensary' or target.state<>'pending'
        or (target.valid_until is not null and target.valid_until<=now_at)
        or exists(select 1 from pilot_memberships where actor_ref=target.actor_ref)
        or exists(select 1 from pilot_staff_only where actor_ref=target.actor_ref) then
        raise exception 'ONBOARDING_ACCOUNT_CONFLICT' using errcode='42501'; end if;
    end if;
    if p_action='inspect' then return jsonb_build_object('accepted',false,'expiresAt',inv.expires_at); end if;
    if p_input->>'consent' is distinct from 'true' then raise exception 'ONBOARDING_CONSENT_REQUIRED' using errcode='22023'; end if;
    if target.actor_ref is null then
      perform enroll_privy_actor(p_subject,'dispensary');
      select b.* into target from actor_bindings b join external_identity_bindings e using(actor_ref)
        where e.provider='privy' and e.external_subject=p_subject for update of b;
    end if;
    select * into app from dispensary_onboarding_applications where actor_ref=target.actor_ref and state<>'rejected';
    if not found then
      insert into dispensary_onboarding_applications(invitation_ref,actor_ref,consent_at)
        values(inv.invitation_ref,target.actor_ref,now_at) returning * into app;
    end if;
    update dispensary_onboarding_invitations set state='accepted',accepted_by=target.actor_ref,updated_at=now_at where invitation_ref=inv.invitation_ref;
    insert into dispensary_onboarding_audit(actor_ref,action,resource_ref) values(target.actor_ref,'accept',inv.invitation_ref);
    return jsonb_build_object('accepted',true,'application',dispensary_onboarding_view(app.application_ref));
  end if;
  if p_action in ('read-draft','save-draft','submit') then
    if a.actor_ref is null or a.role<>'dispensary' or a.actor_state not in ('pending','active')
      or (a.valid_until is not null and a.valid_until<=now_at) then raise exception 'ONBOARDING_FORBIDDEN' using errcode='42501'; end if;
    if p_action='read-draft' then
      select * into app from dispensary_onboarding_applications where actor_ref=a.actor_ref order by created_at desc limit 1;
      return jsonb_build_object('application',dispensary_onboarding_view(app.application_ref));
    end if;
  end if;
  if p_action in ('save-draft','submit','review') then
    select * into app from dispensary_onboarding_applications where application_ref=(p_input->>'applicationRef')::uuid
      and (is_admin or actor_ref=a.actor_ref) for update;
    if not found then raise exception 'ONBOARDING_FORBIDDEN' using errcode='42501'; end if;
  end if;
  if p_action not in ('claim-send','finish-send','read-draft') then
    op := (p_input->>'operationId')::uuid;
    if op is null or p_input->>'intent' is null then raise exception 'ONBOARDING_INPUT_INVALID' using errcode='22023'; end if;
    select * into prior from dispensary_onboarding_operations where subject=p_subject and operation_id=op;
    if found then
      if prior.intent<>p_input->>'intent' then raise exception 'ONBOARDING_REPLAY_CONFLICT' using errcode='PT409'; end if;
      return prior.result;
    end if;
  end if;
  if p_action in ('save-draft','submit','review') then
    if app.version is distinct from (p_input->>'version')::integer then raise exception 'ONBOARDING_VERSION_CONFLICT' using errcode='PT409'; end if;
    if p_action in ('save-draft','submit') and app.state not in ('draft','changes_requested') then
      raise exception 'ONBOARDING_READ_ONLY' using errcode='PT409'; end if;
    if p_action='save-draft' then
      new_profile := p_input->'profile';
      if new_profile is null or jsonb_typeof(new_profile)<>'object' or new_profile - array['managerName','phone','businessName','commune','address','activity','contactEmail'] <> '{}'::jsonb then
        raise exception 'ONBOARDING_INPUT_INVALID' using errcode='22023'; end if;
      foreach field in array array['managerName','phone','businessName','commune','address','activity','contactEmail'] loop
        if jsonb_typeof(new_profile->field) is distinct from 'string' or length(new_profile->>field)>(case when field='activity' then 2000 when field='address' then 300 when field='contactEmail' then 254 else 100 end) then
          raise exception 'ONBOARDING_INPUT_INVALID' using errcode='22023'; end if;
        new_profile := jsonb_set(new_profile,array[field],to_jsonb(btrim(new_profile->>field)));
      end loop;
      if new_profile->>'contactEmail'<>'' and new_profile->>'contactEmail' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'ONBOARDING_INPUT_INVALID' using errcode='22023'; end if;
      update dispensary_onboarding_applications set profile=new_profile,version=version+1,updated_at=now_at where application_ref=app.application_ref;
    elsif p_action='submit' then
      if p_input->>'consent' is distinct from 'true' then raise exception 'ONBOARDING_CONSENT_REQUIRED' using errcode='22023'; end if;
      foreach field in array array['managerName','phone','businessName','commune','address','activity'] loop
        if length(btrim(app.profile->>field))<2 then raise exception 'ONBOARDING_INCOMPLETE' using errcode='22023'; end if;
      end loop;
      update dispensary_onboarding_applications set state='submitted',consent_at=now_at,version=version+1,updated_at=now_at where application_ref=app.application_ref;
    else
      if app.state<>'submitted' then raise exception 'ONBOARDING_NOT_SUBMITTED' using errcode='PT409'; end if;
      if p_input->>'decision' is null or p_input->>'decision' not in ('approve','changes','reject')
        or length(coalesce(p_input->>'reason',''))>2000
        or (p_input->>'decision' in ('changes','reject') and length(btrim(coalesce(p_input->>'reason','')))<3) then
        raise exception 'ONBOARDING_REASON_REQUIRED' using errcode='22023'; end if;
      select * into target from actor_bindings where actor_ref=app.actor_ref for update;
      if target.role<>'dispensary' or target.state<>'pending' or (target.valid_until is not null and target.valid_until<=now_at)
        or exists(select 1 from pilot_staff_only where actor_ref=target.actor_ref)
        or exists(select 1 from pilot_memberships where actor_ref=target.actor_ref)
        or not exists(select 1 from external_identity_bindings where actor_ref=target.actor_ref and provider='privy' and state='active') then
        raise exception 'ONBOARDING_ACCOUNT_CONFLICT' using errcode='42501'; end if;
      update dispensary_onboarding_applications set state=case p_input->>'decision' when 'approve' then 'approved' when 'changes' then 'changes_requested' else 'rejected' end,
        reason=nullif(btrim(p_input->>'reason'),''),version=version+1,updated_at=now_at where application_ref=app.application_ref;
      if p_input->>'decision'='approve' then
        insert into pilot_organizations(name) values(app.profile->>'businessName') returning organization_ref into organization;
        update dispensary_onboarding_applications set organization_ref=organization where application_ref=app.application_ref;
        update actor_bindings set state='active',version=version+1,updated_at=now_at where actor_ref=target.actor_ref;
        insert into pilot_participants(actor_ref) values(target.actor_ref) on conflict do nothing;
        insert into pilot_memberships(actor_ref,organization_ref,role) values(target.actor_ref,organization,'manager');
      end if;
      insert into dispensary_onboarding_decisions(application_ref,reviewer_ref,decision,reason)
        values(app.application_ref,a.actor_ref,p_input->>'decision',nullif(btrim(p_input->>'reason'),''));
    end if;
    result := jsonb_build_object('application',dispensary_onboarding_view(app.application_ref));
  else
    ref := (p_input->>'invitationRef')::uuid;
    if p_action<>'invite' then
      select * into inv from dispensary_onboarding_invitations where invitation_ref=ref for update;
      if not found then raise exception 'ONBOARDING_FORBIDDEN' using errcode='42501'; end if;
    end if;
    if p_action='claim-send' then
      select * into mail from dispensary_onboarding_mail where invitation_ref=ref and generation=inv.generation for update;
      if inv.state<>'pending' or inv.expires_at<=now_at or mail.state in ('sent','delivered','delayed','bounced','cancelled') or mail.lease_until>now_at then return '{}'; end if;
      if mail.first_attempt_at<now_at-interval '23 hours' then raise exception 'ONBOARDING_RECONCILIATION_REQUIRED' using errcode='PT409'; end if;
      if mail.last_attempt_at>now_at-interval '60 seconds' then raise exception 'ONBOARDING_SEND_LIMIT' using errcode='PT429'; end if;
      update dispensary_onboarding_mail set state='sending',first_attempt_at=coalesce(first_attempt_at,now_at),last_attempt_at=now_at,
        lease_until=now_at+interval '60 seconds',lease_ref=gen_random_uuid(),attempts=attempts+1 where mail_ref=mail.mail_ref returning * into mail;
      return to_jsonb(mail)||jsonb_build_object('email_ciphertext',inv.email_ciphertext,'expires_at',inv.expires_at);
    elsif p_action='finish-send' then
      if p_input->>'state' is null or p_input->>'state' not in ('sent','failed','uncertain') then raise exception 'ONBOARDING_INPUT_INVALID' using errcode='22023'; end if;
      update dispensary_onboarding_mail set state=p_input->>'state',provider_ref=p_input->>'providerRef',lease_until=null
        where invitation_ref=ref and generation=inv.generation and lease_ref=(p_input->>'leaseRef')::uuid and state='sending';
      return '{}';
    elsif p_action in ('invite','resend') then
      if p_action='invite' then
        select * into inv from dispensary_onboarding_invitations where email_hash=p_input->>'emailHash' and state='pending' for update;
        if found and inv.expires_at>now_at then raise exception 'ONBOARDING_PENDING_EXISTS' using errcode='PT409'; end if;
        if found then update dispensary_onboarding_invitations set state='cancelled',updated_at=now_at where invitation_ref=inv.invitation_ref; end if;
      elsif inv.state<>'pending' then raise exception 'ONBOARDING_NOT_PENDING' using errcode='PT409'; end if;
      if (select count(*) from dispensary_onboarding_mail where created_at>now_at-interval '24 hours')>=20
        or (select count(*) from dispensary_onboarding_mail j join dispensary_onboarding_invitations i using(invitation_ref)
          where i.email_hash=coalesce(p_input->>'emailHash',inv.email_hash) and j.created_at>now_at-interval '24 hours')>=3
        or exists(select 1 from dispensary_onboarding_mail j join dispensary_onboarding_invitations i using(invitation_ref)
          where i.email_hash=coalesce(p_input->>'emailHash',inv.email_hash) and j.created_at>now_at-interval '60 seconds') then
        raise exception 'ONBOARDING_SEND_LIMIT' using errcode='PT429'; end if;
      if p_action='invite' then
        insert into dispensary_onboarding_invitations(invitation_ref,invited_by,email_hash,email_ciphertext,token_hash,expires_at)
          values(ref,a.actor_ref,p_input->>'emailHash',p_input->>'emailCiphertext',p_input->>'tokenHash',now_at+interval '7 days') returning * into inv;
      else
        update dispensary_onboarding_mail set state='cancelled' where invitation_ref=ref and state in ('queued','sending','failed','uncertain');
        update dispensary_onboarding_invitations set token_hash=p_input->>'tokenHash',generation=generation+1,expires_at=now_at+interval '7 days',updated_at=now_at,invited_by=a.actor_ref
          where invitation_ref=ref returning * into inv;
      end if;
      insert into dispensary_onboarding_mail(invitation_ref,generation,payload_ciphertext) values(ref,inv.generation,p_input->>'payloadCiphertext');
    elsif p_action='cancel' then
      if inv.state<>'pending' then raise exception 'ONBOARDING_NOT_PENDING' using errcode='PT409'; end if;
      update dispensary_onboarding_invitations set state='cancelled',updated_at=now_at where invitation_ref=ref;
      update dispensary_onboarding_mail set state='cancelled' where invitation_ref=ref and state in ('queued','sending','failed','uncertain');
    end if;
    result := jsonb_build_object('invitationRef',ref);
  end if;
  insert into dispensary_onboarding_operations values(p_subject,op,p_input->>'intent',result);
  insert into dispensary_onboarding_audit(actor_ref,action,resource_ref) values(a.actor_ref,p_action,coalesce(app.application_ref,ref));
  return result;
end $$;
revoke all on function public.trustleaf_dispensary_onboarding(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.trustleaf_dispensary_onboarding(text,text,jsonb) to service_role;

create function public.trustleaf_onboarding_mail_event(p_event_id text,p_provider_ref text,p_state text)
returns void language plpgsql security definer set search_path=trustleaf_private,pg_temp as $$
begin
  if p_event_id is null or p_provider_ref is null or p_state is null or length(p_event_id)>200 or length(p_provider_ref)>200
    or p_state not in ('sent','delivered','delayed','failed','bounced') then raise exception 'ONBOARDING_INPUT_INVALID' using errcode='22023'; end if;
  perform 1 from dispensary_onboarding_mail where provider_ref=p_provider_ref for update;
  if not found then raise exception 'ONBOARDING_SEND_NOT_RECORDED' using errcode='PT409'; end if;
  insert into dispensary_onboarding_webhooks(event_id) values(p_event_id) on conflict do nothing;
  if not found then return; end if;
  update dispensary_onboarding_mail set state=p_state where provider_ref=p_provider_ref and state not in ('cancelled','bounced')
    and (p_state='bounced' or state<>'delivered') and not(state in ('delayed','failed') and p_state='sent');
end $$;
revoke all on function public.trustleaf_onboarding_mail_event(text,text,text) from public,anon,authenticated;
grant execute on function public.trustleaf_onboarding_mail_event(text,text,text) to service_role;
commit;
