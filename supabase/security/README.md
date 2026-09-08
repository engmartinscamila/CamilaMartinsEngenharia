# Segurança verificada em 07/09/2026

O site estático mantém autenticação e autorização no Supabase. Código de interface
público e chave publicável não substituem nem enfraquecem RLS por si só.

## Evidências e reprodução

- `baseline-20260907.json`: exportação sem registros de clientes das tabelas,
  colunas, policies (incluindo PERMISSIVE/RESTRICTIVE), privilégios e funções
  públicas, anterior a estas correções. Não é um backup completo do banco.
- Migrations `20260907234344`, `20260907234552`, `20260907234901` e `20260908050914`: mesmas versões
  registradas em produção; preservam dados e a conta administrativa existente.
- `verify-live.sql`: verificações de produção em transação somente leitura.
- `node scripts/security/rls-regression.mjs`: 115 verificações em PostgreSQL
  embarcado com dados sintéticos, usando as policies exportadas e estas migrations.
  Testa anônimo, clientes A/B, cliente suspenso, admin, rascunhos, módulos ocultos,
  originais protegidos, falsificação de solicitações e limite de recuperação.
  O ambiente isolado replica colunas e regras de segurança, sem triggers comerciais,
  constraints de negócio ou serviços externos; não substitui testes ponta a ponta.
- `node scripts/security/secret-scan.mjs`: examina arquivos de ambiente e padrões
  de credenciais no histórico Git sem imprimir valores de segredos.

Instale as dependências do teste com `npm ci --prefix scripts/security`.
O workflow de publicação bloqueia deploy se os testes de segurança falharem.

## Correções desta revisão

1. Consultas legadas e permissões por projeto passam a respeitar suspensão.
2. Documentos gerados dependem de liberação administrativa; uploads manuais
   existentes mantêm a compatibilidade. A RPC de leitura também obedece RLS.
3. Módulos ocultos voltam a ser restringidos por policies RESTRICTIVE (AND).
   Policies restritivas não ampliam acesso entre clientes.
4. Storage consulta metadados autorizados, em vez de confiar apenas na pasta.
   Originais autorais ficam na emissão protegida com URL temporária.
5. Solicitações de cliente não podem simular origem administrativa ou conclusão.
6. Recuperação de senha usa contador atômico, falha de forma fechada em erro do
   banco, limita a uma solicitação/minuto e cinco/hora por e-mail.
7. A página de integridade entra na lista de autorização administrativa.
8. Verificações CI reconhecem exemplos de ambiente e código que rejeita segredos,
   evitando falsos alarmes sem remover a detecção de credenciais reais.

## Limites da verificação

Os testes não enviam e-mails nem usam senhas de clientes reais. A recuperação foi
verificada com entrada vazia (resposta genérica) e testes do contador, sem entrega
real de mensagem. URLs já assinadas antes da mudança podem valer até expirar.

O advisor não aponta tabela pública sem RLS. Mantém avisos de funções SECURITY
DEFINER chamadas intencionalmente por usuários autenticados, cuja autorização é
aplicada no corpo da função, e de proteção adicional contra senhas previamente
vazadas desativada no Auth. Não foi alterado plano, cobrança ou provedor de login.
Não foi encontrada credencial service_role na configuração do navegador ou nos
padrões examinados do histórico. Isso não é garantia de ausência de todo segredo
possível, nem certificação de invulnerabilidade do sistema.

## Complemento de 08/09/2026: PDFs e hospedagem

A URL pública do PDF permanente respondeu HTTP 200 e application/pdf. As duas
cópias em assets/pdfs-protegidos foram removidas da versão atual do repositório e
do artefato; navegação agora usa proteger-pdf com o original no Storage privado,
marca-d'água por emissão e URL assinada. O portfólio não oferece botão de download;
o menu de experiências oferece a cópia identificada, conforme a regra existente.
A emissão pública do portfólio foi validada: protected=true,
downloadAllowed=false, expiresInSeconds=60. Um arquivo visível no navegador
continua passível de cópia/captura. Versões já baixadas, caches e histórico Git
anterior não podem ser tornados privados por essa alteração.

A proteção de originais cobre também o campo legado `autoral` em documentos e
biblioteca. PDFs da biblioteca abrem pelo visualizador, que solicita autorização
ao servidor sem primeiro tentar assinar o original. O selo de autoria usa os
metadados do documento e continua visível com as novas URLs temporárias.

O login usa auth.signInWithPassword, validado pelo Supabase. js/script.js contém
interações do site institucional, sem senha embutida identificada.
O CORS amplo observado pertence ao conteúdo estático do GitHub; não concede
privilégios no banco. Endpoints administrativos continuam exigindo JWT e papel.

A resposta HTTP do domínio não contém os headers de segurança enumerados pelo
usuário. _headers é compatível com Cloudflare Pages, mas não é aplicado pelo
GitHub Pages, hospedagem atual. CSP via meta foi ampliada para bloquear objetos,
formulários externos e troca de base URI. HSTS, X-Frame-Options e nosniff precisam
ser definidos no host/proxy HTTP; não podem ser substituídos por tags meta.
Não foi conectado nem configurado um proxy novo. Esse ponto permanece pendente
na infraestrutura e não deve ser descrito como resolvido.
