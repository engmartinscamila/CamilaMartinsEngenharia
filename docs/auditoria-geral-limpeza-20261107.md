# Vistoria geral e limpeza de código sem função — 07/11/2026

## Método executado
Auditoria sobre a árvore completa do repositório, com varredura de nomes, tamanhos, referências textuais de execução, scripts, estilos, duplicatas de conteúdo, rotas e versões 3D.

**Inventário de referência anterior às exclusões:** 1.176 arquivos, 109.877.856 bytes rastreados, 820 fontes textuais analisadas, 114 arquivos JS/CSS legado avaliados. Os resultados brutos (JSON e Markdown) estão no artefato `auditoria-codigo-sem-uso` do workflow `Auditoria completa do portal` na PR #47.

**Critério para remoção:** o arquivo não tinha importação ou referência de execução identificada nas fontes, páginas e fluxos de publicação inspecionados, não era a fonte atual de funcionalidade, e a funcionalidade equivalente permanecia ativa em outro local. O processo de revisão inclui testes de links e navegador. Ausência de referência estática isoladamente não constitui prova de inutilidade; importações dinâmicas e URLs históricas continuam sendo riscos conhecidos.

## Arquivos removidos nesta branch — 23 / 218.105 bytes
1. `css/contato.css` — comentários sem regra.
2. `css/dashboard.css` — sem página carregando este CSS.
3. `css/financeiro-avancado.css` — painel financeiro legado redirecionado.
4. `css/portfolio-3d.css` — substituído pelo estilo 3D realmente carregado.
5. `css/solicitacoes.css` — sem inclusão nas páginas.
6. `js/contato.js` — arquivo vazio.
7. `js/admin-guard.js` — guarda não importada; proteção real permanece.
8. `js/admin-name-fix.js` — intervenção de nome não carregada.
9. `js/admin-dashboard-fix.js` — script concorrente obsoleto, já vetado pela auditoria do Admin.
10. `js/admin-ui-resilience.js` — script concorrente obsoleto, já vetado pela auditoria do Admin.
11. `js/biblioteca.js` — não carregado; URL da biblioteca usa `js/library-route.js`.
12. `js/casa-urben-capa-movimento-v1.js` — efeito legado não importado; animação atual usa CSS.
13. `js/casa-urben-v17-galeria.js` — variante antiga não referenciada pelas páginas atuais.
14. `js/dashboard.js` — não carregado; `dashboard.html` redireciona ao painel.
15. `js/financeiro-avancado.js` — controlador antigo não carregado por `financeiro.html`.
16. `js/financeiro.js` — controlador antigo não carregado por `financeiro.html`.
17. `js/fotos-lote.js` — auxiliar não incluído em `fotos.html`.
18. `js/portfolio-3d.js` — código não incluído; 3D ativo permanece inline em `index.html`.
19. `js/portfolio-live3d.js` — variante antiga, 3D atual permanece inline em `index.html`.
20. `js/portfolio-motion-v1.js` — animação atual em CSS, JS não incluído.
21. `js/storage.js` — implementação separada não importada.
22. `scripts/build-frases-do-dia-fast.mjs` — gerador legado sem chamador; a geração em CI usa V7.
23. `scripts/build-frases-do-dia.mjs` — gerador antigo sem chamador; preservados V7 e fixed.

## Recursos preservados deliberadamente
- `js/admin-home-route.js`: compatibilidade documentada; requer verificar fluxo de geração/redirecionamento.
- `css/mobile-experience.css` e `js/mobile-experience.js`: arquivo referenciado pelo preparador de publicação.
- `js/pwa-client.js`: injetado/verificado na publicação e necessário ao PWA.
- `js/financial-route.js`, `js/library-route.js`, `js/fotos.js`, `js/admin.js`, `js/auth.js`: referências diretas em páginas.
- Fontes e Edge Functions, modelos 3D publicados, conteúdo do acervo, histórico de versões e contratos; NÃO apagar automaticamente.
- Migrações Supabase (histórico append-only): não devem ser removidas como arquivos `mortos`.

## Duplicatas de código descobertas — não foram removidas
**19 pares de arquivos Edge Functions idênticos**, predominantemente entre `supabase/functions/` e `portal-app/supabase/functions/`. A duplicação pesa no repositório, mas as duas árvores podem servir pipelines diferentes; consolidar exige comprovar qual árvore é a fonte autoritativa e alterar workflows de geração/deploy/testes antes de apagar outra cópia.

## Modelos 3D versionados — não foram removidos
A pasta `previews/` contém 144 arquivos, incluindo aproximadamente 41,8 MB de arquivos. As versões de Casa Urben desde v9 até v16 guardam partes de modelos GLB de revisões anteriores. V16 é referenciada diretamente na home; versões v13 a v15 entram na preparação do site público. Outros links antigos podem ser abertos externamente. Excluir versões anteriores diretamente pode gerar 404 e perda de evidência das revisões. Só mover para armazenamento histórico se houver redirecionamento/compatibilidade comprovados.

## Riscos e verificação
- O script `scripts/audit-code-hygiene.mjs` gera inventário e candidatos, inclusive módulos Expo com resolução de variantes de plataforma, e scripts manuais sem chamador; não exclui nada automaticamente.
- O teste `scripts/verify-code-cleanup.mjs` verifica que removidos não continuam referenciados, mantendo rotas essenciais.
- Auditoria do portal inclui testes sintáticos, integrados e de navegador via Playwright.
- Esta PR é **somente limpeza**, sem alteração de SQL, dados Supabase, recibos, contratos ou serviço comercial.
- A PR #46 ainda está em rascunho; inclui alterações a `js/financeiro-avancado.js`, arquivo apagado aqui por não estar em execução. **A PR #46 deve ser reconciliada para não restaurar código morto** antes de qualquer merge.
- A PR #47 permanece em rascunho até os testes completos. Não fazer publicação automática desta etapa.
