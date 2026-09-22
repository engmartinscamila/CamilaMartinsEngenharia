# Estado de continuidade verificável — PR #19 — 22/09/2026

**Regra de liberação:** código na PR ≠ CI verde ≠ homologação autenticada ≠ implantação sincronizada ≠ confirmação pós-publicação. Não marcar como concluído um módulo que possui apenas código, documentação ou ensaio sintético.

**Repositório:** `engmartinscamila/CamilaMartinsEngenharia`; PR #19 `fix/governanca-preflight-dupla-auditoria-20260921` permanece DRAFT, sem merge/publicação. PR #18 já estava em produção na transferência e deve ser preservada. A PR #19 possuía HEAD inicial `3faa5d43476847acf053c3d2446b85772b837cac` e quatro workflows success. Após novos commits, **sempre usar o SHA atual da PR no GitHub Actions**, não o SHA histórico. Nenhuma alteração de produção foi executada nesta retomada.

## Trabalho efetivamente realizado nesta retomada

| Área | Evidência | Estado honesto |
|---|---|---|
| Pesquisa/benchmark de cronogramas | `docs/benchmark-cronograma-construcao-20260922.md`, fontes PMI/Smartsheet consultadas, commit `91357917` | Pesquisa documental concluída; parâmetros produtivos reais não definidos. |
| CPM, calendário e folgas | `portal-app/src/lib/construction-schedule-critical-path.ts` e `portal-app/scripts/test-construction-schedule-critical-path.mjs`; commits `99195db1`, `7ca389ee`, correção de TypeScript `4bfc1aba` | **Módulo de cálculo isolado e testes automatizados**, ainda não ligado à UI, às RPCs ou ao XLSX oficial. Não equivale ao requisito integral concluído. |
| CI do CPM | `.github/workflows/portal-app-pr.yml`, commit `90877b60` adiciona etapa obrigatória de CPM | Teste incluído na suíte; houve falha inicial TypeScript TS2532 em `90877b60`, corrigida em `4bfc1aba`. No SHA `4bfc1aba`, segurança, documentos e portal-app concluíram com success; auditoria completa foi cancelada por push posterior. |
| Segurança: metadados de funções privilegiadas | `docs/seguranca-inventario-rpcs-pr19-20260922.md`, commit `0910267d`; Advisor e SQL read-only de metadados produção | Inventário/triagem preliminar de 39 funções; **não** validação semântica, correção, certificação ou teste com usuário real. |
| Ambientes | `portal-cliente` e `camila-martins-homologacao` consultados sem escrita | Ambos ativos; homologação ainda não possui o legado e as estruturas novas indispensáveis ao cronograma. |
| Produção | PR mantida draft; nenhuma migration/deploy/merge/grant aplicado | Preservada. |

## Backlog integral — implementação e validação pendentes

