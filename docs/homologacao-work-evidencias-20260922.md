# Homologação operacional da PR 19 — evidências em andamento

Atualizado em 23/09/2026. Estado: **Gate A parcial, homologação integrada bloqueada**. Ambiente gratuito existente `nvhjcoxnzigwwbdbhkhq` (staging); produção `hghtwlopqztfcosfxafd` não alterada. A PR segue draft, sem autorização de publicação.

## Versão e CI

- HEAD remoto anterior consultado: `ca469a8c44831d84b16c531e9aa38f6a323e2965`. As quatro suítes neste commit concluíram com `success`: regressão de orçamentos/contratos `35800410779`, segurança `35800410733`, validação portal-app `35800410714`, auditoria completa `35800410741`. Um novo commit documental requer CI novo no SHA final.
- Esse commit alterou apenas o registro inicial de evidências em relação ao SHA de código `1cb8a99b505bfb90b63a3f328d34675f8615b282`. CI verde não equivale a homologação remota autenticada.

## Mudanças efetivas somente no staging

Foram aplicadas, em ordem, as migrações agregadas `reconcile_governance_base_pr19_20260922`, `reconcile_governance_v3_prelevel_pr19_20260922`, `reconcile_legacy_schedule_base_pr19_20260922` e `reconcile_full_schedule_pr19_20260922`. A primeira reúne a base de governança `202609020*.sql`; a segunda reúne `20260915234000` e as migrações `202609210*.sql` anteriores ao alinhamento final de subtítulos; a terceira reúne as duas migrações legadas do cronograma em `portal-app`; a quarta reúne a cadeia incremental do cronograma e o reuso de cliente existente até `20260923001500`. Não houve aplicação de DDL em produção.

Uma tentativa de incluir `20260921065500_alinhar_subtitulos_pacotes_contrato_v3.sql` falhou de forma atômica com o guard `Catálogo de pacotes mudou; revisar subtítulos e versões antes da atualização`: o staging já tinha versões 4, enquanto a migração pressupõe versões 2. Com autorização expressa da administradora, foi aplicada somente no staging a migração protegida `reconcile_three_existing_levels_v3_staging_20260923` (`20260923001003`). Ela mantém exatamente os três códigos existentes: Bronze/Essencial v4 sem alteração, Prata/Ampliado v5 e Ouro/Completo v5. Os subtítulos correspondem ao Contrato Mestre v3 e não criam novos níveis ou serviços. A atualização exigiu estado anterior exato, incrementou versões e registrou auditoria; não alterou snapshots emitidos nem aprovou revisões. O histórico do staging permanece diferente do de produção e precisa de comparação antes de qualquer deploy.

As Edge Functions `generate-commercial-document`, `generate-commercial-document-final` e `generate-verified-construction-schedule-xlsx` foram implantadas somente no staging, a partir do código da PR e com verificação JWT habilitada. Ainda falta exercitar chamadas autenticadas e arquivos reais por meio da aplicação.

## Verificações observadas

| Item | Resultado | Limite da evidência |
| --- | --- | --- |
| Tabelas do cronograma, catálogo e colunas de governança | PARCIAL | Staging com 72 tabelas públicas, 19 serviços, 4 modelos de cronograma e três níveis ativos com os subtítulos v3; numeração histórica de versões difere da produção. |
| RLS das tabelas públicas consultadas | PASS estrutural | Todas habilitadas; policies e grants ainda não estão completamente comparados com produção. |
| Storage | PARCIAL | Sete buckets privados identificados; policy por objeto e arquivo sintético ainda não testados. |
| Projeto de cliente A e B | PASS limitado | SQL em sessão com papel `authenticated` e `auth.uid()` sintéticos: A enxerga seu projeto e não o de B; B enxerga o seu e não o de A; admin enxerga ambos. Não é login Auth real. |
| Inicialização de cronograma | PASS negativo limitado | A chamada por cliente sintético foi recusada (`Acesso negado`); a chamada por admin em projeto sem cronograma contratado foi recusada pelo guard comercial. Não foram criados cronogramas. |
| Revisão de regras de documentos | BLOQUEADO | 145 linhas `pending` e zero `approved` observadas no staging após o alinhamento dos níveis; não aprovar em massa. As 51 decisões materiais v3 exigem revisão individual da administradora. |
| Security Advisor | PENDENTE | Alertas de funções `SECURITY DEFINER` executáveis precisam de triagem individual; proteção de senhas vazadas desativada e aviso de `google_calendar_tokens` com RLS sem policy. Nenhum privilégio foi revogado em massa. |

Uma simulação anterior com `BEGIN; ...; ROLLBACK` foi insuficiente para validar integralmente uma migração: o `ROLLBACK` final pode mascarar o erro intermediário no retorno da ferramenta. A tentativa real via `apply_migration` revelou o guard acima. Não usar a simulação como evidência de sucesso.

## Gates do manifesto

| Gate | Estado | Próximo requisito |
| --- | --- | --- |
| A — equivalência de banco, Storage, Edge e frontend | FAIL / PARCIAL | Subtítulos v3 alinhados nos três níveis; conferir constraints, policies, grants, Storage e frontend de staging do mesmo SHA. |
| B — fluxo autenticado admin | NÃO EXECUTADO | Login real, orçamento→contrato→cronograma, aprovação, medição e publicação. |
| C — cliente A/B e primeiro acesso | PARCIAL | Isolamento SQL de projetos passou; login Auth, publicações, mutações e Storage exigem testes reais. |
| D — DOCX e XLSX pela aplicação | NÃO EXECUTADO | Gerar, baixar e abrir os arquivos em staging. |
| E — falhas controladas e rollback | PARCIAL | Guards negativos do cronograma passaram; ensaio de migração incompatível em cópia descartável ainda não realizado. |
| F — segurança operacional | PARCIAL | Revisar RPCs, configuração de Auth, bundle, logs e Cloudflare/WAF. |
| G — desktop, mobile e temas | NÃO EXECUTADO | Frontend de homologação e navegação autenticada. |

**Próximo passo:** preparar frontend isolado apontado ao staging e completar os testes autenticados com usuários e arquivos sintéticos. Acesso ao painel Supabase pela opção GitHub escolhida pela usuária chegou à tela GitHub, que respondeu `This account does not support password sign-in, please try another sign-in method or account recovery.` Nenhuma chave pública foi obtida e nenhum login no painel foi confirmado. A leitura ampla da página de chaves foi rejeitada pela revisão automática por poder expor material secreto; após autorização, a navegação foi permitida, mas uma tentativa de snapshot amplo foi novamente rejeitada. Somente um localizador estreito da chave pública será usado após autenticação. Continuam vedados publicação, merge, cópia de dados reais e aprovação automática das 51 decisões materiais.
