# PR #19 — Plano recuperado do chat anterior / cronograma físico-financeiro

Registro de continuidade: 21/09/2026. Fonte: decisões da conversa anterior recuperadas, diagnóstico na própria PR #19 e planilha de referência `02_Cronograma_Fisico_Financeiro.xlsx`. Este documento é a memória do escopo, **não** certificado de implementação ou autorização de deploy.

## Instruções vinculantes

- Base: PR #18 integrada à `main`; preservar todos os documentos, contratos e cronogramas existentes. PR #19 fica draft até homologação; nenhuma publicação antecipada.
- Avançar automaticamente na ordem estabelecida. Duas checagens independentes por alteração: funcionalidade e regressão/compatibilidade (site, aplicativo, Supabase, documentos e histórico). Corrigir falhas antes de avançar.
- Contrato Mestre v3, 18 serviços e pacotes Bronze/Prata/Ouro inclusive avulsos devem permanecer coerentes; não acrescentar serviço, execução ou entrega automaticamente. Preservar v1/v2.
- A elaboração/acompanhamento do cronograma COMPLETO é serviço opcional e de preço próprio, expressamente presente no orçamento, contrato e Anexo I. Não presumir fiscalização, gerenciamento ou execução. Validar cliente, projeto, orçamento, contrato, escopo, versão, status e valores no servidor, não só na UI.
- Distinguir honorários contratuais do orçamento **de execução da obra**. Sem orçamento de obra suficientemente detalhado, custos e pesos não podem ser apresentados como dados reais. Exigir revisão de origem, quantitativos e custos; nunca inventar custos.
- Linha de base do planejamento aprovada é imutável; acompanhamento atualiza o bloco atual/real. Aditivos e reprogramações exigem uma revisão identificável sem apagar anteriores. Não alterar registros legados implicitamente.
- Dados ilustrativos devem ser rotulados como referência; não publicar como prazo, custo ou escopo específico da obra. Histórico de avanço realizado depende de medições datadas, não de interpolação retroativa de um único percentual.
- Cliente autenticado somente visualiza projeto a que tem acesso e material expressamente liberado; cliente não edita escopo, custos ou linha de base. JWT/RLS e trava `assert_document_governance_ready` permanecem ativos.

## Sete etapas originais — critério de aceite e estado em 21/09/2026

1. **Governança comercial**: serviço opcional explícito no catálogo e documentos, sem execução presumida. Implementação proposta na PR; homologação documental v3 continua bloqueada por 51 revisões individuais pendentes.
2. **Vínculo orçamento → contrato → cronograma**: seleção por identificadores consistentes e verificação backend, sem criação/exportação automática por mero acesso à tela. Migrações e tela propostas; homologação integrada pendente.
3. **Biblioteca de modelos e atividades**: residencial novo preserva **20 atividades atuais como referência inicial**, reforma oferece modelo específico, execução parcial inicia somente com escopo contratado e comercial/outros serviços devem ser analisados por natureza. Versionar modelos; revisar e confirmar cada item antes de incorporá-lo. Migração de 4 modelos existe, com revisão individual; não presume prazo/peso para os outros três.
4. **Pesos, prazos e dependências**: redistribuir apenas entre atividades realmente escolhidas; peso financeiro deriva de orçamento de obra validado e peso físico de quantitativos/critérios aceitos; calendário selecionável (úteis/corridos e feriados quando cadastrados), precedências, início/término calculados, caminho crítico e marcos. Motor parcial existe; caminho crítico completo, pesos físicos independentes e calendário persistido com feriados ainda precisam ser verificados.
5. **Gestão físico-financeira**: vincular orçamento de construção por item, quantidades, custo e fonte; registrar medição datada, avanço planejado/real, indicadores de custo/prazo, Gantt e Curva S física E financeira. Não inferir histórico real de datas atuais nem usar honorários como custo. Pendente integração completa; orçamento comercial existente não é orçamento de execução, e `purchase_quote_items` não contém preço unitário no esquema publicado.
6. **Interface, documentos e histórico**: selecionar cliente/projeto/orçamento/contrato; confirmar plano e aprovar; Excel coerente com o calendário, prazo integral e linha de base; versões/aditivos auditáveis; acesso restrito do cliente, preservar cronograma simples/legado. Nova tela e aprovação parcial existem. Exportador legado ainda fixa 27 semanas, usa calendário de Excel diferente e inicializa por RPC antiga; `construction_schedules` na produção tem UNIQUE(project_id), incompatível com múltiplos registros de versões sem migração/abordagem específica.
7. **Auditoria final e homologação**: duas checagens por alteração, CI das quatro suítes `security`, `document-regression`, `validar` e `auditoria` no SHA final; migrações sobre esquema equivalente sem dados reais, testes de autenticação administrador/cliente, permissões, reemissão/rollback, UI desktop/mobile, Excel, baseline e legado. Não confundir testes sintéticos com produção. Revisão individual de 51 pendências documentais pela administradora é bloqueio de aprovação material; não aprovar em massa.

## Referência da planilha já existente

`02_Cronograma_Fisico_Financeiro.xlsx`, versão 1.0 (04/08/2026), contém: `Cadastro`, `Cronograma`, `Curva S`, `Marcos`, `Export Dashboard` e `Leia-me`. Campos: ID, EAP, etapa, atividade, responsável, início/fim base e atual, duração, dependência, avanço, peso físico, valor previsto e realizado, desvio e status. Exige congelar linha de base, atualizar real semanalmente, revisar marcos/desvios, preservar evolução semanal REAL como entrada histórica e exportar indicadores com data. Os valores e datas do arquivo são apenas exemplos ilustrativos.

## Regras para status

Não marcar como *concluída* etapa apenas porque possui código ou teste unitário. Distinguir: implementada na branch / validada em CI / homologada com sessão e esquema equivalentes / publicada. Em caso de falha, registrar SHA exato e erro. Não fazer merge/deploy enquanto pendências materiais persistirem.
