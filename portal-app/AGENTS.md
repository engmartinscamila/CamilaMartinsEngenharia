# Camila Martins Engenharia — regras permanentes do projeto

## Missão

Construir, testar e preparar para publicação um **mobile app real para Android e iOS**, com uma única base de código Expo/React Native, para a Camila Martins Engenharia. O aplicativo reúne Área do Cliente e Área Administrativa e utiliza o mesmo Supabase já usado pelo site e pelo Portal do Cliente.

Este arquivo é a fonte permanente de requisitos. Não contradiga, resuma de forma que perca regras, nem substitua essas decisões por escolhas genéricas. Antes de qualquer alteração, identifique a fase atual e modifique apenas os arquivos necessários para ela.

## Restrições inegociáveis

1. O projeto deve nascer como **mobile app Expo**, não como site convertido posteriormente.
2. Usar TypeScript, Expo Router e React Native/React Native Web, na versão estável compatível com o Bolt.
3. Android e iOS devem compartilhar a mesma base. A versão web serve para teste e painel administrativo responsivo.
4. Não criar Bolt Database, Firebase, banco paralelo ou autenticação paralela.
5. Conectar e reutilizar o Supabase existente. Não duplicar tabelas que já tenham função equivalente.
6. O site institucional e seu repositório são somente referências. Não alterar nem misturar o código do site com o repositório do app.
7. Nunca colocar `service_role`, senhas ou segredos no aplicativo, no chat, no repositório ou em logs. No app móvel usar somente URL e chave pública/anon do Supabase. Operações privilegiadas devem ocorrer em Edge Functions/RPC protegidas no servidor.
8. Não usar dados fictícios, mocks ou botões sem ação na versão final.
9. Não refazer telas ou arquitetura corretas para corrigir um problema isolado.
10. Não executar mudanças destrutivas no Supabase. Não usar `DROP`, truncar, apagar registros reais ou renomear estruturas existentes. Alterações devem ser aditivas, compatíveis e idempotentes.
11. Se a estrutura real do Supabase divergir desta especificação, adaptar o app às tabelas existentes. Criar somente o que estiver comprovadamente ausente.
12. Nenhum projeto pode existir sem contrato e nenhum registro operacional pode ficar órfão.

## Identidade do aplicativo

- Nome: `Camila Martins Engenharia`
- Slug: `camila-martins-engenharia`
- Scheme/deep link: `camilamartinsengenharia`
- iOS bundle identifier: `br.com.camilamartinsengenharia.app`
- Android package: `br.com.camilamartinsengenharia.app`
- Idioma: português do Brasil
- Datas armazenadas em UTC e apresentadas no fuso `America/Sao_Paulo`
- Assinatura institucional: `Projetos • Técnica • Aprovação`

## Identidade visual

Aparência premium, técnica, sóbria, organizada e acolhedora. Usar os ativos oficiais fornecidos e a identidade do site da marca.

- azul-marinho como cor principal;
- dourado como destaque;
- cinza-claro e branco para superfícies e textos de apoio;
- Century Gothic quando a fonte licenciada/arquivo estiver disponível;
- Brittany Signature apenas em assinatura ou detalhe pontual;
- logotipo oficial;
- componentes consistentes e acessíveis;
- sem gradientes genéricos, cores aleatórias, excesso de animação ou aparência de template comum.

Criar tokens centralizados de cor, tipografia, espaçamento, raio, sombra e estados. Não espalhar valores visuais por telas diferentes.

## Arquitetura esperada

Manter estrutura modular e enxuta:

- `app/` para rotas Expo Router;
- grupos de rotas de autenticação, cliente e administração;
- `src/components/` para componentes reutilizáveis;
- `src/features/` por domínio;
- `src/lib/supabase.ts` para cliente Supabase;
- `src/services/` para consultas e mutações;
- `src/hooks/` para sessão, permissões e dados;
- `src/types/` para tipos do banco e domínio;
- `src/theme/` para identidade visual;
- `supabase/migrations/` para migrações aditivas;
- `supabase/functions/` para operações privilegiadas;
- testes próximos aos módulos ou em diretório próprio.

Evitar arquivos gigantes e duplicação de consultas. Criar serviços compartilhados, componentes de lista/formulário/filtro e estados padronizados de loading, vazio, erro e sucesso.

## Autenticação e perfis

Usar exclusivamente Supabase Auth existente.

Implementar:

- login por e-mail e senha;
- sessão persistente com armazenamento seguro compatível com Expo;
- renovação automática de token;
- logout;
- primeiro acesso/criação de senha;
- recuperação e redefinição de senha;
- deep link de retorno da autenticação;
- tratamento de link inválido/expirado;
- bloqueio de usuário inativo;
- redirecionamento conforme o papel;
- proteção de todas as rotas privadas.

