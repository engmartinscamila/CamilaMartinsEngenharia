# Fechamento funcional — 06/11/2026

Base: `8c3f417dc6443dd15b4e5ee6a19bde5759ce7a60`. Continuação da auditoria com correções no ciclo de liberação, aceite e substituição. Não foram emitidos documentos comerciais reais, registrados aceites de clientes ou enviados convites para testar.

## Plano e critérios

| Etapa | Ação | Evidência |
|---|---|---|
| Segurança | Executar as 36 RPCs administrativas como usuário sem privilégio, em transação somente leitura com rollback | Zero funções retornando dados protegidos ou permitindo a operação; negações administrativas verificadas |
| Aceite | Corrigir SHA-256 para documento congelado sem snapshot separado | Erro 42883 reproduzido; cálculo com `pg_catalog.sha256` confere com SHA-256 do Node |
| Liberação | Evitar repetição de notificação e alteração da data original | Antes: duas notificações; depois: uma e mesma data; bloqueio por linha no banco |
| Substituição | Preservar vínculo estabelecido, cliente, projeto e tipo documental; impedir ciclos e destino não emitido | Repetição segura; tentativa de trocar novamente o destino, inverter a cadeia ou cruzar cliente é rejeitada |
| Concorrência | Serializar a leitura e validação do aceite com alterações da mesma versão | Aceite e substituição usam bloqueio da linha documental; emissão mantém o controle independente da rodada anterior |
| Regressões | Testar operações completas com funções PostgreSQL reais e linhas sintéticas | 37 verificações incluindo hash, snapshot, identidade, rejeição, duplicidade, validade, liberação, push e contrato sem projeto |
| Contrato sem projeto | Liberar, listar e aceitar pelo cliente proprietário sem criar projeto artificial | Acesso negado a outro cliente; registro com cliente correto e projeto nulo; listagem e painel web/aplicativo cobertos por regressões |
| Publicação | Aplicar migração e conferir código das RPCs ativas | Migração `20261106183250_client_document_acceptance_hash`; resultados dos workflows associados ao commit |

O teste de token Expo foi inicialmente interpretado incorretamente devido ao escape da expressão na consulta de diagnóstico. A expressão exata publicada aceita o formato válido. Nenhuma correção desnecessária foi aplicada ao cadastro push; o caso foi incluído na regressão.

## Segurança: avaliação dos avisos

- As 52 funções SECURITY DEFINER chamáveis por `authenticated` não equivalem a 52 operações desprotegidas. As 36 funções administrativas foram chamadas com argumentos tipados nulos e identidade sem privilégio em transação somente leitura. Todas exigiram administração; a consulta SQL de alertas retornou zero linhas. As funções de cliente mantêm verificações de identidade/associação e as suítes de isolamento.
- Não revogar globalmente EXECUTE: o portal precisa chamar essas RPCs. O teste cobre a barreira de entrada; não substitui regressões de cada operação e parâmetro.
- A tabela privada de controle de emissão permanece com RLS e sem políticas de cliente, propositalmente negada por padrão.
- O projeto está no plano gratuito. O recurso nativo de proteção contra senhas vazadas exige Pro ou superior: https://supabase.com/docs/guides/auth/password-security. Nenhuma assinatura foi alterada; a configuração não foi marcada como habilitada.

## Limites e dados reais

Um projeto legado continua sem contrato cadastrado; um cadastro comercial continua sem identidade Auth. Não foram inventados dados de acordo, criadas identidades para terceiros, alteradas senhas ou disparados convites. Corrigir código e passar CI não permite marcar esses cadastros como regularizados.

O aceite sem projeto foi implementado pela migração `20261106184050_standalone_document_acceptance`. O proprietário continua obrigatório e é obtido do documento; somente o vínculo de projeto pode ser nulo. A política de leitura permite o próprio registro, a consulta de documentos inclui os documentos próprios sem projeto e o painel de aceite funciona sem seletor de projeto. Tipos, constraints e fluxos existentes foram preservados; não foram criados projetos ou contratos artificiais.

A consulta ao provedor das três últimas mensagens retornou HTTP 401: a chave Resend tem permissão apenas de envio. A rota interna respondeu HTTP 200, mas isso não comprova entrega. Nenhum e-mail foi reenviado. Para validar entrega, é necessário conceder leitura ao provedor ou configurar eventos de entrega autenticados.

Os testes SQL desta rodada usam os tipos de coluna e definições das quatro funções exportadas da produção, com chaves e restrições necessárias reconstruídas. Não incluem todas as triggers, políticas e serviços externos da produção. O isolamento amplo permanece nas suítes próprias. A verificação de entrega de mensagens consulta o provedor pelo fluxo interno existente, sem reenvio; status enviado na fila não deve ser confundido com entrega.
