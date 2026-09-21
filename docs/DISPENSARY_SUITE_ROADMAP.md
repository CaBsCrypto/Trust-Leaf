# Dispensary suite: staged implementation

Scope approved 2026-09-21: one site, manager and operators, synthetic data.
The master evidence record remains TRUSTLEAF_MASTER_PLAN.md. This document is
the delivery checklist, not a claim of production readiness.

## Phase 0: consolidate and prepare

- Preserve B, its clinical grants, receipts and stock. No production writes
  performed by this delivery.
- Demo identities and organization are seeded only in the loopback QA server
  when VITE_COMMERCE_CATALOG_ENABLED=true. They cannot authenticate in production.
- Keep the external-browser native date selector investigation open.
- Business model, product equivalence and real adoption requirements remain
  discovery items; a delivery is not automatically a sale.

## Phase 1: catalog, suppliers, receipt

Implemented on feature branch:
- Separate typed commerce contracts and /api/dispensary-commerce routing.
- Private products, suppliers, batch links, receipts and operation journal.
- Organization-scoped pagination; manager-only supplier contacts and costs.
- Versioned edits, archive, explicit legacy-batch linking without stock changes.
- Receipt delegates to existing pilot transaction; no parallel inventory or
  automatic cash entry. Failure rolls back receipt, batch and movement together.
- Management UI behind separate disabled-by-default client/server flags.
- Local SQL-backed demonstration and both-role responsive browser tests.

Remaining before Phase 1 closure:
- Independent PostgreSQL concurrency, full CI and preview review.
- Expand browser negative scenarios: removal, uncertain response, pagination,
  supplier archive and error recovery; confirm keyboard/focus behavior.
- Review long-list selection and display of linked legacy batches in Inventory.
- Remote migration history, encrypted backup and isolated restoration approval.
- Apply ONLY 20260921010000_dispensary_commerce.sql after the gates pass;
  the monthly quota draft is excluded.
- Publish disabled, verify hosted API, then explicitly enable the demo module.
- Create hosted demo organization through approved panel identities, never by
  copying production clinical data or inventing accounts.

## Phase 2: purchase orders

Manager-only internal orders with draft, open, partial, received and cancelled
states. Product lines retain ordered/received quantities. Partial receipt uses
the existing commerce receipt transaction and cannot exceed the pending quantity.
Increasing an order requires an explicit versioned audited edit. Cancelling a
partial order cancels only its remainder. No supplier email, debt or payment.

## Phase 3: optional commercial documents

One recoverable document per delivery, applied CLP price retained, no duplicate
stock or quota movement. No patient profile copied into commercial documents.
Reference price is CLP per gram; calculate from integer milligrams on the server
and round once to the nearest whole peso. Persist the applied price and amount.
Not implemented in Phase 1. No invoice, tax, discount or credit functionality.

## Phase 4: simulated cash desk

One open shift per site; manager opens/closes, operator records permitted
payments. Cash, transfer and card are declared records, not bank confirmation.
Expected cash = opening + net cash payments + justified cash entries - exits.
Audited compensating reversals never restore stock or medical quota.
No payment gateway or card data. Concurrency and lost-response tests required.
One complete payment per document using one method; no split or partial payments.
Closed shifts cannot be edited. Transfers and cards are separate declared totals.

## Phase 5: physical counts

Manager starts, captures, confirms or cancels. Lock the selected batches against
all movements, including the existing pilot API, until closure or cancellation.
No timeout unlock and no overlapping open counts. Quantity differences require
reasons; compensating movements and unlock are atomic and idempotent. Cancellation
unlocks without changing stock. Medical allowances never change with a count.

## Phase 6: daily workspace and reports

Home uses persisted low-stock thresholds, 30-day expirations and open shift.
Responsive navigation becomes Inicio, Atenciones, Inventario, Caja, Historial,
Gestion. Do not add empty modules before their behavior exists.
Reports cover receipts, outstanding orders, deliveries, stock movements,
payments by method and cash closure. Costs and cash reconciliation are manager-only.
Unsaved forms require discard confirmation; uncertain writes retain their retry.

## Phase 7: accompanied presentation

Use a durable demonstration database and separate authenticated accounts, not
the ephemeral local QA fixture. Demonstrate purchase -> partial receipt ->
attend -> optional simulated payment -> find receipt -> count -> close shift.
Capture observations separately from technical evidence. Preserve B throughout.

## First-dispensary discovery

Confirm sale/contribution/membership model, units and equivalence, source of
stock, exceptions, job responsibilities, reports and existing tools to replace.
Defer memberships, physical returns, integrated payments,
tax documents, import tools, barcodes and multiple sites until requirements
are confirmed. Demo acceptance does not authorize real healthcare or commerce.

## Recovery

Disable TRUSTLEAF_COMMERCE_CATALOG_ENABLED and VITE_COMMERCE_CATALOG_ENABLED,
redeploy, retain all records. Existing clinical and team APIs remain unchanged.
Do not remove private tables to roll back a UI defect.
