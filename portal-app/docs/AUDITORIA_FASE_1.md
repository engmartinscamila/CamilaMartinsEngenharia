# Camila Martins Engenharia — Auditoria técnica da Fase 1

Data da auditoria: 11/08/2026

## Resultado executivo

Os dois ZIPs recebidos são variações do mesmo aplicativo Expo/React Native. Eles são úteis como referência visual e de regras de negócio, mas nenhum deles atende ao critério de “pronto para uso real”. A versão `APP_CORRIGIDO` é a melhor referência porque acrescenta persistência de sessão, redefinição de senha, URLs assinadas e uma migração de segurança. Mesmo assim, ainda faltam o modelo obrigatório de contratos, módulos inteiros, operações administrativas e validação real de isolamento entre clientes.

O Supabase existente está ativo e deve continuar sendo o único backend. O endpoint de autenticação respondeu e a tabela `clientes` está disponível com a chave pública existente. Nenhum segredo foi incluído neste relatório.

## Arquitetura encontrada

```text
Site/Portal atual
    └── Supabase existente
        ├── Auth (usuários já autorizados)
        ├── PostgreSQL (clientes, projetos e módulos do Portal)
        └── Storage privado

Aplicativo novo
    ├── Expo + React Native + TypeScript
    ├── Android e iOS na mesma base
    ├── Expo Router
    ├── Área do Cliente
    ├── Área Administrativa responsiva na web/tablet
    └── Mesmo Supabase do Portal
```

## Materiais auditados

- `CamilaMartinsEngenharia_APP_CORRIGIDO.zip`
- `project-bolt-sb1-yzgfcxk7(1).zip`
- comando mestre em Markdown
- regras permanentes em `agents.md`
- três migrações SQL incluídas no ZIP corrigido
- configuração Expo, autenticação, serviços Supabase e todas as rotas existentes

## O que pode ser reaproveitado

1. A decisão técnica Expo/React Native/TypeScript/Expo Router.
2. A identidade visual azul-marinho e dourado como referência inicial.
3. O cliente Supabase com chave pública por variável de ambiente.
4. Persistência móvel da sessão com AsyncStorage.
5. Fluxos de login, esqueci minha senha, redefinição e logout como base.
6. A separação de rotas cliente/admin.
7. As consultas iniciais de projetos, agenda, biblioteca, solicitações e notificações.
8. O uso de buckets privados e geração de URL assinada apenas no momento de abrir o arquivo.
9. As funções restritas para responder solicitação, marcar notificação e responder aprovação.
10. As políticas corrigidas propostas para reduzir acesso indevido entre clientes.

## Problemas comprovados nas tentativas anteriores

### Configuração do aplicativo

- Scheme atual: `camilaeng`; requerido: `camilamartinsengenharia`.
- Bundle/package atual: `com.camilaMartins.engenharia`; requerido: `br.com.camilamartinsengenharia.app`.
- Não há `eas.json` de desenvolvimento, preview e produção.
- Não há configuração funcional de push notifications.
- As fontes oficiais não foram fornecidas; o app deve usar fallback até receber arquivos licenciados.

### Banco e relacionamentos

- A tabela `contratos` não existe no Supabase real.
- `contract_number` único e obrigatório não existe.
- `projetos.contrato_id` não existe.
- `projetos.cliente_id` é anulável no SQL anterior.
- Registros operacionais usam `cliente_id` e `projeto_id` anuláveis, permitindo dados órfãos.
- Não existe tabela de membros/autorizados por projeto (`project_members`).
- A autorização atual presume um único registro de cliente por `auth_id` e não cobre colaborador por projeto.
- A identificação comercial está misturada em `projetos.numero_contrato`, sem entidade de contrato.

### Supabase real versus arquivos do ZIP

Testes de esquema sem leitura de dados pessoais mostraram:

| Verificação | Resultado |
|---|---|
| Supabase Auth | disponível |
| endpoint `clientes` | disponível |
| tabela `contratos` | ausente |
| coluna `projetos.contrato_id` | ausente |
| tabela `project_members` | ausente |
| `documentos.storage_bucket` | ausente |
| `fotos.storage_bucket` | ausente |
| tabela `aprovacoes` | disponível |
| tabela `audit_log` | disponível |

Conclusão: a terceira migração do ZIP corrigido não foi aplicada integralmente no banco real. Ela não deve ser executada às cegas, pois ainda não cria o modelo central de contratos e membros.

### Área do Cliente

- Não existe seletor real de contrato/projeto centralizado.
- Não existe central completa do projeto.
- Fotos estão misturadas na tela de arquivos; não há galeria, álbuns ou visualização ampliada.
- Não há tela funcional de aprovações, embora a tabela e uma função apareçam no SQL.
- Não há versões de documentos nem destaque seguro de versão atual.
- Não há anexos em solicitações.
- Não há favoritos, novidades desde a última visita ou central de pendências completa.
- Não há estados consistentes de timeout, offline, erro e tentar novamente.
- Várias consultas ignoram o erro retornado pelo Supabase.

