# Revisão documental do contrato CON-2026-10-0002 e Anexo I

Proposta **não publicada** para validação técnica, comercial e jurídica. Preserva emissão histórica 1.0 e snapshots.

## Correções no gerador
- Não usar data de emissão como se fosse data de assinatura, tanto no contrato comercial quanto no Anexo I.
- Exibir exigência de representante legal para contratante com CNPJ.
- Transportar descrição particular do serviço "Outro" para o Anexo I (caso do book de vendas).
- Atribuir cada exclusão à atividade de origem para evitar contradições com outros serviços contratados.
- Tornar visíveis pendências de pagamento e revisões, em vez de encobri-las com "conforme registro".

## Catálogo
Arquivo `docs/revisao-catalogo-38-servicos-114-niveis-proposta.json` traz proposta de textos para **38 serviços / 114 combinações de nível**. A publicação no Supabase requer revisão, aprovações e versionamento próprios; a PR não aplica automaticamente textos à base em produção.

## Pendências de natureza contratual
1. Datas divergentes entre Contrato e Anexo I.
2. Valor global R$12 mil sem parcelamento definido.
3. Cronograma por atividade incompleto.
4. Renders sem número de imagens e revisões.
5. Book de vendas não delimitado em produtos e formato.
6. Assinante representante da pessoa jurídica não qualificado.
7. Legalização/ Habite-se com requisitos e dependências pouco objetivos.
8. ART, taxas e demais condições de execução por definir.

## Regressão
`scripts/contratos-anexo-revisao-regression.mjs`.

## Publicação
Não fazer merge nem editar documentos assinados antes da aprovação dos textos finais e do preenchimento das lacunas comerciais. Testes end-to-end de emissão e aplicação de versões devem ser executados em homologação.