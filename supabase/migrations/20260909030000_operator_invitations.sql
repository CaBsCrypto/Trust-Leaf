begin;

create table trustleaf_private.pilot_staff_only (
  actor_ref uuid primary key references trustleaf_private.actor_bindings(actor_ref),
  created_at timestamptz not null default statement_timestamp()
);
insert into trustleaf_private.pilot_staff_only(actor_ref)
  select actor_ref from trustleaf_private.pilot_memberships where role='operator';
create table trustleaf_private.pilot_team_invitations (
  invitation_ref uuid primary key,
  organization_ref uuid not null references trustleaf_private.pilot_organizations,
  invited_by uuid not null references trustleaf_private.actor_bindings(actor_ref),
  email_hash text not null check (email_hash ~ '^[a-f0-9]{64}$'),
  email_ciphertext text not null,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  state text not null default 'pending' check (state in ('pending','accepted','cancelled')),
  generation integer not null default 1,
  expires_at timestamptz not null,
  accepted_by uuid references trustleaf_private.actor_bindings(actor_ref),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);
create unique index pilot_team_pending_email on trustleaf_private.pilot_team_invitations(organization_ref,email_hash) where state='pending';
create table trustleaf_private.pilot_team_mail (
  mail_ref uuid primary key default gen_random_uuid(),
  invitation_ref uuid not null references trustleaf_private.pilot_team_invitations,
  generation integer not null,
  payload_ciphertext text not null,
  state text not null default 'queued' check (state in ('queued','sending','sent','delivered','delayed','failed','uncertain','bounced','cancelled')),
  provider_ref text unique,
  first_attempt_at timestamptz,
  last_attempt_at timestamptz,
  lease_until timestamptz,
  lease_ref uuid,
  attempts integer not null default 0,
  created_at timestamptz not null default statement_timestamp(),
  unique(invitation_ref,generation)
);
create table trustleaf_private.pilot_team_operations (
  subject text not null,
  operation_id uuid not null,
  intent text not null,
  result jsonb not null,
  primary key(subject,operation_id)
);
create table trustleaf_private.pilot_team_webhooks (
  event_id text primary key,
  created_at timestamptz not null default statement_timestamp()
);
do $$ declare t text; begin
  foreach t in array array['pilot_staff_only','pilot_team_invitations','pilot_team_mail','pilot_team_operations','pilot_team_webhooks'] loop
    execute format('alter table trustleaf_private.%I enable row level security',t);
    execute format('alter table trustleaf_private.%I force row level security',t);
    execute format('revoke all on trustleaf_private.%I from public,anon,authenticated,service_role',t);
  end loop;
end $$;

