# Revisão 0.10.2 — integração do site e portal

## Alterações realizadas

- site público preservado na raiz;
- portal Expo integrado em `/portal` por `experiments.baseUrl`;
- cinco links públicos de Área do Cliente atualizados;
- 23 URLs antigas de cliente/admin encaminhadas às novas rotas equivalentes;
- build único do Cloudflare criado, com saída exclusiva em `dist`;
- Node.js fixado em 22.16.0;
- `_headers` com proteção e bloqueio de indexação da área restrita;
- `robots.txt` atualizado para não indexar `/portal`;
- verificação de arquivos obrigatórios, referências locais, limite de tamanho e
  ausência de credenciais administrativas;
- GitHub Pages alterado para acionamento manual e para publicar o mesmo `dist`;
- arquivos locais, dependências, exports e ZIPs de backup ignorados.

## Resultados reaproveitados da revisão 0.10.1

Não foram repetidas auditorias já aprovadas no pacote anterior: TypeScript,
lint, Expo Doctor, correções de dependências, auditoria de segurança, export web
e preparação Android/iOS. Os relatórios continuam em `portal-app/docs`.

## Verificação desta integração

- export estático Expo: 53 rotas;
- site público e portal montados: 314 arquivos no teste local;
- maior arquivo público: abaixo do limite de 25 MiB;
- rotas pública, login, cliente e admin presentes;
- links locais do site público válidos;
- nenhum `.env`, `node_modules`, Secret key, JWT `service_role` ou chave privada
  incluído no diretório de publicação.

O build local utilizou valores públicos fictícios somente para validar a
compilação. Nenhuma credencial fictícia faz parte do ZIP final; o Cloudflare
deve receber as variáveis reais pelo painel.
