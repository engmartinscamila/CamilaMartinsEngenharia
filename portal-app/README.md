# Camila Martins Engenharia — Revisão 10.1

Aplicativo Expo/React Native completo para Android, iOS e web, conectado ao Supabase já utilizado pelo Portal do Cliente. A mesma base de código reúne Área do Cliente e Área Administrativa.

## Identidade e plataformas

- versão: `0.10.1`;
- Android, iOS e web com Expo Router e TypeScript;
- azul-marinho `#010914`, dourado `#B89A63`, Century Gothic e Brittany Signature Script;
- autenticação e dados exclusivamente pelo Supabase existente;
- idioma português do Brasil e datas exibidas no fuso de São Paulo.

## Revisão 10.1

- corrige o ciclo infinito de redirecionamento do cliente;
- mantém o navegador estável durante a sincronização;
- resolve sessão, papel e perfil antes de liberar as rotas privadas;
- atualiza dados sem remontar toda a navegação;
- usa armazenamento seguro para a sessão móvel;
- preserva Termos de Uso, Política de Privacidade e aceite por versão;
- apresenta o nome cadastrado no início do cliente e da administradora, sem usar e-mail como nome;
- inclui a revisão legal `2026.08.12-2` e preserva os registros das versões anteriores;
- corrige a dependência `uuid` e protege localmente os parsers ICNS, JXL e HEIF do `image-size`;
- bloqueia a inicialização se aparecer vulnerabilidade nova ou crítica;
- mantém os registros fictícios do teste A/B separados das pendências reais de Storage;
- exige somente a migração aditiva `20260812213000_legal_documents_v2.sql`; ela não apaga registros nem exige reaplicar migrações anteriores.

Para substituir a Revisão 10 no Windows, leia `00_COMECE_AQUI_REVISAO_10_1.md` e execute `APLICAR_REVISAO_10_1.cmd`.

## Instalação técnica

Requisitos: Node.js `20.19.4+`, `22.13+` ou `24.3+`, npm e Expo Go atualizado.

```bash
npm install
cp .env.homologation.example .env.local
npm run check:homologation
npm start
```

Nunca coloque `service_role`, Secret key ou senha do banco em `.env.local`.
Somente a chave Publishable pode ficar no app.

## Validação

```bash
npm run typecheck
npm run lint
npm run doctor
npm run security:test
npm run security:audit
npm run export:web
```

As validações específicas do serviço de dados e das políticas de acesso permanecem documentadas em `docs/`. Não execute novamente migrações já aplicadas; aplique apenas a atualização legal nova indicada no guia da Revisão 10.1.

A análise dos avisos do npm e as medidas aplicadas estão em `docs/AUDITORIA_DEPENDENCIAS_REV10_1.md`.

## Identificadores

- Expo slug: `camila-martins-engenharia`
- Scheme: `camilamartinsengenharia`
- iOS: `br.com.camilamartinsengenharia.app`
- Android: `br.com.camilamartinsengenharia.app`
