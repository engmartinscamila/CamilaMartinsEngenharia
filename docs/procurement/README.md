# Compras e cotações — implementação independente dos padrões de suprimentos

Base funcional: fluxo de suprimentos/orçamento comparativo estudado em **Sienge, Vobi, JobTread e ERPNext**. **Não** utiliza o código ou APIs privadas dessas ferramentas.

## Correções aplicadas
- Os projetos sem contrato passam a aparecer em Compras. A cotação vincula `project_id` desde o início e não precisa gerar contrato fictício.
- Criar uma cotação e o item inicial passa a ser **uma só transação PostgreSQL** por `admin_create_purchase_quote`. A chave de reenvio mantida no formulário impede duplicação em perda de resposta e rejeita conteúdo diferente com a mesma chave.
- `admin_register_supplier_bid` bloqueia propostas após aprovação, cancelamento ou pedido; exige fornecedor ativo e condições de pagamento; a unicidade `(quote_id,supplier_id)` é preservada.
- `admin_approve_supplier_bid` verifica a participação do fornecedor na **cotação específica**, impede substituição silenciosa da escolha e não duplica o evento se houver reenvio da mesma aprovação.
- O comparativo mostra menor preço, maior diferença nominal e prazo mais curto conhecido separadamente. **Não** recomenda automaticamente pelo menor preço, pois qualidade e condições também importam.
- Funções usam autenticação e `is_portal_admin()`, `SECURITY DEFINER` com `search_path=''`, logs administrativos e `REVOKE EXECUTE` de `anon`.
- Testes PostgreSQL com prova de idempotência, bloqueio de escolhas de outra cotação, valores inválidos e proteção de permissões.

## Implantação
1. Verificar schemas de `purchase_quotes`, `purchase_quote_items`, `supplier_bids`, `suppliers`, `projetos` e `audit_log`.
2. Executar `docs/procurement/0001-atomic-quote-supplier-workflow.sql` **primeiro em homologação**, testar com transação concluída por `ROLLBACK`.
3. Aplicar somente migração aditiva testada em produção, sem deletar registros existentes.
4. Liberar frontend somente após TypeScript, regressões, segurança, Playwright desktop/mobile e deploy bem-sucedido.
5. Confirmar orçamento/escopo/cotação com o profissional; a escolha de fornecedor não gera contrato, pedido de compra ou lançamento financeiro automaticamente.

**Fora do escopo desta entrega:** BOM/BOQ multinível, geração automática de pedido de compra, empenhos financeiros, importação SINAPI/SICRO, faturamento fiscal e controles de entrega. Esses fluxos exigem registros e permissões próprios; não devem ser simulados com objetos incompletos.
