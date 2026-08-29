# Entrega da Fase 2 — base funcional e segura

Data: 11/08/2026

## Resultado

Foi criada uma base nova em Expo SDK 57, React Native e TypeScript. Ela não depende de Bolt, Floot, Replit ou créditos de gerador para continuar sendo desenvolvida. O projeto pode ser mantido localmente, no GitHub ou em qualquer serviço que aceite um repositório Expo.

Esta fase não é o aplicativo 100% final. Ela é o primeiro checkpoint executável, validado e preservado. Publicar agora deixaria módulos ausentes; por isso a interface mostra somente ações já implementadas e identifica honestamente os módulos da etapa seguinte.

## Implementado

### Configuração

- Expo SDK 57 estável;
- Android, iOS e web na mesma base;
- identificadores definitivos do aplicativo;
- `eas.json` com desenvolvimento, preview e produção;
- lockfile reprodutível;
- variáveis públicas do Supabase fora do código;
- nenhum segredo administrativo no bundle.

### Arquitetura

- rotas em `src/app`;
- componentes reutilizáveis;
- tokens centralizados de cores, tipografia, espaçamento, raios e sombras;
- providers de autenticação e contexto de projeto;
- serviços Supabase separados das telas;
- tipos de domínio centralizados;
- estados de vazio, erro, aviso, sucesso e carregamento.

### Autenticação

- login por e-mail e senha;
- sessão persistente no celular;
- renovação de token conforme o estado do app;
- PKCE e retorno por deep link;
- primeiro acesso sem cadastro público;
- esqueci minha senha;
- redefinição de senha com confirmação;
- logout;
- rotas protegidas por papel;
- bloqueio claro para usuário sem vínculo ativo;
- papel validado no banco, não apenas em metadado do usuário.

### Área do Cliente — pronta nesta fase

- navegação com cinco itens: Início, Projeto, Documentos, Solicitações e Mais;
- seletor de contrato/projeto quando existe mais de um;
- compatibilidade temporária com projetos antigos sem `contract_id`;
- home com contrato, projeto, status, progresso real ou `Indisponível`;
- resumo do projeto;
- documentos por projeto;
- URL assinada de cinco minutos gerada somente ao abrir;
- nenhuma URL assinada salva no banco;
- criação e listagem de solicitações;
- listagem e leitura de notificações;
- perfil, identificação da conta e logout.

### Área Administrativa — pronta nesta fase

- rota exclusiva de administrador;
- indicadores reais de clientes, projetos, solicitações e aprovações;
- falha de indicador aparece como `Indisponível`, nunca como zero falso;
- estrutura dos próximos módulos documentada sem botões falsos.

### Banco preparado, ainda não aplicado

- tabela de contratos com `contract_number` obrigatório e único sem diferenciar maiúsculas/minúsculas;
- vínculo `projetos.contract_id`;
- `project_members` para acesso por usuário/projeto;
- progresso do projeto com faixa de 0 a 100;
- colunas compatíveis de bucket, categoria, versão e permissão de download;
- backfill aditivo de contratos e membros;
- números de migração estáveis quando o contrato antigo está vazio;
- relatório explícito de órfãos e contratos que exigem revisão;
- helpers de autorização por projeto/contrato;
- RLS nas novas tabelas;
- trigger que impede novos projetos sem contrato e divergência cliente/contrato;
- RPC administrativa para o resumo da migração.

## Erros antigos eliminados

1. Identificadores Android/iOS e scheme incorretos.
2. Consulta de `percentual_conclusao` em `projetos`, coluna que não existe no banco real.
3. Zero falso para progresso ou indicador indisponível.
4. Dependência da promessa de que a terceira migração já estava aplicada.
5. Rota administrativa acessível sem guarda central.
6. Ausência de primeiro acesso separado de cadastro público.
7. URL assinada tratada como dado persistente.
8. Dependências sem lockfile validado para a versão atual do Expo.

## Validações executadas

| Validação | Resultado |
|---|---|
| Instalação reproduzível com `npm ci` | passou |
| TypeScript estrito | passou |
| Expo lint | passou sem alertas |
| Expo Doctor | 20/20 |
| Exportação web estática | passou, 22 rotas |
| Busca por segredos no código | nenhum segredo encontrado |
| Endpoint Supabase Auth | respondeu |
| Endpoint da tabela `clientes` | respondeu |
| Chave `service_role` no cliente | ausente |

Ainda não foi possível executar login real porque nenhuma senha de cliente/admin foi solicitada ou exposta. Também não foi aplicada migração no banco principal nem executado build EAS, pois essas etapas exigem checkpoint e, depois, conta Expo/credenciais de loja.

## O que você precisa fazer agora

Nada no Bolt, Floot ou Replit. Não execute o SQL ainda. Guarde este checkpoint.

Na próxima fase, a única ação externa prevista será uma destas opções:

1. preferencial: criar uma branch/ambiente de teste no Supabase e aplicar a migração lá; ou
2. se o plano do Supabase não oferecer branch: fazer backup e executar primeiro apenas as consultas de diagnóstico que serão fornecidas.

Não será solicitado que você adivinhe comandos. Cada clique e cada SQL serão enviados na ordem correta quando a Fase 3 estiver pronta para usar os novos vínculos.

## Próxima fase

Implementar Fotos, Biblioteca, Agenda, Cronograma, Aprovações e pendências do cliente; adicionar histórico de documentos; finalizar as consultas com `project_members`; criar testes Cliente A versus Cliente B; somente depois liberar a migração para validação no Supabase.
