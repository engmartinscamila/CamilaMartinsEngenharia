-- Contrato Mestre v8: escopo, valores e parcelas no contrato principal; Anexo I só para
-- serviço adicional; brechas jurídicas fechadas (cobrança, trabalhista, abandono, limite de
-- responsabilidade, direito autoral, foro); 123 escopos reescritos em padrão único; textos
-- padronizados alinhados. Aprovado pela titular em 08/11/2026 ("pode publicar").
-- Documentos já emitidos permanecem vinculados à versão de sua emissão (cláusula 21.7).
-- O texto da v8 é obtido da v7 por substituições literais; a migração falha se algum trecho
-- não existir exatamente uma vez.

create or replace function private.v8_clean(t text) returns text language sql immutable set search_path to '' as $f$
  select rtrim(regexp_replace(btrim(regexp_replace(coalesce(t, ''), '\s+', ' ', 'g')), '\.{2,}', '.', 'g'), ' ;')
$f$;

create or replace function private.v8_sent(t text) returns text language sql immutable set search_path to '' as $f$
  select case when private.v8_clean(t) = '' or right(private.v8_clean(t), 1) = '.' then private.v8_clean(t)
              else private.v8_clean(t) || '.' end
$f$;

create or replace function private.v8_scope_text(p_code text, p_level text, p_mode text)
returns text language plpgsql stable set search_path to '' as $f$
declare
  s public.service_catalog; r public.service_level_scope_catalog;
  parts text[] := '{}'; v text; k text; seen text[] := '{}'; exc text[] := '{}'; inc text[] := '{}'; ins text[] := '{}';
  fmt text; has_extra boolean; i int := 0; lv text;
  extra constant text := $v8$A contratada prepara requerimentos, organiza documentos fornecidos pelo proprietário, protocola e acompanha a tramitação. A Prefeitura decide sobre aprovação e emissão, sem prazo garantido; topografia, planialtimetria, matrículas, certidões e laudos de terceiros são providenciados e pagos pelo cliente, assim como taxas municipais e ART.$v8$;
begin
  select * into s from public.service_catalog where code = p_code and active;
  select * into r from public.service_level_scope_catalog where service_code = p_code and level_code = p_level and active;
  if s.code is null or r.service_code is null then return null; end if;
  has_extra := (p_code || '|' || p_level) in ('k|bronze','k|ouro','k|prata','l|bronze','l|ouro','l|prata','m|bronze','m|ouro','m|prata');
  lv := case p_level when 'bronze' then 'Bronze' when 'prata' then 'Prata' when 'ouro' then 'Ouro' else initcap(p_level) end;
  for v in select x from jsonb_array_elements_text(coalesce(to_jsonb(r.included_deliverables), '[]')) with ordinality t(x, o) order by o loop
    i := i + 1; inc := inc || ('(' || i || ') ' || rtrim(private.v8_clean(v), '.'));
  end loop;
  for v in select x from (
      select x, 1 g, o from jsonb_array_elements_text(coalesce(to_jsonb(s.exclusions), '[]')) with ordinality t(x, o)
      union all
      select x, 2 g, o from jsonb_array_elements_text(coalesce(to_jsonb(r.excluded_deliverables), '[]')) with ordinality t(x, o)) z
    order by g, o loop
    k := rtrim(private.v8_clean(v), '.');
    continue when k = '' or lower(k) = any(seen)
      or lower(k) like 'serviços de outra categoria%' or lower(k) like 'serviços, visitas, aprovações%'
      or lower(k) like 'recursos visuais, visitas%' or lower(k) like 'a taxa de art legalmente exigível%'
      or (length(k) > 180 and has_extra);
    seen := seen || lower(k); exc := exc || k;
  end loop;
  for v in select x from jsonb_array_elements_text(coalesce(to_jsonb(s.client_inputs), '[]')) with ordinality t(x, o) order by o loop
    k := rtrim(private.v8_clean(v), '.');
    if k <> '' then ins := ins || k; end if;
  end loop;
  select string_agg(x, ', ' order by o) into fmt from jsonb_array_elements_text(
    case when jsonb_array_length(coalesce(to_jsonb(r.delivery_formats), '[]')) > 0 then to_jsonb(r.delivery_formats)
         else coalesce(to_jsonb(s.delivery_formats), '[]') end) with ordinality t(x, o);
  if p_mode = 'annex' then parts := parts || 'SERVIÇO ADICIONAL —'::text; end if;
  parts := parts || (s.name || ' — nível ' || lv || '.') || ('Objeto: ' || private.v8_sent(s.description));
  parts := parts || ('Entregas incluídas: ' || array_to_string(inc, '; ') || '.');
  parts := parts || ('Revisões de preferência: ' || coalesce(r.revisions_included::text, 'somente as fixadas no Quadro (sem número, nenhuma)')
     || '. Visitas: ' || case when coalesce(r.visits_included, 0) <> 0 then r.visits_included::text else 'somente as fixadas no Quadro (sem número, nenhuma)' end
     || '. Formato: ' || coalesce(nullif(fmt, ''), 'PDF') || '. Números diferentes dos indicados aqui só valem se fixados no Quadro.');
  if has_extra then parts := parts || ('Condições específicas: ' || extra); end if;
  if cardinality(ins) > 0 then parts := parts || ('O cliente fornece: ' || array_to_string(ins, '; ') || '.'); end if;
  parts := parts || ('Não inclui: ' || array_to_string(exc || array['taxas de ART e de órgãos públicos (cláusula 5.5)',
     'qualquer item não listado acima, que será serviço adicional (cláusula 1.2)'], '; ') || '.');
  parts := parts || case p_mode
     when 'contract' then 'Quantidades, prazo técnico, marco de início e valor: conforme Quadro de Condições Comerciais deste contrato.'
     when 'budget' then 'Quantidades, prazo técnico e valor: conforme esta proposta.'
     else 'Quantidades, prazo técnico, valor e parcelas: conforme quadro deste Anexo I.' end;
  return array_to_string(parts, ' ');
