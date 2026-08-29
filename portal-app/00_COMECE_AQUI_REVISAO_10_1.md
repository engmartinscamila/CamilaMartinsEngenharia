# Camila Martins Engenharia — Revisão 10.1 completa

Este pacote substitui a estrutura da Revisão 10 pela Revisão 10.1. Ele contém o aplicativo completo, não apenas arquivos soltos de correção.

## O que a Revisão 10.1 resolve

- remove o ciclo infinito que causava `Maximum update depth exceeded` ao entrar como cliente;
- mantém a navegação montada durante a sincronização;
- resolve a identidade do usuário antes de liberar os redirecionamentos;
- faz o botão **Sincronizar** atualizar os dados sem recriar a navegação;
- mantém a confirmação visual da sincronização;
- instala e confere automaticamente as dependências necessárias, inclusive `expo-secure-store`;
- corrige o alerta de `uuid` e aplica proteção local aos parsers vulneráveis do `image-size`;
- testa imagens ICNS, JXL e HEIF malformadas antes de iniciar o aplicativo;
- mantém os indicadores de homologação e separa registros fictícios do teste A/B das pendências reais de Storage;
- apresenta o nome do cliente e da administradora no início, sem usar o e-mail como nome;
- remove da área do cliente nomes de fornecedores, identificadores internos e explicações técnicas desnecessárias;
- revisa Termos de Uso e Política de Privacidade, com novo aceite por versão;
- preserva `.env.local`, dados do Supabase, arquivos, metadados, contratos e histórico financeiro.

## Como substituir a Revisão 10

1. No PowerShell em que o Expo está aberto, pressione `Ctrl + C` uma vez.
2. Extraia este ZIP em `Downloads` e confirme **Substituir os arquivos** quando o Windows perguntar.
3. Abra a pasta `Downloads\camila-martins-engenharia-app`.
4. Execute `1_ATUALIZAR_REGISTRO_LEGAL_10_1.cmd`, cole o conteúdo no SQL Editor aberto e clique em **Run**. Faça isso uma única vez na homologação.
5. Execute `APLICAR_REVISAO_10_1.cmd`.
6. Aguarde a instalação, a validação e o novo QR Code.
7. Atualize o Expo Go pela Play Store ou App Store antes de ler o QR Code.
8. Entre primeiro como Cliente A e depois como administradora.

O instalador preserva o arquivo `.env.local`, instala as dependências da Revisão 10.1, executa a auditoria de segurança, verifica TypeScript e compatibilidade do Expo e inicia o aplicativo com o cache limpo.

## O que não fazer

- não execute outras migrações; aplique somente a atualização legal indicada no passo 4;
- não reaplique migrações da Revisão 10;
- não apague nem substitua `.env.local`;
- não execute `npm audit fix --force`;
- não exclua registros indicados como órfãos sem confirmar o arquivo e o projeto;
- não use o instalador antigo da Revisão 10.

## Teste esperado

- o Cliente A entra sem a tela vermelha de erro;
- o início mostra **Olá, nome do cliente**, nunca o e-mail;
- o painel administrativo mostra **Olá, Camila**;
- a nova versão dos Termos de Uso e da Política de Privacidade exige novo aceite e preserva o histórico anterior;
- os botões de tema e sincronização permanecem no topo;
- tocar em **Sincronizar** mostra a confirmação e atualiza os dados;
- a Área Administrativa continua abrindo normalmente;
- em **Segurança e Storage**, registros fictícios do teste não são contados como pendências reais.

Esta revisão atualiza somente a função que registra a nova versão dos documentos legais. Não apaga tabelas, clientes, arquivos ou aceites anteriores.
