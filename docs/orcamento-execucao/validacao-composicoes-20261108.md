# Quantitativos e orçamento de execução — validação única

Referência funcional independente: **OrçaFascio, Sienge, OpenConstructionERP, ERPNext e JobTread**, conforme o dossiê de engenharia reversa. Não há cópia de código proprietário nem simulação de integração com o SINAPI/SICRO.

## Erro corrigido
A tela anteriormente fazia `Number(valor.replace(',', '.'))`, que não interpreta corretamente custos brasileiros com separador de milhar (por exemplo, `1.250,50`). O salvamento fazia outra conversão independente e enviava o resultado ao banco. Isso criava risco de prévia e persistência divergentes.

## Invariantes
- Uma única função pura analisa a composição de cada atividade e gera dados prontos para a RPC já existente `admin_set_full_schedule_execution_budget`.
- Quantidade pode ter até 4 casas; valores em R$ têm até duas, sem notação exponencial nem números negativos.
- Composição requer **quantidade positiva + unidade + preço unitário**; custo direto exige um único preço sem composição. Fonte do custo obrigatória.
- Multiplicação em escalas inteiras e arredondamento por **linha**, compatível com `round(quantity * unit_cost, 2)` do PostgreSQL. Soma em centavos evita a mistura de valores aproximados.
- Duplicação de código, ausência de fonte, falta de composição ou total zero bloqueiam o envio; a RPC continua a validar autorização, revisão em rascunho e integridade do conjunto.
- O total do banco é comparado ao calculado no formulário; discrepância não gera confirmação visual enganosa.
- **Honorários de engenharia não entram no custo de execução da obra.** As composições não alteram cronogramas aprovados; nesses casos é obrigatória nova revisão/aditivo.
- Referências SINAPI/SICRO, preço de fornecedor, unidade federativa e mês devem ser **informados a partir de fonte verificada**, não preenchidos automaticamente com dados fictícios.

## Validação
`node scripts/test-construction-budget-validation.mjs`, TypeScript, CI de integração, exportação web e auditoria desktop/mobile. Mudanças restritas à interface e ao serviço; nenhuma alteração no banco ou nos registros existentes.
