import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function RootHtml({ children }: PropsWithChildren) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#010914" />
        <meta name="color-scheme" content="light dark" />
        <meta name="robots" content="noindex,nofollow,noarchive" />
        <meta
          name="description"
          content="Portal seguro da Camila Martins Engenharia para clientes e administração."
        />
        <title>Portal do Cliente | Camila Martins Engenharia</title>
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
