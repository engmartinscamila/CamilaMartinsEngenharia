# A19 — Backup e restauração

Levantamento feito em 08/11/2026 no projeto de produção `portal-cliente` (`hghtwlopqztfcosfxafd`).

## Situação atual

| Item | Situação |
|---|---|
| Plano Supabase | **Free**. Não há backup diário restaurável pelo painel nem PITR. |
| Banco | 102 MB |
| Storage | `fotos` 37 objetos / 82,7 MB · `biblioteca` 1 / 32,8 MB · `documentos` 36 / 20,1 MB · `materiais-protegidos` 4 / 11,9 MB |
| Backup lógico existente | `admin_export_application_backup()` (JSON, só para administradora) |
| Lacuna corrigida | A exportação não incluía `financial_origin_review_events` nem `contract_addenda`. A migração `20261108070000` passa a incluí-las sem alterar o restante da função. |
| Storage | **Sem cópia**. Os arquivos só existem no Supabase. |

Tabelas que continuam fora da exportação, de propósito, porque são operacionais ou reconstruíveis: limites de requisição, filas de e-mail e de jobs, tokens e diagnósticos de push, estados OAuth, emissões temporárias de PDF e logs de automação.

## Riscos

1. Sem backup do provedor, uma exclusão acidental de projeto ou de bucket não tem retorno pelo painel.
2. Documentos emitidos (Word/PDF) e fotos não têm cópia fora do Supabase.

## Recomendações (em ordem)

1. **Plano Pro do Supabase** (US$ 25/mês): backups diários com 7 dias de retenção, restauráveis pelo painel. É a forma mais simples de cobrir banco e metadados.
2. **Cópia semanal do Storage**: baixar os quatro buckets, que hoje somam cerca de 150 MB, para uma pasta privada fora do Supabase (Google Drive ou disco).
3. **Exportação mensal** pelo botão de backup do sistema (`admin_export_application_backup`), guardada junto da cópia do Storage.

## Procedimento de restauração (ensaio)

Faça sempre num projeto separado, nunca na produção.

1. Crie um projeto Supabase vazio de ensaio.
2. Aplique as migrações de `supabase/migrations` em ordem (`supabase db push` ou SQL Editor).
3. Restaure os dados:
   - **Com plano Pro:** Painel → Database → Backups → *Restore to new project*.
   - **Sem Pro:** importe o JSON da exportação tabela a tabela, na ordem das dependências: clientes → contratos → projetos → financeiro → payment_receipts → documentos → demais.
4. Envie os arquivos da cópia do Storage para os mesmos buckets e caminhos.
5. Verifique:
   - contagem por tabela igual à da exportação;
   - `select count(*) from documentos d where d.arquivo is not null and not exists (select 1 from storage.objects o where o.bucket_id = coalesce(d.storage_bucket, 'documentos') and o.name = d.arquivo)` igual a 0;
   - abrir 3 documentos Word e 3 fotos;
   - os recibos conferem com os lançamentos (`payment_receipts.amount = financeiro.valor`).
6. Registre a data do ensaio, o tempo gasto (RTO) e a idade do backup usado (RPO).

**Pré-requisito antes de qualquer migração financeira de risco**, como a ativação do Financeiro V2: ter feito ao menos um ensaio completo deste procedimento.
