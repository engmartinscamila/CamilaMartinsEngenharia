# Plano de evolução do ERP de engenharia — Camila Martins Engenharia
**Base de código examinada:** `main@39a6cecf2c84272207d9031f903940826c5dc5ee` (07/11/2026).  
**Objetivo:** adaptar padrões funcionais públicos e práticas verificadas em software livre, **sem copiar código fechado, substituir o portal atual ou alterar dados em produção de forma destrutiva**.

## Evidências e referências
- Comerciais (fluxos documentados, **não** algoritmos privados): Vobi, Mais Controle, Nurbie, Sienge, OrçaFascio, JobTread, Prevision, Autodesk Docs/Forma, Procore, Arquio.
- Código aberto inspecionado: ERPNext, BuildSuite Core, OpenProject, Dolibarr, Odoo Community, OpenConstructionERP, Kimai, Paperless-ngx, Frappe CRM, Plane e solidtime.
- Bibliotecas com licença potencialmente adequada para avaliação: Frappe Gantt (MIT), TanStack Table (MIT), ECharts (Apache-2.0), docx (MIT). Adoção depende de análise da licença específica, integração com Expo web/native e regressão de acessibilidade.
- O que foi recuperado é um estudo funcional/arquitetural; não há comprovação de funcionamento autenticado de todos os produtos externos.

## Restrições obrigatórias
1. Preservar React Native/Expo web + Supabase/Auth/RLS + GitHub Pages + R2/Worker. Evoluir módulos, não reescrever toda a plataforma.
2. Projeto é criado com cliente/endereço e **sem exigir contrato**; orçamento, contrato e projeto não possuem dependências circulares. Contratos e recibos de serviços avulsos continuam permitidos.
3. Não perder contratos, recibos, pagamentos, anexos, fotos, versões, assinaturas, documentos emitidos, projetos 3D ou modelos aprovados.
4. Download de documento não pode emitir revisão. Aditivo é diferente de revisão; alterações de escopo/preço/prazo exigem registro explícito.
5. Não exibir ao cliente dados financeiros internos sem liberação. Respeitar permissões por usuário/cliente/projeto e logs.
6. Segurança/continuidade: migrações forward-only, backup e teste de restauração antes de DDL/DML, rollback de interface por SHA; nunca exclusão automática baseada em código supostamente não usado.
7. Histórico financeiro é imutável; estorno precisa ser compensação rastreável, e recibo não deve criar entrada duplicada.

## Módulos, transferência de padrões e ordem de implantação

| Fase | Referências | Aplicação independente no sistema | Alterações técnicas | Critério de aceite |
|---|---|---|---|---|
| 1A. Cobranças e visibilidade | ERPNext, Mais Controle | Exibir extrato contratual e serviços avulsos com prioridade por vencimento, saldo sem parcelas e créditos separados | Consulta derivada dos lançamentos existentes; filtros e ordenação puros | Sem somar parcela ao saldo restante; CSV usa filtro atual; nenhum DDL |
| 1B. Contas a receber transacionais | ERPNext, Odoo, Sienge | Títulos/parcelas independentes de recebimentos e alocações; pagamentos parciais e múltiplos; estorno; extrato verificável | Novas tabelas `receivables`, `installments`, `payments`, `allocations` **somente depois da homologação**, constraints/RLS/idempotência; adaptador legado | Parcial, duas parcelas/um pagamento, estorno, retry, concorrência e reconciliação sem duplicidade |
| 2. Fluxo comercial e documental | Vobi, JobTread, Dolibarr, Paperless-ngx, Procore | Cliente → orçamento opcional → projeto opcional → contrato → Anexo I → aditivo → recebimento; versões imutáveis e aprovações | Serviços de domínio e estado centralizados, snapshots e links duráveis, ações de emissão distintas de download | Contratos sem orçamento/projeto; Word inicial sem revisão; falha de storage não anuncia sucesso; revisões e aceites rastreáveis |
| 3. Projetos, tarefas e cronogramas | OpenProject, Plane, Prevision, BuildSuite | Centro do projeto com responsáveis, EAP, dependências FS/SS/FF, baseline, progresso e Curva S | Reusar motor de cronograma atual e adicionar relações por ID, validação de ciclos e baseline imutável | Testes de feriados, folga/caminho crítico, publicação sem vazamento de custos e reversão |
| 4. Orçamento de obra e produtividade | OrçaFascio, Sienge, Nurbie, Kimai | Quantitativos, composições, BDI e insumos com fontes por mês/UF; horas/custo/margem por serviço | Versões de orçamento, referência SINAPI/SICRO com proveniência, custo por apontamento sem captura invasiva | Auditoria dos cálculos, versões preservadas, custo de obra distinto de honorários |
| 5. CRM e portal de cliente | Arquio, Frappe CRM, Vobi, Autodesk Docs | Histórico de contato, oportunidade/solicitação, aprovações, arquivos e status de entrega centralizados | Relacionamentos por ID, filtros compartilhados, permissões RLS, uma única origem por informação | Usuário só consulta seus dados; nenhuma duplicação de cadastro ou de notificação |
| 6. Governança e desempenho | Práticas transversais | Reduzir redundância de UI, garantir observabilidade, backups e segurança | Revisão de funções `SECURITY DEFINER`, índices a partir de métricas reais, testes E2E autenticados, medidas de carga | Auditoria de acesso, restauração demonstrada, CI por SHA e teste desktop/mobile |

