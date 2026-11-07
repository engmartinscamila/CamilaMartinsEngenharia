import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('js/financeiro-avancado.js', 'utf8');
const begin = source.indexOf('    const dataReferencia =');
const end = source.indexOf('    function clienteSupabase()', begin);
assert.ok(begin >= 0 && end > begin, 'Funções financeiras do painel legado devem existir');

class Clock extends Date {
  constructor(...args) {
    super(...(args.length ? args : ['2026-11-07T01:30:00Z']));
  }
}
const { dataReferencia, hojeIso, adicionarDiasIso } = vm.runInNewContext(
  source.slice(begin, end) + '\n({dataReferencia,hojeIso,adicionarDiasIso})',
  { Date: Clock, Intl },
);
assert.equal(hojeIso(), '2026-11-06', 'O calendário usa São Paulo, não UTC');
assert.equal(adicionarDiasIso(hojeIso(), 30), '2026-12-06');
assert.equal(adicionarDiasIso('2026-12-20', 30), '2027-01-19', 'Virada do ano correta');
assert.equal(dataReferencia({status:'pago',data_vencimento:'2026-10-01',data_pagamento:'2026-11-06'}), '2026-11-06');
assert.equal(dataReferencia({status:'pendente',data_vencimento:'2026-10-01',data_pagamento:null}), '2026-10-01');
assert.equal(dataReferencia({status:'pago',data:'2026-10-01'}), '2026-10-01', 'Legado sem data de pagamento mantém fallback');
console.log('PASS: datas e filtro mensal financeiro usam data efetiva e fuso de São Paulo.');
