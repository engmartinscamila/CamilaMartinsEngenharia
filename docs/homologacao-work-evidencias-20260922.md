# Homologação operacional da PR 19 — verificação inicial

Data: 22/09/2026. Estado: **FAIL no Gate A (equivalência estrutural)**. Este registro não constitui homologação funcional nem autorização para publicação.

## Versão e testes automatizados

- PR 19: aberta, draft, não mesclada. HEAD verificado: `1cb8a99b505bfb90b63a3f328d34675f8615b282`.
- Quatro workflows associados exatamente ao HEAD: segurança `35797890708`, documentos comerciais `35797890729`, portal-app `35797890694`, auditoria completa `35797890739`; todos `completed/success` na consulta ao GitHub Actions.
- A aprovação das suítes não demonstra login autenticado, geração pela aplicação, equivalência do banco ou isolamento de clientes no ambiente remoto.

## Gate A — comparação somente leitura

Ambientes consultados via metadados de tabelas, colunas, histórico de migrações e Security Advisor, sem ler registros de clientes:

| Verificação | Homologação `nvhjcoxnzigwwbdbhkhq` | Produção `hghtwlopqztfcosfxafd` | Resultado |
| --- | --- | --- | --- |
| Tabelas `construction_schedules` e `construction_schedule_items` | Ausentes | Presentes, versão legada | FAIL |
| Governança v3: `service_catalog`, `service_level_catalog`, `contract_master_versions`, versões e `document_rule_reviews` | Ausentes | Presentes | FAIL |
| `commercial_records` | Sem `source_project_id`, `contract_master_id`, `contract_master_version`, `smart_texts` | Colunas presentes | FAIL |
| `commercial_contract_quote_links` | Presente | Presente | PASS estrutural limitado |
| `clientes` e `projetos` | Colunas essenciais consultadas presentes | Colunas correspondentes presentes | PASS estrutural limitado |
| Security Advisor: funções SECURITY DEFINER executáveis por `authenticated` | 56 avisos | 39 avisos | PENDENTE de revisão individual |
| Security Advisor: proteção de senhas vazadas | Desativada | Desativada | PENDENTE de avaliação de plano/custo/UX |
| Security Advisor: `google_calendar_tokens` com RLS sem policy | 1 aviso informativo | Não reportado | PENDENTE de confirmar uso e intenção |

O staging possui um histórico próprio de migrações que termina em `20260921031116`; a PR contém migrações e dependências de governança e cronograma que ainda não foram aplicadas nesse banco. A diferença não pode ser resolvida aplicando apenas os 18 arquivos incrementais do cronograma: faltam as tabelas-base e colunas de governança, e o histórico remoto não espelha a sequência versionada do repositório. A base de produção contém dados reais, que não podem ser copiados para homologação.

## Resultado dos cenários do manifesto

| Gate | Resultado | Evidência e próxima condição |
| --- | --- | --- |
| A — banco, RLS, Storage, Edge, frontend do mesmo SHA | FAIL | Diferença estrutural acima; nenhum deploy ou migração executado |
| B — fluxo autenticado admin | NÃO EXECUTADO | Depende de Gate A e identidades/objetos sintéticos |
| C — cliente A/B e primeiro acesso | NÃO EXECUTADO | Depende de Gate A e identidades sintéticas |
| D — DOCX e XLSX gerados pela aplicação | NÃO EXECUTADO | Depende dos fluxos autenticados |
| E — falhas controladas e rollback | NÃO EXECUTADO | Depende de ambiente equivalente e cópia descartável para migração incompatível |
| F — segurança operacional | PARCIAL | Advisor consultado; bundle publicado, Cloudflare/WAF, controles Auth e 39 RPCs de produção ainda não homologados individualmente |
| G — desktop, mobile, temas | NÃO EXECUTADO | Depende de frontend de homologação correspondente ao SHA |

## Caminho de recuperação sem dados reais

1. Reconciliar o histórico do staging com a cadeia-base de migrações do repositório e obter snapshot **somente de esquema** da produção, incluindo funções, policies, grants, triggers e Storage; revisar diffs antes de qualquer DDL.
2. Escolher ambiente descartável isolado para ensaiar a cadeia completa sem copiar dados pessoais. Uma branch Supabase tem custo informado de US$ 0,01344/h na consulta de 22/09/2026; o manifesto exige concordância antes de criar recurso pago. A alternativa de usar o staging existente exige migração compatível, aditiva e revisada, sem pular dependências.
3. Criar admin e clientes A/B fictícios, confirmar Auth e Storage, publicar Edge e frontend de homologação do mesmo SHA, então executar Gates B–G com PASS/FAIL e evidências sanitizadas.
4. Manter a PR draft e produção intacta. As 51 decisões materiais do Contrato Mestre v3 e a autorização específica de publicação continuam reservadas à administradora.

**Conclusão:** o sistema ainda não está tecnicamente apto para deploy. Nenhum cenário remoto autenticado foi apresentado como aprovado, nenhum segredo ou dado pessoal foi incluído neste registro, e nenhum objeto do banco foi alterado por esta verificação.
