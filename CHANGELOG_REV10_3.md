# Revisão 0.10.3 — restauração visual e melhorias do portal

Data: 29/08/2026

## Visual e publicação
- Restaurado o painel Admin clássico em azul-marinho e dourado, com assinatura Brittany, conforme a identidade visual aprovada.
- Restauradas as páginas clássicas do Portal do Cliente; o portal Expo deixa de substituir as telas antigas no deploy web.
- Mantidos **Primeiro acesso** e **Esqueci minha senha** no login.
- Mantido o visual do cartão virtual; apenas o atalho da Área do Cliente volta a apontar para o login clássico.
- Links `/portal/...` criados na revisão anterior continuam funcionando como compatibilidade e retornam às páginas clássicas equivalentes.

## Documentos e Biblioteca
- Upload de documentos em lote mantido e aprimorado.
- No modo automático, cada arquivo é classificado individualmente pelo nome.
- Categorias reconhecidas: Contrato, Orçamento/Proposta, Projeto, ART/RRT, Guia de Estilos, Guia de Obras, Laudo/Parecer, Memorial, Norma Técnica, Modelo e Outros.
- Antes do envio, o administrador pode revisar o nome e alterar a categoria de cada arquivo separadamente.
- A Biblioteca continua organizando apenas as categorias que possuem arquivos, evitando pastas vazias.
- Corrigido o contador do Dashboard: Biblioteca passa a consolidar documentos, fotos e registros próprios da biblioteca.

## Parcerias
- Mantida a opção **Parceria** no cadastro de clientes e projetos.
- Contrato e orçamento permanecem opcionais; projetos em parceria podem ser cadastrados sem esses números quando não existirem.

## Validação
- Build estático e verificação integrada executados com sucesso.
- Classificador automático testado com nomes de ART, guias, laudos, contratos, propostas, memoriais, normas, modelos e projetos.
