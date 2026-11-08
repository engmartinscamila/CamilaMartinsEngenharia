# Execução das correções

Referência: auditoria de 07/11/2026, SHA `22328fb626c152e79518ba1451646e2ce85e6698`. O HEAD de produção ainda era esse SHA na preparação. Trabalho no PR #66, sem merge ou publicação. Nenhuma escrita em registros produtivos ou alteração remota de schema foi feita.

`findings-status.json` registra separadamente os 22 achados, testes, dependências e limites. `requirements-traceability.json` conserva os 82 critérios e seus vínculos, sem transformar estudos condicionados em funcionalidades contratadas. Nenhuma linha foi marcada como resolvida em produção com base em teste local.

## Alterações preparadas

- A01: orçamento carrega pela seleção central, limpa o rascunho anterior, ignora respostas atrasadas, recupera erro e impede gravação duplicada.
- A04/A05: valores desconhecidos permanecem desconhecidos; parser e payload financeiro validam centavos e recuperam reenvio após perda da resposta.
- A09/A10: estados existentes permanecem representados; documentos/fotos/biblioteca recuperam todas as páginas e descartam consultas parciais com erro.
- A11/A20: versão do instrumento corrigida; parcelas/datas/identificação conferidas nos arquivos; contrato revisado e recibo incluídos; teste de mutação prova que a fixture incorreta agora falha. O CI não altera o teste antes de rodá-lo.
- A02/A03: guarda de recibos na interface e migração candidata com validação de origem, preservação de pagamentos/documentos e proteção contra mudança dos registros de origem.
- A06/A07: RPC candidata cria tarefa e dependência juntas, conserva chave de repetição e rejeita ciclos e cruzamento de projetos. Interface preparada para usar essa RPC, sem compensação DELETE.

As migrações estão na pasta raiz `supabase/migrations`, criadas pelo CLI. São candidatas, não aplicadas nos projetos conectados. A interface de criação de tarefas deste PR depende da nova RPC: não integrar/publicar isoladamente antes das condições abaixo.

## Continuação verificada em 07/11/2026 (somente leitura dos bancos)

- GitHub Actions do HEAD anterior `dce15675810db047b111620793abfdab39e314ce`: cinco workflows concluídos com sucesso. A nova regressão A04 foi adicionada ao CI após esses resultados e precisa de seu próprio workflow verde.
- A13, catálogo atual do esquema `public`: 178 funções em produção e 155 em homologação, 136 assinaturas em comum, 57 definições divergentes, 42 assinaturas exclusivas de produção e 19 exclusivas de homologação. As diferenças incluem funções de autenticação/acesso, documentos, contratos, notificações e operações financeiras. Comparação por assinatura e hash de definição, **não** uma classificação semântica nem autorização para copiar funções.
- A04: `public.financeiro.valor` em produção é `numeric(12,2)`, que arredonda previamente valores de terceira casa decimal; em homologação é `numeric` sem precisão/escala declaradas. A produção tem 4 lançamentos, nenhum valor armazenado com terceira casa; homologação tem zero lançamentos. A view `public.project_financial_summary` depende da coluna. Logo, um simples `BEFORE TRIGGER` ou `CHECK` na coluna atual **não** pode detectar o valor original, e um `ALTER COLUMN TYPE` isolado pode falhar por dependência de view.
- O novo `scripts/security/audit-money-precision-regression.mjs` reproduz essa falha em PostgreSQL isolado e valida o princípio de `numeric` sem escala com `CHECK` de centavos e magnitude depois de tratar a view fictícia. Não altera produção nem constitui migração aprovada. A migração verdadeira requer reconstrução fiel e validação de dependências, GRANT, segurança de views, consultas e backup restaurável antes da aplicação.
- Permanecem bloqueados merge, publicação, migrações de produção, Financeiro V2 e qualquer reescrita de recibos anteriores até os gates já descritos nesta página.

## Verificação

Suítes existentes: 92 scripts reexecutados, com 89 sucessos imediatos e 3 erros de preparação do executor. Os três passaram após resolver dependências/cwd, sem mudar as asserções. Resultados iniciais e reexecuções estão preservados em `evidence/`. Novos testes de componente/serviço e os dois testes SQL candidatos também passaram. TypeScript, lint (seis avisos anteriores) e exportação web passaram localmente; isso não equivale a homologação autenticada.

