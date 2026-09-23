# Cronograma físico-financeiro — estado verificável em 22/09/2026

## Alterações executadas somente na PR #19

- **Contratação expressa e vínculo comercial:** serviço opcional de cronograma completo (`s`), validação ORC→CON→projeto e titularidade; modelos de quatro naturezas continuam referências revisáveis, nunca parâmetros universais.
- **Preenchimento guiado:** a criação passou a usar modo guiado por padrão; predecessoras manuais, feriados, pesos manuais e critérios físicos ficam em opções avançadas. A administradora confirma atividade/escopo antes de salvar.
- **Cliente existente:** novo orçamento pode pesquisar cliente cadastrado por nome/CPF/CNPJ e usar seus dados como snapshot sem alterar silenciosamente o cadastro original; novo prospect continua disponível.
- **Busca tolerante de serviços:** normalização de caixa/acentos e similaridade conservadora; pequenos erros geram sugestões, nunca vínculo automático. Código oficial curto só é aceito por correspondência exata. A seleção exige confirmação explícita.
- **Custos e pesos:** custos da execução permanecem separados dos honorários. Peso financeiro é derivado de custos completos da obra; peso físico permanece independente e exige critério técnico quando utilizado.
- **Orçamento executivo / quantitativos:** módulo administrativo específico para unidade, quantidade, preço unitário, fonte e custo; composição unitária é validada no servidor e `planned_cost = quantidade × preço unitário`. O RPC recalcula os pesos financeiros pela participação de cada custo no total da execução.
- **CPM/caminho crítico:** o módulo dedicado existente de caminho crítico e folga foi integrado à conferência do planejamento; atividades críticas e folga total são exibidas antes da aprovação. O motor de datas continua separado para não haver dois algoritmos concorrentes.
- **Feriados/calendário:** calendário e feriados conferidos continuam persistidos e congelados na aprovação; dias úteis e corridos permanecem semanticamente separados.
- **Medições:** avanço real exige evento datado, responsável e justificativa; UPDATE direto de campos reais em linha aprovada permanece bloqueado. Correções geram nova medição, não reescrevem histórico.
- **Gráficos Admin:** Curva S planejado × medido ganhou visual responsivo usando as métricas históricas já existentes; realizado não é interpolado quando não há medição.
- **Gráficos Cliente:** a publicação agora pode carregar resumo sanitizado (planejado, realizado medido, desvio, prazo), Gantt e Curva S agregada. Custos, pesos internos, fontes, honorários, notas e vínculos comerciais não integram o snapshot público.
- **Publicação ao cliente:** continua explícita, revogável e vinculada ao próprio projeto. A publicação de uma revisão exige que ela seja vigente e aprovada.
- **Linha de base:** snapshots aprovados permanecem imutáveis e paginados; medições/publicações continuam vinculadas por `schedule_id`.
- **Aditivo/reprogramação:** deixou de depender conceitualmente de um único cronograma por projeto. Cada revisão usa novo `schedule_id`, `revision_number`, `supersedes_schedule_id` e marcador `is_current`; a versão anterior não é apagada. Uma nova revisão parte somente da versão vigente/aprovada, revalida orçamento/contrato e não copia custos, datas, pesos, avanço ou medições como verdade atual.
- **Preparação de aditivo:** uma tela administrativa registra versão anterior, novo orçamento/contrato e justificativa. O pedido expira em 24 h, fica ligado ao mesmo usuário e é consumido uma vez pelo formulário guiado. Sem pedido compatível, o fluxo normal recusa sobrescrever cronograma aprovado.
- **Exportador XLSX:** continua gerando arquivo sob demanda a partir da linha de base, sem usar Storage como banco paralelo. Suítes sintéticas geram/reabrem XLSX; a geração autenticada pelo site e abertura manual em homologação ainda são gates do Work.
- **“Outros” / atividade personalizada:** base normativa oficial foi documentada, mas o escopo continua fechado e literal. O sistema não inventa visitas, revisões, acompanhamento, execução ou entregáveis e não usa citação legal como decoração contratual.
- **Segurança:** inventário das 39 `SECURITY DEFINER` foi atualizado com leitura semântica direcionada. Funções amostradas de push, agenda, aprovação e notificação contêm controles de sessão/ownership; isso é controle existente, não substitui o teste A/B autenticado em homologação. Nenhuma revogação em massa foi feita.
- **Homologação/rollback:** foram adicionados `docs/homologacao-pr19-manifesto-20260922.md` e `docs/plano-deploy-rollback-pr19-20260922.md` com ordem, gates, dados sintéticos, arquivos reais, segurança, desktop/mobile, evidência e rollback. O staging divergente não deve receber somente as migrations novas.

