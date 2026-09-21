# Revisão de governança para emissão comercial — 21/09/2026

**Situação:** correções técnicas na PR nº 18; produção não publicada. Não registrar esta auditoria como aprovação jurídica ou aceite de condições comerciais.

## Causa objetiva do bloqueio

A função `public.assert_document_governance_ready()` impede criar/gerar quando existem revisões pendentes, itens com `last_contract_master_version` desatualizado, itens ativos sem referências de cláusulas ou textos obrigatórios ausentes. A produção apresentava **55 revisões pendentes** na inspeção: **21** do tipo `contract` (18 serviços e 3 níveis), **18** do tipo `service` (compatibilidade entre serviço e nível) e **16** do tipo `text` (textos após mudança dos níveis). Não alterar `document_rule_reviews.status` diretamente nem usar acesso privilegiado para simular uma confirmação de administrador.

## Correções técnicas implementadas

- `Outros`: descrição individual obrigatória, sem duplicação no orçamento; prazo, formato e revisões não são deduzidos de outros serviços.
- Consultoria Técnica (`q`): deixa de ser elegível a Bronze/Prata/Ouro e de ter revisões/PDF presumidos para novas contratações. Gerador também corrige **novos documentos gerados com snapshots antigos**, sem alterar documentos já congelados.
- Legalização administrativa (`k,l,m`), acompanhamento de obra (`n`), laudo/vistoria (`o`) e categoria indefinida `p`: deixam de receber automaticamente níveis exclusivos de projetos. Demais parâmetros próprios são preservados.
- Projeto de Combate a Incêndio (`r`): preserva natureza de projeto complementar; referências de cláusulas passam a constar no catálogo. Para `q` e `r`, vincular cláusulas **não equivale à aprovação do texto** nem atualiza automaticamente a versão mestre marcada como revisada.
- Contrato e orçamento Word: preservação de endereços distintos, escopo incluído e controle de versões; testes automatizados no workflow `commercial-documents.yml`.

## Questões editoriais e contratuais que impedem confirmação responsável

1. O Contrato Mestre v1 (ativo em 21/09/2026) contém **campos entre colchetes ainda não finalizados**, incluindo prazos das cláusulas 3.2–3.4, critérios de atraso e desconto da cláusula 7, prazo de sigilo da cláusula 14, aviso e penalidade da cláusula 16 e **foro `[cidade/UF]`** na cláusula 23. Não substituir por valores inventados nem remover os colchetes sem decisão expressa.
2. As cláusulas **1.5.1–1.5.3** especificam recursos visuais nos níveis BRONZE/PRATA/OURO. O catálogo de níveis atual descreve alguns recursos como condicionais ao orçamento. Conferir e alinhar se os recursos visuais são garantidos em todos os projetos elegíveis ou apenas quando expressamente previstos. Não aprovar as três revisões de nível até resolver essa divergência.
3. A cláusula **1.7** restringe níveis aos serviços de projeto; o catálogo anterior considerava elegíveis também consultoria, trâmites administrativos, vistorias e Outros. A migração da PR corrige prospectivamente essa classificação. Verificar especialidades e propostas existentes caso a caso; documentos já emitidos não são reescritos.
4. A cláusula **2.1** define 45 dias úteis para projetos e a **6.1** define revisões padrão de projetos. Não aplicar essas condições a consultorias, laudos, serviços administrativos e atividades personalizadas sem detalhamento contratual. A PR corrige a geração de novas versões; Anexo I e redação-mestra ainda exigem conferência integral.
5. Verificar os 18 textos de serviço, as 16 frases inteligentes e a matriz de compatibilidade dos níveis com os serviços efetivamente contratáveis antes de confirmar cada revisão; não aprovar em lote por mera correspondência numérica de cláusulas.

## Critério de liberação

A publicação requer: versão final do Contrato Mestre com campos definidos, correspondência demonstrável entre níveis/catálogo/Anexo I, aprovação individual rastreada das revisões por usuária administradora, teste autenticado de orçamento + contrato + Anexo I no mesmo escopo e teste de reemissão preservando versão antiga (baixar sem arquivar / arquivar). Manter a PR como rascunho enquanto qualquer requisito falhar. Dados de clientes, acessos e textos integrais do contrato não devem entrar neste repositório público.
