# Auditoria de dependências — Revisão 10.1

## Resultado

A mensagem inicial do npm mostrava 22 ocorrências: 8 moderadas e 14 altas. Esse total não representava 22 falhas independentes. O npm propagava três avisos raiz por toda a cadeia Expo, Metro e React Native e contabilizava cada pacote afetado novamente.

Depois da correção do `uuid`, o relatório atual mostra 14 ocorrências altas propagadas a partir dos dois avisos do `image-size`; não existem mais ocorrências moderadas nem críticas. Os dois parsers afetados continuam sem uma versão corrigida publicada no registro, por isso o npm mantém o alerta mesmo após a mitigação local verificada.

- vulnerabilidades críticas: **0**;
- aviso de `uuid`: corrigido com `uuid 11.1.1`;
- avisos de `image-size`: dois avisos de negação de serviço sem versão corrigida publicada pelo fornecedor;
- exposição do aplicativo em produção: os parsers pertencem ao Metro e processam ativos do código durante a compilação, não arquivos enviados por clientes;
- mitigação adicional: correção local idempotente dos parsers ICNS, JXL e HEIF, reaplicada depois de cada `npm install`;
- teste: buffers malformados são executados em processos com limite de tempo para confirmar que não há laço infinito.

## Por que não usar `npm audit fix --force`

A correção automática propõe rebaixar Expo 57 para Expo 53 e React Native 0.86 para 0.72. Essas versões não pertencem à mesma matriz de compatibilidade e quebrariam a estrutura validada do aplicativo. A documentação oficial do Expo estabelece que o SDK 57 usa React Native 0.86.

## Verificações incorporadas

```bash
npm run security:patch
npm run security:test
npm run security:audit
```

O instalador executa essas verificações antes do TypeScript, lint e Expo Doctor. Uma vulnerabilidade nova, crítica ou fora da lista analisada interrompe a inicialização.

## Referências

- `image-size` ICNS: https://github.com/advisories/GHSA-w3rx-r6r6-pgpr
- `image-size` JXL/HEIF: https://github.com/advisories/GHSA-5p2g-fcmc-qvqq
- `uuid`: https://github.com/advisories/GHSA-w5hq-g745-h8pq
- compatibilidade do Expo SDK: https://docs.expo.dev/versions/latest/
