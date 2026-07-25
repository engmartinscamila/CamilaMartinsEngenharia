# Camila Martins Engenharia

Site institucional, painel administrativo e portal privado do cliente.

## O que foi corrigido nesta versão

- Painel administrativo e portal do cliente com o mesmo azul-marinho,
  dourado e tipografia do site institucional.
- CRUD das áreas de clientes, projetos, documentos, fotos, biblioteca,
  financeiro, agenda, cronograma e solicitações.
- Upload validado no Storage antes da mensagem de sucesso e exibição por
  URL temporária segura.
- Visualização de imagens e PDFs no painel, com abertura, download e
  substituição do arquivo durante a edição.
- Modo de teste do portal do cliente acessível pelo cadastro de clientes,
  sem encerrar a sessão administrativa.
- Número de contrato e número de orçamento vinculados a cada projeto.
- Primeiro acesso com criação de senha e recuperação de senha por e-mail.
- Avisos por e-mail para novas solicitações e atualizações importantes.
- Preenchimento automático de endereço, cidade e estado pelo CEP, mantendo
  todos os campos editáveis.
- Página administrativa de solicitações reorganizada.
- Acesso à Área do Cliente no site principal e no cartão virtual.
- Correção de links locais, menu móvel, cache de arquivos e favicon.
- Fotos, documentos, agenda, biblioteca e solicitações organizados por cliente
  e contrato, usando também o identificador do cadastro.
- Galeria de fotos dentro do perfil administrativo de cada cliente.
- Biblioteca com pasta do cliente e subpastas por contrato.
- Progresso ponderado e editável por etapa, com modelos iniciais conforme o
  serviço contratado.
- Área construída, área do terreno e endereço da obra com busca por CEP ou
  cópia do endereço do cliente.
- Agenda no portal do cliente e avisos por e-mail.
- Respostas nas solicitações; o status interno aparece somente no painel
  administrativo.

## Ordem correta para atualizar

Não substitua somente os arquivos HTML/JS. Esta versão depende da migração
do banco incluída no pacote.

1. Faça um backup do site atual e do banco do Supabase.
2. No Supabase, abra o **SQL Editor** e crie uma consulta nova.
3. Se ainda não executou a migração final, copie todo o conteúdo de
   `supabase/migracao_correcao_final.sql`, execute uma única vez e confirme
   que não apareceu erro. Se ela já foi executada com sucesso, não é
   necessário repeti-la.
4. Execute também `supabase/migracao_recursos_portal.sql` para adicionar
   número de contrato e número de orçamento aos projetos.
5. Execute `supabase/migracao_organizacao_por_cliente.sql` para criar os novos
   campos, respostas, políticas e vínculos por cliente/contrato.
6. Em **Authentication > Providers > Email**, mantenha o provedor de e-mail
   ativado. Se o painel não mostrar uma opção separada para permitir novos
   cadastros, não é necessário alterar mais nada. O gatilho da migração
   principal bloqueia qualquer e-mail que não tenha sido previamente
   cadastrado na tabela `clientes`.
7. Substitua os arquivos do site pelos arquivos deste pacote.
8. Publique novamente a função `notificar-atualizacao`.
9. Teste primeiro o login administrativo e depois use o botão
   **Visualizar portal do cliente** no cadastro de um cliente.
10. No Supabase, execute novamente o **Security Advisor** para confirmar as
   políticas aplicadas.

O arquivo `supabase/verificacao_portal.sql` é somente leitura e mostra, em
uma única revisão, os acessos dos clientes, arquivos ausentes no Storage,
contratos/orçamentos e políticas do portal.

Depois do envio ao GitHub, aguarde o workflow do GitHub Pages ficar verde e
atualize o navegador com `Ctrl + F5`.

## Teste rápido após publicar

1. Entre como administradora.
2. Cadastre um cliente de teste e confirme a busca do CEP.
3. Cadastre um projeto para esse cliente.
4. Envie uma foto e um documento vinculados ao projeto.
5. Abra os dois arquivos no painel administrativo.
6. No cadastro do cliente, use **Visualizar portal do cliente** e confirme
   que projeto, foto e documento aparecem somente para ele.
7. Envie uma solicitação pelo portal e altere o status no painel
   administrativo.

## Como liberar o acesso de um cliente

1. Cadastre o cliente no painel administrativo com o e-mail correto.
2. Oriente o cliente a abrir `login.html` e clicar em
   **Primeiro acesso: criar minha senha**.
3. O cliente informa o mesmo e-mail cadastrado, cria a senha e confirma o
   endereço pelo e-mail recebido.
4. O vínculo com a tabela `clientes` é feito automaticamente.

Como alternativa, a administradora ainda pode convidar o mesmo e-mail em
**Authentication > Users**.

Qualquer tentativa de criar uma conta cujo e-mail não tenha sido cadastrado
antes na tabela `clientes` será bloqueada pelo banco.

## Recuperação de senha

O botão **Esqueci minha senha** envia o link para o e-mail cadastrado no
Supabase Authentication. A URL
`https://camilamartinsengenharia.com.br/redefinir-senha.html` precisa
permanecer na lista de Redirect URLs do Supabase.

Para uso em produção, configure um SMTP próprio em
**Authentication > Emails > SMTP Settings**. Sem SMTP próprio, o envio usa
o serviço padrão do Supabase e fica sujeito aos limites do projeto.

## Notificações de andamento

O código da Edge Function está em
`supabase/functions/notificar-atualizacao`.

Antes de publicar a função, configure em **Edge Functions > Secrets**:

- `RESEND_API_KEY`
- `NOTIFICATION_ADMIN_EMAIL`
- `NOTIFICATION_FROM_EMAIL`
- `SITE_URL`

Depois implante a função `notificar-atualizacao`. O remetente precisa usar
um domínio verificado no Resend. As instruções completas estão em
`supabase/functions/README.md`.

O site não usa a tabela antiga `clientes_camila` para os clientes novos.
Ela foi mantida para não apagar o cadastro administrativo existente.

## Segurança

- A chave presente em `js/supabase.js` é a chave publicável do navegador.
- Nunca coloque uma chave `service_role` nos arquivos do site.
- As tabelas e os buckets privados usam RLS para separar os dados de cada
  cliente.
- Os buckets usados pelo site são: `documentos`, `fotos` e `biblioteca`.
