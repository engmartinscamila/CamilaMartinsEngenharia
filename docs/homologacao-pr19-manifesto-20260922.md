# Manifesto de homologação — PR #19

Data de consolidação: 22/09/2026  
Repositório: `engmartinscamila/CamilaMartinsEngenharia`  
Branch: `fix/governanca-preflight-dupla-auditoria-20260921`

## Regra de liberação

Este documento NÃO autoriza deploy de produção. A sequência obrigatória é:

1. código da PR e CI no SHA final;
2. homologação equivalente e autenticada com dados sintéticos;
3. validação real de arquivos/downloads, desktop/mobile e segurança;
4. revisão humana dos 51 itens materiais do Contrato Mestre v3;
5. plano/ensaio de rollback;
6. autorização explícita da administradora;
7. deploy sincronizado no MESMO SHA;
8. verificação pós-publicação.

Não alterar produção para testar. Não copiar clientes reais para homologação. Não remover guards, RLS ou `assert_document_governance_ready` para fazer testes passarem.

## 1. Por que o staging atual não deve receber apenas as migrations novas

A leitura de 22/09/2026 mostrou que `camila-martins-homologacao` possui histórico próprio e não reproduz integralmente o esquema do projeto de produção `portal-cliente`. A cadeia de cronograma profissional e partes da governança documental estão ausentes/divergentes. Portanto:

- não aplicar somente `20260921...` / `20260922...` / `20260923...` sobre o staging divergente e chamar isso de homologação;
- não executar DDL em produção para “descobrir” dependências;
- reconstruir/atualizar a homologação a partir da cadeia completa e ordenada do repositório, em ambiente isolado, confirmando cada dependência antes de avançar;
- se uma reconstrução limpa exigir recurso pago ou criação de branch Supabase, parar e obter autorização/custo antes.

## 2. Fonte de verdade da reconstrução

A homologação deve usar:

- migrations versionadas da branch da PR, em ordem cronológica, incluindo toda a base necessária anterior ao cronograma;
- Edge Functions do mesmo SHA da PR;
- frontend/app do mesmo SHA;
- somente dados sintéticos;
- configuração de Auth/Storage/RLS compatível com o cenário necessário, sem transportar segredos ou dados pessoais de produção.

A cadeia específica da evolução nova do cronograma na PR inclui, na ordem:

1. `20260921180000_cronograma_completo_servico_opcional.sql`
2. `20260921181000_cronograma_vinculo_contratual_obrigatorio.sql`
3. `20260921182000_cronograma_biblioteca_modelos_versionados.sql`
4. `20260921183000_cronograma_planejamento_aprovacao_linha_base.sql`
5. `20260921184000_cronograma_salvar_plano_atomico.sql`
6. `20260922002000_cronograma_medicoes_auditaveis.sql`
7. `20260922004000_cronograma_publicacao_cliente_isolada.sql`
8. `20260922004100_cronograma_publicacao_minimizar_colunas_cliente.sql`
9. `20260922005000_cronograma_bloquear_avanco_sem_medicao.sql`
10. `20260922010000_cronograma_arquivo_imutavel_linhas_base.sql`
11. `20260922011000_cronograma_feriados_conferidos.sql`
12. `20260922012000_cronograma_pesos_fisicos_independentes.sql`
13. `20260922234500_cronograma_revisoes_aditivos.sql`
14. `20260922235000_cronograma_revisao_salvar_atomico.sql`
15. `20260922235500_cronograma_quantitativos_auditaveis.sql`
16. `20260922235800_cronograma_orcamento_execucao_rpc.sql`
17. `20260923000500_cronograma_publicacao_curva_cliente.sql`
18. `20260923001500_cronograma_pedido_reprogramacao.sql`

A funcionalidade comercial de reuso de cliente existente também depende de:

- `20260922232000_reutilizar_cliente_existente_orcamento.sql`.

Essa lista NÃO substitui as migrations-base anteriores necessárias para criar tabelas, tipos, funções, policies e vínculos já existentes. A reconstrução deve executar a cadeia completa do repositório até o SHA final, não somente esta lista incremental.

## 3. Gate A — equivalência estrutural

Antes de login:

- migrations sem erro e histórico coerente;
- tabelas/colunas/constraints/índices compatíveis com o SHA;
- RLS habilitada em todas as tabelas expostas aplicáveis;
- policies, views e grants conferidos;
- funções SECURITY DEFINER triadas individualmente, sem revogação em massa;
- Storage/buckets/policies necessários reproduzidos com arquivos sintéticos;
- Edge Functions necessárias implantadas em homologação com JWT/configuração coerente;
- frontend/app apontando somente para homologação;
- bundle público sem segredos de servidor.

Falha em qualquer item = STOP, sem avançar para produção.

## 4. Dados sintéticos mínimos

Criar identidades/objetos claramente fictícios:

- administradora sintética;
- cliente A e cliente B;
- CPF sintético e CNPJ sintético válidos apenas para teste;
- cliente novo e cliente já cadastrado;
- projeto residencial novo;
- reforma;
- execução parcial;
- obra comercial;
- cenário com cronograma contratado;
- cenário sem cronograma contratado;
- revisão/aditivo;
- orçamento de execução com composição quantidade × preço unitário;
- atividades com feriados, dependências e caminho crítico;
- documentos e imagens sintéticos.

