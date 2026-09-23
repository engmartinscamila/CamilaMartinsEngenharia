# Homologação documental — dados fictícios — 23/09/2026

Ambiente exclusivo: `camila-martins-homologacao`, ref `nvhjcoxnzigwwbdbhkhq`; **não executar na produção**. SQL aplicado e versionado em [`homologacao-fixtures-documentais-20260923.sql`](./homologacao-fixtures-documentais-20260923.sql).

## Registros inseridos e verificados no Supabase de homologação

- Um cliente fictício, sem vínculo de Auth, email reservado `qa-fixture-documentos-20260923@example.invalid`.
- Um contrato cadastral fictício **em rascunho** e um projeto fictício vinculado.
- Três orçamentos comerciais fictícios: Bronze com `s` (cronograma R$ 500) + `c` (Projeto Legal R$ 1.500); Prata com `p` (Outros R$ 720 e escopo textual específico); Ouro de prospect novo não cadastrado com `r` (Projeto de Combate a Incêndio R$ 990).
- Um registro comercial do tipo contrato **em rascunho**, vinculado ao orçamento Bronze, ao mesmo cliente, ao contrato cadastral e ao projeto. Um vínculo entre orçamento e contrato confirmado. Valores e snapshots de serviços conferidos.
- Não foram criados documentos em `documentos`, arquivos no Storage, logins fictícios, cronogramas aprovados ou notificações ao cliente. Nenhuma assinatura, envio ou publicação.

## Amostras fora da aplicação

Foram preparados cinco `.docx` e um `.xlsx` de oito abas, entregues à administradora na conversa em um ZIP `Documentos_ficticios_homologacao_2026-09-23.zip`. Arquivos marcados `AMOSTRA DE QA / SEM VALIDADE CONTRATUAL`; **não foram criados pelo gerador oficial nem enviados ao GitHub**, pois a interface GitHub disponível para este trabalho grava somente texto UTF-8. O SQL é a fonte reproduzível dos registros, não dos arquivos Office. Não afirmar teste end-to-end de emissão ou exportação do site a partir das amostras.

## Bloqueios reais, não contornar

A verificação atual da homologação encontrou Contrato Mestre v3 ativo, 53 revisões pendentes e 30 itens ativos de catálogo/textos ainda vinculados a versão anterior; `assert_document_governance_ready` mantém a geração real bloqueada. Não dar aceite fictício, não desativar o gatilho, não alterar grants e não inserir manualmente uma linha em `documentos` para simular arquivo gerado.

Para o teste real, usar uma sessão administrativa legítima no frontend de staging: orçamento → geração oficial de Word → conferência de arquivo/histórico → contrato vinculado e Anexo I → geração Word → criação de cronograma mediante contrato expresso → XLSX oficial → isolamento de cliente. Resolver as revisões materiais individualmente mediante decisão da administradora. Preservar a produção até homologação e autorização de publicação.