-- Keep the tested clinical implementation intact, behind a guarded entry point.
alter function public.trustleaf_operations_pilot(text,text,jsonb) set schema trustleaf_private;
revoke all on function trustleaf_private.trustleaf_operations_pilot(text,text,jsonb) from public,anon,authenticated,service_role;
create function public.trustleaf_operations_pilot(p_subject text,p_action text,p_input jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=trustleaf_private,pg_temp as $$
declare a record; r jsonb; ref uuid;
begin
  if p_action='add-operator' then raise exception 'INVITATION_REQUIRED' using errcode='42501'; end if;
  if p_action in ('create-organization','remove-operator') then perform pg_advisory_xact_lock(42826004); end if;
  select * into a from resolve_privy_actor(p_subject);
  if p_action='create-organization' and exists(select 1 from pilot_staff_only s where s.actor_ref=a.actor_ref) then
    raise exception 'STAFF_ONLY' using errcode='42501';
  end if;
  if p_action='remove-operator' then
    -- Serialize team acceptance/removal with each other, before the legacy member lock.
    perform pg_advisory_xact_lock(42826004);
    ref := (p_input->>'resourceRef')::uuid;
  end if;
  r := trustleaf_private.trustleaf_operations_pilot(p_subject,p_action,p_input);
  if p_action='remove-operator' then
    insert into pilot_staff_only(actor_ref) values(ref) on conflict do nothing;
  end if;
  if p_action='snapshot' then
    r := r || jsonb_build_object('staffOnly',exists(select 1 from pilot_staff_only s where s.actor_ref=a.actor_ref));
  end if;
  return r;
end $$;
revoke all on function public.trustleaf_operations_pilot(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.trustleaf_operations_pilot(text,text,jsonb) to service_role;

-- No direct role promotion, including after an operator's membership is removed.
create function trustleaf_private.pilot_staff_membership_guard() returns trigger
language plpgsql security definer set search_path=trustleaf_private,pg_temp as $$
begin
  if new.role='manager' and exists(select 1 from pilot_staff_only s where s.actor_ref=new.actor_ref) then
    raise exception 'STAFF_ONLY' using errcode='42501';
  end if;
  return new;
end $$;
revoke all on function trustleaf_private.pilot_staff_membership_guard() from public,anon,authenticated,service_role;
create trigger pilot_staff_no_promotion before insert or update on trustleaf_private.pilot_memberships
for each row execute function trustleaf_private.pilot_staff_membership_guard();

create function public.trustleaf_team_invitations(p_subject text,p_action text,p_input jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=trustleaf_private,pg_temp as $$
declare a record; m pilot_memberships%rowtype; inv pilot_team_invitations%rowtype;
  target actor_bindings%rowtype; identity external_identity_bindings%rowtype;
  mail pilot_team_mail%rowtype; prior pilot_team_operations%rowtype;
  now_at timestamptz := statement_timestamp(); op uuid; ref uuid; r jsonb; org_name text;
  org_limit integer; recipient_limit integer; cooldown integer;
begin
  if p_subject is null or length(p_subject)>510 or p_subject !~ '^did:privy:[A-Za-z0-9._:-]{6,}$'
    or p_input is null or jsonb_typeof(p_input)<>'object' or octet_length(p_input::text)>24000
    or p_action not in ('list','create','resend','cancel','inspect','accept','claim-send','finish-send') then
    raise exception 'TEAM_INPUT_INVALID' using errcode='22023';
  end if;
  -- Also used by identity enrollment: no parallel identity creation or team transfer.
  perform pg_advisory_xact_lock(42826004);
  now_at := clock_timestamp();
  select * into a from resolve_privy_actor(p_subject);
  if p_action not in ('inspect','accept') then
    if a.actor_ref is null or a.role<>'dispensary' or a.actor_state<>'active'
      or (a.valid_until is not null and a.valid_until<=now_at) then raise exception 'TEAM_FORBIDDEN' using errcode='42501'; end if;
    select * into m from pilot_memberships x where x.actor_ref=a.actor_ref;
    if m.organization_ref is null then raise exception 'TEAM_FORBIDDEN' using errcode='42501'; end if;
    if p_action<>'list' and m.role<>'manager' then raise exception 'TEAM_FORBIDDEN' using errcode='42501'; end if;
  end if;
  if p_action='list' then
    return jsonb_build_object('organization',(select to_jsonb(o) from pilot_organizations o where o.organization_ref=m.organization_ref),
      'membership',to_jsonb(m),
      'members',(select coalesce(jsonb_agg(jsonb_build_object('actorRef',x.actor_ref,'role',x.role,'subject',e.external_subject)), '[]'::jsonb)
        from pilot_memberships x join external_identity_bindings e on e.actor_ref=x.actor_ref and e.provider='privy' and e.state='active'
        where x.organization_ref=m.organization_ref),
      'invitations',case when m.role='manager' then (select coalesce(jsonb_agg(jsonb_build_object(
        'invitationRef',i.invitation_ref,'emailCiphertext',i.email_ciphertext,'state',case when i.state='pending' and i.expires_at<=now_at then 'expired' else i.state end,
        'expiresAt',i.expires_at,'deliveryState',j.state,'updatedAt',i.updated_at) order by i.created_at desc),'[]'::jsonb)
        from pilot_team_invitations i left join pilot_team_mail j on j.invitation_ref=i.invitation_ref and j.generation=i.generation
        where i.organization_ref=m.organization_ref) else '[]'::jsonb end);
  end if;
  if p_action in ('inspect','accept') then
    select * into inv from pilot_team_invitations i where i.token_hash=p_input->>'tokenHash' for update;
    now_at := clock_timestamp();
    if not found or not (coalesce(p_input->'emailHashes','[]'::jsonb) ? inv.email_hash) then
      raise exception 'TEAM_INVITATION_UNAVAILABLE' using errcode='42501'; end if;
    if inv.state='accepted' then
      if a.actor_ref is distinct from inv.accepted_by or a.actor_state<>'active'
        or (a.valid_until is not null and a.valid_until<=now_at)
        or not exists(select 1 from pilot_memberships x where x.actor_ref=inv.accepted_by and x.organization_ref=inv.organization_ref and x.role='operator') then
        raise exception 'TEAM_INVITATION_UNAVAILABLE' using errcode='42501'; end if;
      return jsonb_build_object('accepted',true,'organizationName',(select name from pilot_organizations where organization_ref=inv.organization_ref));
    end if;
    -- Hold the inviter's authorization stable until acceptance commits.
    perform 1 from actor_bindings b join pilot_memberships x using(actor_ref)
      join external_identity_bindings e using(actor_ref)
      where b.actor_ref=inv.invited_by and e.provider='privy' and e.state='active' for share of b,x,e;
    if not found then raise exception 'TEAM_INVITATION_UNAVAILABLE' using errcode='42501'; end if;
    now_at := clock_timestamp();
    if inv.state<>'pending' or inv.expires_at<=now_at or not exists(
      select 1 from pilot_memberships x join actor_bindings b using(actor_ref)
      where x.actor_ref=inv.invited_by and x.organization_ref=inv.organization_ref and x.role='manager'
      and b.role='dispensary' and b.state='active' and (b.valid_until is null or b.valid_until>now_at)) then
      raise exception 'TEAM_INVITATION_UNAVAILABLE' using errcode='42501'; end if;
    select name into org_name from pilot_organizations where organization_ref=inv.organization_ref;
    if p_action='inspect' then return jsonb_build_object('accepted',false,'organizationName',org_name,'expiresAt',inv.expires_at); end if;
    if p_input->>'acceptSyntheticOnly' is distinct from 'true' then raise exception 'TEAM_CONSENT_REQUIRED' using errcode='22023'; end if;
    -- Check even inactive external bindings; never recreate or reactivate a rejected identity.
    select * into identity from external_identity_bindings e where e.provider='privy' and e.external_subject=p_subject for update;
    if found then
      select * into target from actor_bindings x where x.actor_ref=identity.actor_ref for update;
      now_at := clock_timestamp();
      if identity.state<>'active' or target.role<>'dispensary' or target.state not in ('pending','active')
        or (target.valid_until is not null and target.valid_until<=now_at) then raise exception 'TEAM_ACCOUNT_CONFLICT' using errcode='42501'; end if;
    else
      perform trustleaf_private.enroll_privy_actor(p_subject,'dispensary');
      select b.* into target from actor_bindings b join external_identity_bindings e using(actor_ref)
        where e.provider='privy' and e.external_subject=p_subject for update of b;
    end if;
    perform pg_advisory_xact_lock(hashtextextended('pilot-member|'||target.actor_ref::text,0));
    if inv.expires_at<=clock_timestamp() then raise exception 'TEAM_INVITATION_UNAVAILABLE' using errcode='42501'; end if;
    if exists(select 1 from pilot_memberships x where x.actor_ref=target.actor_ref) then raise exception 'TEAM_ALREADY_MEMBER' using errcode='PT409'; end if;
    insert into pilot_staff_only(actor_ref) values(target.actor_ref) on conflict do nothing;
    update actor_bindings set state='active',version=version+1,updated_at=now_at where actor_ref=target.actor_ref and state='pending';
    insert into pilot_participants(actor_ref) values(target.actor_ref) on conflict do nothing;
    insert into pilot_memberships(actor_ref,organization_ref,role) values(target.actor_ref,inv.organization_ref,'operator');
    update pilot_team_invitations set state='accepted',accepted_by=target.actor_ref,updated_at=now_at where invitation_ref=inv.invitation_ref;
    insert into pilot_audit(actor_ref,action,resource_ref) values(target.actor_ref,'accept-operator-invitation',inv.invitation_ref);
    return jsonb_build_object('accepted',true,'organizationName',org_name);
  end if;
  ref := (p_input->>'invitationRef')::uuid;
  if p_action<>'create' then
    select * into inv from pilot_team_invitations i where i.invitation_ref=ref and i.organization_ref=m.organization_ref for update;
    if not found then raise exception 'TEAM_FORBIDDEN' using errcode='42501'; end if;
  end if;
  if p_action='claim-send' then
    select * into mail from pilot_team_mail j where j.invitation_ref=ref and j.generation=inv.generation for update;
    if inv.state<>'pending' or inv.expires_at<=now_at or mail.state in ('sent','delivered','delayed','bounced','cancelled')
      or mail.lease_until>now_at then return '{}'::jsonb; end if;
    if mail.first_attempt_at is not null and mail.first_attempt_at<now_at-interval '23 hours' then raise exception 'TEAM_RECONCILIATION_REQUIRED' using errcode='PT409'; end if;
    if mail.last_attempt_at>now_at-interval '60 seconds' then raise exception 'TEAM_SEND_LIMIT' using errcode='PT429'; end if;
    update pilot_team_mail set state='sending',first_attempt_at=coalesce(first_attempt_at,now_at),last_attempt_at=now_at,lease_until=now_at+interval '60 seconds',
      lease_ref=gen_random_uuid(),attempts=attempts+1 where mail_ref=mail.mail_ref returning * into mail;
    return to_jsonb(mail) || jsonb_build_object('email_ciphertext',inv.email_ciphertext,'organization_name',(select name from pilot_organizations where organization_ref=m.organization_ref),'expires_at',inv.expires_at);
  end if;
  if p_action='finish-send' then
    if p_input->>'state' not in ('sent','failed','uncertain') then raise exception 'TEAM_INPUT_INVALID' using errcode='22023'; end if;
    update pilot_team_mail set state=p_input->>'state',provider_ref=p_input->>'providerRef',lease_until=null
      where invitation_ref=ref and generation=inv.generation and lease_ref=(p_input->>'leaseRef')::uuid and state='sending';
    return '{}'::jsonb;
  end if;
  op := (p_input->>'operationId')::uuid;
  if op is null or p_input->>'intent' is null then raise exception 'TEAM_INPUT_INVALID' using errcode='22023'; end if;
  select * into prior from pilot_team_operations x where x.subject=p_subject and x.operation_id=op;
  if found then
    if prior.intent<>p_input->>'intent' then raise exception 'TEAM_REPLAY_CONFLICT' using errcode='PT409'; end if;
    return prior.result;
  end if;
  if p_action in ('create','resend') then
    org_limit := least(greatest(coalesce((p_input->>'orgLimit')::integer,20),1),100);
    recipient_limit := least(greatest(coalesce((p_input->>'recipientLimit')::integer,3),1),10);
    cooldown := greatest(coalesce((p_input->>'cooldownSeconds')::integer,60),60);
    if p_action='create' then
      if p_input->>'emailHash' !~ '^[a-f0-9]{64}$' then raise exception 'TEAM_INPUT_INVALID' using errcode='22023'; end if;
      select * into inv from pilot_team_invitations i where i.organization_ref=m.organization_ref and i.email_hash=p_input->>'emailHash' and i.state='pending' for update;
      if found and inv.expires_at>now_at then raise exception 'TEAM_PENDING_EXISTS' using errcode='PT409'; end if;
      if found then update pilot_team_invitations set state='cancelled',updated_at=now_at where invitation_ref=inv.invitation_ref; end if;
    elsif inv.state<>'pending' then raise exception 'TEAM_NOT_PENDING' using errcode='PT409'; end if;
    if (select count(*) from pilot_team_mail j join pilot_team_invitations i using(invitation_ref) where i.organization_ref=m.organization_ref and j.created_at>now_at-interval '24 hours')>=org_limit
      or (select count(*) from pilot_team_mail j join pilot_team_invitations i using(invitation_ref) where i.email_hash=coalesce(p_input->>'emailHash',inv.email_hash) and j.created_at>now_at-interval '24 hours')>=recipient_limit
      or exists(select 1 from pilot_team_mail j join pilot_team_invitations i using(invitation_ref) where i.email_hash=coalesce(p_input->>'emailHash',inv.email_hash) and j.created_at>now_at-make_interval(secs=>cooldown)) then
      raise exception 'TEAM_SEND_LIMIT' using errcode='PT429'; end if;
    if p_action='create' then
      insert into pilot_team_invitations(invitation_ref,organization_ref,invited_by,email_hash,email_ciphertext,token_hash,expires_at)
        values(ref,m.organization_ref,a.actor_ref,p_input->>'emailHash',p_input->>'emailCiphertext',p_input->>'tokenHash',now_at+interval '7 days') returning * into inv;
    else
      update pilot_team_mail set state='cancelled' where invitation_ref=ref and state in ('queued','sending','failed','uncertain');
      update pilot_team_invitations set token_hash=p_input->>'tokenHash',generation=generation+1,expires_at=now_at+interval '7 days',updated_at=now_at,invited_by=a.actor_ref
        where invitation_ref=ref returning * into inv;
    end if;
    insert into pilot_team_mail(invitation_ref,generation,payload_ciphertext) values(ref,inv.generation,p_input->>'payloadCiphertext');
  elsif p_action='cancel' then
    if inv.state<>'pending' then raise exception 'TEAM_NOT_PENDING' using errcode='PT409'; end if;
    update pilot_team_invitations set state='cancelled',updated_at=now_at where invitation_ref=ref;
    update pilot_team_mail set state='cancelled' where invitation_ref=ref and state in ('queued','sending','failed','uncertain');
  end if;
  r := jsonb_build_object('invitationRef',ref);
  insert into pilot_team_operations values(p_subject,op,p_input->>'intent',r);
  insert into pilot_audit(actor_ref,action,resource_ref) values(a.actor_ref,p_action||'-operator-invitation',ref);
  return r;
end $$;
revoke all on function public.trustleaf_team_invitations(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.trustleaf_team_invitations(text,text,jsonb) to service_role;

create function public.trustleaf_team_mail_event(p_event_id text,p_provider_ref text,p_state text)
returns void language plpgsql security definer set search_path=trustleaf_private,pg_temp as $$
begin
  if length(p_event_id)>200 or length(p_provider_ref)>200 or p_state not in ('sent','delivered','delayed','failed','bounced') then raise exception 'TEAM_EVENT_INVALID' using errcode='22023'; end if;
  -- A webhook can beat the HTTP response. Ask the provider to retry, without
  -- consuming its event id, until the durable send result has been recorded.
  perform 1 from pilot_team_mail where provider_ref=p_provider_ref for update;
  if not found then raise exception 'TEAM_SEND_NOT_RECORDED' using errcode='PT409'; end if;
  insert into pilot_team_webhooks(event_id) values(p_event_id) on conflict do nothing;
  if not found then return; end if;
  update pilot_team_mail set state=p_state where provider_ref=p_provider_ref and state not in ('cancelled','bounced')
    and (p_state='bounced' or state<>'delivered') and not (state in ('delayed','failed') and p_state='sent');
end $$;
revoke all on function public.trustleaf_team_mail_event(text,text,text) from public,anon,authenticated;
grant execute on function public.trustleaf_team_mail_event(text,text,text) to service_role;
commit;