## Entidades e invariantes prioritários
- `client_id`, `project_id`, `quote_id`, `contract_id` referenciam registros únicos e permanentes; campos opcionais permanecem nulos quando legítimos.
- `receivable` (obrigação) → `installment` (vencimento) ↔ `payment_allocation` ↔ `payment` (liquidação) → `receipt` (comprovante). O recibo *não* é novo pagamento.
- `saldo a receber = valores exigíveis - alocações líquidas - abatimentos aprovados`; parcelas pendentes detalham, não incrementam, o saldo.
- `caixa realizado` considera pagamentos liquidados e saídas efetivas, sem misturar previstos; importação OFX conciliada não duplica lançamento manual.
- `document_version` captura conteúdo, origem, autor, data, hash, estado e arquivo. Emissão altera estado; download é leitura.
- Um processo repetido com a mesma chave de idempotência produz uma emissão/pagamento, inclusive depois de perda de resposta.
- RLS testa escopo no **banco**, não apenas filtro visual.

## Ambientes e implantação
O levantamento de 06/11 encontrou produção e homologação divergentes (inclusive presença de `extrato_financeiro` apenas em homologação). **Não** aplicar em lote migrações antigas por contagem; inventariar schema real, produzir cópia descartável, comparar, restaurar e testar migrações novas, com critérios de reversão. A fase 1A é propositalmente apenas TypeScript/UI/testes para não afetar os dados.

Fluxo de entrega: branch isolada → testes unitários e regressões → PR/CI → revisão do diff → deploy do SHA aprovado → verificação com perfis reais e dados de teste → monitoramento e rollback de frontend se necessário. Não afirmar `100% sem erros` sem teste real autenticado. O estado da fase 1A nesta branch é **implementada no código, pendente de validação CI e publicação**.

## Testes essenciais por fase
- Financeiro: saldo com 2 projetos/mesmo contrato; contrato sem valor; serviço sem contrato; vencido; parcialmente pago; crédito; estorno; recibo idempotente; contas com e sem referência; CSV condizente com filtro.
- Comercial/documentos: projeto antes de contrato; contrato com/sem orçamento; Word inicial reaberto; aditivo; aprovação, revisão e substituição; erro de rede/storage; clique duplo.
- Cronograma: ciclos, FS/SS/FF, calendário útil, baseline, progressão, Curva S e exportação legível.
- Segurança: clientes isolados, funções privilegiadas por papel, R2 privado, hashes, auditoria, backup/restore, autenticação web e móvel.

## Implementação da fase 1A nesta PR
- `src/lib/receivable-priorities.ts`: fonte única para agregações e critérios de priorização.
- `src/app/admin/financial.tsx` e `src/components/financial-overview.tsx`: filtro operacional no extrato, visão de valores vencidos, saldo sem parcelas e créditos, exportação do conjunto exibido.
- `scripts/test-receivable-priorities.mjs`: regressões sintéticas para totais, pesquisa, filtros e ordenação, integrado ao teste financeiro e ao CI.

**Não realizado nesta PR:** novas tabelas, migrações, emissão fiscal, conciliação transacional avançada, implantação em produção ou acesso a dados privados de terceiros.