Na tela de login normal mostrar apenas e-mail, senha, entrar, primeiro acesso e esqueci minha senha. `Confirmar senha` existe somente na criação/redefinição.

Não existe cadastro público. Clientes são criados/convidados pela administradora. Reutilizar a administradora existente do Portal; se não existir, documentar um procedimento único e seguro para promovê-la pelo UUID no Supabase, sem senha fixa no código.

Papéis mínimos:

- `admin`: acesso administrativo completo, validado no banco/servidor;
- `client`: somente projetos formalmente vinculados ao UUID;
- `collaborator`: somente se já existir na base e com permissões por projeto.

Não usar apenas `user_metadata` como fonte de autorização.

## Regra central de contratos e projetos

O número do contrato é a referência comercial obrigatória.

- `contract_number` deve ser obrigatório e único;
- todo projeto deve possuir `contract_id` obrigatório;
- um cliente pode ter vários contratos;
- um contrato pode conter um ou vários projetos;
- pessoas com o mesmo nome são permitidas;
- identidade técnica é UUID/e-mail normalizado, nunca nome;
- o mesmo e-mail não pode gerar perfis duplicados;
- novo contrato para cliente existente deve reutilizar o perfil;
- documentos, fotos, biblioteca, agenda, cronograma, solicitações, aprovações e notificações devem estar vinculados a `project_id`, e por ele ao contrato e cliente;
- formulários administrativos devem exigir seleção de contrato antes de criar projeto;
- listagens e pesquisas administrativas devem aceitar número do contrato como filtro principal.

## Entidades lógicas

Mapear primeiro para a estrutura existente e criar somente lacunas:

- perfis/usuários;
- clientes;
- contratos;
- projetos;
- membros/autorizados do projeto;
- documentos e versões;
- fotos e álbuns;
- biblioteca;
- eventos/agenda;
- etapas do cronograma;
- solicitações e histórico/mensagens;
- aprovações;
- notificações;
- dispositivos/tokens de push;
- logs de auditoria.

## Segurança de dados

Aplicar defesa no banco, Storage, Edge Functions e interface.

- RLS em todas as tabelas privadas;
- policies de Storage baseadas em usuário, papel e associação ao projeto;
- cliente somente acessa registros de projetos presentes na tabela de membros/autorizados;
- administrador é validado por registro protegido;
- prevenção de IDOR: nunca confiar em IDs fornecidos pela interface sem revalidar acesso;
- URLs assinadas de curta duração para arquivos privados;
- validação de tipo, tamanho, nome e extensão;
- bloquear executáveis;
- nomes físicos aleatórios e caminhos por `project_id`;
- rate limiting em funções sensíveis;
- mensagens de erro sem dados internos;
- logs administrativos sem segredos;
- ações destrutivas com confirmação forte;
- menor privilégio e compatibilidade com LGPD.

O teste essencial é Cliente A versus Cliente B. Alterar IDs, URLs ou parâmetros nunca pode permitir acesso cruzado.

## Storage e arquivos

Usar buckets privados existentes; criar buckets privados apenas se ausentes. Caminho recomendado: `<project_id>/<categoria>/<uuid>.<ext>`.

Fluxo correto de upload:

1. validar sessão e vínculo;
2. validar arquivo;
3. enviar para caminho privado;
4. inserir/atualizar metadado com `project_id` e caminho físico;
5. invalidar/refazer consulta;
6. gerar URL assinada somente ao visualizar/baixar;
7. nunca salvar URL assinada expirada no banco.

Corrigir o erro histórico das fotos: a listagem deve partir dos metadados corretos, gerar URLs assinadas sob demanda e continuar funcionando após refresh e nova sessão.

O gerenciador administrativo de armazenamento deve somar tamanhos reais, apresentar uso por bucket/cliente/contrato/projeto, localizar órfãos e excluir objeto + metadado de forma coerente. Se a consulta falhar, mostrar `Indisponível`, nunca `0` falso.

PDFs privados podem receber marca d'água com cliente/contrato e registro de visualização/download quando o fluxo existente suportar. Não prometer bloqueio de screenshot.

## Área do Cliente

Navegação móvel com cinco itens: Início, Projeto, Documentos, Solicitações e Mais.

`Mais` contém Fotos, Biblioteca, Agenda, Cronograma, Aprovações, Notificações, Perfil e Suporte.

### Início

Saudação, seletor de contrato/projeto, número do contrato, nome/status/progresso, próxima etapa, próximos eventos, pendências, aprovações, documentos e solicitações recentes, notificações não lidas.

### Projeto

Somente projetos autorizados, alternância entre contratos, tipo de serviço, endereço resumido, responsáveis, situação, progresso e detalhes.

### Documentos

