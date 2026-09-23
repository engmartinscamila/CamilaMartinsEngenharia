import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../src/lib/commercial-service-match.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
const { normalizeServiceText, suggestCommercialServices } = await import(`data:text/javascript,${encodeURIComponent(output.outputText)}`);

const catalog = [
  { code: 'c', name: 'Projeto Legal' },
  { code: 'e', name: 'Projeto Estrutural' },
  { code: 'f', name: 'Projeto Elétrico' },
  { code: 'g', name: 'Projeto Hidrossanitário' },
  { code: 'o', name: 'Laudo técnico / avaliação / vistoria' },
  { code: 't', name: 'Reforma / adequação de edificação', aliases: ['reforma residencial', 'reforma comercial'], synonyms: ['projeto de reforma'], keywords: ['adequação', 'intervenção'] },
];
let checks = 0;
const ok = (condition, message) => { assert.ok(condition, message); checks += 1; };

ok(normalizeServiceText('PROJÉTO   ELÉTRICO') === 'projeto eletrico', 'normaliza caixa, acento e espaços');
let result = suggestCommercialServices('projeto eletrco', catalog);
ok(result[0]?.code === 'f', 'erro pequeno sugere projeto elétrico');
ok(result[0]?.exact === false, 'erro ortográfico nunca é tratado como correspondência exata');
result = suggestCommercialServices('HIDROSSANITÁRIO', catalog);
ok(result[0]?.code === 'g', 'acentos e caixa não impedem sugestão');
result = suggestCommercialServices('o', catalog);
ok(result[0]?.code === 'o' && result[0]?.exact === true, 'código oficial exato pode ser sugerido');
result = suggestCommercialServices('reforma', catalog);
ok(result[0]?.code === 't', 'atividade reforma é localizada no catálogo canônico');
result = suggestCommercialServices('adequacao', catalog);
ok(result[0]?.code === 't', 'alias/sinônimo normalizado encontra reforma/adequação');
result = suggestCommercialServices('intervencao', catalog);
ok(result[0]?.code === 't', 'palavra-chave encontra a atividade sem auto seleção');
result = suggestCommercialServices('xyz totalmente diferente', catalog);
ok(result.length === 0, 'entrada sem proximidade não inventa correspondência');

// Esta função só retorna sugestões; seleção continua sendo uma ação explícita da UI.
ok(!('selected' in (suggestCommercialServices('estruturl', catalog)[0] ?? {})), 'sugestão não carrega estado de seleção automática');

console.log(`BUSCA DE SERVIÇOS: ${checks} verificações passaram.`);
