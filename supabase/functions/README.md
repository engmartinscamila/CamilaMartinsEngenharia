# Notificações por e-mail

A função `notificar-atualizacao` envia avisos transacionais com o Resend.

## Segredos necessários

- `RESEND_API_KEY`
- `NOTIFICATION_ADMIN_EMAIL`
- `NOTIFICATION_FROM_EMAIL`
- `SITE_URL`
- `ADMIN_UID` (opcional; já existe um valor padrão no código)

Exemplo de `NOTIFICATION_FROM_EMAIL`:

`Camila Martins Engenharia <portal@seudominio.com.br>`

O domínio do remetente precisa estar verificado no Resend.

## Implantação

```bash
supabase functions deploy notificar-atualizacao
```

Configure os segredos no painel do Supabase em **Edge Functions > Secrets**.
Nunca coloque a chave do Resend nem a service role dentro dos arquivos do site.
