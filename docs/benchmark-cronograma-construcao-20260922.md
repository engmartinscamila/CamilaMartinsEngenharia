# Benchmark verificável — cronograma físico-financeiro (22/09/2026)

## Objetivo e método

Pesquisa documental de referências de planejamento para obras residenciais, reformas, escopos parciais e pequenas obras comerciais. **Não é levantamento estatístico de produtividade**, validação de custos SINAPI, composição de preços nem homologação de qualquer modelo do portal. A base oficial de cada cronograma continua sendo o orçamento de execução e o contrato vinculados à obra; honorários de engenharia não são custo de construção.

## Fontes efetivamente consultadas

1. Project Management Institute, *Scheduling 101 — the Basic of Best Practices* (2009): https://www.pmi.org/learning/library/schedule-101-basic-best-practices-6701 — estruturar WBS/EAP, pacotes de trabalho, atividades, lógica/dependências, recursos, prazos e análise; cada projeto é único e a pergunta central é se o cronograma é executável.
2. Project Management Institute, *Critical path method calculations*: https://www.pmi.org/learning/library/critical-path-method-calculations-scheduling-8040 — CPM com avanço e retorno (ES/EF/LS/LF), folga total e possibilidade de mais de um caminho crítico; atividade com folga zero pode afetar o término.
3. Smartsheet, *Modelos gratuitos de cronograma de construção*: https://pt.smartsheet.com/content/construction-schedule-templates — modelos distintos para obra simples, residencial, reforma, comercial, CPM e horizonte de três semanas; datas planejadas/reais, avanço, aprovações e marcos.
4. Smartsheet, *Free Construction Gantt Chart Templates*: https://www.smartsheet.com/content/gantt-chart-construction-templates — fases, dependências, marcos, recursos, coordenação de empreiteiros e inspeções, customização por reforma/residencial/comercial.

Fontes 1–4 fundamentam a **estrutura de trabalho e a experiência visual**, não autorizam adotar suas durações, porcentagens, produtividade ou custos como padrões da obra no Brasil. A consulta foi realizada em 22/09/2026.

## Decisões para presets seguros

| Natureza | Sugestão de agrupamento editável | Regras de preenchimento |
|---|---|---|
| Residencial nova | preparação e licenças, fundações/estrutura, instalações, vedações, acabamentos, inspeção e entrega | Exibir apenas atividades efetivamente contratadas; duração, sequência, custo e marco dependem de escopo, projeto, licenças, equipe e calendário. |
| Reforma | diagnóstico/proteção, demolição selecionada quando aplicável, adequações, instalações, acabamentos, conferência e entrega | Não presumir demolição, remoção estrutural ou desocupação; registrar interferências e limitações. |
| Execução parcial | somente serviços contratados, suas interfaces, aceites e entrega | Iniciar sem lista predefinida universal; vínculo estrito a códigos do orçamento/contrato. |
| Comercial | planejamento e liberações, etapas contratadas, instalações/compatibilização, inspeções e entrega | Não presumir ocupação, normas especiais, sequência, escopo nem prazo sem dados próprios. |

**Valor universal de duração, custo, peso ou produtividade: nenhum.** Valores ilustrativos não devem se tornar defaults silenciosos. Pesos financeiros provêm de custos de obra completos, verificáveis e aprovados; pesos físicos usam quantitativos/critério técnico independente e justificativa. O sistema deve sinalizar campos incompletos, não estimar dados desconhecidos.

## UX alvo do modo guiado

1. Selecionar projeto → orçamento com serviço de cronograma expressamente contratado → contrato vinculado.
2. Escolher natureza/modelo e marcar somente atividades do escopo; oferecer inclusão de atividade contratada específica.
3. Informar data inicial, calendário e custos/quantidades; propor dependência apenas quando justificável; esconder campos avançados até pedido do usuário.
4. Revisar prazos, feriados, custos, pesos e critérios físicos em uma etapa única; exigir confirmação antes de aprovar a linha de base.
5. Exibir no admin Gantt, Curva S planejado×medido, marcos, prazo e CPM (folga explícita e validação). Ao cliente, publicar snapshot resumido sem honorários, custos internos ou dados de outros projetos.

## Evidências exigidas, ainda NÃO realizadas aqui

Pesquisa documental concluída; parametrização em projeto real, aprovação dos presets, integração UI→RPC→XLSX, comparação com produtividade/orçamento específicos, E2E autenticado e validação do usuário permanecem pendentes. Não converter a existência deste arquivo em status de implementação ou homologação.
