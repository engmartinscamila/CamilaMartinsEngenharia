-- Contrato Mestre v9: cláusula 5.6 sem brechas sobre custos de terceiros (autorizado pela titular em 08/11/2026).
-- Aplicada em produção pelo conector; o texto da v9 é a v8 com duas substituições literais na 5.6.
do $mig$
declare v_body text; v_new text; rec record; v_count int;
begin
  if exists (select 1 from public.contract_master_versions where version = 9) then return; end if;
  select body into v_body from public.contract_master_versions where version = 8 and active;
  if v_body is null then raise exception 'Contrato Mestre v8 ativo não encontrado.'; end if;
  v_new := v_body;
  for rec in select * from (values
   ($c$relativas à legalização do imóvel, bem como pela obtenção$c$,
    $c$relativas à legalização do imóvel ou necessárias à execução do objeto, bem como pela obtenção$c$),
   ($c$Nenhuma despesa será antecipada pela CONTRATADA sem acordo escrito$c$,
    $c$Incluem-se, entre outros: estudo de solo e sondagem; levantamentos topográficos, planialtimétricos e cadastrais; projetos, laudos, ensaios e pareceres de terceiros; taxas, vistorias e licenças da Prefeitura, do Corpo de Bombeiros, da vigilância sanitária, de órgãos ambientais, de patrimônio histórico e de concessionárias; certidões, autenticações, reconhecimentos de firma, registros, cópias, plotagens e impressões; deslocamentos para fora do município da CONTRATADA quando não previstos no Quadro; e quaisquer outras taxas, emolumentos, tributos ou custos de terceiros, atuais ou futuros, necessários ao objeto e não incluídos expressamente nos honorários. Excetuam-se apenas os tributos incidentes sobre os honorários da própria CONTRATADA. Nenhuma despesa será antecipada pela CONTRATADA sem acordo escrito$c$)
  ) t(before, after) loop
    v_count := (length(v_new) - length(replace(v_new, rec.before, ''))) / length(rec.before);
    if v_count <> 1 then raise exception 'Trecho encontrado % vez(es): %', v_count, left(rec.before, 60); end if;
    v_new := replace(v_new, rec.before, rec.after);
  end loop;
  update public.contract_master_versions set active = false where active;
  insert into public.contract_master_versions(version, label, body, notes, active, effective_at)
  values (9, 'Contrato Mestre v9 — custos de terceiros e taxas sem brechas', v_new,
    'Autorizado pela titular em 08/11/2026. Cláusula 5.6 ampliada: todas as taxas, serviços e custos de terceiros necessários ao objeto ficam com o cliente, exceto tributos sobre os honorários da contratada. Demais cláusulas iguais à v8.',
    true, now());
  update public.document_text_catalog set last_contract_master_version = 9 where active;
  update public.service_catalog set last_contract_master_version = 9 where active;
  update public.service_level_catalog set last_contract_master_version = 9 where active;
  update public.document_rule_reviews set status = 'resolved', resolved_at = now()
   where contract_master_version = 9 and status = 'pending';
  perform public.assert_document_governance_ready();
end
$mig$;
