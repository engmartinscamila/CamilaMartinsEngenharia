# Plano de ação executivo — modernização integrada do sistema interno
**Data-base:** 07/11/2026 · **Responsável técnico de implementação:** desenvolvimento do sistema · **Referência:** engenharia reversa funcional dos ERPs do dossiê de 06/11/2026

## Princípios inegociáveis
1. Preservar projetos, contratos, orçamento, recibos, revisões e histórico financeiro. Nada de apagar registros para "limpar" o código.
2. Cada alteração tem PR independente, testes de regressão/segurança, homologação e rollback de interface antes de ativar em produção.
3. Um cliente pode ter projeto sem contrato; um contrato pode existir sem orçamento ou projeto. O contrato não é obrigatório na criação inicial do projeto.
4. O extrato nunca somará simultaneamente a representação legada e a mesma obrigação no ledger V2.
5. Reversões e revisões documentais preservam histórico imutável; reenvio por falha de rede é idempotente.

## Etapas, entregáveis e evidências

| Prioridade | Frente | Implementação concreta | Evidência/critério de aceite | Status em 07/11 |
|---|---|---|---|---|
| P0 | Auditoria/deploy | Conferir PR #52/#53, CI e execução de publicação | Quatro testes aprovados e deploy pelo mesmo SHA | PR #52/#53 integrados; deploy #53 conferido separadamente |
| P0 | Banco financeiro | Comparar schemas/contagens/versões em produção e homologação | Nenhum DDL/DML sobre produção; inventário de divergências | Concluído diagnóstico |
| P0 | Núcleo Financeiro V2 | Implantar 5 tabelas + RPCs de títulos, parcelas, recebimentos, alocações, estornos, RLS e view | Testes no Supabase de homologação + PGlite; rollback de fixtures | Implantado em homologação; produção não migrada |
| P0 | Integração V2 em homologação | Tela administrativa de testes para título, parcelamento mensal, distribuição, crédito e estorno; guarda rígida de ambiente | TypeScript, testes unitários, interface, proibição de RPC fora de homologação | Código nesta etapa |
| P0 | Conciliação histórica | Mapear 4 lançamentos `financeiro` e 3 recibos legados por ID sem DML | Resolução individual de vínculos e duplicidades; relatório diferença zero | A iniciar |
| P0 | Recibos e caixa | Conectar confirmação de pagamento V2 ao recibo emitido uma vez, sem criar segunda entrada; preservar recibo inicial e Word | 1:1 recibo/pagamento, testes de falha e retries | Depois da conciliação |
| P1 | Comercial e documentos | Fonte única contrato/orçamento/Anexo I/aditivo; Word inicial sem nova revisão; revisões imutáveis; eliminação de reescrita redundante | Testes de emissão, download, histórico, sem novo motivo no documento | Planejado |
| P1 | Projetos e agenda | Templates de tarefas, cronograma físico-financeiro, marcos, dependências, caminho crítico, alertas | Comparação com obras reais, teste desktop e mobile | Planejado |
| P1 | Orçamentos e custos | Composições, quantitativos, materiais, desvios custo/planejado e horas/margem | Fórmulas verificáveis por contrato, nenhuma soma duplicada | Planejado |
| P2 | CRM/portal | Funil de propostas, solicitações, notificações, documentação para aceite e calendário | Controle de acesso cliente/administrador, RLS e UX | Planejado |
| P2 | Governança | Observabilidade, telemetria de erro, redução de arquivos longos, backups restauráveis, auditoria de políticas | zero regressões em CI, relatórios verificáveis e métricas de desempenho | Planejado |

## Diagnóstico factual dos ambientes
- **Produção `portal-cliente`:** 4 linhas em `financeiro`, 3 em `payment_receipts` e 0 transações em `bank_transactions` no diagnóstico realizado; `fin_v2_receivables` não instalada. Não concluir que os três recibos correspondem a três dos quatro lançamentos sem verificar os IDs.
- **Homologação:** `financeiro` vazio, `payment_receipts` ausente; colunas `cliente_id`/`contract_id` ausentes em `financeiro`; histórico de migrações de produção e homologação divergem. Recriar somente as dependências necessárias à etapa, sem migrações destrutivas.
- **Migração aplicada somente em homologação:** `finance_v2_core_homologacao_20261107`, a partir de `docs/finance-v2/0001-financial-ledger-candidate.sql`.
- **Teste SQL real em homologação:** criado título sintético de R$1.000,00 em 2 parcelas (R$400,00/R$600,00), liquidação parcial de R$250,00, segundo recebimento de R$350,00 dividido entre parcelas, bloqueio de excesso/cliente divergente e estorno. Tudo executado numa transação encerrada por `ROLLBACK`. As cinco tabelas V2 ficaram vazias.
- **Segurança:** RLS habilitada nas cinco tabelas, uma política restrita a administradores para cada; nenhuma permissão direta de INSERT/UPDATE/DELETE ao papel `authenticated`.
- **Site:** `/admin/financial-v2` só pode consultar/gravar quando a configuração explícita é `appEnvironment=homologation` **e** `projectRef=nvhjcoxnzigwwbdbhkhq`. Fora disso, página bloqueada e serviços não fazem RPC.

## Critérios para liberar o V2 em produção
- [ ] Backup **restaurável** com prova de restauração.
- [ ] Resolver diferença de migrações e coluna financeira entre os dois ambientes.
- [ ] Relatório de reconciliação **por contrato, projeto e cliente**, com destino único para cada obrigação/pagamento.
- [ ] Comprovante/recibo e lançamento sempre associados, sem duplicar entrada de caixa.
- [ ] Testes concorrentes, falha após commit, RLS de clientes reais e role admin, redução de regressões de UX.
- [ ] Cutover por feature flag com reversão rápida da interface; nenhuma exclusão do legado.

**Observação:** aplicar novas funcionalidades com base em fluxos e práticas de mercado; não copiar código proprietário de outros aplicativos.

## Continuidade: conciliação do legado e comprovante administrativo V2

- **Execução:** painel de conciliação com conferência individual de recibos/contratos e serviços avulsos; falha de leitura impede concluir a conferência.
- **Diagnóstico de produção, somente leitura:** quatro lançamentos financeiros (três recebidos e um pendente); três recibos relacionados, todos sem divergência de valor, data, cliente ou projeto; três lançamentos ainda não classificados como contratuais; quatro contratos sem valor cadastrado.
- **Regra de negócio:** serviço avulso legítimo não recebe contrato fictício. Deve ser identificado e preservado como categoria distinta na reconciliação, sem somar duas vezes ao saldo.
- **Homologação:** recibo interno V2 1:1 ao pagamento, com snapshot e histórico de estorno, nunca um recebimento financeiro adicional. Testes abrangem concorrência lógica por trava, idempotência, leitura RLS, reversão e interface de homologação.
- **Não concluído:** recibo Word/PDF definitivo, cutover produtivo, reclassificação individual de serviço avulso, preenchimento de contratos sem valor e verificação de backup restaurável. Não declarar 100% operacional enquanto isso permanecer.
