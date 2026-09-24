import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');
const has = (source, value, message) => assert.ok(source.includes(value), message);
const lacks = (source, value, message) => assert.ok(!source.includes(value), message);

const sections = read('portal-app/src/lib/admin-sections.ts');
has(sections, "title: 'Contratos gerais'", 'Contratos Gerais não é o ponto de entrada nomeado.');
lacks(sections, "key: 'document-preparation'", 'Preparação documental concorrente voltou ao menu.');
has(sections, "key: 'construction-schedule-test'", 'Cronograma de teste não está disponível na navegação.');

const generated = read('portal-app/src/app/admin/contract-documents.tsx');
has(generated, 'Histórico de emissões', 'Documentos Gerados perdeu responsabilidade de histórico.');
has(generated, 'Abrir Contratos Gerais', 'Documentos Gerados não encaminha criação ao fluxo canônico.');
lacks(generated, 'prepareContractDocument', 'Documentos Gerados voltou a criar documentos por regra concorrente.');

const prep = read('portal-app/src/app/admin/document-preparation.tsx');
has(prep, "openWebsiteAdminSection('commercial-documents')", 'Rota legada web não redireciona ao fluxo canônico.');
lacks(prep, "key:'acceptance'", 'Admin voltou a escolher o aceite do cliente.');
lacks(prep, "key:'approval',label:'Aprovação'", 'Admin voltou a pré-aprovar Serviço Adicional.');

const approvals = read('portal-app/src/app/(client)/approvals.tsx');
for (const status of ["'aprovado'", "'aprovado_com_ressalvas'", "'rejeitado'"]) has(approvals, status, `Manifestação ${status} ausente no portal do cliente.`);
has(approvals, 'Aceitar com ressalvas', 'Portal não oferece aceite com ressalvas.');
has(approvals, 'title="Recusar"', 'Portal não oferece recusa explícita.');

const approvalService = read('portal-app/src/services/portal-service.ts');
has(approvalService, "'aprovado_com_ressalvas'", 'Serviço do portal não aceita ressalvas.');

const notificationUuidFix = read('supabase/migrations/20260924154500_fix_notification_reference_uuid.sql');
has(notificationUuidFix, "'document_acceptance',v_id", 'Aceite documental voltou a gravar referencia_id como texto.');
has(notificationUuidFix, "'cliente','documento',d.id", 'Liberação documental voltou a gravar referencia_id como texto.');

const acceptanceMigration = read('supabase/migrations/20260924153000_acceptance_three_states.sql');
has(acceptanceMigration, "'aprovado_com_ressalvas'", 'Migration não protege os três estados de aceite.');
has(acceptanceMigration, 'v_client_id', 'Aceite não está vinculado à identidade do cliente.');

const serviceLevels = read('portal-app/src/app/admin/service-level-governance.tsx');
has(serviceLevels, 'expandedServices', 'Serviços não são recolhíveis.');
has(serviceLevels, 'expandedLevels', 'Níveis não são recolhíveis individualmente.');
for (const filter of ['serviceFilter', 'categoryFilter', 'levelFilter']) has(serviceLevels, filter, `Filtro ${filter} ausente.`);

const adminApprovals = read('portal-app/src/app/admin/approvals.tsx');
for (const label of ['Projeto / contrato', 'O que o cliente deverá aprovar?', 'Objeto específico', 'Documento relacionado', 'Prazo para manifestação']) has(adminApprovals, label, `Aprovações guiadas perderam “${label}”.`);
for (const label of ["['Material', 'Material']", "['Acabamento', 'Acabamento']"]) has(adminApprovals, label, `Aprovações guiadas perderam a opção ${label}.`);

const diary = read('portal-app/src/app/admin/work-diary.tsx');
has(diary, 'teamBreakdown', 'Diário não possui equipe estruturada.');
has(diary, 'Horário registrado automaticamente', 'Horário automático do diário não está claro.');
has(diary, 'Gerar PDF', 'Relatório PDF do diário desapareceu.');

const procurement = read('portal-app/src/app/admin/procurement.tsx');
has(procurement, '<DateField label="Prazo para receber propostas"', 'Cotação não usa seletor de data.');
has(procurement, "'Outra'", 'Cotação não permite unidade “Outra”.');
has(procurement, 'customPaymentTerms', 'Cotação não permite especificar outro pagamento.');

const finance = read('portal-app/src/app/admin/financial.tsx');
has(finance, 'Taxa horária padrão', 'Financeiro não permite taxa horária padrão.');
has(finance, 'updateAdminFinancialPreferences', 'Taxa horária não é persistida.');
has(finance, 'não calcula nem inventa valor profissional', 'Aviso contra valor profissional inventado desapareceu.');

const portalPreview = read('portal-app/src/app/admin/portal-control.tsx');
has(portalPreview, 'Visualizar como este cliente', 'Prévia real do cliente ausente.');
has(portalPreview, 'somente leitura', 'Prévia não declara modo somente leitura.');
has(portalPreview, 'previewData', 'Prévia voltou a mostrar somente contadores.');

