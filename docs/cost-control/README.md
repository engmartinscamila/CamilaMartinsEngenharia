# Controle de custos de obra — evidências e critérios de integração
**Data:** 08/11/2026

## Entrega
Nova visão administrativa **Gestão de obras → Controle de custos**, por projeto, sem exigir contrato, integrando fontes existentes. Base funcional de fluxo de orçamento/gestão de obras (Sienge, Vobi, ERPNext, Kimai), com implementação independente e sem cópia de código de fornecedores.

- **Previsto:** soma do `planned_cost` dos itens da versão `is_current` do cronograma, **somente quando `activation_status='approved'` e todos os itens têm preço**. Rascunho, cronograma legado e atividades sem preço bloqueiam um total apresentado como definitivo.
- **Medido:** soma informativa de `actual_cost`, sem assumir que houve pagamento. Nulos significam custos ainda não medidos, e não despesas nulas confirmadas.
- **Pago e pendente:** leitura dos registros `financeiro` do projeto com `tipo='saida'`; status `pago/recebido` e `pendente` são exibidos separadamente. Status desconhecido impede a diferença orçamentária.
- **Cotado aprovado:** valor do lance do fornecedor escolhido em `purchase_quotes` com status `approved`. É **proposta escolhida**, não pedido de compra, custo comprometido ou pagamento; não integra valores de gasto.
- **A diferença entre previsto e saídas registradas é parcial**, não fluxo de caixa nem margem, e não pode ser interpretada como previsão do custo final.
- **Apontamentos de horas e honorários:** não são automaticamente somados às despesas, pois podem já estar contabilizados e exigiriam conciliação única de origem.

O serviço consulta as tabelas por projeto, com paginação, ordenação estável e bloqueio de total em erro de qualquer página; não cria, edita, lança nem migra dados. RLS existente mantém acesso financeiro, cronogramas e compras restrito a administradores.

## Limites e próximas integrações necessárias
1. Para exibir **comprometido**, implementar pedido de compra/serviço autenticado com aceite, fornecedor, valor, centro de custo, status e vínculo à linha orçamentária; não tratar cotação como compromisso.
2. Para custo por insumo e BDI, implantar composições versionadas, referências SINAPI/SICRO por localidade/mês e aprovação de revisão, sem confundir com o `planned_cost` vigente.
3. Para conciliar medição e despesa, vincular documento/saída à atividade e impedir contabilização duplicada.
4. Validar em contas reais autorizadas e simulação de dados: projeto sem contrato, sem cronograma, cronograma aprovado incompleto, despesa paga/pendente, fornecedor selecionado, falha na paginação. Não declarar cobertura de todos os custos de obra sem registro das despesas faltantes.

## Evidências de segurança
Inspeção somente leitura das políticas em produção verificou `is_portal_admin()` para cronogramas, cotações e lances e `private.eh_administradora()` para lançamentos financeiros. Nenhum DDL/DML, nenhum acesso de cliente às demonstrações de custo, nenhuma escrita em produção ou homologação nesta PR.

## Testes
`portal-app/scripts/test-project-cost-control.mjs`: centavos, orçamento incompleto, linha-base não aprovada, status financeiro desconhecido, proposta ausente, duplicidade de IDs, valores negativos/inválidos e separação entre proposta, medição e caixa. O teste é requisito no workflow `portal-app-pr.yml`.
