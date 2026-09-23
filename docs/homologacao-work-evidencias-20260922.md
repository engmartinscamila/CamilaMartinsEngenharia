# Homologação operacional da PR 19 — evidências em andamento

Atualizado em 23/09/2026. Estado: **Gate A parcial, homologação integrada bloqueada**. Ambiente gratuito existente `nvhjcoxnzigwwbdbhkhq` (staging); produção `hghtwlopqztfcosfxafd` não alterada. A PR segue draft, sem autorização de publicação.

## Versão e CI

- HEAD remoto consultado: `af90d4a39a02d55dad1538a36640286921a9facb`. As quatro suítes neste commit concluíram com `success`: regressão de orçamentos/contratos `35798934137`, segurança `35798934234`, validação portal-app `35798934124`, auditoria completa `35798934127`.
- Esse commit alterou apenas o registro inicial de evidências em relação ao SHA de código `1cb8a99b505bfb90b63a3f328d34675f8615b282`. CI verde não equivale a homologação remota autenticada.

## Mudanças efetivas somente no staging

Foram aplicadas, em ordem, as migrações agregadas `reconcile_governance_base_pr19_20260922`, `reconcile_governance_v3_prelevel_pr19_20260922`, `reconcile_legacy_schedule_base_pr19_20260922` e `reconcile_full_schedule_pr19_20260922`. A primeira reúne a base de governança `202609020*.sql`; a segunda reúne `20260915234000` e as migrações `202609210*.sql` anteriores ao alinhamento final de subtítulos; a terceira reúne as duas migrações legadas do cronograma em `portal-app`; a quarta reúne a cadeia incremental do cronograma e o reuso de cliente existente até `20260923001500`. Não houve aplicação de DDL em produção.

Uma tentativa de incluir `20260921065500_alinhar_subtitulos_pacotes_contrato_v3.sql` falhou de forma atômica com o guard `Catálogo de pacotes mudou; revisar subtítulos e versões antes da atualização`. O catálogo de níveis do staging já tinha versões diferentes das pressupostas pela migração. **Não** foram forçadas versões nem desativado o guard. O staging continua divergente na governança documental; a migração final está pendente de reconciliação específica e revisão de conteúdo.

As Edge Functions `generate-commercial-document`, `generate-commercial-document-final` e `generate-verified-construction-schedule-xlsx` foram implantadas somente no staging, a partir do código da PR e com verificação JWT habilitada. Ainda falta exercitar chamadas autenticadas e arquivos reais por meio da aplicação.

## Verificações observadas

| Item | Resultado | Limite da evidência |
| --- | --- | --- |
| Tabelas do cronograma, catálogo e colunas de governança | PARCIAL | Staging com 72 tabelas públicas, 19 serviços e 4 modelos de cronograma; versões de níveis/v3 seguem divergentes. |
| RLS das tabelas públicas consultadas | PASS estrutural | Todas habilitadas; policies e grants ainda não estão completamente comparados com produção. |
| Storage | PARCIAL | Sete buckets privados identificados; policy por objeto e arquivo sintético ainda não testados. |
| Projeto de cliente A e B | PASS limitado | SQL em sessão com papel `authenticated` e `auth.uid()` sintéticos: A enxerga seu projeto e não o de B; B enxerga o seu e não o de A; admin enxerga ambos. Não é login Auth real. |
| Inicialização de cronograma | PASS negativo limitado | A chamada por cliente sintético foi recusada (`Acesso negado`); a chamada por admin em projeto sem cronograma contratado foi recusada pelo guard comercial. Não foram criados cronogramas. |
| Revisão de regras de documentos | BLOQUEADO | 137 linhas `pending` observadas no staging; não aprovar em massa. As 51 decisões materiais v3 exigem revisão individual da administradora. |
| Security Advisor | PENDENTE | Alertas de funções `SECURITY DEFINER` executáveis precisam de triagem individual; proteção de senhas vazadas desativada e aviso de `google_calendar_tokens` com RLS sem policy. Nenhum privilégio foi revogado em massa. |

Uma simulação anterior com `BEGIN; ...; ROLLBACK` foi insuficiente para validar integralmente uma migração: o `ROLLBACK` final pode mascarar o erro intermediário no retorno da ferramenta. A tentativa real via `apply_migration` revelou o guard acima. Não usar a simulação como evidência de sucesso.

## Gates do manifesto

| Gate | Estado | Próximo requisito |
| --- | --- | --- |
| A — equivalência de banco, Storage, Edge e frontend | FAIL / PARCIAL | Resolver divergência v3 sem alterar decisões materiais; conferir constraints, policies, grants, Storage e frontend de staging do mesmo SHA. |
| B — fluxo autenticado admin | NÃO EXECUTADO | Login real, orçamento→contrato→cronograma, aprovação, medição e publicação. |
| C — cliente A/B e primeiro acesso | PARCIAL | Isolamento SQL de projetos passou; login Auth, publicações, mutações e Storage exigem testes reais. |
| D — DOCX e XLSX pela aplicação | NÃO EXECUTADO | Gerar, baixar e abrir os arquivos em staging. |
| E — falhas controladas e rollback | PARCIAL | Guards negativos do cronograma passaram; ensaio de migração incompatível em cópia descartável ainda não realizado. |
| F — segurança operacional | PARCIAL | Revisar RPCs, configuração de Auth, bundle, logs e Cloudflare/WAF. |
| G — desktop, mobile e temas | NÃO EXECUTADO | Frontend de homologação e navegação autenticada. |

**Próximo passo:** reconciliar a migração v3 com revisão explícita das versões e subtítulos, preparar frontend isolado apontado ao staging e completar os testes autenticados com usuários e arquivos sintéticos. Continuam vedados publicação, merge, cópia de dados reais e aprovação automática das 51 decisões materiais.
