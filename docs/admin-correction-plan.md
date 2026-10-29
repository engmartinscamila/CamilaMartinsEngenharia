# Correção do administrador — acompanhamento

Base de recuperação do código: `3e9d3c703ac00faed7ea263d77a57080f1c5f402`, preservada na branch `backup/admin-before-priority-repairs`.

## Lote 1: falhas prioritárias

- Publicação do exportador existente `generate-verified-construction-schedule-xlsx`, restrito à administração e sem gravações de negócio.
- Exportação administrativa consistente em uma leitura do banco: 66 tabelas de negócio, contagens e inventário dos objetos. JSON e ZIP disponíveis em Configurações.
- ZIP com arquivos binários, manifesto e hashes SHA-256, verificação de tamanho e nova conferência dos dados e inventário ao terminar. Falhas cancelam o pacote. Limite de 256 MB no navegador.
- Exportação administrativa não equivale a dump recuperável de toda a infraestrutura. Auth, Vault, senhas, tokens, configurações externas e arquivos fora do Supabase exigem recuperação própria. Restauração automática sobre produção não é oferecida.
- Biblioteca: falha no refresh após persistir não elimina o arquivo salvo. Exclusão verifica metadados antes da limpeza física; referências compartilhadas preservam o objeto. Falhas de limpeza ficam visíveis para tratamento administrativo.
- A mesma preservação de referências também foi aplicada ao serviço de exclusão do portal moderno.
- Diagnóstico do servidor passa a conferir o exportador contratado e a exportação administrativa, incluindo leitura de recibos. Seu escopo é explicitado; não atesta entrega de e-mail nem executa emissão/exclusão.

Validação: testes sintéticos de ZIP/CRC/SHA-256 e falhas, planilha real gerada/reaberta, testes de autorização SQL com rollback, segurança A/B, TypeScript, integração e interface. Nenhuma emissão real nem exclusão de cliente/arquivo foi usada como teste.

Banco: apenas função aditiva `admin_export_application_backup()`. Nenhuma tabela existente foi alterada ou limpa. A função de exportação usa uma lista explícita; novos módulos precisam ser incluídos deliberadamente.

## Próximos lotes autorizados

1. Financeiro único: categorias, totais por situação, filtros, contas/saldos, OFX e acesso a recibos.
2. Arquivos únicos: cadastros centrais, Biblioteca e Álbum como visões; links contextuais e autoria por registro.
3. Gestão documental: criação, acompanhamento/aceites/versões e arquivo/restauração sem formulários concorrentes.
4. Menus e nomes canônicos em todas as interfaces, com redirecionamentos de compatibilidade.
5. Ficha de cliente/contrato, busca geral, recibo vinculado ao recebimento com idempotência, central de pendências, prévia do portal, histórico, proteção contra cliques repetidos e formulários que preservam preenchimento.
6. Mensagens de e-mail, filtros e paginação restantes, integração fiscal conforme provedor disponível e diagnósticos complementares.

Homologação deve usar identidades e arquivos sintéticos, sem copiar clientes reais nem disparar mensagens reais. Publicar cada lote após os testes correspondentes.

## Implementação dos demais lotes — 29/10/2026