Os geradores produziram 13 DOCX e um XLSX com cinco abas. OOXML/CRC, parcelas, valores, identificação, datas e versões foram reabertos e conferidos. As 13 amostras renderizaram; a inspeção visual pontual não equivale a revisão de todas as páginas no Microsoft Word. Não entregar as amostras fictícias como documentos reais.

RLS: `supabase/security/verify-live.sql` passou no banco produtivo, em transação somente leitura com rollback. Conferiu papéis anônimo/cliente/admin, liberação documental e buckets privados. Não são sessões JWT nem prova E2E de REST/Storage.

## Gates que impedem publicação e migração

1. A19: obter backup completo e restaurá-lo isoladamente com schema, dados, relações e bytes de Storage; comparar hashes e reabrir arquivos. O exportador atual exclui Auth/Vault e não é um dump PostgreSQL. O catálogo de Storage não contém os arquivos físicos. Não basta repetir o teste sintético de ZIP para liberar migração financeira.
2. A13: classificar semanticamente as diferenças por objeto e preparar homologação equivalente. Os catálogos atuais confirmam 198 funções em produção, 161 em homologação e 57 corpos diferentes. Financeiro V2 é diferença intencional; não copiar nenhum ambiente sobre o outro.
3. Aplicar candidatos primeiro no ambiente equivalente, validando dados existentes antes e depois. Testar duas sessões reais, REST/RPC, isolamento por cliente e os seis fluxos autenticados. As travas presentes nos candidatos ainda não foram homologadas com sessões simultâneas.
4. O preflight adicional encontrou uma divergência histórica apenas na descrição de um recibo/lançamento, com valor, data, cliente e projeto conferentes. Não modificar o original automaticamente; classificar essa diferença antes de exigir equivalência textual em restauração/regravação. A02: concluir o fluxo de correção/estorno com documento e equivalência financeira; não liberar edição do pagamento original como atalho. A04: validar também entrada SQL direta: `numeric(12,2)` arredonda antes dos triggers, portanto validação no aplicativo não cobre esse caminho.
5. A12: os seis casos têm histórico `download_only`, sem caminhos de arquivo ou hashes do original. Todos têm snapshot; dois snapshots são backfill legado. Examinar downloads/backups externos antes de concluir perda do original. Qualquer reconstituição deve ter identificação e caminho próprios, sem alterar versão/data/número do emitido.
6. Confirmar D01/D02 (valores, serviços avulsos, contas/data-base), D03 (exigibilidade do aditivo), D04 (compras/orçamento avançado), D05 (origem do progresso) e D06 (recuperação/custo). Não inventar referências para fechar saldo.
7. A22: obter evidência do provedor e teste de entrega/falha/retry em destinos autorizados. `sent` não prova entrega; não reclassificar os envios existentes por presunção.

## Recuperação e reversão operacional

Antes de cada mudança crítica, guardar o SHA aprovado e um backup verificável do estado anterior, além das configurações de Auth/Storage/Edge Functions e dependências externas. Usar destino isolado sem disparo de cron/e-mail/push e sem dados pessoais em homologação; dados reais só em restauração restrita autorizada. Restaurar banco e arquivos físicos, conferir contagens, FKs e SHA-256 de cada arquivo, testar abertura e acesso e registrar duração e ponto de recuperação. Definir retenção/RPO/RTO sem contratar serviços pagos por presunção.

Rollback operacional: reverter a aplicação ao SHA anterior e manter histórico/guardas de integridade; não apagar a tabela privada de requisições de tarefa nem desabilitar a proteção de recibos para contornar erro. A nova tabela não ativa Financeiro V2, não altera saldos e não substitui registros anteriores. Uma reversão de schema exige plano revisto contra o estado do momento; não existe script destrutivo automático neste PR.

Após passar todos os gates: revisar conflitos com a main atual, integrar pelo PR, acompanhar os workflows, confirmar SHA publicado no domínio e executar os testes autenticados pós-deploy. Até lá, este PR permanece em rascunho.