Categorias, pesquisa, filtros, visualização, download, upload autorizado, versão atual, histórico de versões, responsável, data, estado e URLs assinadas.

### Fotos

Álbuns por projeto, miniaturas, legenda, data, etapa, responsável, carregamento progressivo e visualização ampliada.

### Biblioteca

Guias, catálogos, memoriais, referências e materiais organizados por projeto/categoria com pesquisa e filtros.

### Agenda e cronograma

Reuniões, visitas, entregas e vencimentos; etapas, datas previstas/realizadas, status, percentual, marcos, observações e atrasos.

### Solicitações

Criar, anexar, acompanhar e responder. Estados: aberta, em análise, aguardando cliente, em execução, concluída e cancelada. Histórico preservado.

### Aprovações

Abrir versão correspondente, aprovar, solicitar revisão ou rejeitar com justificativa. Registrar usuário, data, hora, versão e comentário. Nova versão exige nova aprovação.

### Notificações e perfil

Central lida/não lida, preferências, contatos oficiais, projetos vinculados, redefinição de senha, política de privacidade e logout.

## Área Administrativa

Usar as mesmas entidades e serviços; não duplicar lógica. Layout responsivo para web/tablet e utilizável no celular.

- dashboard com indicadores reais;
- clientes: criar/convidar, editar, ativar/suspender, reenviar convite, recuperar senha, pesquisar e vincular perfil existente;
- contratos: número único obrigatório, cliente, serviço, status, datas e observações;
- projetos: somente dentro de contrato, responsáveis, usuários, progresso e status;
- documentos e versões;
- fotos e álbuns;
- biblioteca;
- agenda e cronograma;
- solicitações e aprovações;
- notificações por projeto;
- armazenamento real;
- auditoria;
- exclusão completa protegida.

A exclusão completa de cliente deve ocorrer somente em Edge Function/RPC privilegiada: validar JWT e papel admin; produzir resumo; exigir confirmação; localizar arquivos/vínculos; remover somente dados pertencentes ao cliente; revogar acesso; excluir Auth quando solicitado; registrar a operação; devolver relatório. Reutilizar `excluir-cliente-completo` se já existir e estiver correta.

## Notificações

Implementar notificações internas desde a primeira versão. Preparar Expo Notifications para push em Android/iOS, registrar token por usuário/dispositivo e enviar somente por função protegida. Solicitar permissão após explicar o benefício, não no primeiro carregamento.

Se push remoto depender de projeto Expo/EAS ou credenciais externas ainda não fornecidas, manter a implementação pronta, indicar a pendência externa e não fingir envio bem-sucedido.

## Acessibilidade, desempenho e qualidade

- layouts para 360 px, 390 px, tablet e web;
- safe areas de iPhone;
- área de toque mínima adequada;
- contraste, labels, foco, teclado na web e texto alternativo;
- nenhuma rolagem horizontal indevida;
- loading, vazio, erro, retry e sucesso;
- paginação e consultas indexadas;
- carregamento sob demanda;
- imagens/miniaturas otimizadas;
- progresso e tratamento de falha de upload;
- sem cache de documentos privados ou URLs assinadas;
- sem erros TypeScript, Expo Doctor ou console;
- nenhum segredo no bundle.

## Economia de tokens e modo de trabalho

- Trabalhar por fase e parar ao concluir a fase solicitada.
- Usar o agente Standard para implementação rotineira. Não usar Max sem necessidade comprovada.
- Antes de editar, ler somente arquivos relacionados à fase.
- Alterar lotes coerentes e evitar reescrever arquivos inteiros por detalhes.
- Executar testes direcionados durante a fase e validação completa apenas na fase final.
- Não gerar imagens por IA.
- Não criar múltiplas variações de design.
- Não pedir novamente requisitos presentes neste arquivo.
- Ao terminar uma fase, informar: arquivos principais, banco alterado, testes executados, pendências reais e próximo comando. Então parar.
- Se houver risco de mudança destrutiva ou incompatibilidade estrutural, parar e explicar antes de agir.

## Critério final de pronto

O app somente está pronto quando: autenticação funciona; cliente acessa apenas os próprios contratos; todo projeto possui contrato; documentos/fotos aparecem e abrem; módulos do cliente funcionam; admin gerencia o ecossistema; exclusões mantêm banco/Storage coerentes; armazenamento é real; isolamento A/B está validado; interface funciona em Android/iOS/web; testes passam; Expo Go/EAS abre o app; e não existem dados fictícios, páginas vazias ou botões falsos.

Publicação nas lojas exige contas e aprovações externas Apple/Google. Não declarar publicação nas lojas antes dessas etapas. A entrega gratuita validável é o app funcionando no Expo Go e a versão web de teste; depois gerar builds EAS quando as contas estiverem disponíveis.
