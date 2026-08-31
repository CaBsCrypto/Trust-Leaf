-- Test-only professional applications. This accepts only fixed synthetic fixtures;
-- no RUN, license, document, or real contact information is stored here.

begin;

create table trustleaf_private.professional_test_applications (
  actor_ref uuid primary key references trustleaf_private.actor_bindings(actor_ref),
  role trustleaf_private.actor_role not null check (role in ('doctor', 'dispensary')),
  display_name text not null check (char_length(display_name) between 3 and 120),
  registration_reference text not null check (registration_reference like 'TEST-%'),
  review_context text not null check (char_length(review_context) between 3 and 180),
  is_test_data boolean not null default true check (is_test_data),
  version bigint not null default 1 check (version > 0),
  submitted_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

alter table trustleaf_private.professional_test_applications enable row level security;
alter table trustleaf_private.professional_test_applications force row level security;
revoke all on trustleaf_private.professional_test_applications from public, anon, authenticated, service_role;

create or replace function trustleaf_private.submit_professional_test_application(
  subject text,
  requested_role trustleaf_private.actor_role,
  submitted_display_name text,
  submitted_registration_reference text,
  submitted_review_context text
)
returns table (actor_ref uuid, role trustleaf_private.actor_role, actor_state trustleaf_private.lifecycle_state, valid_until timestamptz)
language plpgsql security definer set search_path = trustleaf_private, pg_temp
as $$
declare enrolled record;
begin
  if requested_role not in ('doctor', 'dispensary') then
    raise exception 'TEST_APPLICATION_ROLE_INVALID' using errcode = '22023';
  end if;
  if (requested_role = 'doctor' and (submitted_display_name, submitted_registration_reference, submitted_review_context) <> ('Dra. Camila Prueba', 'TEST-RNPI-0001', 'Medicina general | Perfil de prueba'))
    or (requested_role = 'dispensary' and (submitted_display_name, submitted_registration_reference, submitted_review_context) <> ('Dispensario Central Prueba', 'TEST-ISP-0001', 'Operación farmacéutica | Perfil de prueba')) then
    raise exception 'TEST_APPLICATION_PROFILE_INVALID' using errcode = '22023';
  end if;

  select * into enrolled from trustleaf_private.enroll_privy_actor(subject, requested_role);
  if enrolled.actor_state <> 'pending' then
    raise exception 'TEST_APPLICATION_NOT_PENDING' using errcode = '40001';
  end if;

  insert into professional_test_applications (actor_ref, role, display_name, registration_reference, review_context)
  values (enrolled.actor_ref, requested_role, submitted_display_name, submitted_registration_reference, submitted_review_context)
  on conflict (actor_ref) do update set
    display_name = excluded.display_name,
    registration_reference = excluded.registration_reference,
    review_context = excluded.review_context,
    version = professional_test_applications.version + 1,
    updated_at = statement_timestamp();

  return query select enrolled.actor_ref, enrolled.role, enrolled.actor_state, enrolled.valid_until;
end
$$;

drop function if exists public.trustleaf_list_pending_privy_actors(text);
drop function if exists trustleaf_private.list_pending_privy_actors(text);

create function trustleaf_private.list_pending_privy_actors(admin_subject text)
returns table (
  actor_ref uuid,
  role trustleaf_private.actor_role,
  version bigint,
  requested_at timestamptz,
  display_name text,
  registration_reference text,
  review_context text,
  is_test_data boolean
)
language plpgsql security definer set search_path = trustleaf_private, pg_temp
as $$
begin
  if not exists (
    select 1 from external_identity_bindings i join actor_bindings a on a.actor_ref = i.actor_ref
    where i.provider = 'privy' and i.external_subject = admin_subject and i.state = 'active'
      and a.role = 'admin' and a.state = 'active'
  ) then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;

  return query
  select a.actor_ref, a.role, a.version, a.created_at,
    application.display_name, application.registration_reference, application.review_context, application.is_test_data
  from actor_bindings a
  join external_identity_bindings i on i.actor_ref = a.actor_ref
  left join professional_test_applications application on application.actor_ref = a.actor_ref
  where i.provider = 'privy' and i.state = 'active' and a.state = 'pending' and a.role in ('doctor', 'dispensary')
  order by a.created_at asc;
end
$$;

create function public.trustleaf_list_pending_privy_actors(admin_subject text)
returns table (
  actor_ref uuid,
  role text,
  version bigint,
  requested_at timestamptz,
  display_name text,
  registration_reference text,
  review_context text,
  is_test_data boolean
)
language sql security definer set search_path = pg_catalog, public
as $$
  select actor_ref, role::text, version, requested_at, display_name, registration_reference, review_context, is_test_data
  from trustleaf_private.list_pending_privy_actors(admin_subject);
$$;

create function public.trustleaf_submit_professional_test_application(
  subject text,
  requested_role text,
  submitted_display_name text,
  submitted_registration_reference text,
  submitted_review_context text
)
returns table (actor_ref uuid, role text, actor_state text, valid_until timestamptz)
language sql security definer set search_path = pg_catalog, public
as $$
  select actor_ref, role::text, actor_state::text, valid_until
  from trustleaf_private.submit_professional_test_application(
    subject,
    requested_role::trustleaf_private.actor_role,
    submitted_display_name,
    submitted_registration_reference,
    submitted_review_context
  );
$$;

revoke all on function trustleaf_private.submit_professional_test_application(text, trustleaf_private.actor_role, text, text, text) from public, anon, authenticated, service_role;
revoke all on function trustleaf_private.list_pending_privy_actors(text) from public, anon, authenticated, service_role;
revoke all on function public.trustleaf_list_pending_privy_actors(text) from public, anon, authenticated;
revoke all on function public.trustleaf_submit_professional_test_application(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.trustleaf_list_pending_privy_actors(text) to service_role;
grant execute on function public.trustleaf_submit_professional_test_application(text, text, text, text, text) to service_role;

commit;
