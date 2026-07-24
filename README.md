# Camila Martins Engenharia

Site institucional, painel administrativo e portal privado do cliente.

## Ordem correta para atualizar

Não substitua somente os arquivos HTML/JS. Esta versão depende da migração
do banco incluída no pacote.

1. Faça um backup do site atual e do banco do Supabase.
2. No Supabase, abra o **SQL Editor** e crie uma consulta nova.
3. Copie todo o conteúdo de
   `supabase/migracao_correcao_final.sql`, execute uma única vez e confirme
   que não apareceu erro.
4. Em **Authentication > Providers > Email**, mantenha o provedor de e-mail
   ativado. Se o painel exibir separadamente **Allow new users to sign up**,
   desative somente essa opção. Em versões do painel que não exibem essa
   opção, o RLS continuará bloqueando usuários não vinculados.
5. Substitua os arquivos do site pelos arquivos deste pacote.
6. Teste primeiro o login administrativo e depois um login de cliente.
7. No Supabase, execute novamente o **Security Advisor** para confirmar as
   políticas aplicadas.

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
