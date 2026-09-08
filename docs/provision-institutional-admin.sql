-- One-time, user-authorized provisioning; execute only against Trust Leaf.
begin;
do $$
declare
  target_subject constant text := 'did:privy:cmtrolt0d007r0cl5vncll5e0';
  authorizer uuid;
  target_actor uuid;
  previous_hash bytea;
begin
  perform pg_catalog.pg_advisory_xact_lock(42826003);
  select a.actor_ref into authorizer
  from trustleaf_private.actor_bindings a
  join trustleaf_private.external_identity_bindings i using(actor_ref)
  where i.provider='privy' and i.external_subject='did:privy:cmtgnyjtd03400cjlm7dmt3s4'
    and i.state='active' and a.role='admin' and a.state='active';
  if authorizer is null then raise exception 'Expected existing admin missing'; end if;
  if exists(select 1 from trustleaf_private.external_identity_bindings
    where provider='privy' and external_subject=target_subject) then
    if not exists(select 1 from trustleaf_private.external_identity_bindings i
      join trustleaf_private.actor_bindings a using(actor_ref)
      where i.provider='privy' and i.external_subject=target_subject
        and i.state='active' and a.role='admin' and a.state='active') then
      raise exception 'Target has conflicting binding; no changes made';
    end if;
    return;
  end if;
  target_actor := pg_catalog.gen_random_uuid();
  insert into trustleaf_private.actor_bindings(actor_ref,auth_subject,role,state)
    values(target_actor,pg_catalog.gen_random_uuid(),'admin','active');
  insert into trustleaf_private.external_identity_bindings(provider,external_subject,actor_ref,state)
    values('privy',target_subject,target_actor,'active');
  perform pg_catalog.pg_advisory_xact_lock(42826001);
  select event_digest into previous_hash from trustleaf_private.audit_events
    order by audit_seq desc limit 1;
  insert into trustleaf_private.audit_events(actor_ref,action_code,resource_ref,outcome,previous_digest,event_digest)
    values(authorizer,'actor.admin.provision',target_actor,'allowed',previous_hash,
      pg_catalog.sha256(coalesce(previous_hash,'\x'::bytea) ||
        pg_catalog.convert_to('actor.admin.provision|authorized-cli|' || target_actor::text,'UTF8')));
end $$;
commit;
