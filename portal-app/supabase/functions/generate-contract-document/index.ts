import { createClient } from 'supabase';
import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } });
}

function environment() {
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) throw new Error('Configuração segura do Supabase ausente.');
  return { url, anonKey, serviceKey };
}

async function requireAdmin(req: Request) {
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) throw new Error('Sessão administrativa ausente.');
  const { url, anonKey, serviceKey } = environment();
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) throw new Error('Sessão administrativa inválida.');
  const { data: isAdmin, error: adminError } = await caller.rpc('is_portal_admin');
  if (adminError || isAdmin !== true) throw new Error('Acesso administrativo necessário.');
  return {
    caller,
    service: createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }),
    user: userData.user,
  };
}

function textValue(data: Record<string, unknown>, key: string, fallback = 'Não informado') {
  const raw = data[key];
  return typeof raw === 'string' && raw.trim() ? raw.trim() : fallback;
}

function datePt(raw: unknown) {
  if (typeof raw !== 'string' || !raw) return 'Não informada';
  const date = new Date(raw);
  return Number.isNaN(date.getTime())
    ? raw
    : new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

const paragraph = (text: string, bold = false) => new Paragraph({
  spacing: { after: 120 },
  children: [new TextRun({ text, bold, font: 'Century Gothic', size: 20 })],
});

const heading = (text: string) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  spacing: { before: 220, after: 100 },
  children: [new TextRun({ text, bold: true, font: 'Century Gothic', size: 22 })],
});

function formalNotice(data: Record<string, unknown>) {
  const consequences = Array.isArray(data.consequences)
    ? data.consequences.filter((item): item is string => typeof item === 'string')
    : [];
  const days = typeof data.regularization_days === 'number' ? data.regularization_days : 3;
  const today = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date());

  const children = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [new TextRun({ text: 'NOTIFICAÇÃO FORMAL', bold: true, font: 'Century Gothic', size: 28 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [new TextRun({ text: 'Atraso / Pendência contratual', font: 'Century Gothic', size: 18 })],
    }),
    heading('1. IDENTIFICAÇÃO'),
    paragraph(`Contrato nº: ${textValue(data, 'contract_number')}`),
    paragraph('De (CONTRATADO(A)): Camila Martins Engenharia Civil'),
    paragraph(`Para (CONTRATANTE): ${textValue(data, 'client_name')}`),
    paragraph(`Projeto: ${textValue(data, 'project_name')}`),
    paragraph(`Endereço do imóvel/obra: ${textValue(data, 'property_address')}`),
    paragraph(`Data desta notificação: ${today}`),
    heading('2. MOTIVO DA NOTIFICAÇÃO'),
    paragraph('☒ Ausência de manifestação sobre etapa entregue, dentro do prazo contratual.'),
    heading('3. DESCRIÇÃO DO FATO'),
    paragraph(`Etapa/decisão aguardando manifestação: ${textValue(data, 'approval_title')}.`),
    paragraph(`Material entregue em ${datePt(data.delivered_at)}. O prazo contratual de 10 (dez) dias corridos encerrou-se em ${datePt(data.approval_due_at)} sem manifestação registrada no portal.`),
    data.approval_description
      ? paragraph(`Descrição da entrega: ${String(data.approval_description)}`)
      : paragraph('Descrição da entrega: conforme material disponibilizado pelos canais oficiais.'),
    heading('4. PRAZO PARA REGULARIZAÇÃO'),
    paragraph(`Fica concedido o prazo de ${days} (${days}) dias corridos, a contar do recebimento desta notificação, para a regularização da pendência acima descrita.`),
    heading('5. CONSEQUÊNCIAS EM CASO DE NÃO REGULARIZAÇÃO'),
    ...(consequences.length
      ? consequences.map((item) => paragraph(`☒ ${item}`))
      : [paragraph('☐ Suspensão da contagem dos prazos de execução previstos no Anexo I, sem caracterização de mora do(a) CONTRATADO(A).')]),
    heading('6. ENVIO'),
    paragraph('Esta notificação é enviada pelos canais oficiais previstos no contrato, considerando-se válida e eficaz a partir do envio, conforme as disposições contratuais aplicáveis.'),
    paragraph(''),
    paragraph('_______________________________________________'),
    paragraph('CONTRATADO(A)'),
  ];

  return new Document({ sections: [{ properties: {}, children }] });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  try {
    const { caller, service, user } = await requireAdmin(req);
    const body = await req.json();
    const documentId = typeof body.documentId === 'string' ? body.documentId : '';
    const action = body.action === 'send' ? 'send' : 'generate';
    if (!/^[0-9a-f-]{36}$/i.test(documentId)) return json({ error: 'Documento inválido.' }, 400);

    const { error: rateError } = await caller.rpc('consume_admin_rate_limit', { p_action: `contract-document-${action}` });
    if (rateError) return json({ error: 'Muitas tentativas. Aguarde antes de repetir a operação.' }, 429);

    const { data: row, error: rowError } = await service
      .from('documentos')
      .select('id, cliente_id, projeto_id, contract_id, nome, arquivo, storage_bucket, document_kind, workflow_status, generated_data, versao')
      .eq('id', documentId)
      .maybeSingle();
    if (rowError) throw rowError;
    if (!row) return json({ error: 'Documento não encontrado.' }, 404);
    if (row.document_kind !== 'notificacao_formal') return json({ error: 'Tipo de documento ainda não suportado por este gerador.' }, 400);

    if (action === 'send') {
      if (!row.arquivo || row.workflow_status === 'rascunho') return json({ error: 'Gere o Word antes de enviá-lo ao cliente.' }, 400);
      await service.from('documentos').update({ workflow_status: 'enviado' }).eq('id', row.id);
      await service.from('notificacoes').insert({
        cliente_id: row.cliente_id,
        projeto_id: row.projeto_id,
        titulo: 'Notificação formal disponível',
        mensagem: 'Uma notificação formal vinculada ao seu contrato foi disponibilizada em Documentos.',
        tipo: 'documento_contratual',
        destinatario: 'cliente',
        referencia_tipo: 'documento',
        referencia_id: row.id,
        link_path: '/(client)/documents',
        lida: false,
      });
      await service.from('audit_log').insert({
        user_id: user.id,
        action: 'send_formal_notice',
        entity_type: 'documentos',
        entity_id: row.id,
        details: { project_id: row.projeto_id, contract_id: row.contract_id },
      });
      return json({ sent: true });
    }

    const document = formalNotice((row.generated_data ?? {}) as Record<string, unknown>);
    const buffer = await Packer.toBuffer(document);
    const version = String(row.versao ?? '1.0').replace(/[^0-9.]/g, '') || '1.0';
    const path = `${row.projeto_id}/contratual/${row.id}/notificacao-formal-v${version}.docx`;
    const { error: uploadError } = await service.storage.from('documentos').upload(path, buffer, {
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      upsert: true,
    });
    if (uploadError) throw uploadError;

    const { error: updateError } = await service.from('documentos').update({
      arquivo: path,
      storage_bucket: 'documentos',
      workflow_status: 'gerado',
      generated_at: new Date().toISOString(),
    }).eq('id', row.id);
    if (updateError) throw updateError;

    await service.from('audit_log').insert({
      user_id: user.id,
      action: 'generate_formal_notice_docx',
      entity_type: 'documentos',
      entity_id: row.id,
      details: { path },
    });
    return json({ generated: true, documentId: row.id, path });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível gerar o documento.';
    return json({ error: message }, message.includes('Acesso') ? 403 : message.includes('Sessão') ? 401 : 500);
  }
});