## Testes automáticos adicionados/reforçados

- reuso de cliente existente sem UPDATE silencioso de `clientes`;
- busca tolerante de serviços sem auto-seleção;
- cadeia de revisões/aditivos e preservação histórica;
- pedido temporário/consumível de reprogramação;
- quantitativos, fonte, composição unitária e derivação de peso financeiro;
- vínculo contratual e contratação expressa do cronograma;
- biblioteca/modelos versionados;
- aprovação/linha de base;
- medições e rollback transacional;
- bloqueio de avanço sem medição;
- arquivo imutável de baselines;
- feriados/calendário;
- publicação e isolamento A/B sintético;
- snapshot do cliente sem custo/peso/fonte/nota interna;
- Curva S agregada sanitizada;
- timestamps únicos de migrations;
- scanner de segredos;
- geração/reabertura de XLSX sintético.

## Estado do CI

A referência correta é sempre o **HEAD final da PR**, não um commit anterior. Durante esta rodada, regressões encontradas foram corrigidas em commits subsequentes (TypeScript estrito da busca tolerante; código oficial curto; permissão da função auxiliar de Curva S). As quatro suítes devem estar `success` no HEAD final antes de considerar a fase de código pronta para homologação.

## O que continua bloqueando uma declaração de conclusão do sistema

1. **Homologação equivalente:** o projeto Supabase de staging `nvhjcoxnzigwwbdbhkhq` continua com histórico/schema divergente. Deve ser reconstruído/atualizado de forma isolada com a cadeia completa de dependências e dados sintéticos; não aplicar apenas migrations novas e declarar homologado.
2. **Teste E2E autenticado:** administradora + cliente A/B, orçamento → contrato → Anexo I → DOCX → histórico → cronograma → orçamento executivo → aprovação → medição → gráficos → publicação → XLSX → revogação → reprogramação, além de primeiro acesso/recuperação, sessão expirada, erros e rollback.
3. **Arquivos reais:** gerar pelo site, baixar e abrir todos os documentos e o XLSX no ambiente homologado.
4. **Desktop/mobile/temas:** validar navegação, responsividade, claro/escuro/automático e retorno.
5. **Segurança operacional:** testar as 39 RPCs com A/B/admin fictícios, Storage e objetos; conferir bundle/configuração, Cloudflare WAF/rate limit/CAPTCHA e Supabase Auth. Proteção de senhas vazadas continua dependente de confirmação de plano/custo/UX antes de ativação.
6. **51 revisões materiais do Contrato Mestre v3:** permanecem decisão individual da administradora. Não aprovar em massa nem remover `assert_document_governance_ready`.
7. **Deploy:** banco, Edge, frontend e app somente no mesmo SHA homologado, com rollback ensaiado e autorização expressa. Produção permanece inalterada nesta fase.

## Regra para continuidade

**Cinco estados distintos:** código na PR → CI automatizado no SHA final → homologação autenticada equivalente → deploy sincronizado autorizado → verificação pós-publicação. Não marcar uma funcionalidade como concluída apenas porque existe migration, tela, Edge Function ou teste sintético. Preservar PR #18, versões v1/v2, contratos, documentos, cronogramas e arquivos legados.
