# Revisão funcional 0.10.10 — 09/09/2026

Correções no site, portal web e aplicativo Android integrado.

## Problemas corrigidos

- Galeria pública: corrigido o clique/toque para ampliar a imagem. A captura do ponteiro agora começa somente no arraste, preservando o clique do botão.
- Dependências: js-yaml atualizado de 4.3.1 para 4.3.2 após o gate identificar GHSA-2883-xcg3-v3hh. Auditoria repetida sem exceções.

- Cronograma: estados legados como “Concluído” e “Em andamento” agora são entendidos pelo app; o site reconhece os estados com sublinhado escritos pelo app. A edição no site preserva o estado e oferece Pausado/Cancelado.
- Notificações: links das páginas antigas e do portal são convertidos em destinos conhecidos do app, com o projeto informado. Avisos sem destino útil oferecem “Marcar como lida”. Não há mais botão que apenas reabre a própria lista.
- Push: navegação aguarda autenticação, verifica o destino e não repete a abertura quando a sessão é renovada.
- Projetos: atualização preserva a seleção válida; falha no armazenamento local não impede carregar os projetos. Links de notificação selecionam projetos disponíveis à conta.
- Administração: acesso direto ao painel e menu de outras áreas em todas as telas administrativas. Nomes mais claros para documentos, auditoria e configuração do portal.
- Conteúdo: navegação entre documentos, fotos e biblioteca acompanha o tipo solicitado e reinicia o formulário, evitando reaproveitar arquivo/classificação de outra área.
- CRM: uma ação “Editar oportunidade” por registro; etapa, data e motivo da perda são editados juntos. Limpar a próxima ação realmente remove a data; datas inválidas e motivo de perda vazio são recusados.
- Gravação: alterações de tarefas, oportunidades, cronograma, cancelamento de agenda e aprovação de proposta verificam a linha retornada antes de indicar sucesso.
- Agenda: cancelamento tem confirmação com identificação do compromisso na própria ficha.
- Documentos: geração bem-sucedida oferece “Ver documentos gerados”; prazo em meses rejeita texto/números inválidos.
- Portal: resumo administrativo não se apresenta como visualização autenticada do cliente. Falha na consulta não é mostrada como zero registros.
- Área do cliente: removido atalho “Suporte” que duplicava Solicitações; contato da equipe identificado com clareza.
- Extrato OFX: elimina duplicações no arquivo, confere datas e concilia através de uma transação no banco. Exige mesma conta, valor exato e data até três dias distante. Possibilidades ambíguas em qualquer lado ficam sem vínculo. Falha na segunda gravação reverte a primeira; falha na conciliação informa que a importação já ocorreu.

## Banco

Migration `20260909041055_atomic_ofx_reconciliation.sql` aplicada e registrada no Supabase. Função SECURITY INVOKER, RLS preservada, verificação de administrador e execução anônima revogada. Nenhum lançamento existente foi conciliado durante a publicação.

A CLI não pôde ser carregada neste ambiente; a migration foi gerada pelo serviço de migrations do Supabase e o arquivo local usa a versão efetivamente registrada, sem inventar um timestamp.

## Verificação reproduzível

- `npm run typecheck`, `npm run lint`, `npm run test:integration` em portal-app.
- 26 verificações funcionais novas: estados, destinos de notificação, confirmação de gravação, CRM, importação OFX e erros parciais.
- `node scripts/security/ofx-regression.mjs`: 15 verificações em PostgreSQL isolado, incluindo ambiguidade, conta diferente, repetição, acesso administrativo e reversão de gravação parcial.
- O pipeline de publicação executa auditorias estáticas e testes de navegador do site; o pipeline Android verifica a compilação e a abertura instalada em emulador.

## Limites

Não é uma garantia de ausência de todo erro. Foram usados dados sintéticos para operações de escrita. Envio real de e-mail/push, aceites, emissões municipais, pagamento e edição de registros reais não foram executados como testes. A conferência manual autenticada dos fluxos com dados reais e a instalação no aparelho do usuário continuam necessárias.

Os avisos já existentes do Supabase sobre funções SECURITY DEFINER e proteção de senhas vazadas não foram convertidos em alegação de falha explorável nem resolvidos removendo permissões usadas pelo sistema. A nova função não usa SECURITY DEFINER.
