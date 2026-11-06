# Terceira auditoria completa — 06/11/2026

Base: main 66f80af9668bdc7f2ad7d6b08109622c7048186b. Código, testes no GitHub, consultas de leitura na produção e regressões PostgreSQL isoladas. Não foram criados contratos, pagamentos, aceites ou convites reais para testar o sistema.

## Problema novo reproduzido

Duas chamadas simultâneas do finalizador conseguiam criar duas revisões ou executar dois núcleos sobre o mesmo documento. O teste anterior protegia retentativas sequenciais e clique duplo na mesma tela; não provava exclusividade entre instâncias do servidor.

Reprodução: duas chamadas iniciadas juntas geraram três registros documentais no cenário com uma versão original, quando deveriam existir somente a original e uma revisão. Outro cenário, com a primeira chamada já renderizando, permitia duas respostas de sucesso e duas renderizações sobre o mesmo UUID.

## Plano de ação executado

| ID | Prioridade | Ação | Critério de aceite |
|---|---|---|---|
| C01 | Alta | Exclusividade por cadastro comercial e tipo de documento, validada no banco | Uma chamada conclui; a concorrente recebe estado de operação em andamento e não cria revisão |
| C02 | Alta | Proteção separada para o núcleo que continua trabalhando após perda da conexão | Nova tentativa e chamada direta ao núcleo aguardam; depois da conclusão, a mesma versão é retomada |
| C03 | Alta | Token de propriedade e validação entre finalizador e núcleo | Chamada atrasada e limpeza de um antigo proprietário não interferem na nova operação |
| C04 | Média | Expiração de segurança para trabalhador encerrado inesperadamente | O cadastro não fica bloqueado indefinidamente; registros e tipos diferentes permanecem independentes |
| C05 | Média | Regressões das funções PostgreSQL reais e dos handlers completos, incluídas no CI | Testar concorrência, retomada imediata, expiração, liberação, permissões e imutabilidade da versão emitida |

Implementação: controle interno em `private.commercial_emission_leases`, sem fonte paralela de dados comerciais. RLS habilitado; anônimos e clientes sem acesso; funções SECURITY INVOKER executáveis somente pelo servidor. A expiração supera o limite máximo de duração de um worker hospedado documentado pelo fornecedor, evitando que um worker antigo continue gravando depois da substituição. Referência: https://supabase.com/docs/guides/functions/limits.

A ausência de políticas de cliente nessa tabela privada é intencional: clientes são negados por padrão. O papel servidor existente tem BYPASSRLS e os privilégios necessários. O aviso informativo do advisor sobre RLS sem políticas não representa liberação pública dessa tabela.

## Conferência completa por área

| Área | Evidência desta rodada |
|---|---|
| Acesso e navegação | Suítes de sessão, retorno de login, autorização e navegação desktop/celular repetidas no GitHub; CAPTCHA preservado |
| Clientes e projetos | Zero projetos vinculados a contrato de cliente diferente; permanece um projeto legado sem contrato e um cliente sem identidade Auth |
| Comercial e documentos | Cenários de contrato e orçamento com falhas intermediárias, chamadas simultâneas, núcleo direto, transporte interrompido, snapshot e arquivo divergente |
| Acervo e histórico | 36 documentos e dez snapshots; zero snapshots duplicados por documento/versão, zero referências físicas internas ausentes, zero Word emitido sem caminho e zero vínculo de histórico quebrado |
| Financeiro e recibos | Zero recibos sem lançamento correspondente ou com valor divergente; resumo financeiro com security_invoker=true; regressões financeiras e OFX na suíte |
| Cronogramas e obras | Regressões de revisões, contratos, orçamento, adicional, aprovações, medições, baselines, feriados, publicação e Excel no workflow de publicação |
| Agenda e relacionamento | Código, permissões, filas e notificações cobertos pelas suítes; 22 e-mails com status enviado. Recebimento na caixa postal, push e calendário em dispositivos reais não são comprovados por esse estado |
| Segurança e armazenamento | Zero tabelas públicas sem RLS e zero buckets públicos; controle interno de emissão inacessível a anon/authenticated |
| Logs | Na consulta de function_edge_logs da janela de 24 horas, todas as respostas agrupadas retornaram status 200. Isso cobre a fonte consultada, não todos os serviços ou fluxos sem chamada registrada |

Os alertas preexistentes sobre funções SECURITY DEFINER executáveis e proteção contra senhas vazadas continuam registrados para avaliação de configuração. Não foram revogadas permissões indiscriminadamente nem removida proteção de autenticação.

## Pendências de cadastro e limites

- Projeto legado sem contrato: regularizar com os dados verdadeiros do acordo. Não inventar número, valor ou assinatura.
- Cliente sem conta: habilitar pelo fluxo explícito de convite, mantendo o cadastro existente. Nenhum convite foi enviado nesta auditoria.
- Testes de rede, banco e Storage dos handlers usam adaptadores determinísticos; a camada SQL de controle é testada com PostgreSQL real via PGlite. A suíte independente continua gerando e reabrindo Word e Excel reais com dados sintéticos.
- Resultado final de CI e publicação: workflows associados ao commit. Não apresentar testes isolados como emissão de contrato real, entrega de mensagem ou garantia de ausência absoluta de erros.
