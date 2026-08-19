# Como adicionar um projeto à galeria

1. Mantenha as imagens originais fora deste repositório público.
2. Gere cópias em formato WebP com a marca-d'água incorporada.
3. Crie uma pasta em `assets/projetos/` usando um nome curto, sem espaços ou acentos.
4. Numere as imagens na ordem desejada: `01.webp`, `02.webp`, `03.webp` e assim por diante.
5. Acrescente o projeto e suas imagens no arquivo `assets/projetos/galeria.json`.
6. Verifique a galeria no computador e somente depois publique as alterações.

## Como adicionar vídeos sem misturá-los às fotos

1. Crie uma subpasta `videos` dentro da pasta do projeto.
2. Exporte o vídeo em MP4 com codec H.264, sem reprodução automática e com a marca-d'água incorporada.
3. Gere uma imagem de capa em WebP para cada vídeo.
4. No projeto correspondente em `assets/projetos/galeria.json`, adicione a lista `videos` com `src`, `poster`, `titulo` e `descricao`.
5. Mantenha as fotos na lista `imagens`; a página monta automaticamente uma seção separada chamada “Vídeos do projeto”.

O site não inclui botão de download e bloqueia as formas mais comuns de salvar ou arrastar imagens e vídeos. Como qualquer conteúdo exibido na internet pode ser capturado por meios técnicos ou por gravação de tela, a proteção permanente é a marca-d'água incorporada ao próprio arquivo.
