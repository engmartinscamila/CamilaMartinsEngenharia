# Financeiro V2 — protocolo de homologação e integração

**Estado em 07/11/2026:** núcleo de cálculo implementado + diagnóstico administrativo integrado no React + SQL de migração candidata + teste de Postgres isolado. **Não habilitado para lançamentos reais.**

## O que foi implementado
- `src/lib/payment-allocation-model.ts`: motor de centavos, idempotência por solicitação, recebimento parcial, divisão entre parcelas, crédito não alocado e reversão sem apagamento do pagamento original.
- `src/lib/financial-reconciliation.ts`: diagnóstico não destrutivo de lançamentos existentes, contrato/cliente/projeto, quitação sem conta/dia específico e banco vinculado mais de uma vez. A detecção é indicativa, não comprova perda financeira.
- `src/components/financial-overview.tsx` e `src/app/admin/financial.tsx`: painel de conferência dentro do extrato financeiro administrativo.
- `0001-financial-ledger-candidate.sql`: novas tabelas `fin_v2_receivables`, `fin_v2_installments`, `fin_v2_payments`, `fin_v2_allocations`, `fin_v2_reversals`; RPC transacional com validação explícita de administrador, chaves únicas, bloqueio de parcela, RLS admin-only, view `security_invoker` e audit_log.
- Testes `test-payment-allocation-model.mjs`, `test-financial-reconciliation.mjs` e `test-financial-v2-sql.mjs` (PostgreSQL/PGlite em ambiente efêmero).

## Avisos de compatibilidade
A produção contém `financeiro`, `payment_receipts`, projetos e contratos com vínculo real. A homologação não é réplica da produção: falta `payment_receipts` e colunas de `financeiro` como `cliente_id` e `contract_id`. Não executar migrações por contagem de versões.

**O novo SQL permanece deliberadamente em `docs/finance-v2/`, fora do diretório de migrações automaticamente aplicáveis.** Primeiro executar em banco descartável do mesmo Postgres, reconciliar versionamento, confirmar RLS por usuário autenticado e um backup restaurável. Depois será promovido para uma migração forward-only.

## Regras antes de habilitar UI de gravação
1. Nenhum registro de `financeiro` ou `payment_receipts` será apagado, sobrescrito ou duplicado no novo ledger.
2. Apenas um dos modelos deve alimentar os indicadores para cada obrigação financeira: legado ou V2; jamais somar duas representações do mesmo pagamento.
3. A migração dos 4 lançamentos ativos de produção será feita somente com mapeamento de origem, prova de reconciliação, chave de idempotência e decisão explícita sobre estados; não assumir que `pago` no legado corresponde a alocação por parcela.
4. Um recebimento sem alocação fica em **crédito adiantado**, não baixa uma parcela aleatória.
5. O recibo V2 só poderá ser emitido a partir de pagamento confirmado e com vínculo verificado; não habilitar o fluxo antigo de recibo para V2 sem adaptador transacional.
6. A soma das alocações por pagamento não pode ultrapassar o valor recebido; a soma ativa por parcela não pode ultrapassar seu valor exigível.
7. Reversão cria fato de estorno e restabelece o saldo da parcela, sem DELETE físico no histórico.
8. RLS: `anon` e cliente não podem ver lançamentos internos; `authenticated` admin apenas leitura; toda mutação ocorre por RPC com `auth.uid()` e `public.is_portal_admin()` verificados, parâmetros validados, `search_path` vazio e EXECUTE revogado ao público.

## Critérios de homologação
- Testes unitários: 2 pagamentos na mesma parcela, 1 pagamento em 2 parcelas, excesso de alocação rejeitado, duplicidade idempotente, cliente incompatível rejeitado, crédito adiantado, estorno preservado, arredondamento e data no Brasil.
- Banco: integração real com contas/contratos/cliente, transaction rollback em erro, locking concorrente de parcelas, SELECT RLS de administrador/não administrador, CREATE direto bloqueado e auditoria de alteração.
- Conferência de dados: comparar total por contrato e por cliente, relatório de diferença **igual a zero** antes de cutover, não só total agregado; testar recibos gerados e importação OFX.
- Operação: fluxo navegável desktop/móvel, download Word/PDF inicial, histórico de recibos, contas bancárias, aviso claro de indisponibilidade e rollback de interface.

## Próximos pontos técnicos da fase financeira
1. Reconstruir homologação consistente a partir de histórico de migrações e fixtures sintéticas; nunca copiar dados pessoais indiscriminadamente.
2. Testar a migração candidata no banco isolado e corrigir avisos do Supabase Advisor.
3. Desenvolver adaptador `financeiro` → V2 com reconciliação por ID, sem efetuar conversão em produção.
4. Criar formulário de pagamento parcial e distribuição entre parcelas usando RPC transacional; habilitar com feature flag depois da validação.
5. Vincular recibos aos IDs de pagamento V2, não gerar entrada de caixa por emissão documental.
6. Testar concorrência, falhas de rede, autenticação, PDFs e extratos reais em homologação; só então publicar.

**Não foi executada nesta PR qualquer DDL/DML em produção ou homologação.** O SQL está versionado, e não aplicado.

## Lote de reconciliação e comprovantes internos (07/11/2026)

A conferência administrativa não destrutiva usa `legacy-finance-audit.ts`, `legacy-receipt-service.ts` e `legacy-financial-audit-panel.tsx`. Exibe contratos sem valor, lançamentos sem contrato para classificação manual, pagamentos sem recibo e erros de vínculo (número de recibos por pagamento, valor, data, cliente e projeto). Se a leitura de uma página do histórico falhar, todo o diagnóstico é marcado indisponível; nenhuma soma parcial é exibida. O sistema não assume que ausência de contrato é erro: pode se tratar de prestação de serviço avulsa.

**Conferência SQL somente leitura na produção (estado observado):** 5 contratos, 4 sem valor, 4 lançamentos financeiros (3 pagos, 1 pendente), 3 sem contrato identificável, 3 recibos vinculados sem divergência de valor, data, cliente ou projeto. São dados de diagnóstico do momento, não devem virar valores fixos do código.

### Registro interno de comprovante V2 — homologação

`0002-receipt-evidence-candidate.sql` cria `fin_v2_receipt_records` e a RPC `admin_fin_v2_issue_receipt_reference`. Este registro é **comprovante administrativo de teste**, NÃO é recibo legal definitivo. A ligação é 1 pagamento V2 para no máximo 1 registro, com número interno de homologação, snapshot não reescrito, deduplicação por solicitação e histórico de estorno preservado. **Não insere em `financeiro` nem em `payment_receipts`.** A UI de homologação exibe o comprovante e não oferece reemissão para um pagamento já vinculado.

Antes de gerar recibo definitivo em produção, é obrigatório validar identidade profissional, valor recebido, pagamento real e totalidade dos vínculos; não converter automaticamente os quatro lançamentos existentes. A migração de homologação deve permanecer fora de `supabase/migrations` enquanto os ambientes divergirem. A migração da prova interna só será aplicada à homologação após teste automatizado PGlite, auditoria de segurança e confirmação explícita de ausência de dados alterados na produção.