const security = read('portal-app/src/app/admin/security.tsx');
has(security, 'showProjectUsage', 'Uso por projeto não é recolhível.');
has(security, 'showAudit', 'Auditoria não é recolhível.');
for (const filter of ['auditPeriodDays', 'auditAction', 'auditUser', 'auditProject', 'auditType']) has(security, filter, `Filtro de auditoria ${filter} ausente.`);

const scheduleTest = read('portal-app/src/app/admin/construction-schedule-test.tsx');
has(scheduleTest, 'TESTE / NÃO CONTRATUAL', 'Cronograma sandbox não está marcado como teste.');
has(scheduleTest, 'planConstructionSchedule', 'Sandbox não usa o motor real de planejamento.');
has(scheduleTest, 'analyzeConstructionCriticalPath', 'Sandbox não testa caminho crítico.');
has(scheduleTest, 'Curva S TESTE', 'Sandbox não testa Curva S.');
has(scheduleTest, 'Gerar Excel TESTE', 'Sandbox não oferece Excel isolado.');

const additionalScheduleGuardFix = read('supabase/migrations/20260924160000_fix_additional_service_schedule_guard.sql');
has(additionalScheduleGuardFix, "authorization_type'='servico_adicional_aceito", 'Guard do cronograma não reconhece autorização por Serviço Adicional aceito.');
has(additionalScheduleGuardFix, 'assert_full_schedule_additional_service', 'Guard não revalida o Serviço Adicional aceito.');
has(additionalScheduleGuardFix, 'assert_full_schedule_commercial_link', 'Guard perdeu a validação ORC + CON do fluxo original.');
has(additionalScheduleGuardFix, 'quote_record_id is not null', 'Guard não protege os IDs comerciais nulos no fluxo posterior.');

const additionalScheduleFix = read('supabase/migrations/20260924155500_fix_additional_service_schedule_save.sql');
has(additionalScheduleFix, "authorization_type'='servico_adicional_aceito", 'Cronograma posterior não reconhece autorização por Serviço Adicional aceito.');
has(additionalScheduleFix, 'assert_full_schedule_additional_service', 'Cronograma posterior não revalida o Serviço Adicional aceito.');
has(additionalScheduleFix, 'assert_full_schedule_commercial_link', 'Cronograma original perdeu a validação ORC + CON.');

const scheduleFunction = read('portal-app/supabase/functions/generate-construction-schedule-test-xlsx/index.ts');
has(scheduleFunction, 'persisted:false', 'Gerador sandbox não declara ausência de persistência.');
lacks(scheduleFunction, ".from('", 'Gerador sandbox não deve gravar tabelas do projeto.');
has(scheduleFunction, 'is_portal_admin', 'Gerador sandbox precisa exigir admin.');

const finalGenerator = read('portal-app/supabase/functions/generate-contract-document-final/index.ts');
lacks(finalGenerator, "if(!text(o.acceptance))", 'Gerador final voltou a exigir aceite escolhido pelo admin.');
has(finalGenerator, "nativeKinds.has", 'Gerador final não aplica renderer nativo aos documentos opcionais.');

const native = read('portal-app/supabase/functions/generate-contract-document-final/native-options-docx.ts');
has(native, '<w14:checkbox>', 'Checkbox Word não usa controle OOXML real.');
has(native, 'Aceito com ressalvas.', 'Termo Word não contém aceite com ressalvas.');
has(native, 'Recuso esta entrega.', 'Termo Word não contém recusa.');
for (const key of ['sanitary','masonry','waterproofing','facade','accessibility','fire_safety','dimensions','equipment','safety_risk','no_anomaly']) has(native, key, `Vistoria incompleta: ${key} ausente.`);

const phrases = JSON.parse(read('assets/frases-do-dia.json'));
assert.ok(Array.isArray(phrases.frases) && phrases.frases.length >= 700, 'Acervo de frases não contém centenas de itens.');
const authors = new Set(phrases.frases.map((item) => item.autor).filter(Boolean));
assert.ok(authors.size >= 8, 'Acervo continua sem diversidade de autores.');
assert.ok(authors.has('Camila Martins'), 'Camila Martins desapareceu do acervo.');
const phraseKeys = phrases.frases.map((item) => `${String(item.autor).trim()}::${String(item.texto).trim().toLocaleLowerCase('pt-BR')}`);
assert.equal(new Set(phraseKeys).size, phraseKeys.length, 'Acervo contém duplicata exata autor + frase.');

const phraseRuntime = read('js/frase-do-dia.js');
has(phraseRuntime, 'America/Sao_Paulo', 'Frase do dia não usa America/Sao_Paulo.');
has(phraseRuntime, 'autoresRecentes', 'Frase do dia não mantém histórico de autores.');
has(phraseRuntime, 'LIMITE_HISTORICO', 'Frase do dia não evita repetição recente.');

console.log('Regressão de finalização: OK');
