-- Etapa 3/7: modelos de referência versionados. NÃO são cronogramas aprovados
-- nem geram atividades para clientes sem orçamento/contrato com serviço s.
CREATE TABLE IF NOT EXISTS public.construction_schedule_templates (
  template_code text NOT NULL,
  template_version integer NOT NULL CHECK(template_version > 0),
  title text NOT NULL,
  work_type text NOT NULL CHECK(work_type IN ('residential_new','renovation','partial','commercial')),
  description text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  reference_only boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(template_code,template_version)
);
CREATE TABLE IF NOT EXISTS public.construction_schedule_template_items (
  template_code text NOT NULL,
  template_version integer NOT NULL,
  code text NOT NULL,
  category text NOT NULL,
  activity text NOT NULL,
  display_order integer NOT NULL CHECK(display_order>0),
  reference_weight_percent numeric(7,3) CHECK(reference_weight_percent BETWEEN 0 AND 100),
  reference_duration_days integer CHECK(reference_duration_days>0),
  predecessor_code text,
  requires_scope_confirmation boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(template_code,template_version,code),
  UNIQUE(template_code,template_version,display_order),
  FOREIGN KEY(template_code,template_version)
    REFERENCES public.construction_schedule_templates(template_code,template_version) ON DELETE RESTRICT
);

ALTER TABLE public.construction_schedule_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.construction_schedule_template_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS construction_template_admin_read ON public.construction_schedule_templates;
CREATE POLICY construction_template_admin_read ON public.construction_schedule_templates
  FOR SELECT TO authenticated USING(public.is_portal_admin());
DROP POLICY IF EXISTS construction_template_item_admin_read ON public.construction_schedule_template_items;
CREATE POLICY construction_template_item_admin_read ON public.construction_schedule_template_items
  FOR SELECT TO authenticated USING(public.is_portal_admin());
REVOKE ALL ON public.construction_schedule_templates,public.construction_schedule_template_items FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.construction_schedule_templates,public.construction_schedule_template_items TO authenticated;

INSERT INTO public.construction_schedule_templates(template_code,template_version,title,work_type,description)
VALUES
 ('residential_reference',1,'Obra residencial nova — referência de 20 atividades','residential_new',
 'Os pesos e durações derivam do modelo residencial legado apenas como ponto de partida. Verificar quantitativos, orçamento de obra, equipe, sequência, caminho crítico e escopo antes de selecionar qualquer atividade.'),
 ('renovation_reference',1,'Reforma — atividades a selecionar e dimensionar','renovation',
 'Estrutura de sugestão, SEM pesos ou prazos definidos; fundações, estrutura e instalações somente quando contratadas.'),
 ('partial_scope',1,'Execução parcial — começar do escopo contratado','partial',
 'Não incluir etapas predeterminadas: importar e confirmar somente os itens aprovados nos documentos de origem.'),
 ('commercial_reference',1,'Obra comercial — adaptar às especialidades contratadas','commercial',
 'Biblioteca inicial vazia: atividades, pesos e durações devem ser definidos após análise do escopo e aprovações aplicáveis.')
ON CONFLICT(template_code,template_version) DO NOTHING;

