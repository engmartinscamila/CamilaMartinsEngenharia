# Correção do retorno indevido ao dashboard — 15/09/2026

Base: 4a0cef85d529cab1e056963fdc439f673badce1d. As atualizações posteriores à entrega 0.10.11 foram preservadas.

## Defeito reproduzido

Com sessão administrativa real, clicar em Oportunidades comerciais no site abriu `/portal/admin/crm/` e, após o carregamento, voltou a `/admin.html`.

O AuthProvider inicializava duas operações em paralelo: `getSession()` e o evento `INITIAL_SESSION`. O primeiro podia encerrar `loading` enquanto o segundo ainda consultava o papel no servidor. O layout enxergava temporariamente uma sessão nula, abria o login e, quando a identidade chegava, o login mandava para a entrada padrão, que retorna ao dashboard clássico. A mesma falha atingia todos os módulos que compartilham esse layout.

O teste determinístico `scripts/test-auth-lifecycle.mjs` reproduziu a liberação prematura com a versão anterior (asserção false !== true) e passou com a correção.

## Alteração

- Restauração inicial por `INITIAL_SESSION`, sem concorrência com um segundo bootstrap.
- Só a validação de identidade mais recente pode encerrar o carregamento e aplicar o perfil.
- Consultas permanecem fora do callback do Auth para não prender o lock de sessão.
- Renovação continua sem desmontar a ferramenta; respostas antigas não restauram uma conta após logout/troca de perfil/desmontagem.
- Sincronização consulta a sessão atual em vez de reaplicar a sessão capturada por um callback antigo.
- Quando login é necessário, a ferramenta escolhida é preservada por `returnTo`, restrito às rotas internas cadastradas. Projeto e tipo de conteúdo têm validação. Clientes e contas sem papel admin não usam o destino administrativo para obter acesso.

## Validação e limites

- TypeScript, lint, testes de integração, emissão protegida, 56 verificações funcionais, ciclo de autenticação e destinos de retorno passaram localmente.
- Novo gate `scripts/admin-session-navigation-smoke.mjs`: bundle real em servidor local, com sessão e respostas sintéticas; clica todas as ferramentas a partir de Configurações e das ações rápidas, verifica permanência na página, recarga e retorno do login. Também exige bloqueio de perfil sem autorização.
- Os testes antigos sem sessão continuam existindo. Chegar ao login não é mais o único critério para a navegação.
- O teste sintético não valida RLS nem operações reais. A conferência autenticada do site publicado deve ser registrada separadamente, após o deploy.

Nenhum layout, estilo, imagem, marca d'água, bucket, policy, cabeçalho ou migration foi alterado. As verificações reais de perfil no servidor permanecem obrigatórias. Não houve envio, exclusão ou alteração de registros reais para testar esta correção.
