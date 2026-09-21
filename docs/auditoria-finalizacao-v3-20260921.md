# Auditoria de integração comercial v3 — 21/09/2026

## Correções verificadas

- Contrato Mestre v3 ativo em produção, versões anteriores e documentos emitidos preservados. Os 18 serviços ativos admitem pacotes inclusive quando contratados individualmente; o nível não acrescenta atividades ou entregáveis não contratados.
- Contrato Mestre v3 tem 94 cláusulas numeradas; referências dos catálogos apontaram para cláusulas existentes. Essa checagem é sintática e não substitui aprovação de conteúdo.
- Geradores comerciais duplicados em `supabase/functions` e `portal-app/supabase/functions` foram sincronizados; testes isolados de DOCX, integridade do Word, propostas avulsas e snapshots históricos passaram em execuções anteriores da PR.
- Interface web corrigida: descrição digitada em Outros inclui uma única vez o serviço `p` no snapshot, sem retirar atividades comuns. Falha no carregamento do catálogo impede a criação em vez de usar nomes genéricos. Teste `scripts/commercial-custom-scope-regression.mjs` executado com sucesso no workflow 35570360115 e incluído na auditoria permanente.
- Catálogo de níveis de produção alinhado ao Contrato Mestre v3: `BRONZE — Essencial`, `PRATA — Ampliado` e `OURO — Completo`. Migração `20260921065500_alinhar_subtitulos_pacotes_contrato_v3.sql` testada com rollback e aplicada com sucesso; Prata/Ouro incrementados da versão 2 para 3, sem atualizar snapshots emitidos nem certificar versões não revisadas. Triggers de governança elevaram as pendências da v3 de 44 para 51. Revisões históricas v1/v2 permanecem 92 e nenhuma foi resolvida automaticamente.
- A tela de governança passa a mostrar o conteúdo do serviço, nível ou texto inteligente e as cláusulas relacionadas do Contrato Mestre, com escape do texto, antes de habilitar o botão de confirmação. Caso falte conteúdo ou cláusula vinculada, o botão permanece desabilitado. Testes de sintaxe, correspondência de cláusulas, segurança de regressão e integração estática passaram na execução 35571084088; rotina temporária removida. A confirmação com sessão real ainda NÃO foi testada.
- Função `admin_confirm_document_rule_review` em produção exige versão atual, trava registros, rejeita itens inativos, exige administrador e mantém auditoria. As 92 revisões históricas não podem rebaixar marcadores da v3; nenhuma aprovação foi executada pela auditoria.
- Teste passivo das 11 rotas públicas principais passou HTTP 200 (35564995056); testes de HTML local, menus e rotas principais não equivalem a ações após autenticação.
- Testes de permissões de banco com dados sintéticos e recuperação de senha passaram em execução anterior. Ambiente de segurança isolado não cobre todas as migrações do Contrato Mestre.

## Impedimentos para concluir/publicar

1. **51 revisões documentais da v3 aguardam análise e confirmação administrativa individual**, não apenas verificação de referências. A aprovação não pode ser dada automaticamente. Há 92 revisões v1/v2 preservadas exclusivamente como histórico.
2. Marcadores de versão dos catálogos dependem dessa conferência; não preencher `last_contract_master_version=3` sem registrar análise, especialmente após mudança dos subtítulos dos níveis.
3. `main` e a Edge Function final de produção ainda usam a geração anterior ao pacote completo desta PR. Site, app, geradores e banco devem ser publicados/testados conjuntamente, com JWT, integridade histórica e plano de reversão.
4. Homologação não reproduz integralmente o esquema documental de produção; falta ensaio completo de migrações em ambiente isolado equivalente, com dados sintéticos.
5. Ainda falta sessão legítima de administrador e cliente testando ORC → contrato → Anexo I → Word → prévia → download/arquivo → reemissão/histórico. Não usar credenciais na conversa.
6. Alertas de segurança remanescentes: 39 avisos de funções privilegiadas chamáveis por autenticados, que exigem avaliação individual para não quebrar RPCs, e proteção contra senhas vazadas desativada no Supabase Auth (a verificar configuração sem comprometer primeiro acesso).
7. Links externos, estados autenticados e ações de botões ainda não tiveram cobertura completa. Teste HTTP 200 não certifica funcionamento do aplicativo.

## Critério de liberação

Exigir quatro auditorias aprovadas no SHA exato candidato, revisão de conteúdo, homologação real completa, comparação exata site/backend, preservação de documentos e políticas de acesso. Manter `assert_document_governance_ready` intacto. Não integrar PR em rascunho com pendências impeditivas.