end
$f$;
revoke all on function private.v8_scope_text(text, text, text) from public, anon, authenticated;

do $mig$
declare
  v_body text; v_new text; rec record; v_count int; v_text public.document_text_catalog;
begin
  if exists (select 1 from public.contract_master_versions where version = 8) then
    raise notice 'Contrato Mestre v8 já existe; nada a fazer.'; return;
  end if;
  select body into v_body from public.contract_master_versions where version = 7;
  if v_body is null then raise exception 'Contrato Mestre v7 não encontrado.'; end if;
  v_new := v_body;
  for rec in select * from (values
  ($v8$1.1$v8$, $v8$de serviços técnicos de engenharia relativos ao imóvel/empreendimento identificado no Anexo I. Integram o objeto somente os serviços, etapas, entregáveis, quantidades, formatos, níveis de prestação, valores e prazos expressamente indicados no Anexo I e no orçamento comercial vinculado. O cronograma físico-financeiro completo somente integra a contratação quando constar como serviço específico no orçamento e no Anexo I.$v8$, $v8$de serviços técnicos de engenharia relativos ao imóvel/empreendimento identificado neste contrato. Integram o objeto somente os serviços, etapas, entregáveis, quantidades, formatos, níveis de prestação, revisões, visitas, valores e prazos expressamente indicados no Quadro de Condições Comerciais deste contrato ("Quadro"). O cronograma físico-financeiro completo somente integra a contratação quando constar como serviço específico no Quadro.$v8$, 0),
  ($v8$1.2$v8$, $v8$Qualquer serviço, projeto complementar, prancha adicional, detalhamento extra, compatibilização, visita, protocolo, aprovação, execução, fornecimento ou outra atividade não indicada no Anexo I será considerado SERVIÇO ADICIONAL e dependerá de orçamento prévio e aditivo ou aceite escrito antes de sua execução.$v8$, $v8$Qualquer serviço, projeto complementar, prancha adicional, detalhamento extra, compatibilização, visita, protocolo, aprovação, execução, fornecimento ou outra atividade não indicada no Quadro será considerado SERVIÇO ADICIONAL e dependerá de orçamento prévio e aceite escrito antes de sua execução. Cada serviço adicional aceito será descrito em Anexo I próprio, vinculado a este contrato, com escopo, valor, parcelas e prazo específicos.$v8$, 1),
  ($v8$1.3$v8$, $v8$Os projetos e documentos serão entregues nos formatos especificados no Anexo I.$v8$, $v8$Os projetos e documentos serão entregues nos formatos especificados no Quadro.$v8$, 2),
  ($v8$1.4$v8$, $v8$exigidos para o tipo de processo e autorizados no Anexo I.$v8$, $v8$exigidos para o tipo de processo e indicados no Quadro.$v8$, 3),
  ($v8$1.4.1$v8$, $v8$os desenhos daquele projeto efetivamente selecionados no Anexo I$v8$, $v8$os desenhos daquele projeto efetivamente selecionados no Quadro$v8$, 4),
  ($v8$1.5.1$v8$, $v8$O Anexo I reproduzirá a lista da atividade escolhida,$v8$, $v8$O Quadro reproduzirá a lista da atividade escolhida,$v8$, 5),
  ($v8$1.5.3$v8$, $v8$com denominação e formato constantes do Catálogo e do Anexo I.$v8$, $v8$com denominação e formato constantes do Catálogo e do Quadro.$v8$, 6),
  ($v8$1.6$v8$, $v8$ao orçamento e ao Anexo I contendo os serviços selecionados, o nível de cada atividade, os entregáveis, exclusões, valores e demais condições específicas.$v8$, $v8$ao orçamento e a este contrato, cujo Quadro contém os serviços selecionados, o nível de cada atividade, os entregáveis, exclusões, valores, parcelas, forma de pagamento e demais condições específicas.$v8$, 7),
  ($v8$2.1$v8$, $v8$no quadro de condições comerciais e no Anexo I, com prazos por atividade$v8$, $v8$no Quadro, com prazos por atividade$v8$, 8),
  ($v8$3.2$v8$, $v8$salvo prazo diverso indicado no próprio documento ou no Anexo I.$v8$, $v8$salvo prazo diverso indicado no próprio documento ou no Quadro.$v8$, 9),
  ($v8$4.2$v8$, $v8$quando não incluída no Anexo I, dependerá de orçamento prévio.$v8$, $v8$quando não incluída no Quadro, dependerá de orçamento prévio.$v8$, 10),
  ($v8$5.1$v8$, $v8$5.1. Pela prestação dos serviços descritos no Anexo I, o(a) CONTRATANTE pagará ao(à) CONTRATADO(A) o valor total ali detalhado, conforme parcelas e etapas nele previstas.$v8$, $v8$5.1. Pela prestação dos serviços descritos no Quadro, o(a) CONTRATANTE pagará ao(à) CONTRATADO(A) o valor total ali indicado, nas parcelas, datas de vencimento e forma de pagamento nele previstas. Serviço adicional terá valor, parcelas e vencimentos próprios, fixados no respectivo Anexo I.$v8$, 11),
  ($v8$5.2$v8$, $v8$5.2. Os pagamentos serão realizados nas datas, valores e condições pactuados. A quitação da parcela ocorrerá após a confirmação do respectivo pagamento.$v8$, $v8$5.2. Os pagamentos serão realizados nas datas, valores e condições pactuados. A quitação da parcela ocorrerá após a confirmação do respectivo pagamento e será comprovada por recibo. Havendo divergência entre a soma das parcelas e o valor total, prevalece o valor total, e a diferença será ajustada por escrito antes de qualquer cobrança.$v8$, 12),
  ($v8$5.3$v8$, $v8$Na ausência de vencimento específico no Anexo I,$v8$, $v8$Na ausência de vencimento específico no Quadro ou no Anexo I do serviço adicional,$v8$, 13),
  ($v8$6.1$v8$, $v8$6.1. O Anexo I deverá indicar, por atividade, as revisões, visitas e formatos incluídos.$v8$, $v8$6.1. O Quadro (e, para serviço adicional, o respectivo Anexo I) indicará, por atividade, as revisões, visitas e formatos incluídos; atividade sem número indicado não inclui revisão de preferência nem visita.$v8$, 14),
  ($v8$9.1$v8$, $v8$salvo se a atualização já estiver incluída no Anexo I.$v8$, $v8$salvo se a atualização já estiver incluída no Quadro.$v8$, 15),
  ($v8$14.6$v8$, $v8$inclusive contrato, orçamento, Anexo I, ART,$v8$, $v8$inclusive contrato, orçamento, Anexos I de serviços adicionais, ART,$v8$, 16),
  ($v8$21.1$v8$, $v8$21.1. Este contrato, o Anexo I, o orçamento comercial vinculado e os aditivos posteriores constituem o conjunto documental da contratação, cada qual com a função definida neste instrumento.$v8$, $v8$21.1. Este contrato, incluindo o Quadro, o orçamento comercial vinculado, os Anexos I de serviços adicionais e os aditivos posteriores constituem o conjunto documental da contratação, cada qual com a função definida neste instrumento.$v8$, 17),
  ($v8$21.5$v8$, $v8$Para escopo, quantidades, nível, entregáveis, preço e prazo específicos, prevalecerá o Anexo I e o respectivo orçamento vinculado; para condições jurídicas gerais, prevalecerá o Contrato Mestre, sem interpretação que amplie automaticamente o objeto contratado.$v8$, $v8$Para escopo, quantidades, nível, entregáveis, preço, parcelas e prazo específicos, prevalecerá o Quadro deste contrato e, para cada serviço adicional, o respectivo Anexo I; o orçamento tem função informativa e não prevalece sobre o contrato. Para condições jurídicas gerais, prevalecerá o Contrato Mestre, sem interpretação que amplie automaticamente o objeto contratado.$v8$, 18),
  ($v8$5.4$v8$, $v8$atualização monetária pelo INPC/IBGE, ou índice oficial que o substitua,$v8$, $v8$atualização monetária pelo IPCA/IBGE (art. 389, parágrafo único, do Código Civil), ou índice oficial que o substitua,$v8$, 19),
  ($v8$5.7 a 5.10 (novos)$v8$, $v8$A obrigação de corrigir defeitos imputáveis à própria CONTRATADA não é transferida ao(à) CONTRATANTE.$v8$, $v8$A obrigação de corrigir defeitos imputáveis à própria CONTRATADA não é transferida ao(à) CONTRATANTE.
5.7. Este contrato, assinado pelas partes, constitui título executivo extrajudicial quanto às parcelas vencidas e não pagas (art. 784, III, do CPC). Assinado eletronicamente, com integridade conferida por provedor de assinatura, dispensa a assinatura de testemunhas (art. 784, § 4º, do CPC).
5.8. Vencida a parcela e decorridos 10 (dez) dias da notificação sem pagamento, a CONTRATADA poderá levar o débito a protesto e, após a comunicação prévia exigida pelo art. 43, § 2º, do CDC, quando aplicável, solicitar sua inscrição em cadastros de proteção ao crédito. A parte que der causa à cobrança judicial ou extrajudicial arcará com as despesas comprovadas e com honorários advocatícios de 10% (dez por cento) sobre o débito, direito igualmente assegurado ao(à) CONTRATANTE em caso de inadimplemento da CONTRATADA (art. 395 do Código Civil e art. 51, XII, do CDC).
5.9. Parcelas com vencimento posterior a 12 (doze) meses da assinatura serão reajustadas, a cada 12 (doze) meses, pela variação acumulada do IPCA/IBGE desde a assinatura (Lei nº 10.192/2001), mediante comunicação prévia por escrito.
5.10. Pagamento feito por terceiro sem identificação, estornado, contestado ou devolvido não produz quitação. A quitação é comprovada exclusivamente por recibo emitido pela CONTRATADA.$v8$, 20),
  ($v8$6.3$v8$, $v8$6.3. Pedidos de ajustes de preferência deverão ser encaminhados por escrito, preferencialmente de forma consolidada, em até 10 (dez) dias corridos da entrega da etapa. O silêncio poderá ser utilizado para continuidade de prazos e cobrança quando isso estiver previsto no fluxo de aceite, mas não impede a correção de vícios técnicos ou o exercício de direitos legalmente assegurados.$v8$, $v8$6.3. Pedidos de ajustes de preferência deverão ser encaminhados por escrito, de forma consolidada, em até 10 (dez) dias corridos da entrega da etapa. Decorrido esse prazo sem manifestação, a etapa será considerada recebida para fins de continuidade, prazo e cobrança. O recebimento não impede a correção de vícios técnicos nem o exercício de direitos legalmente assegurados, inclusive os do art. 26 do CDC, quando aplicável.$v8$, 21),
  ($v8$10.7 a 10.9 (novos)$v8$, $v8$A presente cláusula não amplia responsabilidade técnica para serviços que não tenham sido efetivamente contratados e assumidos.$v8$, $v8$A presente cláusula não amplia responsabilidade técnica para serviços que não tenham sido efetivamente contratados e assumidos.
10.7. A CONTRATADA presta os serviços com autonomia técnica, por meios próprios e sem subordinação, pessoalidade ou exclusividade. Não há vínculo empregatício entre as partes, nem entre o(a) CONTRATANTE e colaboradores da CONTRATADA (arts. 2º e 3º da CLT). Cada parte responde integralmente pelos encargos trabalhistas, previdenciários, fiscais e de segurança do trabalho das pessoas que contratar.
10.8. A contratação de projeto, consultoria ou acompanhamento técnico não torna a CONTRATADA empregadora, empreiteira, construtora ou responsável pela execução da obra. Trabalhadores, empreiteiros e fornecedores contratados pelo(a) CONTRATANTE são de sua exclusiva responsabilidade, inclusive quanto a registro, pagamento, saúde e segurança no trabalho, e cabe ao(à) CONTRATANTE escolher empreiteiro idôneo. Se a CONTRATADA for demandada por obrigação dessas pessoas, o(a) CONTRATANTE a ressarcirá integralmente, incluídas custas e honorários.
10.9. Em visitas ao local, o(a) CONTRATANTE garantirá acesso seguro e informará os riscos conhecidos. A CONTRATADA poderá adiar a visita, sem que isso configure atraso, quando o local não oferecer condições mínimas de segurança (NR-18).$v8$, 22),
  ($v8$11.8 (novo)$v8$, $v8$11.7. Em serviços perante órgãos públicos, fornecer tempestivamente documentos e informações exigidos e assinar requerimentos ou autorizações que dependam do(a) CONTRATANTE.$v8$, $v8$11.7. Em serviços perante órgãos públicos, fornecer tempestivamente documentos e informações exigidos e assinar requerimentos ou autorizações que dependam do(a) CONTRATANTE.
11.8. O(A) CONTRATANTE declara ser proprietário(a), possuidor(a) ou autorizado(a) a contratar serviços relativos ao imóvel e que os dados cadastrais e documentos fornecidos são verdadeiros. Declaração falsa que cause prejuízo à CONTRATADA autoriza a rescisão por justa causa, sem prejuízo da reparação cabível.$v8$, 23),
  ($v8$12.2 (novo)$v8$, $v8$mediante notificação, preservadas as obrigações já vencidas e os direitos legalmente assegurados às partes.$v8$, $v8$mediante notificação, preservadas as obrigações já vencidas e os direitos legalmente assegurados às partes.
12.2. Enquanto houver parcela vencida e não paga, a CONTRATADA poderá reter a entrega dos arquivos finais e editáveis da etapa correspondente ao débito (art. 476 do Código Civil). A retenção não alcança documentos cuja entrega seja exigida por lei, nem impede o registro de ART legalmente obrigatória.$v8$, 24),
  ($v8$13.5 (novo)$v8$, $v8$Utilização não autorizada que viole direitos de autor poderá sujeitar o responsável às medidas legais cabíveis, sem prejuízo dos direitos do(a) CONTRATANTE decorrentes da finalidade contratada.$v8$, $v8$Utilização não autorizada que viole direitos de autor poderá sujeitar o responsável às medidas legais cabíveis, sem prejuízo dos direitos do(a) CONTRATANTE decorrentes da finalidade contratada.
13.5. Projetos e desenhos técnicos são obras protegidas (art. 7º, X, da Lei nº 9.610/1998). Se o projeto for alterado sem o consentimento do autor, este poderá repudiar a autoria da versão alterada, que não poderá ser atribuída à CONTRATADA (art. 26 da mesma lei).$v8$, 25),
  ($v8$16.6 e 16.7 (novos)$v8$, $v8$a terceiro, a órgão público ou a evento de força maior.$v8$, $v8$a terceiro, a órgão público ou a evento de força maior.
16.6. Configura abandono, que autoriza a CONTRATADA a rescindir por justa causa mediante notificação, a ausência de resposta do(a) CONTRATANTE pelos canais oficiais por 60 (sessenta) dias corridos quando sua manifestação, documento ou pagamento for necessário à continuidade dos serviços. Nesse caso são devidos os serviços executados, as despesas comprovadas e a multa do item 16.4.
16.7. Em qualquer encerramento, as partes farão o acerto de contas por memória de cálculo em até 15 (quinze) dias. Valores pagos por serviços executados não são restituíveis, e os entregáveis correspondentes a valores quitados serão disponibilizados ao(à) CONTRATANTE.$v8$, 26),
  ($v8$17.4 e 17.5 (novos)$v8$, $v8$nem afasta direitos irrenunciáveis do consumidor quando aplicáveis.$v8$, $v8$nem afasta direitos irrenunciáveis do consumidor quando aplicáveis.
17.4. Quando não houver relação de consumo, a responsabilidade total da CONTRATADA por perdas e danos decorrentes deste contrato fica limitada ao valor efetivamente pago pelo(a) CONTRATANTE, excluídos lucros cessantes, perda de uma chance e danos indiretos, salvo dolo ou culpa grave (arts. 421-A e 944 do Código Civil). Esta limitação não se aplica a danos à vida, à saúde ou à segurança de pessoas.
17.5. Vício ou erro identificado deverá ser comunicado por escrito, com sua descrição, para que a CONTRATADA o corrija sem custo em prazo razoável. Correção contratada com terceiro sem essa oportunidade não será reembolsada, salvo urgência comprovada ou direito assegurado por lei, inclusive pelo CDC.$v8$, 27),
  ($v8$21.6$v8$, $v8$21.6. As partes poderão utilizar assinatura física, assinatura eletrônica ou manifestação eletrônica de vontade pelo Portal do Cliente, conforme a natureza do ato e os requisitos legais aplicáveis.$v8$, $v8$21.6. As partes poderão utilizar assinatura física, assinatura eletrônica ou manifestação eletrônica de vontade pelo Portal do Cliente, conforme a natureza do ato e os requisitos legais aplicáveis (Lei nº 14.063/2020 e MP nº 2.200-2/2001).$v8$, 28),
  ($v8$21.8 (novo)$v8$, $v8$Atualizações futuras não alterarão retroativamente documentos históricos.$v8$, $v8$Atualizações futuras não alterarão retroativamente documentos históricos.
21.8. A invalidade ou inaplicabilidade de alguma disposição não prejudica as demais, e a disposição afetada será aplicada na maior extensão permitida pela lei (art. 184 do Código Civil).$v8$, 29),
  ($v8$23.1$v8$, $v8$23.1. Eventuais controvérsias serão submetidas ao foro competente segundo a legislação processual aplicável, preservado o direito do(a) CONTRATANTE consumidor(a) ao foro de seu domicílio quando cabível. Eventual eleição expressa de foro em instrumento específico somente será válida quando legalmente admissível e não reduzir proteção obrigatória do consumidor.$v8$, $v8$23.1. Fica eleito o foro da comarca do domicílio da CONTRATADA, que guarda pertinência com o domicílio de uma das partes (art. 63, § 1º, do CPC, com a redação da Lei nº 14.879/2024). Quando o(a) CONTRATANTE for consumidor(a), poderá propor ou responder à ação no foro de seu domicílio. A eleição não impede medidas urgentes no foro do local do imóvel.$v8$, 30)) c(ref, before, after, ord) order by ord loop
    v_count := (length(v_new) - length(replace(v_new, rec.before, ''))) / length(rec.before);
    if v_count <> 1 then raise exception 'Trecho da cláusula % encontrado % vez(es); esperado 1.', rec.ref, v_count; end if;
    v_new := replace(v_new, rec.before, rec.after);
  end loop;
  if v_new ~ '\[[^]]+\]' then raise exception 'v8 contém campo provisório entre colchetes.'; end if;

  update public.contract_master_versions set active = false where active;
  insert into public.contract_master_versions(version, label, body, notes, active, effective_at)
  values (8, 'Contrato Mestre v8 — contrato principal com Quadro, Anexo I só para adicionais, cláusulas reforçadas',
          v_new,
          'Aprovado e autorizado pela titular em 08/11/2026. Escopo, valores e parcelas no Quadro do contrato; Anexo I só para serviço adicional; cobrança (CPC 784), trabalhista (CLT/OJ 191), abandono, limite de responsabilidade B2B, direito autoral (Lei 9.610), foro (Lei 14.879/2024). Versões anteriores preservadas.',
          true, now());

  -- textos padronizados
  for rec in select * from (values
  ($v8$anexo_scope_governance$v8$, $v8$O Anexo I discrimina por atividade:$v8$, $v8$O Anexo I é emitido somente para serviço adicional aceito e discrimina, por atividade adicional:$v8$),
  ($v8$notification_rule$v8$, $v8$quando houver fundamento no Contrato, no Anexo I e comunicação correspondente.$v8$, $v8$quando houver fundamento no Contrato (ou no Anexo I do serviço adicional) e comunicação correspondente.$v8$),
  ($v8$proposal_revision_rule$v8$, $v8$valem os números inseridos para cada atividade na proposta e no Anexo I, inclusive zero.$v8$, $v8$valem os números inseridos para cada atividade na proposta e reproduzidos no Quadro do contrato, inclusive zero.$v8$),
  ($v8$proposal_scope_governance$v8$, $v8$serão reproduzidos no contrato e no Anexo I.$v8$, $v8$serão reproduzidos no Quadro do contrato.$v8$),
  ($v8$acceptance_rule$v8$, $v8$arquivos nominados no Anexo I,$v8$, $v8$arquivos nominados no Quadro do contrato (ou no Anexo I do serviço adicional),$v8$),
  ($v8$level_scope_rule$v8$, $v8$No orçamento e no Anexo I devem constar$v8$, $v8$No orçamento e no Quadro do contrato devem constar$v8$),
  ($v8$anexo_revision_rule$v8$, $v8$reproduzido no quadro de quantitativos do Anexo I, inclusive zero.$v8$, $v8$reproduzido no quadro de quantitativos deste Anexo I do serviço adicional, inclusive zero.$v8$),
  ($v8$anexo_timeline_rule$v8$, $v8$são os preenchidos nas condições comerciais e reproduzidos no Anexo I.$v8$, $v8$são os preenchidos nas condições comerciais do serviço adicional e reproduzidos neste Anexo I.$v8$)) t(code, before, after) loop
    select * into v_text from public.document_text_catalog where code = rec.code and active;
    if v_text.code is null or position(rec.before in v_text.body) = 0 then
      raise exception 'Texto padronizado % sem o trecho esperado.', rec.code;
    end if;
    insert into public.document_text_catalog_versions(text_code, version, snapshot, contract_master_version)
      values (v_text.code, v_text.version, to_jsonb(v_text), v_text.last_contract_master_version)
      on conflict do nothing;
    update public.document_text_catalog set body = replace(body, rec.before, rec.after), version = version + 1,
      updated_at = now() where code = rec.code and active;
  end loop;
  update public.document_text_catalog set last_contract_master_version = 8 where active;

  -- escopos (histórico + novo texto)
  insert into public.service_level_scope_versions(service_code, level_code, version, snapshot)
    select service_code, level_code, version, to_jsonb(l) from public.service_level_scope_catalog l where active
    on conflict do nothing;
  update public.service_level_scope_catalog l set
    contract_scope = private.v8_scope_text(l.service_code, l.level_code, 'contract'),
    budget_description = private.v8_scope_text(l.service_code, l.level_code, 'budget'),
    annex_scope = private.v8_scope_text(l.service_code, l.level_code, 'annex'),
    version = l.version + 1, review_status = 'approved', updated_at = now()
  where l.active;
  if exists (select 1 from public.service_level_scope_catalog where active and (contract_scope is null or contract_scope = '')) then
    raise exception 'Escopo sem texto após a reescrita.';
  end if;

  -- catálogos alinhados à v8 e liberação da trava (pendências de revisão da v8 resolvidas pela aprovação da titular)
  update public.service_catalog set last_contract_master_version = 8 where active;
  update public.service_level_catalog set last_contract_master_version = 8 where active;
  update public.document_rule_reviews set status = 'resolved', resolved_at = now()
   where contract_master_version = 8 and status = 'pending';
  perform public.assert_document_governance_ready();
end
$mig$;

-- Ajuste aplicado logo após a v8: exclusão da atividade "af" sem referência ao Anexo I.
update public.service_catalog set exclusions = replace(exclusions::text,'Itens não previstos no orçamento e no Anexo I','Itens não previstos no Quadro do contrato')::jsonb where code='af' and active;
update public.service_level_scope_catalog set
 excluded_deliverables = replace(excluded_deliverables::text,'Itens não previstos no orçamento e no Anexo I','Itens não previstos no Quadro do contrato')::jsonb,
 contract_scope=replace(contract_scope,'Itens não previstos no orçamento e no Anexo I','Itens não previstos no Quadro do contrato'),
 budget_description=replace(budget_description,'Itens não previstos no orçamento e no Anexo I','Itens não previstos nesta proposta'),
 annex_scope=replace(annex_scope,'Itens não previstos no orçamento e no Anexo I','Itens não previstos neste Anexo I')
where active and service_code='af';
update public.document_rule_reviews set status='resolved', resolved_at=now() where contract_master_version=8 and status='pending';
