-- Qualify the conflict target: actor_ref is also a PL/pgSQL output variable.
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
  if requested_role is null or requested_role not in ('doctor', 'dispensary') then
    raise exception 'TEST_APPLICATION_ROLE_INVALID' using errcode = '22023';
  end if;
  if (requested_role = 'doctor' and (submitted_display_name, submitted_registration_reference, submitted_review_context) is distinct from ('Dra. Camila Prueba', 'TEST-RNPI-0001', 'Medicina general | Perfil de prueba'))
    or (requested_role = 'dispensary' and (submitted_display_name, submitted_registration_reference, submitted_review_context) is distinct from ('Dispensario Central Prueba', 'TEST-ISP-0001', 'Operación farmacéutica | Perfil de prueba')) then
    raise exception 'TEST_APPLICATION_PROFILE_INVALID' using errcode = '22023';
  end if;

  select * into enrolled from trustleaf_private.enroll_privy_actor(subject, requested_role);
  if enrolled.role is distinct from requested_role then
    raise exception 'TEST_APPLICATION_ROLE_CONFLICT' using errcode = '42501';
  end if;
  if enrolled.actor_state <> 'pending' then
    raise exception 'TEST_APPLICATION_NOT_PENDING' using errcode = '40001';
  end if;

  insert into professional_test_applications (actor_ref, role, display_name, registration_reference, review_context)
  values (enrolled.actor_ref, requested_role, submitted_display_name, submitted_registration_reference, submitted_review_context)
  on conflict on constraint professional_test_applications_pkey do update set
    display_name = excluded.display_name,
    registration_reference = excluded.registration_reference,
    review_context = excluded.review_context,
    version = professional_test_applications.version + 1,
    updated_at = statement_timestamp();

  return query select enrolled.actor_ref, enrolled.role, enrolled.actor_state, enrolled.valid_until;
end
$$;
