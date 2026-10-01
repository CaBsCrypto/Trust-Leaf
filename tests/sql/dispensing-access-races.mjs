import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { invitationInput, acceptanceInput } from './team-fixtures.mjs';

const literal = value => `'${String(value).replaceAll("'", "''")}'`;

// Execute the first RPC without committing, then observe the second RPC waiting
// on that backend's real business lock. No trigger or artificial lock replaces it.
async function orderedRace({ sql, connectionEnv }, name, first, second) {
  const marker = `READY_${randomUUID().replaceAll('-', '')}:`;
  const application = `pilot-access-${name}`;
  const holder = spawn(process.env.PSQL_BIN ?? 'psql', ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], {
    env: { ...process.env, ...connectionEnv, PGAPPNAME: `${application}-holder`,
      PGOPTIONS: '-c statement_timeout=20000 -c lock_timeout=15000 -c idle_in_transaction_session_timeout=20000' },
    windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
  });
  let output = '', error = '', readyTimer;
  const watchdog = setTimeout(() => holder.kill('SIGKILL'), 25000);
  holder.stderr.on('data', chunk => { error += chunk; });
  const finished = new Promise((resolve, reject) => {
    holder.once('error', reject);
    holder.once('close', code => {
      clearTimeout(watchdog);
      code === 0 ? resolve() : reject(new Error(error || `Holder exited ${code}`));
    });
  });
  // Attach rejection handlers before starting either connection.
  const completion = finished.then(() => ({ status: 'fulfilled' }), reason => ({ status: 'rejected', reason }));
  const ready = new Promise((resolve, reject) => {
    readyTimer = setTimeout(() => reject(new Error(`${name}: first RPC did not reach its transaction barrier`)), 10000);
    holder.stdout.on('data', chunk => {
      output += chunk;
      const lines = output.trim().split(/\r?\n/);
      const index = lines.findIndex(line => line.startsWith(marker));
      if (index >= 0) {
        clearTimeout(readyTimer);
        try { resolve({ pid: Number(lines[index].slice(marker.length)), result: JSON.parse(lines[index - 1]) }); }
        catch (reason) { reject(reason); }
      }
    });
    holder.once('error', reject);
    holder.once('close', () => reject(new Error(error || `${name}: holder ended before ready`)));
  });
  let follower, settled = false, commit = false;
  holder.stdin.on('error', () => {}); // The exit/error promise reports failed psql processes.
  holder.stdin.write(`begin isolation level read committed; set role service_role; ${first} select ${literal(marker)}||pg_backend_pid();\n`);
  try {
    const leader = await ready;
    follower = sql(`begin isolation level read committed; set role service_role; ${second} commit;`, application).then(
      value => { settled = true; return { status: 'fulfilled', value: JSON.parse(value) }; },
      reason => { settled = true; return { status: 'rejected', reason }; },
    );
    const deadline = Date.now() + 10000;
    while (true) {
      const blocked = await sql(`select count(*) from pg_stat_activity
        where application_name=${literal(application)} and datname=current_database() and pid<>${leader.pid} and wait_event_type='Lock'
          and ${leader.pid}=any(pg_blocking_pids(pid));`);
      if (blocked === '1') break;
      assert.equal(settled, false, `${name}: second RPC completed without waiting for the first`);
      assert.ok(Date.now() < deadline, `${name}: second RPC never waited on the first backend`);
      await new Promise(resolve => setTimeout(resolve, 25)); // Poll an observed DB condition, not an ordering delay.
    }
    commit = true;
    holder.stdin.end('commit;\n');
    const ended = await completion;
    if (ended.status === 'rejected') throw ended.reason;
    return { first: leader.result, second: await follower };
  } finally {
    clearTimeout(readyTimer);
    if (!commit) holder.stdin.end('rollback;\n');
    await completion;
    if (follower) await follower;
  }
}