1. **Segurança antes de expandir módulos:** confrontar bundle realmente publicado, variáveis e segredos sem revelá-los; analisar por inteiro 39 corpos de RPC, roles, grants, RLS, views e Storage com testes fictícios A/B/admin, sem revogar em massa. Auditar Auth leaked-password, entrada/SQL/XSS/CSP, SSRF somente se houver URL configurável, LLM somente se houver integração, rate limits, erros e painéis Cloudflare. Não assumir vulnerabilidade só pelo vídeo.
2. **Formulário guiado do cronograma:** hoje tela nova exibe numerosos campos ao mesmo tempo. Introduzir etapa curta, campos avançados sob demanda, menos repetição, ajustes seguros e revisão individual de escopo/pressupostos.
3. **Presets versionados:** validar por natureza e obra, sem pesos/duração universais; documentar critérios efetivos antes de promover valores à produção.
4. **Gráficos em tela:** Admin e Cliente com planejado×realizado, Curva S, marcos e desvios, restrição de custos internos para cliente. Exportador Excel tem gráficos; tela ainda não equivale ao requisito.
5. **Aditivos/reprogramação:** atualmente um cronograma por projeto (`UNIQUE (project_id)` no legado), embora baselines arquivadas existam na PR. Projetar revisão vigente explícita, preservar histórico e adaptar RPCs, RLS, medições, publicações, consultas, exportador e UI; não remover constraint isoladamente.
6. **Orçamento executivo e quantitativos:** itens, unidade, quantidade, preço, composição/fonte, custo, vínculo com atividades e critério de peso físico separado. Honorários de engenharia nunca são custo da obra.
7. **CPM integral:** ligar o módulo isolado ao planejamento real, garantir dependências e calendários coerentes na persistência, exibir no Admin e no XLSX, incluir marcos/deadlines e testar E2E.
8. **Selecionar cliente existente:** busca restrita/autorizada por nome, CPF/CNPJ, autocompletar orçamento/contrato, não sobrescrever histórico, preservar novo prospect.
9. **Serviços com erro ortográfico:** normalizar caixa/acentos, sugerir aproximações conservadoras, confirmação obrigatória para serviço oficial; nunca selecionar ambiguidade automaticamente.
10. **Texto de Outros:** auditar escopo fechado, coerência ORC/CON/Anexo I e confirmar legislação brasileira antes de citar artigo; não inventar base legal.
11. **Demais documentos/botões:** verificar tipo correto, origem, versão, snapshot, arquivo gerado, integridade, compensação quando Edge final falhar depois do gerador canônico; preservar documentos anteriores.
12. **51 revisões materiais do Contrato Mestre v3:** submissão INDIVIDUAL à administradora para aprovar/rejeitar/ajustar; não aprovar automaticamente; manter `assert_document_governance_ready` e histórico v1/v2.

## Portões operacionais em ordem

A. **Código:** implementar pendências na PR, teste de regressão defensivo por alteração, comparar diff e validar migrações/dependências e contratos do app, sem tocar produção.
B. **CI do SHA FINAL:** quatro workflows success no mesmo SHA; registrar IDs e conclusão, não inferir do SHA anterior.
C. **Homologação isolada:** construir esquema equivalente aplicando histórico completo/Edge compatível, sem copiar dados pessoais; frontend/app/staging todos na mesma versão.
D. **Testes autenticados Work:** admin/cliente sintético, A/B, CPF/CNPJ e novo cliente, ORC→CON→Anexo I→DOCX e demais tipos, emissão/download/histórico, cronograma contratado/não contratado, aprovação/medição/republicação/aditivo, XLSX real aberto, recuperação/primeiro acesso, responsividade, temas, expiração, falhas simuladas seguras e rollback. Registrar PASS/FAIL e evidência redigida.
E. **Revisões humanas e autorização:** obter decisões individuais sobre 51 textos e os demais parâmetros técnicos sem base objetiva; não decidir pela administradora. Preparar rollback e plano SHA sincronizado banco+Edge+frontend+app.
F. **Produção:** somente após gates anteriores e autorização expressa, publicação coordenada e verificação pós-deploy; nunca usar produção para ensaios invasivos.

## Transferência específica ao ChatGPT Work

Trabalhar apenas depois que a PR estiver tecnicamente pronta, tomando este arquivo e o relatório original atualizado de 22/09/2026 como fontes. Ler o SHA real e não confiar nos SHAs históricos. O ambiente staging está incompleto (inclusive ausência de `construction_schedules`/`construction_schedule_items`). Recriar dependências e migrations completas e usar apenas fixtures fictícias. Não reutilizar segredos nem pedir senha em chat. Não marcar documento, feature nem segurança como concluídos antes de sessão autenticada, teste real do artefato, rollback e evidência. Não aprovar as 51 revisões e não publicar sem consentimento de produção.

## Referências de origem

Documento de transferência `Relatorio_transferencia_estrutura_site_ATUALIZADO_AUDITORIA_VIDEO_SEGURANCA_2026-09-22(1).docx`, seções 1–20. Estado inicial da PR #19 e `docs/estado-implantacao-cronograma-20260922.md` no repositório. Fontes oficiais de Supabase indicadas no inventário. Não usar a existência deste relatório de estado como prova de execução dos itens pendentes.
