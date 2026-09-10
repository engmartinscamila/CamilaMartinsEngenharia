# Revisão 0.10.11 — navegação principal no site e no aplicativo

Pedido: retirar o botão de painel integrado, eliminar acessos repetidos e trazer as funções exclusivas para a área principal, no site e no app.

- Site: remove o acesso intermediário /portal/admin (também os nomes anteriores Gestão integrada e Mais ferramentas de gestão). Treze ferramentas específicas ficam acessíveis diretamente no menu e nas ações principais de admin.html.
- Oportunidades, documentos gerados/aceites, preparação, versões, arquivo, tarefas, diário de obra, cotações, conciliação bancária OFX, módulos do cliente, aprovações, notificações e armazenamento/auditoria permanecem disponíveis.
- Contas bancárias e conciliação OFX complementa o financeiro clássico; não eliminar a importação de extratos ao simplificar os menus.
- Portal web publicado: o endereço antigo /portal/admin e o botão Início da administração levam à área principal do site. No menu de cada ferramenta, áreas equivalentes usam os destinos clássicos existentes.
- Android/iOS: mantém as 23 funções diretamente na tela inicial nativa, sem passar por um segundo painel. Os indicadores deixam de repetir botões para áreas que já aparecem na lista.
- Nomes: Orçamentos e contratos e Início da administração usados de forma consistente.
- Normalização do menu é idempotente; teste de navegador verifica ausência do painel intermediário, destinos únicos e 13 atalhos exclusivos.

## Estado da validação

TypeScript, lint, testes de integração/funcionais, auditoria estática e scanner de segredos passaram após a alteração de navegação. A nova versão exige exportação/publicação web e novo build Android; consultar o roteiro de entrega para o estado final dos pipelines.

A compilação Android anterior 0.10.10 gerou APK e renderizou o login, mas a validação automática falhou com um diálogo “Quickstep isn't responding” do launcher do emulador sobre o aplicativo. Não tratar isso como APK validado nem como crash confirmado do app. Os diagnósticos pertencem ao commit 463373fcc6614677e50d7abc1931a0ba5026d579 e não incluem esta nova navegação.

A função admin-delete-client ainda precisa ser revisada e disponibilizada ou substituída pela excluir-cliente-completo existente. Não testar exclusão em clientes reais.
