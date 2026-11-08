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
| A11 | P2 | **Corrigido e publicado** (`generate-contract-document` v29 publicada pelo conector em 08/11) | PR #70 |
| A12 | P1 | **Corrigido e publicado**. Gerador v29 no ar; o botão de cópia reconstituída volta a funcionar para os 6 documentos emitidos sem arquivo (só adiciona um arquivo identificado como "CÓPIA RECONSTITUÍDA", com número, data e versão originais) | PR #72 + PR #83 |
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
2. **Criar o token de implantação das Edge Functions** (A11 e A12 já publicados pelo conector; o token mantém `download-commercial-word`, `process-commercial-document-job` e as próximas correções em dia):
   - Supabase → Account → Access Tokens → *Generate new token*;
   - GitHub → repositório → Settings → Secrets and variables → Actions → *New repository secret* com o nome `SUPABASE_ACCESS_TOKEN`;
   - Depois: GitHub → Actions → "Publicar Edge Functions no Supabase" → *Run workflow* com `download-commercial-word process-commercial-document-job`.
3. **Dados do negócio (A14)**: informar o valor dos contratos sem valor e cadastrar as contas bancárias, se quiser saldo bancário.
4. **Decisões D04 e D05** (A15, A16, A17): definir se o sistema deve ter pedido de compra e conta a pagar, base SINAPI e BDI, e dependências SS/FF no cronograma.
5. **Backup**: avaliar o plano Pro do Supabase e fazer uma cópia dos arquivos (cerca de 150 MB).
6. **Republicar o Worker de mídia do portfólio** (PR #82): na pasta `cloudflare/media-worker`, `npx wrangler deploy` (conta Cloudflare). Até lá, a proteção já vale pelo site.
7. **Cronograma do Vitalle**: dizer qual contrato cobre a obra (ver seção do Vitalle abaixo).
8. **Opcional (A21)**: ativar a proteção contra senhas vazadas (Supabase → Authentication → Policies), se disponível no plano.


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
| `generate-contract-document` (A11, A12, proteção de documento emitido) | **Publicado pelo conector (v29) e testado**: dependências conferidas na produção; inicializa e recusa chamada sem sessão administrativa com a própria mensagem | PR #79 → PR #83 |

| Fluxo de recibos revisado: recibo **estornado** agora aparece como ESTORNADO (tela, impressão, histórico, Word e nome do arquivo); emissão para **projeto sem contrato** aceita contrato do mesmo cliente (antes falhava com "Contrato incompatível") | **Publicado** (função do banco aplicada na produção; 3 recibos conferidos, nenhum divergente) | PR #81 |
| Upload autoral com marca d'água: conferido (23 documentos e 37 fotos autorais, todos com arquivo; marca diagonal + rodapé rastreável testados) | **Conferido, sem alterações** | — |
| Portfólio: exclusão de mídia nunca apaga arquivo ainda usado no catálogo | **Publicado no site**; o Worker do Cloudflare precisa ser republicado (ver pendências) | PR #82 |

### Cronograma do Empreendimento Vitalle (legacy) — conferido em 08/11

- **Nada se perde na migração**: as 20 atividades são o modelo padrão (`residencial_v1`), todas com **0% de avanço**, sem medições, sem custos e sem linha de base. Atenção: as datas previstas estão desatualizadas (ex.: Estrutura prevista até 14/10, sem avanço registrado).
- **Por que não foi convertido automaticamente**: o cronograma completo só nasce de um orçamento + contrato do módulo comercial (ou de um serviço adicional aceito). O Vitalle não tem nenhum: o contrato `MIG-C5272F21` veio da migração, sem valor e sem serviços. O contrato comercial `CON-2026-10-0002` da Tributino está ligado aos projetos **Cléos** e **Residencial**, não ao Vitalle. Usar esse contrato no Vitalle seria inventar o vínculo.
- **O que falta de você** (uma decisão): o Vitalle tem contrato de execução de obra próprio? Se sim, registre-o em Orçamentos e contratos (valor e serviços) vinculado ao projeto Vitalle. Se a obra estiver coberta pelo CON-2026-10-0002, diga isso e eu faço o vínculo.
- **Depois disso** (posso fazer na próxima sessão): Gestão de obras → Cronograma completo → Novo cronograma com o modelo residencial (recria as mesmas 20 atividades), ajustar datas reais e custo por atividade, e aprovar a linha de base. O legado fica como histórico; nada é apagado.
- O cronograma simples do Vitalle (4 linhas) continua funcionando.

> PR #77: `generate-contract-document`, `generate-commercial-document-final` e `deliver-generated-document` já estão no ar. Ainda dependem do token (item 2): `download-commercial-word` (usa o mesmo módulo de escopo detalhado) e `process-commercial-document-job` (embute cópias dos geradores).


## Atualização 08/11 (tarde) — decisões D04/D05 e obra sem contrato

| Item | Situação | PR |
|---|---|---|
| Cronograma interno para obra **sem cronograma completo contratado** (uso interno, nunca publicado ao cliente; migração formal do legado) | **No ar** (banco + tela, opção 2C) | #85 |
| D05: dependências SS/FF, defasagem e caminho crítico | **No ar** | #86 |
| D04: pedido de compra → contas a pagar no Financeiro | **No ar** (tela Compras) | #87 |
| D04: BDI, curva ABC e importação SINAPI | **Suspenso a pedido da proprietária** (não iniciado) | — |
| Acompanhamento simples dos serviços contratados (perfil do cliente) | Mantido como está | — |

Regra registrada: o cronograma completo só é oferecido ao cliente quando o serviço "s" estiver no contrato (ou Serviço Adicional aceito).

**Vitalle:** usar Gestão de obras → Novo cronograma → opção 2C, informando motivo, datas e custos. O legado fica preservado como histórico.

Pendentes da proprietária: token `SUPABASE_ACCESS_TOKEN` (funções `download-commercial-word` e `process-commercial-document-job`) e `npx wrangler deploy` do Worker de mídia.


## Atualização 08/11 (noite) — contrato → Financeiro, Anexo I e Contrato Mestre v8

| Item | Situação | Onde |
|---|---|---|
| Parcelas do contrato emitido viram contas a receber (uma por parcela, sem duplicar; revisão atualiza só as em aberto; pagas nunca mudam; contrato cancelado cancela as em aberto; soma ≠ total ou lançamento manual prévio não gera nada e registra pendência) | **No ar** (migração `20261108140000` aplicada; testada antes em transação desfeita). CON-2026-10-0002: 8 parcelas de R$ 1.500 geradas | commit `6f8af58` |
| Anexo I exigido só com Serviço Adicional (não recusado) ou aditivo aceito | **No ar** (migração `20261108141000`; mapa documental e conferência de fechamento) | commit `6f8af58` |
| Tarefa de revisão documental sem Anexo I quando não há adicional | **No ar** (`process-commercial-document-job` v3 publicada pelo CI em 08/11) | commit `6f8af58` |
| Contrato Mestre v8, textos padronizados, gerador e 123 escopos reescritos | **Aguardando “ok” da proprietária** (nada aplicado). Dados prontos em `docs/contrato-mestre-v8/revisao-v8.json` | — |
| Revisão jurídica do Contrato Mestre v8 | **Recomendada** antes do uso com clientes (5.2, 6.1, 21.5) | — |

Atenção: a Parcela 1/8 do CON-2026-10-0002 venceu em 06/11 e está como pendente. Se já foi recebida, marque como paga no Financeiro.
