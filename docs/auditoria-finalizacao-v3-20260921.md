# Auditoria de integração comercial v3 — 21/09/2026

## Alterações comprovadas nesta rodada

- Contrato Mestre v3 ativo no Supabase de produção, sem campos provisórios; v1 e v2 preservados.
- 18/18 serviços ativos admitem Bronze, Prata e Ouro, inclusive contratações avulsas; o nível limita-se ao próprio serviço e não adiciona automaticamente entregáveis, visitas ou terceiros.
- O Contrato Mestre v3 possui 94 cláusulas numeradas; todas as referências de cláusulas dos serviços, níveis e textos ativos existem no mapa contratual (consulta de comparação retornou zero referências inexistentes).
- Gerador comercial principal sincronizado byte a byte entre `supabase/functions/generate-commercial-document/index.ts` e `portal-app/supabase/functions/generate-commercial-document/index.ts`. A primeira auditoria identificou divergência; o espelho foi corrigido, o teste de governança, o typecheck e a geração/regressão de DOCX passaram antes do commit. O workflow temporário foi excluído.
- A auditoria completa de portal (execução 35564022403), a validação de aplicativo (35564022408) e a regressão de Word (35564022384) foram bem-sucedidas na versão sincronizada. O teste do Worker público foi pulado naquela execução; não constitui prova de disponibilidade do Worker.
- O teste de segurança de mesma versão encontrou um falso negativo de fixture: tentava publicar Contrato Mestre v2 sobre um banco isolado sem texto contratual. O fixture foi limitado às migrações de segurança para as quais possui dados sintéticos, sem alterar políticas; o teste PostgreSQL de isolamento e recuperação de senha passou na execução 35564203778. Isto NÃO prova migrações contratuais em banco recém-criado.
- Scripts/workflows temporários de sincronização e de correção de fixture foram removidos da branch.

## Bloqueadores verificados — não autorizar emissão ou declarar homologação

1. Contrato Mestre v3 possui 44 revisões pendentes: 12 `contract` de serviço, três `level`, 13 `service` e 16 `text`. São revisões de conteúdo e devem ser homologadas individualmente pela administradora; não aprovar automaticamente via SQL.
2. Atualização de versões de catálogos ainda não homologada: 17 serviços, três níveis e nove textos ativos não registram a v3 em `last_contract_master_version`. Não atualizar marcador sem registrar revisão de conteúdo.
3. `main` e Edge Functions da produção ainda não recebem o código corrigido dos pacotes avulsos nesta branch. Para publicar, sincronizar site, cópias do gerador e Edge Functions com JWT obrigatório, verificar versões e plano de reversão.
4. O ambiente de homologação disponível não reproduz a governança documental de produção. Falta um teste integral de migrações e cenários com dados inteiramente sintéticos.
5. Não foi efetuado teste autenticado real admin/cliente de proposta → contrato → Anexo I → Word → prévia → download/arquivo → revisão histórica; testes sintéticos não substituem esse percurso.
6. Advisor Supabase apresentou 39 avisos de funções SECURITY DEFINER chamáveis por autenticados. Amostra de quatro rotinas administrativas confirmou checagem explícita de `is_portal_admin()`, e `anon` sem EXECUTE. Avaliar individualmente as demais; NÃO revogar em massa. Advisor também avisou proteção contra senhas vazadas desativada; verificar ativação via configuração Supabase Auth sem alterar fluxo de primeiro acesso.
7. Verificar links externos e rotas sem extensão em execução real: a auditoria estática confere arquivos locais de extensão explícita, não toda navegação externa.

## Critério de liberação

Reexecutar auditorias no commit exato candidato, concluir análise da governança, comparar as versões site/backend, testar ambiente equivalente e sessão legítima; manter bloqueio `assert_document_governance_ready` até liberação administrativa auditável. Preservar contratos e snapshots existentes; não forçar merge da PR rascunho com verificações falhas.
