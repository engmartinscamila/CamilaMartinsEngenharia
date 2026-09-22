# PR #19 — estado de continuidade verificável (22/09/2026)

**Regra de conclusão:** código na PR ≠ testes automatizados no SHA final ≠ homologação autenticada ≠ deploy ≠ verificação pós-publicação. Este arquivo registra evidências e bloqueadores; nenhuma etapa operacional é declarada concluída por haver apenas migration/tela/CI. Consultar o HEAD da PR e as quatro suítes no GitHub antes de usar este documento: novos commits invalidam o status de CI anterior.

**Repositório:** `engmartinscamila/CamilaMartinsEngenharia`; PR #19, branch `fix/governanca-preflight-dupla-auditoria-20260921`, permanece DRAFT, não mesclada. Preservar a PR #18 publicada, arquivos e baselines legadas, Contratos Mestre v1/v2 e documentos existentes. Não executar testes destrutivos nem migrations de PR em produção.

## Implementado somente no código da PR (necessita homologação integrada)

- Contratação explícita do serviço de cronograma e vínculo ORC→CON→projeto; modelos por natureza apenas como sugestão, não como prazo/peso universal. Benchmark em `docs/benchmark-cronograma-construcao-20260922.md`.
- Formulário guiado com opções avançadas, feriados informados para a obra, pesos físicos independentes e revisão expressa de escopo. Motor de dependências/datas e análise de CPM/folga em módulo único, com regressões automatizadas.
- Separação entre honorários comerciais e orçamento da execução. RPC `admin_set_full_schedule_execution_budget`, serviço e tela de quantitativos exigem custo/fonte e permitem quantidade × preço unitário; peso financeiro recalculado a partir dos custos; peso físico mantém critério próprio.
- Baselines arquivadas, medição datada imutável, bloqueio de alteração direta do realizado, publicação explícita e revogável, snapshot do cliente sem custo/nota interna, Curva S, Gantt e indicadores. XLSX gerado sob demanda e testado em ambiente sintético (não via sessão autenticada de homologação).
- Revisões/aditivos usam novo schedule_id, justificativa, versão vigente distinta da histórica e preparação temporária ligada ao contrato/usuário; consultas legadas apontam para a versão vigente. A mudança de versão e as funções que dependem dela ainda exigem E2E no staging equivalente.
- Reuso de cliente existente por busca autorizada, sem alterar silenciosamente cadastro histórico; busca tolerante de serviços com confirmação, não seleção automática; texto de 'Outros' com escopo fechado e referência normativa documentada.
- Regressões de documentos comerciais e testes de segurança com fixtures; inventário das 39 funções SECURITY DEFINER em `docs/seguranca-inventario-rpcs-pr19-20260922.md`, mas não houve prova autenticada de autorização por função nem pentest de produção.

## Correções adicionais desta retomada (22/09/2026)

1. `scripts/security/construction-schedule-budget-regression.mjs`: eliminou falso positivo causado por comentário SQL com a palavra honorários; verificação agora olha o SQL executável e mantém exigência de nenhuma origem comercial de custo.
2. `supabase/migrations/20260923000500_cronograma_publicacao_curva_cliente.sql`: consertou `permission denied` nas funções auxiliares do editor administrativo com EXECUTE restrito a `authenticated` e predicados `is_portal_admin()`; função permanece SECURITY INVOKER e `anon` não obtém acesso. Regressão de publicação/isolamento A/B passou na suíte de segurança no commit `955178f`.
3. `supabase/migrations/20260923001500_cronograma_pedido_reprogramacao.sql`: preservou no caminho de primeira criação da RPC atômica a gravação de feriados e pesos físicos que havia sido perdida ao sobrescrever o wrapper anterior.
4. `portal-app/src/services/construction-schedule-budget-service.ts`: orçamento passa a encontrar a revisão mais recente **em rascunho**, mesmo que ainda não seja vigente. A baseline anterior aprovada não se torna editável; RPC exige `activation_status='draft'`.
5. `scripts/security/construction-schedule-revision-request-regression.mjs`: regressões acrescentadas para persistência de feriados, pesos físicos e orçamento de aditivo em rascunho.

**CI:** no commit `955178f`, segurança e documentos comerciais obtiveram success; portal-app e auditoria ainda executavam durante a leitura. Foram adicionados commits depois disso, portanto esse resultado NÃO vale como quatro suítes aprovadas no HEAD final. Reconsultar GitHub Actions e registrar os quatro IDs/conclusões sobre o mesmo SHA antes de homologar.

## Bloqueado por ambiente/execução operacional (ChatGPT Work)

- Staging Supabase `nvhjcoxnzigwwbdbhkhq` divergente: consulta somente leitura desta retomada confirmou que, entre oito tabelas relevantes consultadas, existem `commercial_records` e `commercial_contract_quote_links`, mas não há as seis tabelas do cronograma consultadas; não instalar só a migration nova. Reconstruir cadeia completa/dependências e Edge Functions em staging isolado com fixtures fictícias, sem dados pessoais reais nem custo não autorizado.
- Testar com sessões legítimas A/B/admin: orçamento→contrato→Anexo I→DOCX→arquivo/histórico; cada botão/tipo de documento; cronograma contratado/não contratado, aditivo, orçamento/quantitativos, feriados, aprovação, medição, publicação/revogação, XLSX real aberto, temas/desktop/mobile, primeiro acesso/recuperação de senha, expiração/falha de Edge/snapshot e rollback. Registrar PASS/FAIL por cenário e SHA de frontend/Edge/banco.
- Auditar bundle publicado, configurações Auth e Cloudflare, WAF/rate limit, RLS/views/Storage, 39 funções privilegiadas individualmente, validação de servidor e endpoints; avisos do Advisor não equivalem a exploração comprovada. Não imprimir segredos, não conceder privilégios em massa, não testar produção com identidades reais.
- Plano de deploy sincronizado com rollback testado só após os gates; manter a PR em draft e produção inalterada até então.

## Decisão humana obrigatória (administradora)

- Rever individualmente as 51 pendências materiais da versão v3 do Contrato Mestre, aprovando/rejeitando/ajustando com justificativa; não aprovar em massa e não remover `assert_document_governance_ready`.
- Confirmar parâmetros de cada obra sem base objetiva e critérios de peso físico, validar material jurídico/normativo e autorizar explicitamente publicação só após homologação. Nenhuma destas decisões é inferida da solicitação genérica de continuar o desenvolvimento.

**Condição de entrega:** quatro suítes verdes no HEAD, staging equivalente e E2E autenticado documentado, 51 decisões materiais quando aplicáveis, rollback testado e autorização expressa antes de produção. Para detalhes de origem, consultar o DOCX de transferência de 22/09/2026, seções 1–20. A própria existência deste registro não é evidência de homologação.
