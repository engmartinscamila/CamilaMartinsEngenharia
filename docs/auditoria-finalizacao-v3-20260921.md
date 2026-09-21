# Auditoria de integração comercial v3 — 21/09/2026

## Alterações comprovadas nesta rodada

- Contrato Mestre v3 ativo no Supabase de produção, sem campos provisórios; v1 e v2 preservados. 18/18 serviços ativos admitem Bronze, Prata e Ouro, inclusive contratações avulsas; o nível limita-se ao próprio serviço e não adiciona automaticamente entregáveis, visitas ou terceiros.
- O Contrato Mestre v3 possui 94 cláusulas numeradas; todas as referências de cláusulas dos serviços, níveis e textos ativos existem no mapa contratual (zero referências inexistentes).
- Gerador comercial principal sincronizado byte a byte entre `supabase/functions/generate-commercial-document/index.ts` e `portal-app/supabase/functions/generate-commercial-document/index.ts`. A primeira auditoria identificou divergência; o espelho foi corrigido, e o teste de governança, o typecheck e a regressão de DOCX passaram antes do commit. O workflow temporário foi excluído.
- Auditoria completa de portal (execução 35564022403), validação do aplicativo (35564022408) e regressão Word (35564022384) foram bem-sucedidas na versão sincronizada. O teste do Worker público foi pulado nessa execução; não constitui prova de disponibilidade do Worker.
- Teste de segurança identificou falso negativo de fixture: tentava publicar Contrato Mestre v2 sobre banco isolado sem cláusulas. Fixture limitado às migrações de segurança com dados sintéticos, sem mudar políticas; teste PostgreSQL de isolamento e recuperação de senha passou (35564203778). Isso NÃO valida toda migração contratual em banco novo.
- Corrigida na branch a orientação antiga da página web que limitava pacotes a projetos: interface agora informa que níveis do catálogo servem também a atividades avulsas e não assume outras atividades. Testes de sintaxe, auditoria estática de 33 HTML/63 JS/24 CSS, menu administrativo e governança documental passaram na execução 35564697018. Testes anteriores mal sucedidos da rotina temporária foram diagnosticados (pré-geração de frases faltante e proibição de listas fixas), corrigidos antes do commit; workflow temporário removido.
- Corrigida e implantada em produção a função `admin_confirm_document_rule_review`: requer Contrato Mestre ativo igual ao da revisão, bloqueia revisão e mestre durante confirmação, rejeita itens inativos e mantém checagem administrativa/auditoria. Migração versionada `20260921053000_revisao_apenas_contrato_ativo.sql`. Dupla conferência após aplicação: v3 ativa, 44 pendentes atuais, 92 pendentes históricas preservadas, zero resolvidas, `anon` sem EXECUTE, `authenticated` com EXECUTE sob guarda `is_portal_admin`. Não ocorreu aprovação real autenticada na auditoria.
- Teste passivo de links publicado (execução 35564995056) acessou sem login 11 rotas/arquivos e recebeu HTTP 200 em todos: home, login, galeria, portfólio, orçamentos, documentos contratuais, arquivo documental, portal, administração, logo e JS comercial. Validou presença de 3 destinos e 6 âncoras na homepage. Não testa funcionalidades autenticadas ou links externos; workflow temporário excluído.

## Bloqueadores verificados — não autorizar emissão ou declarar homologação

1. Contrato Mestre v3 possui **44 revisões pendentes**: 12 `contract` de serviço, três `level`, 13 `service` e 16 `text`. São revisões de conteúdo e devem ser homologadas individualmente pela administradora; não aprovar por SQL sem revisão.
2. Marcadores de catálogos ainda não homologados: 17 serviços, três níveis e nove textos ativos não registram v3 em `last_contract_master_version`. Não atualizar sem revisão substancial e registro auditável.
3. `main` e Edge Functions de produção não receberam os novos geradores de pacotes avulsos desta branch. Publicar frontend e backend sincronizados apenas após homologação e CI no SHA exato, com JWT obrigatório e plano de reversão.
4. Homologação atual não reproduz a governança documental de produção. Falta teste integral de migrações em base sintética equivalente.
5. Falta sessão autenticada real admin/cliente do percurso proposta → contrato → Anexo I → Word → prévia → download/arquivo → revisão histórica; testes sintéticos não substituem esse percurso.
6. Advisor Supabase mostrou 39 avisos de funções SECURITY DEFINER executáveis por autenticados. Amostra de quatro funções administrativas tem guarda explícita de `is_portal_admin()` e anon sem EXECUTE. Avaliar individualmente as restantes, sem revogação indiscriminada. Advisor também reportou proteção contra senhas vazadas desativada; configuração do Supabase Auth requer ajuste sem quebrar o primeiro acesso.
7. Rotas públicas verificadas passivamente, porém links externos, navegação condicionada ao login e ações de botões continuam sem teste de sessão real.

## Critério de liberação

Reexecutar as quatro auditorias no commit exato, revisar a governança, comparar versões site/backend, testar ambiente equivalente e sessão legítima. Manter `assert_document_governance_ready` até aprovação auditável; preservar contratos e snapshots. Não efetuar merge da PR em rascunho enquanto houver bloqueadores.