Nunca copiar nome, e-mail, telefone, CPF/CNPJ, endereço, contrato, documento ou mídia de cliente real.

## 5. Gate B — fluxo autenticado da administradora

Registrar PASS/FAIL e evidência por passo:

1. login;
2. criar orçamento para novo prospect;
3. criar novo orçamento reutilizando cliente existente sem alterar o cadastro original;
4. busca de serviço com caixa/acentos/erro pequeno e confirmação obrigatória;
5. contrato vinculado ao orçamento;
6. Anexo I;
7. DOCX real;
8. download/abertura;
9. histórico/reemissão e snapshot;
10. criação de cronograma apenas quando o serviço foi contratado;
11. modo guiado;
12. custos da execução separados de honorários;
13. quantitativos/unidade/preço unitário/fonte;
14. peso financeiro derivado dos custos;
15. peso físico independente quando houver critério;
16. feriados;
17. CPM/caminho crítico e folga;
18. aprovação da linha de base;
19. medição datada;
20. Curva S/planejado × realizado;
21. publicação sanitizada;
22. XLSX real;
23. revogação/republicação;
24. preparação de reprogramação/aditivo;
25. nova revisão, preservando a anterior;
26. nova aprovação/publicação.

## 6. Gate C — cliente A/B

Cliente A:

- primeiro acesso;
- recuperação de senha;
- troca de projeto;
- cronograma somente se contratado, vigente e publicado;
- dashboard simples com planejado, realizado, desvio, prazo, Gantt e Curva S;
- nenhum custo interno, peso interno, honorário, nota administrativa ou dado comercial sensível.

Cliente B:

- não pode ler nem alterar objetos do cliente A por IDs conhecidos;
- não pode aceitar documento, marcar notificação, responder agenda/aprovação, ler publicação ou acessar Storage do cliente A;
- respostas não devem revelar se um recurso privado de outro cliente existe.

Administrador:

- mantém acesso funcional apenas às operações administrativas legítimas.

## 7. Gate D — arquivos reais gerados pela aplicação

Gerar pelo fluxo real e abrir/inspecionar:

- orçamento;
- contrato;
- Anexo I;
- Termo de Aceite;
- Estudo Preliminar;
- Levantamento Técnico;
- Serviço Adicional;
- Autorização de Imagem;
- Quitação/Encerramento;
- Notificação Formal;
- XLSX de cronograma.

Para cada documento: conferir botão correto, origem, versão, snapshot, nome do arquivo, conteúdo e download.

Para XLSX: conferir abertura, 8 abas esperadas quando aplicável, fórmulas, datas, Gantt, Curva S, indicadores e que editar o arquivo NÃO altera o banco.

## 8. Gate E — falhas controladas

Em homologação e sem carga agressiva:

- sessão expirada;
- Edge indisponível/erro controlado;
- falha após geração antes de snapshot;
- falha de XLSX;
- ID de outro cliente;
- arquivo de outro projeto;
- payload inválido;
- duplicidade de revisão;
- reprogramação sem pedido válido/expirado;
- migration incompatível em cópia descartável;
- recuperação de senha com conta existente/inexistente sem enumeração externa.

Não realizar DoS, brute force, varredura invasiva ou testes em terceiros/produção.

## 9. Gate F — segurança operacional

Confirmar em painéis autorizados:

- estado real de WAF/rate limiting/bot/CAPTCHA Cloudflare;
- rate limits por login, recuperação, upload, geração, notificação e RPC sensível;
- leaked-password protection do Supabase Auth: disponibilidade no plano/custo/impacto antes de ativar;
- bundle/variáveis públicas vs. segredos;
- logs sem senhas, tokens ou documentos;
- CSP e saídas HTML;
- inventário das 39 SECURITY DEFINER com resultado A/B/admin;
- Storage por objeto/projeto;
- SSRF apenas nos serviços que recebem URL externa; marcar N/A com justificativa quando inexistente;
- Prompt Injection apenas em fluxos onde conteúdo não confiável entra em LLM/automação.

## 10. Gate G — desktop/mobile/temas

Testar ao menos:

- desktop web;
- viewport mobile web;
- app homologação quando aplicável;
- claro/escuro/automático;
- navegação de volta;
- estados vazio/carregando/erro;
- acessibilidade básica de botões/campos;
- layout dos gráficos e documentos.

## 11. Evidência obrigatória

Para cada cenário registrar:

- SHA;
- ambiente;
- usuário sintético/papel;
- pré-condição;
- passos;
- resultado esperado;
- resultado obtido PASS/FAIL;
- captura/log sanitizado quando útil;
- correção vinculada se FAIL;
- reteste;
- indicação se bloqueia deploy.

## 12. Saída necessária do Work

Somente após os gates:

- relatório PASS/FAIL;
- SHA final;
- migrations/Edges/frontend/app usados;
- divergências staging × produção;
- lista de correções;
- rollback ensaiado;
- situação das 39 funções e controles externos;
- itens humanos pendentes;
- indicação objetiva de aptidão técnica para deploy.

As 51 revisões materiais do Contrato Mestre v3 permanecem decisão humana e nunca devem ser aprovadas em massa pela automação.
