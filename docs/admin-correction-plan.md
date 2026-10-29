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
