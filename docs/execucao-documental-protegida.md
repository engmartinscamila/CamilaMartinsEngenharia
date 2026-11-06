# Execução protegida de contrato e Anexo I

O gerador do site foi corrigido, mas os documentos já emitidos permanecem imutáveis. Uma correção cadastral precisa de nova revisão do contrato e novo Anexo I derivado da revisão concluída.

`process-commercial-document-job` executa essa cadeia no servidor para operações administrativas autorizadas. Reutiliza os quatro handlers canônicos por adaptadores gerados por `node scripts/build-commercial-document-job.mjs`; não mantém outro modelo de contrato ou de regras comerciais. As rotas públicas e sua autenticação de usuário permanecem iguais.

## Autorização

- A fila contém somente estado operacional; o cadastro e os documentos existentes continuam sendo a fonte dos dados comerciais.
- RLS habilitado, sem privilégios ou políticas para anônimos/clientes. Somente o servidor registra, consulta e processa trabalhos.
- Cada trabalho tem segredo aleatório de 256 bits, armazenado por SHA-256, prazo de validade, administradora solicitante existente e cadastro específico. O segredo não é devolvido pelos RPCs, registrado em log ou incluído no repositório.
- A rota usa essa autenticação própria; `verify_jwt=false` não torna a operação pública. Requisições sem segredo válido são recusadas antes de alterar documentos. O corpo é limitado a 4 KB.
- A delegação de RPC exige trabalho ativo e segredo válido. A lista permitida contém apenas o diagnóstico do cadastro, limites de emissão, numeração daquele cadastro e preparação de Anexo I daquele contrato/projeto. A identidade administrativa vale somente na transação PostgreSQL; nenhuma sessão Auth é criada.

## Preservação e retomada

1. Confere o token de edição, ausência de inconsistências e necessidade real de revisão.
2. Registra hashes dos arquivos e snapshots anteriores.
3. Emite a revisão comercial pelo mesmo finalizador do site.
4. Prepara o Anexo I a partir do snapshot congelado da nova revisão, sem repetir o formulário comercial.
5. Gera, arquiva e registra a mesma versão do Anexo I.
6. Reabre os dois pacotes Word, verifica CRC, arquivos OOXML essenciais, SHA-256 e correspondência de escopo/parcelamento. Confere novamente os hashes das versões antigas e o diagnóstico administrativo.

A preparação do Anexo I grava seu UUID na mesma transação que cria o rascunho. Uma falha após geração do contrato recupera a versão marcada pelo trabalho, sem emitir outra revisão. A exclusividade dura mais que o tempo máximo do worker hospedado e trabalhos concluídos são somente consultados em novas tentativas.

A revisão técnica dos binários de um trabalho concluído exige o mesmo segredo válido e só pode obter os dois arquivos daquele trabalho. Não há seleção arbitrária de cliente/documento pela requisição.

## Testes e publicação

- `node scripts/security/commercial-document-job-regression.mjs`: funções reais PostgreSQL com usuários e registros sintéticos; permissões, segredo, origem, exclusividade, delegação, checkpoint e expiração.
- `node --experimental-strip-types scripts/commercial-document-job-regression.mjs`: adaptadores gerados conferidos contra as fontes, orquestração com falhas intermediárias, ZIP real sintético, bloqueio de divergências e autenticação da rota. Os serviços SQL/Storage são adaptadores determinísticos neste teste.
- As suítes próprias continuam validando os handlers comerciais completos e a geração dos Word reais com dados sintéticos.

Executar o construtor antes de empacotar a função; incluir os arquivos de `generated/` e o `deno.json`. Resultados de execução em registros reais são conferidos separadamente; teste de código não equivale a reemissão real.
