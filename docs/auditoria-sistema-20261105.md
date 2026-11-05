# Auditoria do sistema de gestão — 05/11/2026

Estado: auditoria de código e banco concluída para o escopo abaixo; correções em execução. Não representa certificação de funcionamento integral em sessão autenticada. A pedido da administradora, testes continuam pelo GitHub quando o acesso interativo não concluir.

Base: main 9d29f471600bec0217f61d6f823654a9bc58ed65. Site estático GitHub Pages, portal Expo web e Supabase de produção existente. Nenhum banco paralelo, documento emitido, aceite, pagamento ou histórico foi criado para realizar esta auditoria.

## Inventário e cobertura

| Área | Recursos encontrados | Evidência e limite |
|---|---|---|
| Site institucional | Home, portfólio, galeria, contato, previews 3D | 34 HTML, 84 JS e 28 CSS passaram na auditoria de referências/sintaxe; disponibilidade externa das mídias exige teste de rede |
| Acesso | Login, primeiro acesso, recuperação, redefinição, retorno interno, logout, sessões | Testes de ciclo de autenticação e retorno passaram; tentativa interativa não concluiu e permaneceu desabilitada, sem erro visível |
| Visão geral | Indicadores, busca, ficha, pendências | Código e testes de integração; nenhum teste real de salvamento nesta sessão |
| Clientes e projetos | Criar, editar, convidar, acessos, contratos, fichas | RPC e funções publicadas presentes; dois projetos legados sem contrato e um cliente ativo sem Auth |
| Comercial | Oportunidades, orçamento, contrato direto ou vinculado, prazos, parcelas, escopo por nível, Word original e revisão | 41 atividades e 123 escopos de nível no banco; testes estruturais e de integração; emissão real não executada |
| Documentos contratuais | Anexo I, vistoria, estudo, autorização de imagem, aditivo, quitação, notificações formais | Aditivo já existe. Contrato e Anexo I são snapshot; motivos de revisão permanecem internos. Um teste estático antigo ficou desatualizado |
| Emissões e aprovações | Documento/versão, liberação, aceites, substituição, validade, decisões de projeto | Testes do modelo passaram; a lista exige projeto, enquanto contratos comerciais podem existir sem projeto |
| Acervo | Documentos e biblioteca unificados, imagens, download protegido, recibos, arquivos antigos e restauração | Metadados compartilhados; imagem no álbum e no acervo é a mesma entidade, não cópia. Encontrados problemas de contexto e histórico abaixo |
| Financeiro | Entradas/saídas, caixa, pagamentos, contas, OFX, horas, margem, recibos, exportações, arquivo | Dois recibos têm lançamento associado e valores/status consistentes. Rascunhos fiscais existem mas faltam na navegação agrupada |
| Obras | Tarefas, dependências/modelos, diário, fornecedores e cotações | Estrutura implementada; tabelas vazias não provam falta de função nem execução bem-sucedida |
| Cronogramas | Simples, completo, criação, orçamento/quantitativos, medições, revisões, baselines, feriados, publicação, teste e Excel | 24 regressões de banco passaram; aceite/publicação reais não executados |
| Relacionamento | Agenda, solicitações/respostas, notificações e e-mails | 21 e-mails com status sent; não equivale a entrega na caixa de entrada. Zero solicitações/aprovações reais na base |
| Configurações | Identidade, textos/níveis, módulos por projeto, PDFs públicos protegidos, espaço, auditoria, diagnóstico e backup | RLS em todas as tabelas públicas; 7 buckets privados e view financeira security_invoker |
| Integrações | RPCs, Edge Functions, push, calendário, mídia pública, filas | Chamadas literais do frontend encontradas no backend; integração externa efetiva depende de credenciais e teste específico |

As 37 áreas registradas são compostas em centrais; não representam 37 funcionalidades independentes duplicadas. Rotas antigas são mantidas como compatibilidade. O README ainda descreve parte da arquitetura de maneira antiga e precisa acompanhar o portal integrado.

## Problemas e plano de ação em ordem