### Área Administrativa

- Não existe gestão de contratos.
- Não existem formulários completos para criar/editar clientes, contratos e projetos.
- Não existe convite/criação protegida de usuário.
- Não existe upload administrativo completo de documentos, versões, fotos e biblioteca.
- Não existem módulos administrativos completos de aprovações, notificações, cronograma e biblioteca.
- Não existe relatório real de Storage nem detecção de órfãos.
- Não existe exclusão completa protegida do cliente.
- Não existe visualização segura “como cliente”.
- Não existe painel de auditoria.
- Os botões atuais de arquivar/revogar atualizam diretamente a tabela e não produzem um fluxo administrativo completo e auditado.

### Segurança

- A migração original de Storage permitia leitura a qualquer usuário autenticado, independentemente do cliente; a migração corretiva tenta fechar essa falha, mas não está aplicada no banco real.
- A autorização ainda depende principalmente de `clientes.auth_id`; não existe vínculo granular usuário → projeto.
- O app consulta IDs fornecidos pela interface sem uma camada compartilhada que revalide sempre o projeto autorizado.
- Não há teste automatizado Cliente A versus Cliente B.
- Não há Edge Function para convite, reenvio, exclusão de Auth ou exclusão completa.
- A chave usada pelo app é pública/anon, o que está correto. Nenhuma `service_role` foi encontrada no bundle cliente.

### Qualidade e testes

- A tentativa anterior declara que o TypeScript e a exportação web passaram, mas o ZIP não contém resultados reproduzíveis de testes.
- Não existem testes automatizados de domínio, autorização ou interface.
- A instalação local das dependências não pôde ser concluída neste ambiente porque o espelho do npm retornou tarballs corrompidos repetidamente. Isso é uma limitação do ambiente de auditoria, não um diagnóstico de erro do código. A validação será repetida assim que a base limpa tiver dependências disponíveis.
- Não há evidência de teste em Android físico, iPhone, Expo Go ou builds EAS.

## Decisão de arquitetura

Será criado um aplicativo limpo, usando o ZIP corrigido somente como referência e reaproveitando trechos comprovadamente úteis. O banco será evoluído com migrações aditivas e idempotentes, sem apagar dados existentes.

### Modelo de autorização escolhido

1. O usuário entra pelo mesmo Supabase Auth do Portal.
2. O papel administrativo é validado em registro protegido no banco.
3. Todo projeto pertence obrigatoriamente a um contrato.
4. Todo contrato pertence obrigatoriamente a um cliente.
5. A tabela de membros vincula usuário a projeto e define o papel naquele projeto.
6. As políticas RLS verificam o vínculo de membro ou administrador.
7. Storage verifica metadado + projeto autorizado antes de gerar a URL assinada.
8. Operações privilegiadas usam RPC/Edge Function e revalidam o JWT.

### Compatibilidade com os dados existentes

A migração futura deverá:

1. criar `contratos` se estiver ausente;
2. criar um contrato de migração para cada projeto antigo usando `numero_contrato` quando válido;
3. resolver números antigos vazios ou repetidos com identificador técnico temporário, registrando-os para revisão administrativa;
4. adicionar e preencher `projetos.contrato_id` antes de torná-lo obrigatório;
5. criar membros de projeto a partir de `clientes.auth_id` já existente;
6. adicionar `project_id` aos módulos que ainda não o possuem e gerar relatório de órfãos;
7. aplicar restrições `NOT NULL` somente depois que o relatório confirmar zero órfãos;
8. manter as colunas antigas durante a transição para não quebrar o Portal;
9. aplicar novas policies somente após testes com Admin, Cliente A e Cliente B.

## Ordem de implementação aprovada

1. Base limpa Expo, configuração correta, tema e componentes de estado.
2. Migração compatível de contratos, membros e segurança.
3. Autenticação, primeiro acesso, rotas e seleção de contexto.
4. Módulos do cliente com dados reais.
5. Módulos administrativos e funções privilegiadas.
6. Storage, uploads, versões e exclusões coerentes.
7. Testes funcionais e Cliente A versus Cliente B.
8. Expo Go, web, EAS e preparação das lojas.

## Ações da proprietária nesta fase

Nenhuma ação é necessária agora. Não criar projeto no Bolt, Replit ou outro gerador. Não executar as migrações dos ZIPs no Supabase. O próximo checkpoint será uma base Expo limpa e inicializável; somente depois serão solicitados logins ou cliques externos indispensáveis.

## Critério de saída da Fase 1

- arquitetura anterior mapeada: concluído;
- Supabase existente validado sem expor credenciais: concluído;
- divergências do esquema real identificadas: concluído;
- reaproveitamento definido: concluído;
- riscos de segurança e retrabalho registrados: concluído;
- plano aditivo definido: concluído.

