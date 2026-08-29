# Revisão final de lançamento — Revisão 10.1

Data da revisão: 12 de agosto de 2026.

## Resultado técnico

O código da Revisão 10.1 passou por TypeScript, lint, Expo Doctor, testes dos parsers de imagem, auditoria controlada de dependências e geração integral dos pacotes web, Android e iOS.

| Verificação | Resultado |
|---|---|
| TypeScript | aprovado |
| ESLint | aprovado |
| Expo Doctor | 20 de 20 verificações aprovadas |
| Teste de segurança ICNS/JXL/HEIF | aprovado |
| Vulnerabilidades críticas | nenhuma |
| Exportação web | aprovada, 53 rotas estáticas |
| Bundle Android | aprovado |
| Bundle iOS | aprovado |

## Melhorias aplicadas

| Área | Antes | Depois |
|---|---|---|
| Início do cliente | podia exibir e-mail durante o carregamento | usa nome cadastrado ou nome autenticado; fallback “Cliente” |
| Painel administrativo | título genérico “Visão geral” | cumprimento “Olá, Camila” ou nome autenticado |
| Perfil do cliente | exibia identificador interno e fornecedor de autenticação | mostra apenas nome, e-mail, status e orientação de proteção da conta |
| Resumo de privacidade | expunha token, servidor e detalhes de infraestrutura | explica finalidade, permissões, proteção da conta e direitos em linguagem do cliente |
| Canal LGPD | solicitação genérica | assunto pré-preenchido e e-mail institucional de privacidade |
| Termos de Uso | regras essenciais resumidas | deveres, boa-fé, evidência, autoria, segurança, responsabilidade por nexo causal, suspensão e lei aplicável |
| Política de Privacidade | informações básicas | controladora, categorias, finalidades, bases, operadores, tratamento internacional, retenção, direitos, incidentes e dados de terceiros |
| Aceite | versão `2026.08.12-1` | nova versão `2026.08.12-2`, com registros anteriores preservados |

## Fundamentos considerados

A redação foi estruturada a partir da LGPD, do Marco Civil da Internet, do Código Civil, do Código de Defesa do Consumidor e das regras e orientações da ANPD. Ela evita dois extremos: não apresenta a tecnologia como insegura e não promete uma isenção absoluta que poderia ser inválida.

A cláusula de responsabilidade exige apuração, evidência e nexo causal e distribui deveres sobre senha, aparelho, dados enviados e uso da conta. Ela preserva direitos obrigatórios e não exclui responsabilidade que venha a ser comprovada.

## Etapas externas obrigatórias antes da publicação

O código está compilável, mas o lançamento em loja somente deve ocorrer depois destes itens:

1. aplicar `supabase/migrations/20260812213000_legal_documents_v2.sql` na homologação e validar o novo aceite;
2. aplicar as migrações aprovadas no projeto de produção, após backup;
3. configurar no EAS as variáveis públicas de produção e executar `npm run check:production` com `.env.production.local` equivalente;
4. executar o teste Cliente A versus Cliente B no ambiente que será publicado e confirmar o isolamento por RLS;
5. remover ou arquivar contas e registros fictícios do ambiente de produção;
6. confirmar nome empresarial/CPF ou CNPJ e dados contratuais que identificam a controladora;
7. revisar Termos, Política e contratos com advogado que conheça a operação real;
8. gerar os builds assinados e concluir as fichas de privacidade e publicação nas contas Apple e Google.

O aviso “Cannot connect to Expo CLI” visto no Expo Go pertence ao modo de desenvolvimento e não aparece no aplicativo instalado pela loja.

## Fontes oficiais consultadas

- LGPD: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm
- Marco Civil da Internet: https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l12965.htm
- Código de Defesa do Consumidor: https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm
- Código Civil: https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm
- Comunicação de incidentes — ANPD: https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/comunicado-de-incidente-de-seguranca-cis
- Resolução CD/ANPD nº 2/2022: https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd/resolucao-cd-anpd-no-2-de-27-de-janeiro-de-2022
