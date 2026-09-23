import assert from 'node:assert/strict';
import fs from 'node:fs';

const screen = fs.readFileSync(new URL('../src/app/admin/commercial-documents.tsx', import.meta.url), 'utf8');
const service = fs.readFileSync(new URL('../src/services/commercial-service.ts', import.meta.url), 'utf8');
const generator = fs.readFileSync(new URL('../../supabase/functions/generate-commercial-document/index.ts', import.meta.url), 'utf8');

let checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks+=1;};

ok(screen.includes("const SERVICE_LEVELS"), 'UI mantém somente Bronze, Prata e Ouro');
ok(screen.includes("selectedLevels"), 'UI guarda nível por serviço');
ok(screen.includes("levelCode: selectedLevels[item.code] ?? null"), 'snapshot recebe o nível da atividade');
ok(screen.includes("levelApplicable: item.levelApplicable"), 'UI respeita exceção configurável do catálogo');
ok(screen.includes("Nível da atividade personalizada"), 'atividade personalizada também recebe nível');
ok(!screen.includes("form.experienceLevel"), 'UI não depende mais de um nível global digitado');
ok(service.includes("levelCode?: CommercialServiceLevelCode"), 'tipo comercial transporta nível por atividade');
ok(service.includes("const compatibilityLevel"), 'campo global permanece apenas para compatibilidade histórica');
ok(service.includes("Selecione Bronze, Prata ou Ouro para o serviço"), 'criação bloqueia serviço aplicável sem nível');
ok(generator.includes("2. NÍVEIS DE PRESTAÇÃO POR ATIVIDADE"), 'Word organiza nível por atividade');
ok(!generator.includes("levelFromServices("), 'Word não usa mais o primeiro nível como regra global');

console.log(`NÍVEL POR SERVIÇO: ${checks} verificações passaram.`);
