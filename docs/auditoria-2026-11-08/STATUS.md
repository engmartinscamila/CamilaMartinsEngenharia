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
| A18 | P1 | **Concluído**: site publicado e migração aplicada na produção (08/11, com confirmação da proprietária) | PR #74 + migração `20261108060000` |
| A19 | P1 | **Diagnóstico e procedimento entregues**. Lacuna corrigida e **aplicada na produção**: a exportação passa a incluir as revisões financeiras e as tarefas (inclusive aditivos, reaplicado após o A18). Plano Free: sem backup restaurável | `A19-backup-e-restauracao.md` |
| A20 | P2 | **Corrigido** (fixture, critérios rígidos e o mesmo arquivo no local e no CI) | PR #73 |
| A21 | P2 | **Verificado na produção**: todas as funções `admin_*` conferem a administradora; nenhuma função privilegiada é executável sem login; sem permissão de CREATE no esquema `public`; nenhum bucket público; as funções de push conferem o dono. As 2 tabelas com RLS e sem política são de uso exclusivo do servidor (negam tudo ao cliente, o que é correto) | — |
| A22 | P2 | **Verificado**: os 32 envios têm `provider_id` do Resend, e a consulta de entrega por ID existe em `dispatch-client-emails` | — |

## Pendências que dependem de você

1. ~~Confirmar a migração do A18~~ — **feito em 08/11**.
2. **Criar o token de implantação das Edge Functions** (implanta A11 e A12 e as correções futuras):
   - Supabase → Account → Access Tokens → *Generate new token*;
   - GitHub → repositório → Settings → Secrets and variables → Actions → *New repository secret* com o nome `SUPABASE_ACCESS_TOKEN`;
   - Depois: GitHub → Actions → "Publicar Edge Functions no Supabase" → *Run workflow* com `generate-contract-document deliver-generated-document`.
3. **Dados do negócio (A14)**: informar o valor dos contratos sem valor e cadastrar as contas bancárias, se quiser saldo bancário.
4. **Decisões D04 e D05** (A15, A16, A17): definir se o sistema deve ter pedido de compra e conta a pagar, base SINAPI e BDI, e dependências SS/FF no cronograma.
5. **Backup**: avaliar o plano Pro do Supabase e fazer uma cópia dos arquivos (cerca de 150 MB).
6. **Opcional (A21)**: ativar a proteção contra senhas vazadas (Supabase → Authentication → Policies), se disponível no plano.


## Além da auditoria (pedidos diretos de 08/11)

| Item | Situação | Onde |
|---|---|---|
| Cadastro de cliente já cria o projeto (sem número de contrato) | **Publicado** | PR #76 |
| Painel de espaço do Supabase (usado/livre, alerta e atalho para limpeza) | **Publicado** | PR #76 |
| Revisões de contrato: a versão anterior passa a ser substituída; motivo obrigatório real | **Código pronto**; dados do CON-2026-10-0002 já corrigidos na produção (vigentes: contrato 4.0 e Anexo I 1.1) | PR #77 |
| Emissão de documentos unificada (site e portal usam o mesmo gerador; documento emitido não é sobrescrito) | **Código pronto** | PR #77 |
| Escopo do contrato com limites objetivos (quantidade, revisões, visitas, prazo, exclusões e cláusula de itens não listados) | **Código pronto** | PR #77 |
| Cronograma: o único cronograma de produção (Empreendimento Vitalle) está como "legacy" | **Diagnosticado** — ver abaixo | — |
| Edge Functions publicadas pelo conector (sem token): `deliver-generated-document` v6 e `generate-commercial-document-final` v13 (revisões, escopo detalhado) | **Publicado e testado** (inicializa e recusa chamada sem sessão administrativa) | — |
| `generate-contract-document` (A11, A12, proteção de documento emitido) | **Aguardando o token** — arquivo grande demais para publicar com segurança pelo conector. Enquanto isso, a tela não pede cópia reconstituída (evita gerar por cima de uma emissão) | PR #79 |

### Cronograma do Empreendimento Vitalle (legacy)

- O cronograma completo (com orçamento de execução, medições e revisões) exige que **cada atividade esteja ligada a um serviço contratado e tenha custo informado** — é isso que permite medir e cobrar com segurança.
- As 20 atividades do cronograma do Vitalle foram criadas antes dessa regra: **nenhuma tem serviço de origem nem custo**, e o projeto não tem orçamento/contrato no módulo comercial (só o contrato cadastrado). Converter automaticamente exigiria inventar esses dados.
- Caminho recomendado: (1) registrar o orçamento/contrato do Vitalle no módulo comercial (ou vincular o contrato existente); (2) em Gestão de obras → Cronograma completo → **Novo cronograma**, escolher o modelo e reaproveitar as atividades; (3) informar custo por atividade; (4) aprovar a linha de base. O cronograma legado continua visível como histórico e não é apagado.
- O **cronograma simples** (38 linhas) segue funcionando normalmente.

> As mudanças do PR #77 ficam nas Edge Functions: entram no ar quando o segredo `SUPABASE_ACCESS_TOKEN` estiver configurado (item 2 das pendências).
