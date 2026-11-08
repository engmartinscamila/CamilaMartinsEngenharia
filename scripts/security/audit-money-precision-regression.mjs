import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';

// A04: Regression of the actual database failure mode. This is an isolated
// PostgreSQL fixture; it must not be taken as evidence that production is fixed.
const db = new PGlite();
try {
  await db.exec(`
    create table qa_legacy_cash (amount numeric(12,2));
    create view qa_legacy_cash_summary as select amount from qa_legacy_cash;
    insert into qa_legacy_cash(amount) values (12.345);
  `);

  const legacy = await db.query('select amount::text as amount from qa_legacy_cash');
  assert.equal(legacy.rows[0].amount, '12.35',
    'A numeric(12,2) input rounds before a row trigger can reject extra cents');

  // Production has a view depending on financeiro.valor. A direct ALTER TYPE
  // therefore cannot be claimed safe without preserving that view.
  await assert.rejects(
    db.exec('alter table qa_legacy_cash alter column amount type numeric'),
    /depend[s]? on column|depend[s]? on.*view|cannot alter type/i,
  );

  // Simulate the safe *principle* only after removing the fixture dependency.
  // A real migration must separately inventory and restore its actual views,
  // privileges, RLS properties, and other dependencies; it is not approved here.
  await db.exec(`
    drop view qa_legacy_cash_summary;
    alter table qa_legacy_cash alter column amount type numeric;
    alter table qa_legacy_cash add constraint qa_money_cents_check
      check (
        amount is null or (
          amount between -9999999999.99 and 9999999999.99
          and amount = round(amount, 2)
        )
      );
    create view qa_legacy_cash_summary as select amount from qa_legacy_cash;
  `);

  for (const invalid of ['12.345', '0.001', '-100.999', '10000000000.00']) {
    await assert.rejects(
      db.query('insert into qa_legacy_cash(amount) values ($1::numeric)', [invalid]),
      /check constraint/i,
      `A04 must reject non-cent or out-of-range value: ${invalid}`,
    );
  }
  for (const valid of ['0.00', '12.34', '-2.50', '9999999999.99']) {
    await db.query('insert into qa_legacy_cash(amount) values ($1::numeric)', [valid]);
  }

  const retained = await db.query('select amount::text as amount from qa_legacy_cash order by amount');
  assert.ok(retained.rows.some(row => row.amount === '12.35'),
    'Existing rounded value must not be silently rewritten');

  console.log('PASS A04 isolated SQL: reproduces legacy rounding and view dependency; strict unconstrained numeric + cent/range check rejects third decimals. Production remains blocked.');
} finally {
  await db.close();
}