export async function runDispensingAccessRaces(context) {
  const { sql, command, mutation, agenda, teamCommand } = context;
  const call = (who, action, input) => sql(`set role service_role; ${command(who, action, input)}`).then(JSON.parse);
  const actorRef = who => sql(`select actor_ref from public.trustleaf_resolve_privy_actor(${literal('did:privy:concurrency-' + who)});`);
  let fixtureIndex = 0;
  async function fixture(name) {
    const patient = `race-${name}-patient`, manager = `race-${name}-manager`, operator = `race-${name}-operator`;
    for (const [who, role] of [[patient, 'patient'], [manager, 'dispensary']]) {
      await sql(`select public.trustleaf_enroll_privy_actor(${literal('did:privy:concurrency-' + who)},${literal(role)});
        update trustleaf_private.actor_bindings set state='active' where actor_ref=(
          select actor_ref from public.trustleaf_resolve_privy_actor(${literal('did:privy:concurrency-' + who)}));`);
      await mutation(who, 'join', { acceptSyntheticOnly: true });
    }
    const organizationRef = (await call(manager, 'create-organization', { name: `Synthetic access race ${name}` })).resourceRef;
    const invitation = invitationInput();
    await sql(`set role service_role; ${teamCommand(manager, 'create', invitation)}`);
    await sql(`set role service_role; ${teamCommand(operator, 'accept', acceptanceInput(invitation))}`);
    const slotRef = randomUUID(), bookingRef = randomUUID();
    const starts = Date.now() + 172800000 + fixtureIndex++ * 3600000;
    await agenda('doctor', 'publish', { slotRef, startsAt: new Date(starts).toISOString(), endsAt: new Date(starts + 1800000).toISOString() });
    await agenda(patient, 'reserve', { slotRef, bookingRef, version: 1 });
    await call('doctor', 'start-encounter', { resourceRef: bookingRef });
    await call('doctor', 'complete-encounter', { resourceRef: bookingRef, version: 1, issueTreatment: true, allowanceMg: 30000, periodCount: 3 });
    const treatmentRef = await sql(`select treatment_ref from trustleaf_private.pilot_treatments where booking_ref=${literal(bookingRef)};`);
    await call(patient, 'grant', { resourceRef: treatmentRef, organizationRef });
    const batchRef = (await call(manager, 'receive-batch', { lotCode: name, product: 'Synthetic access race flower',
      sourceReference: 'ISOLATED QA ONLY', expiresAt: '2099-01-01T00:00:00Z', quantityMg: 100000 })).resourceRef;
    const f = { patient, manager, operator, organizationRef, treatmentRef, batchRef,
      patientRef: await actorRef(patient), managerRef: await actorRef(manager), operatorRef: await actorRef(operator) };
    await call(manager, 'dispense', { resourceRef: treatmentRef, batchRef, quantityMg: 500 });
    return f;
  }
  const ledger = async f => JSON.parse(await sql(`select jsonb_build_object(
    'batch',(select to_jsonb(b) from trustleaf_private.pilot_batches b where batch_ref=${literal(f.batchRef)}),
    'treatment',(select to_jsonb(t) from trustleaf_private.pilot_treatments t where treatment_ref=${literal(f.treatmentRef)}),
    'periods',(select jsonb_agg(p order by period_index) from trustleaf_private.pilot_periods p where treatment_ref=${literal(f.treatmentRef)}),
    'deliveries',(select coalesce(jsonb_agg(d order by delivery_ref),'[]') from trustleaf_private.pilot_deliveries d where treatment_ref=${literal(f.treatmentRef)}),
    'movements',(select jsonb_agg(m order by movement_ref) from trustleaf_private.pilot_movements m where batch_ref=${literal(f.batchRef)}),
    'stock',(select sum(quantity_mg) from trustleaf_private.pilot_movements where batch_ref=${literal(f.batchRef)}),
    'used',(select coalesce(sum(quantity_mg),0) from trustleaf_private.pilot_deliveries where treatment_ref=${literal(f.treatmentRef)}),
    'grants',(select coalesce(jsonb_agg(g),'[]') from trustleaf_private.pilot_grants g where treatment_ref=${literal(f.treatmentRef)}),
    'membership',(select to_jsonb(m) from trustleaf_private.pilot_memberships m where actor_ref=${literal(f.operatorRef)}),
    'journal',(select jsonb_agg(o order by actor_ref,operation_id) from trustleaf_private.pilot_operations o
      where actor_ref in (${literal(f.patientRef)}::uuid,${literal(f.managerRef)}::uuid,${literal(f.operatorRef)}::uuid)),
    'audit',(select coalesce(jsonb_agg(a order by audit_ref),'[]') from trustleaf_private.pilot_audit a
      where resource_ref in (${literal(f.batchRef)}::uuid,${literal(f.treatmentRef)}::uuid,${literal(f.operatorRef)}::uuid)
        or resource_ref in (select delivery_ref from trustleaf_private.pilot_deliveries where treatment_ref=${literal(f.treatmentRef)}))
  );`));
  const journalCount = input => sql(`select count(*) from trustleaf_private.pilot_operations where operation_id=${literal(input.operationId)};`);
  const assertBusinessError = (reason, pattern, state) => {
    assert.match(reason.message, pattern);
    assert.match(reason.message, new RegExp(`ERROR:\\s+${state}:`), 'business SQLSTATE, never timeout/deadlock/transport failure');
  };
  const denied = async (who, input, pattern, state) => {
    await assert.rejects(call(who, 'dispense', input), reason => { assertBusinessError(reason, pattern, state); return true; });
    assert.equal(await journalCount(input), '0', 'rejected delivery has no success journal');
  };
  const assertDelivery = (before, after, count, resourceRef) => {
    assert.deepEqual(after.treatment, before.treatment, 'delivery/control change never changes treatment');
    assert.deepEqual(after.periods, before.periods, 'allowances are immutable');
    assert.equal(after.deliveries.length, before.deliveries.length + count);
    assert.equal(after.movements.length, before.movements.length + count);
    assert.equal(after.stock, before.stock - count * 1000);
    assert.equal(after.used, before.used + count * 1000);
    for (const receipt of before.deliveries) assert.deepEqual(after.deliveries.find(d => d.delivery_ref === receipt.delivery_ref), receipt);
    for (const movement of before.movements) assert.deepEqual(after.movements.find(m => m.movement_ref === movement.movement_ref), movement);
    if (count) {
      const delivery = after.deliveries.find(d => d.delivery_ref === resourceRef);
      assert.ok(delivery);
      assert.equal(delivery.quantity_mg, 1000);
      const movement = after.movements.find(m => m.delivery_ref === resourceRef);
      assert.ok(movement);
      assert.equal(movement.quantity_mg, -1000);
      assert.equal(movement.batch_ref, delivery.batch_ref);
      assert.equal(movement.operator_ref, delivery.operator_ref);
    }
    assert.equal(after.audit.filter(a => a.action === 'dispense').length, before.audit.filter(a => a.action === 'dispense').length + count);
  };

  const cases = [
    ['grant-manager', 'grant', 'manager'], ['grant-operator', 'grant', 'operator'],
    ['removal', 'removal', 'operator'], ['blocked-lot', 'lot', 'operator'],
  ];
  for (const [label, kind, role] of cases) for (const deliveryFirst of [false, true]) {
    const name = `${label}-${deliveryFirst ? 'delivery-first' : 'control-first'}`;
    const f = await fixture(name), who = f[role];
    const before = await ledger(f);
    const priorViews = [await call(f.patient, 'snapshot', {}), await call(f.manager, 'snapshot', {})];
    const delivery = { operationId: randomUUID(), resourceRef: f.treatmentRef, batchRef: f.batchRef, quantityMg: 1000 };
    let control = { operationId: randomUUID() }, controlWho, action, rejection;
    if (kind === 'grant') {
      control = { ...control, resourceRef: f.treatmentRef, organizationRef: f.organizationRef };
      controlWho = f.patient; action = 'revoke-grant'; rejection = /PILOT_GRANT_REQUIRED/;
    } else if (kind === 'removal') {
      control = { ...control, resourceRef: f.operatorRef };
      controlWho = f.manager; action = 'remove-operator'; rejection = /PILOT_FORBIDDEN|PILOT_DISPENSARY_REQUIRED/;
    } else {
      control = { ...control, resourceRef: f.batchRef, version: before.batch.version, state: 'quarantined' };
      controlWho = f.manager; action = 'set-batch-state'; rejection = /PILOT_STOCK_OR_QUOTA_CONFLICT/;
    }
    const deliverSql = command(who, 'dispense', delivery), controlSql = command(controlWho, action, control);
    const race = await orderedRace(context, name, deliveryFirst ? deliverSql : controlSql, deliveryFirst ? controlSql : deliverSql);
    assert.equal(race.first.replayed, false);
    if (!deliveryFirst || kind === 'lot') {
      assert.equal(race.second.status, 'rejected');
      assertBusinessError(race.second.reason, deliveryFirst ? /PILOT_VERSION_CONFLICT/ : kind === 'removal' ? /PILOT_FORBIDDEN/ : rejection,
        kind === 'lot' ? 'PT409' : '42501');
    } else assert.equal(race.second.status, 'fulfilled');
    assert.equal(await journalCount(delivery), deliveryFirst ? '1' : '0');
    assert.equal(await journalCount(control), deliveryFirst && kind === 'lot' ? '0' : '1');
    let after = await ledger(f);
    assertDelivery(before, after, Number(deliveryFirst), deliveryFirst ? race.first.resourceRef : undefined);
    assert.equal(after.batch.version, before.batch.version + (kind === 'lot' || deliveryFirst ? 1 : 0));
    if (deliveryFirst && kind === 'lot') {
      assert.equal(after.batch.state, 'active', 'stale-version block does not appear successful');
      assert.equal(after.audit.filter(a => a.action === action).length, before.audit.filter(a => a.action === action).length);
      const freshControl = { ...control, version: after.batch.version, operationId: randomUUID() };
      await call(controlWho, action, freshControl);
      assert.equal(await journalCount(freshControl), '1');
      const blocked = await ledger(f);
      assert.equal(blocked.batch.version, after.batch.version + 1);
      assert.deepEqual(blocked.deliveries, after.deliveries);
      assert.deepEqual(blocked.movements, after.movements);
      assertDelivery(before, blocked, 1, race.first.resourceRef);
      after = blocked;
    }
    if (kind === 'grant') assert.deepEqual(after.grants, []);
    if (kind === 'removal') assert.equal(after.membership, null);
    if (kind === 'lot') assert.equal(after.batch.state, 'quarantined');
    assert.equal(after.audit.filter(a => a.action === action).length, before.audit.filter(a => a.action === action).length + 1);

    // Neither a rejected in-flight request nor a fresh request may write after withdrawal.
    await denied(who, { ...delivery, operationId: randomUUID() }, rejection, kind === 'lot' ? 'PT409' : '42501');
    if (!deliveryFirst) await denied(who, delivery, rejection, kind === 'lot' ? 'PT409' : '42501');
    if (deliveryFirst) {
      // SQL journal recovery returns only the already committed receipt, not a new delivery.
      const recovered = await call(who, 'dispense', delivery);
      assert.equal(recovered.replayed, true);
      assert.equal(recovered.resourceRef, race.first.resourceRef);
      await assert.rejects(call(who, 'dispense', { ...delivery, quantityMg: 2000 }), reason => {
        assertBusinessError(reason, /PILOT_REPLAY_CONFLICT/, 'PT409'); return true;
      });
    }
    const views = [await call(f.patient, 'snapshot', {}), await call(f.manager, 'snapshot', {})];
    for (const [index, snapshot] of views.entries()) {
      assert.equal(snapshot.deliveries.length, after.deliveries.length);
      for (const receipt of priorViews[index].deliveries) {
        assert.deepEqual(snapshot.deliveries.find(d => d.delivery_ref === receipt.delivery_ref), receipt, 'previous receipt remains intact after withdrawal');
      }
      if (deliveryFirst) assert.equal(snapshot.deliveries.filter(d => d.delivery_ref === race.first.resourceRef).length, 1);
    }
    if (kind === 'removal') {
      const removed = await call(f.operator, 'snapshot', {});
      assert.deepEqual(removed.membership, { actor_ref: null, organization_ref: null, role: null, created_at: null },
        'removed membership preserves the existing all-null composite contract');
      for (const key of ['treatments', 'grants', 'patientProfiles', 'batches', 'movements', 'deliveries']) {
        assert.deepEqual(removed[key], [], `removed operator cannot read ${key}`);
      }
    }
    assert.deepEqual(await ledger(f), after, 'denials, recovery and reads never create movements or audit successes');
    console.log(`PASS: ${name}; independent backend wait observed, prior receipt preserved, new receipts=${Number(deliveryFirst)}, stock=${after.stock} mg, used=${after.used} mg.`);
  }
}
