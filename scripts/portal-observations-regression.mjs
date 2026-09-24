import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('orcamentos-contratos.html','utf8');
const commercial=fs.readFileSync('js/commercial-documents-web.js','utf8');
const contractual=fs.readFileSync('js/contract-documents-web.js','utf8');
const options=fs.readFileSync('js/document-options-web.js','utf8');
const generator=fs.readFileSync('supabase/functions/generate-contract-document/index.ts','utf8');
const generatorMirror=fs.readFileSync('portal-app/supabase/functions/generate-contract-document/index.ts','utf8');
const dispatcher=fs.readFileSync('supabase/functions/dispatch-document-notifications/index.ts','utf8');
const dispatcherMirror=fs.readFileSync('portal-app/supabase/functions/dispatch-document-notifications/index.ts','utf8');
const dispatchMigration=fs.readFileSync('supabase/migrations/20260924124500_dispatch_scheduled_document_notifications.sql','utf8');
const phraseBuilder=fs.readFileSync('scripts/build-frases-do-dia-v7.mjs','utf8');
const phraseUi=fs.readFileSync('js/frase-do-dia.js','utf8');

assert.ok(html.includes('id="experienceLevelField"')&&html.includes('doc-hidden'),'Nível do orçamento precisa começar oculto e aparecer após a seleção de atividades.');
assert.ok(!/<label>Nível de prestação<\/label><select id="experienceLevel">/.test(html),'Nível voltou a aparecer no grid antes dos serviços.');
assert.ok(commercial.includes('id="openCommercialServices"')&&commercial.includes('id="commercialServiceModal"'),'Serviços propostos precisam usar botão/modal.');
assert.ok(commercial.includes('Um único nível será aplicado a todas as atividades elegíveis deste pacote'),'Pacote precisa usar um nível único.');
assert.ok(commercial.includes("if (isContract && !sources.length)"),'Contrato precisa exigir orçamento de origem.');
assert.ok(commercial.includes('Os orçamentos selecionados possuem níveis de prestação diferentes'),'Contrato precisa bloquear mistura de níveis no mesmo pacote.');
assert.ok(commercial.includes("aliases,synonyms,keywords"),'Reconhecimento de pequenos erros precisa consultar metadados canônicos do catálogo.');
assert.ok(commercial.includes('id="existingClientPicker"'),'Cliente existente precisa ficar em seletor compacto.');
assert.ok(commercial.includes("['pix', 'Pix']")&&commercial.includes("cartao_parcelado")&&commercial.includes("transferencia"),'Formas de pagamento compactas incompletas.');

assert.ok(!contractual.includes('data-scope="'),'Anexo I não pode expor nova seleção manual de escopo.');
assert.ok(contractual.includes('Somente leitura')||html.includes('Somente leitura'),'Escopo derivado precisa ser explicado como somente leitura.');
assert.ok(contractual.includes("document_acceptances")&&contractual.includes('Aceito pelo cliente'),'Admin precisa refletir manifestação do cliente.');
assert.ok(contractual.includes('id="newApprovalRequest"')&&contractual.includes("from('aprovacoes').insert"),'Termo de Aceite precisa poder ser criado sem etapa prévia.');
assert.ok(options.includes('window.CMEPrepareContractDocument=prepare'),'Fluxo de aceite precisa abrir a preparação estruturada depois da criação.');

assert.ok(contractual.includes('askSendSchedule')&&contractual.includes('Agendar envio'),'Envio agendado precisa ter interface própria, não prompt ISO.');
assert.ok(contractual.includes('Visualizado no portal'),'Admin precisa exibir leitura do documento/notificação.');

assert.ok(options.includes("acceptance_type")&&options.includes("service_completion"),'Termo de Aceite precisa permitir tipos de aceite.');
assert.ok(!options.includes("['accepted','Aceito sem ressalvas']"),'Admin não pode aceitar documento no lugar do cliente.');
assert.ok(options.includes("additional_service_code")&&options.includes("loadServiceCatalog"),'Serviço Adicional precisa usar catálogo completo.');
assert.ok(options.includes("additional_service_description")&&options.includes("textarea"),'Descrição do serviço adicional precisa ser pré-preenchível e editável.');
assert.ok(options.includes("payment_method")&&options.includes("payment-select"),'Serviço Adicional precisa registrar forma de pagamento.');
assert.ok(options.includes("data-use-now")&&options.includes("datetime-local"),'Vistoria precisa permitir data/hora atual ou seleção manual.');
for(const token of ['waterproofing','fire_safety','document_mismatch','safety_risk']){
  assert.ok(options.includes(token),`Vistoria perdeu elemento/condição: ${token}`);
}

assert.equal(generatorMirror,generator,'Gerador contratual do portal-app divergiu do canônico.');
assert.ok(generator.includes("TERMO DE ACEITE —")&&generator.includes('Portal do Cliente'),'Word do aceite precisa registrar manifestação pelo cliente no Portal.');
assert.ok(!generator.includes("☐ Aprovo a alteração acima e autorizo o início do serviço adicional"),'Word de Serviço Adicional não pode conter aceite pré-marcável pelo admin.');
assert.ok(generator.includes("TERMO DE SERVIÇO ADICIONAL")&&generator.includes("Não cria um contrato paralelo"),'Serviço Adicional precisa estar vinculado ao contrato vigente.');
assert.ok(generator.includes("dateTimePt(d.survey_datetime")&&generator.includes("Responsável pelo acompanhamento no local"),'Word de vistoria precisa usar data/hora e acompanhante.');
assert.ok(generator.includes("REGISTRO FOTOGRÁFICO")&&generator.includes("inserido manualmente neste Word"),'Registro fotográfico manual da vistoria precisa permanecer possível.');
assert.ok(generator.includes("Insumo necessário','Recebido / pendente','Observações"),'Estudo Preliminar precisa usar tabela editável para insumos.');
assert.ok(!generator.includes("Base documental: Contrato Mestre v"),'Metadado interno do Contrato Mestre vazou para o Word.');

assert.equal(dispatcherMirror,dispatcher,'Dispatcher do portal-app divergiu do canônico.');
assert.ok(dispatcher.includes("delivery_status','scheduled")&&dispatcher.includes("RESEND_API_KEY"),'Dispatcher precisa processar agendados e enviar e-mail.');
assert.ok(dispatchMigration.includes("cme-document-notification-dispatch")&&dispatchMigration.includes("vault.decrypted_secrets"),'Agendamento automático precisa usar Cron + Vault.');
assert.ok(generator.includes("client_released_at")&&generator.includes("sendClientDocumentEmail"),'Envio imediato precisa liberar documento e disparar e-mail.');

assert.ok(phraseBuilder.includes('build-frases-do-dia-fixed.mjs'),'Build voltou a substituir o banco multi-autores por conteúdo editorial único.');
assert.ok(phraseBuilder.includes('autores.size < 8'),'Build precisa falhar se perder diversidade de autores.');
assert.ok(phraseUi.includes('LIMITE_HISTORICO = 14')&&phraseUi.includes('autoresRecentes'),'Seleção diária precisa preservar histórico e evitar mesmo autor consecutivo.');

console.log('PASS: observações do portal protegidas por regressões de UI, fluxo documental, Word, notificações e frases.');
