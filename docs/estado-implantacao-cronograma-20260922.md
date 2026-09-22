# Cronograma físico-financeiro — estado verificável em 22/09/2026

## Alterações executadas somente na PR #19

- Serviço opcional contratado (`s`), validação ORC→CON→projeto e vínculo com documentos; modelos de quatro naturezas usados apenas como referência, sem injetar 20 atividades em qualquer obra.
- Plano com custos de execução separados dos honorários, pesos financeiros, dependências, cálculo de datas, revisão de atividades e aprovação com snapshot congelado; pendem pesos físicos independentes e feriados persistidos.
- Medições efetivas com data, responsável e justificativa, sem inventar histórico. Bloqueio adicional de UPDATE direto nos campos reais de linhas aprovadas: migration `20260922005000`, regressão SQL real em PGlite.
- Exportador novo XLSX de cronograma aprovado, com oito abas, gráfico visual Curva S, linha de base, Gantt, medições históricas e controles de acesso; não há comprovação de geração XLSX real em Supabase homologado. Não publicar frontend isoladamente da Edge Function.
- Publicação explícita ao cliente em snapshot mínimo e restrito ao projeto; revogação e histórico, teste de isolamento A/B.
- Arquivo imutável e paginado de snapshots aprovados, tela administrativa para consulta, migração `20260922010000`, regressão de unicidade, RLS e aprovação atômica. Não confundir consulta de versões com criação/ativação de aditivo.
- Teste automático de timestamps SQL válidos e ausência de números de versão duplicados.

## O que continua bloqueando uma declaração de conclusão

1. **Aditivo completo:** a produção tem `construction_schedules_project_id_key UNIQUE (project_id)`. A estratégia atual mantém um cronograma por projeto, e o arquivo guarda apenas snapshots aprovados. Não remover a UNIQUE nem desbloquear a edição de planejamentos aprovados sem adaptar inicializador, todas as consultas, medições, exportação, status, revisões e RLS para distinguir versão vigente vs. histórica.
2. **Planejamento por quantitativos:** custos unitários, fontes verificáveis, orçamento de construção auditável, peso físico independente, calendário com feriados e caminho crítico ainda não estão implementados integralmente na interface, gravação e XLSX.
3. **Homologação:** o projeto Supabase de staging `nvhjcoxnzigwwbdbhkhq` não contém sequer as tabelas `construction_schedules`, `construction_schedule_items`, `construction_schedule_measurements`, `construction_schedule_publications` e `construction_schedule_baseline_versions`, enquanto o projeto de produção possui as duas primeiras e não possui as três seguintes. Históricos de migrations divergem: reconstruir esquema isolado com todas as dependências primeiro. Nunca executar só o último SQL e declarar homologado.
4. **Documentos contratuais:** auditoria anterior encontrou 51 revisões individuais de conteúdo pendentes no Contrato Mestre v3. Revalidar a quantidade e registrar apreciação individual pela administradora. O bloqueio `assert_document_governance_ready` deve permanecer.
5. **Teste fim a fim:** login de administradora e clientes sintéticos, aprovação, medição, revogação de acesso, DOCX, geração do XLSX real e abertura no Excel, expiração de sessão, recuperação de senha, desktop/mobile e rollback de Edge/frontend/banco. CI sintético não equivale a homologação real.

## Regra para continuidade

**Quatro níveis de estado:** código salvo na PR → verificações automatizadas no commit final → homologação autenticada no esquema equivalente → deploy sincronizado e verificação pós-publicação. Não marcar etapas 4–7 como completas por existirem apenas arquivos, mocks ou uma visualização. Não alterar dados de cliente/produção para validar hipóteses. Preservar PR #18, versões v1/v2, contratos e cronogramas legados.
