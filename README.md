# Camila Martins Engenharia

Site institucional, painel administrativo e portal privado do cliente.

## O que foi corrigido nesta versão

- Painel administrativo e portal do cliente com o mesmo azul-marinho,
  dourado e tipografia do site institucional.
- CRUD das áreas de clientes, projetos, documentos, fotos, biblioteca,
  financeiro, agenda, cronograma e solicitações.
- Upload validado no Storage antes da mensagem de sucesso e exibição por
  URL temporária segura.
- Preenchimento automático de endereço, cidade e estado pelo CEP, mantendo
  todos os campos editáveis.
- Página administrativa de solicitações reorganizada.
- Acesso à Área do Cliente no site principal e no cartão virtual.
- Correção de links locais, menu móvel, cache de arquivos e favicon.

## Ordem correta para atualizar

Não substitua somente os arquivos HTML/JS. Esta versão depende da migração
do banco incluída no pacote.

1. Faça um backup do site atual e do banco do Supabase.
2. No Supabase, abra o **SQL Editor** e crie uma consulta nova.
3. Se ainda não executou a migração final, copie todo o conteúdo de
   `supabase/migracao_correcao_final.sql`, execute uma única vez e confirme
   que não apareceu erro. Se ela já foi executada com sucesso, não é
   necessário repeti-la.
4. Em **Authentication > Providers > Email**, mantenha o provedor de e-mail
   ativado. Se o painel exibir separadamente **Allow new users to sign up**,
   desative somente essa opção. Em versões do painel que não exibem essa
   opção, o RLS continuará bloqueando usuários não vinculados.
5. Substitua os arquivos do site pelos arquivos deste pacote.
6. Teste primeiro o login administrativo e depois um login de cliente.
7. No Supabase, execute novamente o **Security Advisor** para confirmar as
   políticas aplicadas.

Depois do envio ao GitHub, aguarde o workflow do GitHub Pages ficar verde e
atualize o navegador com `Ctrl + F5`.

## Teste rápido após publicar

1. Entre como administradora.
2. Cadastre um cliente de teste e confirme a busca do CEP.
3. Cadastre um projeto para esse cliente.
4. Envie uma foto e um documento vinculados ao projeto.
5. Abra os dois arquivos no painel administrativo.
6. Entre com o usuário do cliente e confirme que projeto, foto e documento
   aparecem somente para ele.
7. Envie uma solicitação pelo portal e altere o status no painel
   administrativo.

## Como liberar o acesso de um cliente

1. Cadastre o cliente no painel administrativo com o e-mail correto.
2. No Supabase, abra **Authentication > Users**.
3. Crie ou convide o usuário usando exatamente o mesmo e-mail.
4. O vínculo com a tabela `clientes` será feito automaticamente.

Qualquer tentativa de criar uma conta cujo e-mail não tenha sido cadastrado
antes na tabela `clientes` será bloqueada pelo banco.

O site não usa a tabela antiga `clientes_camila` para os clientes novos.
Ela foi mantida para não apagar o cadastro administrativo existente.

## Segurança

- A chave presente em `js/supabase.js` é a chave publicável do navegador.
- Nunca coloque uma chave `service_role` nos arquivos do site.
- As tabelas e os buckets privados usam RLS para separar os dados de cada
  cliente.
- Os buckets usados pelo site são: `documentos`, `fotos` e `biblioteca`.
