# Situação dos 22 achados — execução de 08/11/2026

Base: dossiê de auditoria de 07/11/2026 (commit de referência `22328fb`). Cada item foi conferido no código atual antes de qualquer correção.

| ID | Prioridade | Situação | Onde |
|---|---|---|---|
| A01 | P1 | **Corrigido e publicado** | PR #67 |
| A02 | P1 | **Corrigido e publicado** (banco aplicado em produção e verificado: alteração e exclusão do REC-000001 bloqueadas) | PR #69 + migração `20261108040000` |
| A03 | P1 | **Corrigido e publicado** (banco aplicado em produção) | PR #69 |
| A04 | P1 | **Corrigido e publicado** | PR #68 |
| A05 | P2 | **Corrigido e publicado** | PR #68 |
| A06 | P2 | **Corrigido e publicado** (RPC aplicada em produção) | PR #71 + migração `20261108050000` |
| A07 | P2 | **Corrigido e publicado** (banco aplicado em produção) | PR #71 |
| A08 | P2 | **Corrigido e publicado** (banco aplicado em produção) | PR #71 |
| A09 | P2 | **Corrigido e publicado** | PR #70 |
| A10 | P2 | **Corrigido e publicado** | PR #70 |
| A11 | P2 | **Código publicado; falta implantar a Edge Function** `generate-contract-document` | PR #70. Implantação automática via workflow (ver "Pendências") |
| A12 | P1 | **Causa já eliminada no código atual (bb98f81); recuperação implementada**. Os 6 documentos são identificados e podem ser reconstituídos como "CÓPIA RECONSTITUÍDA", preservando número, data e versão | PR #72. Requer a implantação das Edge Functions |
| A13 | P1 | **Mapa objeto a objeto entregue**; diferenças do V2 classificadas como intencionais | `A13-homologacao-x-producao.md` |
| A14 | P1 | **Mecanismos técnicos prontos**: valor desconhecido ≠ zero (A05), classificação auditável de avulso, campo para informar o valor do contrato, saldo bancário só com conta e referência. **Depende de dados seus**: valor de 4 contratos, contas bancárias e natureza de 3 lançamentos | Tela Financeiro → Recebíveis |
| A15 | P2 | **Aguarda decisão D04** (escopo de compras: pedido, compromisso, conta a pagar). Nada foi inventado | — |
| A16 | P2 | **Aguarda decisão D04** (SINAPI, BDI, curva ABC). Nenhuma integração falsa foi criada | — |
| A17 | P2 | **Aguarda decisão D05** (SS/FF/lag). O FS atual foi preservado | — |
| A18 | P1 | **Implementado**: aceite de aditivo gera uma única obrigação prevista e soma ao total de referência. **Migração pendente na produção** | PR #74 + migração `20261108060000` |
| A19 | P1 | **Diagnóstico e procedimento entregues**. Lacuna corrigida: a exportação passa a incluir as revisões financeiras e os aditivos (migração pendente). Plano Free: sem backup restaurável | `A19-backup-e-restauracao.md` |
| A20 | P2 | **Corrigido** (fixture, critérios rígidos e o mesmo arquivo no local e no CI) | PR #73 |
| A21 | P2 | **Verificado na produção**: todas as funções `admin_*` conferem a administradora; nenhuma função privilegiada é executável sem login; sem permissão de CREATE no esquema `public`; nenhum bucket público; as funções de push conferem o dono. As 2 tabelas com RLS e sem política são de uso exclusivo do servidor (negam tudo ao cliente, o que é correto) | — |
| A22 | P2 | **Verificado**: os 32 envios têm `provider_id` do Resend, e a consulta de entrega por ID existe em `dispatch-client-emails` | — |

## Pendências que dependem de você

1. **Confirmar duas migrações na produção.** A produção recusa a aplicação automática sem a sua confirmação. Elas são aditivas e não alteram dados existentes:
   - `supabase/migrations/20261108060000_accepted_addendum_financial_obligation.sql` (A18)
   - `supabase/migrations/20261108070000_backup_include_financial_reviews.sql` (A19)
2. **Criar o token de implantação das Edge Functions** (implanta A11 e A12 e as correções futuras):
   - Supabase → Account → Access Tokens → *Generate new token*;
   - GitHub → repositório → Settings → Secrets and variables → Actions → *New repository secret* com o nome `SUPABASE_ACCESS_TOKEN`;
   - Depois: GitHub → Actions → "Publicar Edge Functions no Supabase" → *Run workflow* com `generate-contract-document deliver-generated-document`.
3. **Dados do negócio (A14)**: informar o valor dos contratos sem valor e cadastrar as contas bancárias, se quiser saldo bancário.
4. **Decisões D04 e D05** (A15, A16, A17): definir se o sistema deve ter pedido de compra e conta a pagar, base SINAPI e BDI, e dependências SS/FF no cronograma.
5. **Backup**: avaliar o plano Pro do Supabase e fazer uma cópia dos arquivos (cerca de 150 MB).
6. **Opcional (A21)**: ativar a proteção contra senhas vazadas (Supabase → Authentication → Policies), se disponível no plano.
