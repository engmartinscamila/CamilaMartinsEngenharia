# Matriz de requisitos recuperados do prompt original

Esta matriz evita interpretar “tela pronta” como “sistema validado”.

## Implementado no pacote

| Área | Situação |
|---|---|
| Autenticação, recuperação e primeiro acesso | Implementado com Supabase Auth |
| Separação Administrador / Cliente / Colaborador | Implementada na navegação e no banco |
| Isolamento Cliente A / Cliente B | RLS preparada; teste real ainda obrigatório |
| Múltiplas contratações | Seletor por contrato/projeto |
| Home e “o que acontece agora” | Resumo real de etapa, compromisso e indicadores |
| Cronograma | Lista real por projeto, status e progresso |
| Documentos e versões | Lista paginada, versão e URL temporária |
| PDFs técnicos autorais | Cópia identificada por cliente, contrato e código |
| Fotos autorais | Derivada com marca d’água; original privado |
| Documentos administrativos | Download autorizado somente ao cliente do projeto |
| Aprovações | Resposta e histórico, sem fingir assinatura digital |
| Solicitações | Categorias, estados, respostas e histórico |
| Pendências | Aprovações, solicitações e agenda que aguardam o cliente |
| Agenda e reunião online | Eventos reais e abertura do link cadastrado |
| Biblioteca por contratação | Escopo por projeto/cliente |
| Entregas e checklist | Derivado apenas de etapas e arquivos publicados |
| Notificações internas | Lista, leitura e publicação administrativa |
| Contato | Solicitação interna, WhatsApp e e-mail institucionais |
| Privacidade | Tela LGPD operacional e canal para pedidos |
| Offline | Aviso global; nenhum documento confidencial salvo offline |
| Tema e identidade | Escuro/claro/automático, cores, logo e Brittany do site |
| Sincronização | Botão manual + Realtime nas tabelas operacionais |
| Extrato financeiro | Exclusivo do administrador por RLS forçada |
| Exclusão de cliente | Prévia nominal e arquivo financeiro imutável antes da exclusão |
| Storage | Buckets privados, URLs de 10 minutos e diagnóstico de órfãos |
| Android/iOS/Web | Expo configurado; exportação web validada |

## Depende da homologação

Estes itens não podem ser declarados aprovados apenas pela leitura do código:

- executar a migração da Fase 7 na cópia de homologação;
- executar o preflight SQL;
- publicar as Edge Functions;
- testar Administrador, Cliente A e Cliente B com contas reais de teste;
- conferir se os seis metadados órfãos são registros antigos recuperáveis;
- testar cópia identificada de PDF e marca d’água de foto em aparelho real;
- confirmar o evento em tempo real nos dois sentidos;
- testar exclusão somente com um quarto cliente descartável;
- validar backup restaurável antes de produção.

## Depende de serviço externo ou decisão da empresa

| Item | Dependência |
|---|---|
| Push no aparelho | Projeto Expo/EAS, credenciais FCM/APNs e teste físico |
| E-mail crítico | SMTP/remetente aprovado no Supabase |
| Termos e Política definitivos | Texto jurídico aprovado e URLs publicadas |
| Publicação Android | Conta Google Play, assinatura e revisão |
| Publicação iOS | Conta Apple Developer, assinatura e revisão |
| Hospedagem do Portal web | Domínio/hosting apontado para esta versão e mesmo Supabase |

## Intencionalmente futuro no prompt original

Assinatura eletrônica, pagamentos, calendário externo automático, videochamada,
tour 360°, comparação antes/depois avançada, analytics, relatórios gerenciais,
dashboard de obra específico, busca global, favoritos e IA foram descritos como
futuros ou condicionais. Não devem consumir a estabilidade da V1.

## Limites técnicos honestos

- nenhum sistema pode prometer ser impossível de invadir;
- capturas de tela não podem ser impedidas em todos os aparelhos;
- marca d’água reduz abuso e aumenta rastreabilidade, mas não torna cópia
  tecnicamente impossível;
- o site só se torna espelho depois de ser publicado com esta versão ou adaptado
  para as mesmas tabelas, políticas e projeto Supabase.

