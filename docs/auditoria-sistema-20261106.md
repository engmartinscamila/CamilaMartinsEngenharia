# Segunda auditoria do sistema — 06/11/2026

Base: main 9266ea5501f43febf420e1065123014493818f0f. Revisão por código, testes no GitHub e consultas administrativas de leitura na produção. Esta rodada acrescenta testes dos handlers HTTP completos do gerador, com falhas controladas entre as etapas de persistência. Não foram emitidos contratos, aceites ou pagamentos reais para fazer os testes.

## Problemas reproduzidos e plano executado

| ID | Prioridade | Falha demonstrada antes da correção | Correção e critério de aceite |
|---|---|---|---|
| B01 | Alta | O gerador gravava o Word e depois podia falhar ao atualizar o cadastro; o finalizador removia o registro da nova revisão mesmo com arquivo gerado | Manter a versão gerada vinculada e disponível para retomada; não apagar o Word depois de persistido |
| B02 | Alta | Falha no acabamento ou congelamento deixava um documento gerado sem emissão concluída; a tentativa seguinte retornava 409 como se ele fosse uma versão já emitida | Retomar o UUID existente, usando os dados e os bytes persistidos; não renderizar outra versão |
| B03 | Alta | Falha no arquivo ou no histórico ocorria depois do snapshot; a tentativa seguinte criava outra revisão | Distinguir finalização pendente de emissão concluída; terminar arquivo/histórico da mesma versão, sem duplicação |
| B04 | Alta | A recuperação precisava conferir a identidade do arquivo, inclusive quando o caminho já apontava para o próprio arquivo protegido | Guardar hash SHA-256 no snapshot; recusar conteúdo divergente e preservar o arquivo encontrado |
| B05 | Média | A prévia podia tratar finalização pendente como pedido de nova revisão, e o diagnóstico podia considerar o Word parcialmente gerado como emissão concluída | Mostrar retomada com os dados persistidos da emissão, manter a versão e não pedir novo motivo; liberar Anexo I somente após a finalização completa |

Teste novo: `scripts/commercial-emission-recovery-regression.mjs`. Executa os handlers completos de geração e finalização, para contrato e orçamento, com adaptadores determinísticos de banco, rede e Storage. Injeções: atualização de cadastro, acabamento, snapshot, arquivo, histórico e marcação de conclusão. Inclui primeira emissão, revisão, ausência de autorização, alteração posterior dos dados comerciais e conflito de conteúdo no arquivo. O teste separado de arquivos reais continua gerando e reabrindo Word e Excel para validar OOXML.

Antes do patch foram reproduzidos: remoção da revisão gerada, retorno 409 na retomada e criação de novo UUID depois da falha no arquivo/histórico. Depois do patch, todos os casos preservam UUID/versão, arquivo anterior e um registro operacional de emissão. Dados comerciais alterados depois da falha não reescrevem o conteúdo da emissão retomada.

## Conferência dos demais módulos e dados

- Navegação administrativa: auditoria funcional com dez itens de menu, 37 áreas React e 34 páginas HTML. A suíte de publicação repete os testes de interface, navegação integrada, retornos, recibos, acervo e contexto entre projetos.
- Banco: nenhuma tabela pública sem RLS e nenhum bucket público. Nenhum projeto associado a contrato de cliente diferente. Nenhum número de contrato ou pedido de recibo duplicado nas consultas desta rodada.
- Acervo: 36 documentos, dez snapshots; nenhuma repetição de documento/versão nos snapshots e nenhum objeto físico ausente entre os caminhos internos consultados.
- Financeiro: dois recibos, ambos vinculados a lançamento com valor consistente. Nenhum pedido de emissão de recibo repetido.
- E-mails: 22 registros marcados como enviados; esse estado não comprova recebimento na caixa postal. Não foram enviados e-mails nesta auditoria.
- Persistem duas pendências de dados distintas de falha do gerador: um projeto legado sem contrato e um cadastro sem identidade Auth. O fluxo existente permite regularização com os dados verdadeiros do acordo e convite explícito. Não foram inventados contrato, valor, assinatura ou credenciais.
- Segurança: o advisor mantém alertas sobre funções SECURITY DEFINER executáveis e proteção contra senhas vazadas. Eles exigem avaliação individual; não foi feita revogação indiscriminada que quebrasse as regras existentes. A alteração desta rodada mantém SECURITY INVOKER, verificação administrativa e bloqueio de execução anônima no diagnóstico.

## Fechamento e evidência

B01–B05 implementados com regressões e integrados aos workflows comercial e de publicação. A evidência final de CI e implantação é o resultado dos workflows associados ao commit. Os dados reais e as emissões anteriores permanecem preservados; testes em ambiente isolado não devem ser apresentados como novas emissões na produção nem como prova de entrega de e-mail, push ou calendário.


## Complemento — perda da resposta durante geração

Reteste solicitado: uma conexão HTTP interrompida não cancela necessariamente o gerador que já está executando. Foi reproduzido um caso em que o finalizador fazia rollback de um rascunho enquanto o núcleo ainda gerava o Word, deixando a gravação posterior sem vínculo. A limpeza agora só pode ocorrer antes do despacho ao núcleo. Depois do despacho, a versão fica vinculada para retomada. O teste controla a execução em segundo plano e confirma UUID, versão, arquivo e histórico preservados; outra verificação garante que uma falha de vínculo anterior ao despacho continua removendo apenas o rascunho não utilizado.
