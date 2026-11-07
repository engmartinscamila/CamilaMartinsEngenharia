# Refatoração conservadora — Fase 1+2 consolidada — 07/11/2026

## Finalidade
Remover código sem uso, consolidar serviços por domínio e eliminar duplicações verificáveis sem comprometer contratos, recibos, documentos, financeiro e projetos. Não houve alteração no banco Supabase ou dados de clientes.

## Evidências
- **Vistoria inicial:** 1.176 arquivos, 820 fontes textuais e 114 arquivos JS/CSS legados. 23 artefatos de código sem execução comprovada removidos na primeira fase. Os testes de segurança, varredura e navegador da PR #47 passaram.
- **Fachada administrativa:** `portal-app/src/services/admin-service.ts`, original 43.163 caracteres, após refatoração 2.357 caracteres. As funções continuam acessíveis por reexportação, agora distribuídas em módulos coesos (clientes/projetos/contratos, agenda/cronograma, aprovações/notificações, documentos/Storage, financeiro e histórico, armazenamento e auditoria).
- **Paginação:** substituição de três laços ad hoc por `readAllRows` com limite e falha integral; não gera totais a partir de dados incompletos.
- **Orçamentos e contratos:** `js/commercial-documents-web.js` original 68.902 caracteres e agora ~61.940, com utilitários determinísticos e reconstrução de orçamentos históricos em `commercial-documents-utils.js`, carregado antes do formulário. Mantidos snapshots de serviços, níveis, observações, revisões e valores.
- **Financeiro:** `portal-app/src/app/admin/financial.tsx` original 54.411 caracteres, agora ~49.532, com estilos, cards de parcelas e cards de lançamentos modulares.
- **Regra de percentual:** normalização compartilhada em `src/lib/format.ts`, mesmo intervalo 0–100 e mesmo valor null para dados ausentes.

### Importante: tamanho de arquivo não é tamanho total do aplicativo
A divisão melhora legibilidade, manutenção e separação das responsabilidades. **Não significa que o tamanho total do código foi reduzido na mesma proporção**, porque a maior parte do código foi transferida, não apagada. A redução real obtida vem de arquivos sem função e de implementações repetidas.

## Proteções
1. Não alterar assinaturas de métodos importados pelas telas.
2. Não criar novos títulos financeiros, novas revisões de contrato nem recibos automaticamente.
3. Não mudar permissões, RLS, operações SQL ou migrações.
4. Não alterar renderização da versão pública das maquetes e biblioteca.
5. Testar criação independente de projeto e contrato, extrato, arquivo documental, recibos e fluxo de cadastro antes de publicar.
6. Sem merge automático e sem publicação até passar auditorias de navegador e homologação.

## Scripts legados ofuscados
`js/clientes.js` e `js/portfolio-admin.js` não foram reescritos: são fontes ofuscadas, não uma estrutura interna em módulos. A substituição segura exige recuperar a fonte original atual ou reconstruir funções com testes comparativos. Uma versão de `clientes.js` de julho é legível, mas **não demonstra equivalência** com a versão de julho atualizada depois. O portfólio só mostrou versão ofuscada no histórico consultado. Não confundir a preservação desses arquivos com prova de otimização completa.

## Verificação automatizada
O workflow de aplicativo, executado em commit anterior desta PR, já passou em TypeScript, testes de integração, ESLint, patches de segurança, auditoria de dependências, Excel e exportação web. Esta PR consolidada foi direcionada à `main` para que a auditoria de navegador do pacote conjunto também seja exigida.

## Dependências de outras PRs
PR #46 modifica um arquivo financeiro legado removido na PR #47. Precisa ser reconciliada antes de qualquer merge; não restaurar controlador antigo só para aplicar outro conserto.