| ID | Prioridade | Problema confirmado | Ação | Critério de aceite |
|---|---|---|---|---|
| A01 | Alta | Link de recibo usa receiptId, mas iframe e central descartam esse parâmetro | Preservar receiptId na navegação, retorno de login e contexto do módulo | Abrir recibo existente pelo acervo mantém seu identificador, sem emitir outro |
| A02 | Alta | Histórico do arquivo documental não respeita o projeto selecionado | Consultar histórico e restauração pelo UUID; filtrar manutenção no servidor por UUID | Mesmo nome de projeto não mistura arquivos; limpar seleção retorna ao conjunto geral |
| A03 | Alta | Manutenção usa nome parcial de projeto como contexto automático | Acrescentar projectId aos filtros da função existente, mantendo filtros antigos | Preview/export do projeto só considera seu UUID |
| A04 | Média | Oito eventos de geração aparecem como oito emissões da mesma versão | Agrupar apresentação por documento e versão; conservar contagem de gerações e trilha original | Uma versão na lista operacional; eventos de auditoria preservados |
| A05 | Média | Rascunhos fiscais não aparecem na central financeira | Expor subárea existente com rótulo explícito de rascunho | Acesso disponível, sem anunciar emissão de NF |
| A06 | Média | Navegação financeira por alias sobrescreve view=history/accounts/hours por entries | Preservar subárea financeira reconhecida | Origem e retorno mantêm subárea válida |
| A07 | Média | Notificações rejeitam destinos modernos válidos como document-center e centrais | Atualizar destinos permitidos e parâmetros conhecidos | Links internos válidos resolvem; URLs externas continuam recusadas |
| A08 | Média | Um teste de revisões procura frase antiga embora o gerador já restrinja revisões por atividade | Atualizar teste para regra vigente, preservando obrigação de não presumir revisões | Teste verifica política atual e proteção de assinatura/escopo |
| A09 | Alta | Dois projetos sem contrato; um tem duas opções de contrato e o outro nenhuma | Mostrar pendência acionável; não inventar vínculo ou contrato | Responsável confirma vínculo comercial correto antes de regularizar |
| A10 | Alta | Um cliente ativo sem identidade Auth | Expor diagnóstico de acesso e ação existente de convite | Reutilizar cadastro e confirmar entrega do convite; sem envio durante auditoria |
| A11 | Média | Histórico/documentos distribuídos entre criação comercial, aprovações e manutenção | Manter criação/Word no comercial, decisões no centro, manutenção sem extrato geral aberto | Cada tela tem propósito explícito e não apresenta todo o histórico por padrão |
| A12 | Média | Readme não reflete portal integrado publicado | Atualizar arquitetura e instruções de validação | Fonte e publicação descritas corretamente |
| A13 | Baixa | Aviso de proteção contra senhas vazadas desativada | Verificar disponibilidade/plano e configuração de Auth | Melhoria de segurança separada de falha funcional |
| A14 | Validação | CAPTCHA/login impediu teste autenticado neste ambiente | Continuar GitHub conforme pedido; não remover CAPTCHA | CI e artefato passam; registrar que teste autenticado real permanece pendente |
| A15 | Validação | APIs externas, e-mail recebido, push e sincronização de calendário não comprovados por análise estática | Teste real controlado após acesso/dispositivos adequados | Evidência por integração; status enviado não equivale a recebido |

## O que foi validado sem alterações nos dados

- Banco ACTIVE_HEALTHY; sem avisos de saúde e sem erros ERROR/FATAL encontrados na consulta de logs das últimas 24 horas. Ausência de log não prova funcionamento completo.
- Nenhuma tabela pública sem RLS. Sete buckets existentes são privados. View project_financial_summary usa security_invoker=true.
- 52 funções SECURITY DEFINER sinalizadas pelo advisor não são automaticamente vulnerabilidades: as 34 funções admin executáveis por authenticated verificadas contêm checagem is_portal_admin. Requer análise individual de funções auxiliares; não revogar em massa e quebrar RLS.
- Nenhuma referência física quebrada detectada em documentos com caminho de Storage não HTTP. Não cobre URLs externas, links assinados vencidos nem fidelidade do conteúdo.
- Dois recibos vinculados ao financeiro, sem diferença de valor ou pagamento; 21 e-mails da fila marcados como enviados.
- 24 regressões SQL locais aprovadas; TypeScript aprovado; integração, privacidade de emissão, ciclo de sessão, retorno interno e modelo de documentos aprovados.
- A suíte estática inicial passou em 35 de 52 comandos; 16 falharam por dependências ausentes e um pela expectativa antiga A08. Após instalar a dependência de banco, todos os 24 testes SQL passaram. Falha de instalação não foi classificada como falha do produto.

## Encerramento exigido

Não declarar 100% enquanto houver vínculos comerciais indefinidos, acesso de cliente ausente, teste autenticado pendente ou integrações sem evidência. Cada correção deve ter teste de comportamento, commit, CI e publicação confirmada. Nenhum registro histórico deve ser apagado para esconder duplicação visual.