| Atividade | Resultado implementado | Verificação |
| --- | --- | --- |
| Financeiro único | Extrato, contas, OFX, horas/margem, rascunhos fiscais e histórico na mesma área. Endereço antigo redireciona e preserva contexto. | Cálculos e tela real com dados sintéticos; categorias antigas preservadas; 1.001 registros recuperados; conciliação contada uma vez. |
| Indicadores financeiros | Recebido/pago separados de previsão; cancelados excluídos; lista, busca, projeto, mês e indicadores compartilham o mesmo filtro. | Testes de filtros, centavos, datas, cancelados e saldos. |
| Contas | Saldo inicial exige data de referência; registros conciliados não são editados/excluídos pelo extrato. | Modelo e bloqueios do serviço exercitados. Datas históricas não foram inventadas. |
| Arquivos | Documentos é o cadastro central; Álbum mostra imagens das mesmas fontes; Biblioteca abre a visão filtrada do cadastro central. Tabelas e arquivos existentes mantidos. | Teste no navegador móvel com os três tipos reais de metadado; links contextuais e lote de imagens. |
| Autoria e falhas de envio | Cada edição carrega sua própria marcação; categoria desconhecida permanece; formulário é preservado em falha parcial; repetição ignora arquivos já confirmados. | Duas edições sucessivas, clique duplo e falha na segunda gravação do lote, seguida de repetição sem cópia do primeiro arquivo. |
| Fluxo documental | Criação permanece em Contratos gerais; emissões/aceites, governança de versões e arquivo/restauração conservam funções distintas. Preparação antiga é apenas compatibilidade de entrada. | Auditorias documentais, regressões de governança, rota canônica e retorno após login. |
| Menus | Financeiro deixa de aparecer sob dois nomes. Nomes correspondentes foram alinhados. Recibos, Configurações e Conteúdo do site também têm acesso pelo menu do portal. | Auditoria de destinos, código de todas as rotas e testes de navegação/publicação. |
| Central de gestão | Busca entre clientes, contratos/projetos, arquivos, lançamentos, solicitações e aprovações; ficha do contrato e atalhos com projeto; pendências de respostas, aprovações, atraso financeiro e e-mails. | Serviços existentes protegidos; leituras paginadas e erro explícito quando uma fonte falha. |
| Recibo por recebimento | Entrada recebida abre formulário preenchido. Servidor deriva valor, cliente, projeto e data; uma chave única por lançamento e trava transacional devolvem a emissão existente. Word/PDF e histórico mantidos. | PostgreSQL isolado: autorizado/não autorizado, repetição com outra requisição, pendentes recusados e registro imutável. Bloqueio não administrativo também verificado em produção com rollback. |
| Prévia do portal | Módulos usam configuração salva; documentos gerados ainda não liberados não aparecem na amostra. Nenhuma sessão de cliente é criada. | Mesma condição de liberação vigente no banco; erros de leitura são apresentados como indisponibilidade. |
| Histórico e proteção de formulários | Auditoria conserva seus filtros e passa a recuperar páginas completas; aviso antes de fechar/recarregar formulários preenchidos; botões suprimem ativação repetida imediata. | TypeScript, lint, integração e regressões de interface. Não há cópia de dados dos formulários para armazenamento persistente do navegador. |
| E-mails | Fila automática existente verificada; histórico administrativo ganha filtro por situação e páginas, sem expor payload, tokens ou chaves. Central consulta todas as pendências de envio. | Fila registrada: 10 atualizações e 2 convites aceitos pelo provedor; agendamento ativo a cada minuto. Testes sintéticos de convite, retry, calendário e anti-enumeração. |
| Diagnóstico | `system-health` v5 acrescenta leitura das referências financeiras e dos vínculos de recibos. | Função publicada com JWT e verificação administrativa; não executa emissões, exclusões ou mensagens de clientes para testar. |

Alterações de banco adicionais: `opening_balance_date` em contas, chave de repetição em lançamentos, vínculo único de recibo/recebimento e RPC administrativa paginada de histórico de e-mails. Apenas alterações aditivas; nenhum cadastro, arquivo de cliente, lançamento ou recibo real foi removido/emitido como teste.

### Limites externos preservados

- O provedor aceita o envio, mas a credencial atual não permite confirmar chegada à caixa de entrada ou spam. A interface distingue envio aceito, fila e falha.
- NFS-e permanece identificada como **rascunho**. Transmissão municipal depende de provedor, credenciais e parâmetros fiscais disponíveis; nenhuma emissão é simulada como concluída.
- Backups exportam dados/objetos da aplicação; não substituem um dump de infraestrutura nem incluem segredos de Auth/Vault.
- Registros antigos que apontam para o mesmo objeto não foram apagados automaticamente: o catálogo reúne a visualização e preserva outros vínculos quando um cadastro é removido.

A publicação do código depende da aprovação automática das auditorias do repositório. O status final deve ser confirmado no deploy e nas URLs públicas, sem confundir alterações locais com publicação.


### Consolidação de documentos — 29/10/2026
- Arquivos e biblioteca: uma entrada para documentos, imagens e materiais, preservando os metadados e controles de upload existentes.
- Emissões e aprovações: documentos e aceites, aprovações e versões/liberações em visões integradas; URLs antigas redirecionadas e projeto compartilhado entre as visões.
- Barra lateral persistente no portal administrativo desktop e botões de ação com largura ajustável também no CSS móvel.
- Sem cópia ou remoção de arquivos e sem alterações fiscais.


### Central documental compacta — 29/10/2026
- Menu lateral com ícone/nome; sincronização normal discreta no Admin e alertas preservados para falhas.
- Pesquisa e seleção explícita de projeto, contexto compartilhado e criação no fluxo comercial existente.
- Lista de documentos com pesquisa, filtros e contadores reais; decisões de projeto sem repetir aceites documentais.
- Painel lateral reúne versão vigente, versões vinculadas por revisão, histórico, respostas e ações permitidas; liberação/envio exigem confirmação.
- Rascunhos de aprovação preservados na sessão por projeto; respostas atrasadas e falhas de consulta não produzem dados de outro projeto ou totais falsos.
- Consultas paginadas reutilizam dados e permissões existentes; nenhum esquema ou registro de produção alterado.
