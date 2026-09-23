# Plano de deploy sincronizado e rollback — PR #19

Data: 22/09/2026

## Regra principal

Nenhum item abaixo autoriza publicação. Deploy de produção só ocorre após homologação autenticada no SHA final, quatro suítes verdes, revisão humana necessária resolvida/separada, plano de rollback ensaiado e autorização expressa da administradora.

## Unidade de versão

O deploy deve registrar um único SHA como referência para:

- migrations do banco;
- Edge Functions;
- frontend web;
- portal-app/app;
- scripts/testes;
- documentação de estado.

Não combinar banco de um commit com frontend/Edge de outro.

## Pré-deploy obrigatório

1. Quatro workflows verdes no SHA final.
2. Homologação equivalente aprovada conforme `docs/homologacao-pr19-manifesto-20260922.md`.
3. Diff de schema staging × alvo revisado.
4. Advisor de segurança/performance executado após DDL em homologação.
5. 39 funções privilegiadas com triagem e testes negativos A/B/admin documentados; alertas remanescentes justificados.
6. Bundle público e variáveis verificados sem expor valores secretos.
7. Leaked-password protection apenas após confirmar plano/custo/UX e autorização.
8. 51 revisões materiais do Contrato Mestre v3: decisões humanas registradas ou bloqueio explicitamente mantido.
9. Backup/restore e rollback ensaiados com dados sintéticos.
10. Janela de publicação definida sem edição concorrente de cadastros/documentos críticos.

## Ordem de deploy

A ordem deve minimizar incompatibilidade e preservar versões anteriores:

### Fase 1 — preparação

- registrar SHA final e estado anterior de produção;
- registrar versões ativas das Edge Functions e frontend;
- registrar migration head e advisors antes da alteração;
- confirmar que não existe migration destrutiva inesperada;
- confirmar que constraints/versionamento preservam cronogramas, documentos e contratos antigos.

### Fase 2 — banco

- aplicar somente migrations já homologadas, na ordem do repositório;
- interromper imediatamente em erro; não “pular” migration nem alterar manualmente produção para fazê-la passar;
- executar smoke queries somente leitura após cada bloco lógico;
- confirmar RLS, grants, índices e funções esperados;
- executar advisors após DDL.

### Fase 3 — Edge Functions

- publicar somente as versões correspondentes ao SHA final;
- manter JWT/auth conforme homologado;
- não substituir função por variante sem guard apenas para facilitar teste;
- validar health/smoke com identidade autorizada e dados sintéticos/controle sem revelar segredos.

### Fase 4 — frontend/app

- publicar frontend correspondente ao mesmo SHA;
- invalidar cache conforme mecanismo existente, sem apagar conteúdo de usuário;
- app deve permanecer compatível com banco/Edges publicados; se a publicação do app tiver ciclo separado, funcionalidades incompatíveis precisam ficar protegidas por compatibilidade/feature gate previamente homologado.

### Fase 5 — pós-publicação

Verificar imediatamente, com menor impacto possível:

- login admin;
- login cliente de teste/autorizado;
- leitura de projeto/documentos já existentes;
- geração controlada de um fluxo não destrutivo quando autorizado;
- cronogramas legados continuam acessíveis;
- nenhuma revisão histórica foi apagada;
- tema/navegação principais;
- erros/logs sem dados sigilosos;
- Advisor sem novo achado crítico introduzido pela mudança.

## Estratégia de rollback

Rollback não deve significar apagar histórico ou executar SQL destrutivo improvisado.

### Frontend

- manter SHA/artefato anterior identificável;
- em regressão visual/funcional, restaurar o artefato anterior compatível;
- não reverter banco automaticamente só porque o frontend foi revertido; avaliar compatibilidade primeiro.

### Edge Functions

- registrar versão anterior de cada Edge alterada;
- se a Edge nova falhar, restaurar versão anterior somente quando ela continuar compatível com o schema já migrado;
- se a compatibilidade não existir, usar correção forward previamente preparada/testada em homologação.

### Banco

- migrations de produção devem preferir alterações aditivas e compatíveis;
- dados históricos/versionados não devem ser deletados em rollback;
- para DDL incompatível, usar migration de compensação homologada, não edição manual;
- nunca remover coluna/tabela que já recebeu dados sem cópia/estratégia explícita e teste de restauração;
- `revision_number`, `is_current`, `supersedes_schedule_id`, snapshots, medições e publicações históricas devem permanecer preservados;
- se uma nova revisão estiver em rascunho e houver falha operacional, manter a revisão anterior como vigente; não promover rascunho;
- promoção de revisão só após aprovação conforme regras do banco.

### Documentos

- snapshots/documentos já emitidos permanecem imutáveis;
- reemissão gera nova versão; rollback não sobrescreve documento antigo;
- `assert_document_governance_ready` permanece como gate enquanto houver pendência material aplicável.

## Condições de abortar o deploy

Abortar/pausar imediatamente se ocorrer:

- migration parcialmente aplicada ou dependência ausente;
- RLS/policy/grant divergente da homologação;
- Edge do SHA final não inicia ou retorna erro de autorização inesperado;
- acesso cruzado A/B;
- segredo real encontrado no bundle/log;
- perda/inacessibilidade de contrato, documento, cronograma legado ou arquivo;
- geração de documento sem snapshot/versionamento correto;
- cronograma cliente expondo custo/peso interno/nota administrativa;
- nova revisão substituindo/apagando histórico;
- CI do SHA publicado deixar de corresponder ao SHA homologado.

## Evidência de rollback ensaiado

Antes da produção, o Work deve registrar em homologação:

1. versão anterior simulada;
2. aplicação da cadeia nova;
3. smoke test;
4. falha controlada escolhida;
5. restauração de frontend/Edge ou correção compensatória de banco conforme o caso;
6. confirmação de que dados/snapshots históricos continuam presentes;
7. novo smoke test;
8. PASS/FAIL.

## Resultado esperado

A produção só recebe a PR quando o sistema puder avançar e recuar de maneira controlada, com banco, Edge, frontend e app compatíveis e com histórico preservado. CI verde isoladamente não é autorização de deploy.