INSERT INTO public.construction_schedule_template_items(
 template_code,template_version,code,category,activity,display_order,
 reference_weight_percent,reference_duration_days,predecessor_code
)
VALUES
 ('residential_reference',1,'01','Planejamento','Mobilização e planejamento executivo',1,2,3,NULL),
 ('residential_reference',1,'02','Preliminares','Serviços preliminares e canteiro',2,3,5,'01'),
 ('residential_reference',1,'03','Terreno','Terraplenagem e preparação do terreno',3,4,5,'02'),
 ('residential_reference',1,'04','Infraestrutura','Fundações',4,8,10,'03'),
 ('residential_reference',1,'05','Estrutura','Estrutura',5,12,25,'04'),
 ('residential_reference',1,'06','Vedações','Alvenaria e vedações',6,8,15,'05'),
 ('residential_reference',1,'07','Cobertura','Cobertura',7,5,10,'06'),
 ('residential_reference',1,'08','Instalações','Instalações hidrossanitárias',8,7,15,'06'),
 ('residential_reference',1,'09','Instalações','Instalações elétricas, dados e infraestrutura',9,7,15,'06'),
 ('residential_reference',1,'10','Proteção','Impermeabilização',10,4,7,'08'),
 ('residential_reference',1,'11','Revestimentos','Revestimentos internos',11,8,20,'10'),
 ('residential_reference',1,'12','Revestimentos','Revestimentos externos e fachada',12,5,12,'10'),
 ('residential_reference',1,'13','Esquadrias','Esquadrias e vidros',13,5,10,'12'),
 ('residential_reference',1,'14','Acabamentos','Forros, gesso e sancas',14,4,8,'11'),
 ('residential_reference',1,'15','Acabamentos','Pisos, soleiras e rodapés',15,5,10,'11'),
 ('residential_reference',1,'16','Acabamentos','Pintura',16,5,10,'14'),
 ('residential_reference',1,'17','Acabamentos','Louças, metais e acabamentos finais',17,3,7,'15'),
 ('residential_reference',1,'18','Externo','Área externa e paisagismo',18,2,7,'13'),
 ('residential_reference',1,'19','Qualidade','Testes, inspeções e comissionamento',19,2,5,'17'),
 ('residential_reference',1,'20','Entrega','Limpeza final, as built e entrega',20,1,3,'19'),
 ('renovation_reference',1,'01','Planejamento','Levantamento, proteção e mobilização',1,NULL,NULL,NULL),
 ('renovation_reference',1,'02','Preliminares','Demolições e remoções expressamente contratadas',2,NULL,NULL,'01'),
 ('renovation_reference',1,'03','Infraestrutura','Reparos e reforços se previstos em projeto',3,NULL,NULL,'02'),
 ('renovation_reference',1,'04','Instalações','Adequação hidrossanitária contratada',4,NULL,NULL,'02'),
 ('renovation_reference',1,'05','Instalações','Adequação elétrica e dados contratada',5,NULL,NULL,'02'),
 ('renovation_reference',1,'06','Proteção','Impermeabilização de áreas previstas',6,NULL,NULL,'04'),
 ('renovation_reference',1,'07','Vedações','Recomposição de paredes e regularizações',7,NULL,NULL,'03'),
 ('renovation_reference',1,'08','Acabamentos','Revestimentos, pisos e forros previstos',8,NULL,NULL,'06'),
 ('renovation_reference',1,'09','Esquadrias','Esquadrias e vidros contratados',9,NULL,NULL,'07'),
 ('renovation_reference',1,'10','Acabamentos','Pintura e acabamentos finais',10,NULL,NULL,'08'),
 ('renovation_reference',1,'11','Qualidade','Testes e inspeções do escopo',11,NULL,NULL,'10'),
 ('renovation_reference',1,'12','Entrega','Limpeza, documentação e entrega contratadas',12,NULL,NULL,'11')
ON CONFLICT(template_code,template_version,code) DO NOTHING;

DO $verify$
BEGIN
 IF (SELECT count(*) FROM public.construction_schedule_template_items
     WHERE template_code='residential_reference' AND template_version=1) <> 20
    OR (SELECT sum(reference_weight_percent) FROM public.construction_schedule_template_items
     WHERE template_code='residential_reference' AND template_version=1) <> 100
    OR EXISTS(SELECT 1 FROM public.construction_schedule_template_items
      WHERE template_code='renovation_reference' AND (reference_weight_percent IS NOT NULL OR reference_duration_days IS NOT NULL))
    OR EXISTS(SELECT 1 FROM public.construction_schedule_template_items
      WHERE requires_scope_confirmation=false) THEN
   RAISE EXCEPTION 'Biblioteca não confere: os modelos devem exigir validação do escopo';
 END IF;
END $verify$;

-- Prévia SEM efeitos colaterais: backend confere a contratação antes de mostrar
-- atividades sugeridas. Não gera cronograma, data, custo ou etapa automaticamente.
CREATE OR REPLACE FUNCTION public.admin_preview_full_schedule_template(
 p_project_id uuid,p_quote_record_id uuid,p_contract_record_id uuid,p_template_code text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $preview$
DECLARE v_template public.construction_schedule_templates%ROWTYPE;
DECLARE v_commercial jsonb;
BEGIN
 IF NOT public.is_portal_admin() THEN RAISE EXCEPTION 'Acesso administrativo necessário'; END IF;
 v_commercial:=public.assert_full_schedule_commercial_link(p_project_id,p_quote_record_id,p_contract_record_id);
 SELECT * INTO v_template FROM public.construction_schedule_templates
 WHERE template_code=p_template_code AND active=true ORDER BY template_version DESC LIMIT 1;
 IF v_template.template_code IS NULL THEN RAISE EXCEPTION 'Modelo de cronograma não encontrado'; END IF;
 RETURN jsonb_build_object('commercial',v_commercial,'template_code',v_template.template_code,
  'template_version',v_template.template_version,'reference_only',true,
  'requires_scope_confirmation',true,
  'items',(SELECT coalesce(jsonb_agg(jsonb_build_object(
   'code',code,'category',category,'activity',activity,'display_order',display_order,
   'reference_weight_percent',reference_weight_percent,
   'reference_duration_days',reference_duration_days,'predecessor_code',predecessor_code,
   'requires_scope_confirmation',true) ORDER BY display_order),'[]'::jsonb)
   FROM public.construction_schedule_template_items
   WHERE template_code=v_template.template_code AND template_version=v_template.template_version));
END;
$preview$;
REVOKE ALL ON FUNCTION public.admin_preview_full_schedule_template(uuid,uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_preview_full_schedule_template(uuid,uuid,uuid,text) TO authenticated;
