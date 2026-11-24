# Geração dos arquivos de documentação

A fonte do relatório é `docs/fontes/DOCUMENTACAO_COMPLETA_AQUARILANDIA.md`. Os detalhes de código ficam em `docs/fontes/ANEXO_TECNICO_AQUARILANDIA.md` e são incorporados ao mesmo PDF, como Apêndice A. O único arquivo de leitura e entrega é `docs/DOCUMENTACAO_COMPLETA_AQUARILANDIA.pdf`.

A composição segue a ABNT NBR 14724:2024 e o [Manual de normalização de trabalhos acadêmicos do CEFET-MG, 3. ed., 2025](https://repositorio.cefetmg.br/server/api/core/bitstreams/dcc67c14-b1bc-4820-8c7c-b5111fc07bc6/content). O texto é preto, com Arial 12, entrelinhas 1,5, recuo de parágrafo de 1,25 cm e margens superior/esquerda de 3 cm e inferior/direita de 2 cm. Fontes, notas, quadros e transcrições extensas usam tamanho 10 e espaço simples. As ilustrações preservam as cores do material visual.

Capa, folha de rosto, resumos e palavras-chave são editados em `docs/fontes/ELEMENTOS_PRE_TEXTUAIS.json`. Não acrescente orientador, nome da parceira, CNPJ ou aprovação sem uma fonte que os confirme.

Use Python 3 com as bibliotecas de `requirements.txt`, as dependências do frontend já instaladas e um Chromium disponível. As bibliotecas Python são exclusivas da documentação; podem ser instaladas em um ambiente virtual, sem alterar a aplicação:

```bash
python -m venv /tmp/aquarilandia-documentacao-venv
/tmp/aquarilandia-documentacao-venv/bin/python -m pip install -r docs/ferramentas/requirements.txt
PYTHON=/tmp/aquarilandia-documentacao-venv/bin/python node docs/ferramentas/renderizar-documentacao.mjs --pdf
```

O renderizador usa `PYTHON` quando definido. No WSL, as fontes Arial são lidas de `/mnt/c/Windows/Fonts`, sem copiá-las para o repositório. Para outro ambiente, defina `AQUARILANDIA_ARIAL_DIR` com a pasta que contém `arial.ttf`, `arialbd.ttf`, `ariali.ttf` e `arialbi.ttf`. A exportação deve falhar se a fonte necessária não estiver disponível.

Para atualizar também as pranchas, execute antes da exportação, na raiz do repositório:

```bash
python docs/ferramentas/gerar-visuais.py
node docs/ferramentas/renderizar-documentacao.mjs --assets
```

A geração dos visuais só é necessária quando as pranchas forem alteradas. A exportação `--pdf` executa automaticamente `gerar-documentacao.py`, calcula o destino das seções, figuras e quadros com `finalizar-pdf.py` e repete a composição até que as páginas do sumário e das listas estabilizem. A numeração conta a partir da folha de rosto, exclui a capa e aparece somente desde a introdução, no alto à direita. O apêndice mantém a sequência.

Os arquivos HTML e PDFs intermediários ficam na pasta temporária do sistema, fora de `docs`. Antes de substituir o PDF principal, o processo confere formato A4, texto preto, fonte disponível, imagens, conteúdo técnico, sumário estável e preservação dos links internos. Não há dependência de Word ou DOCX.

Os SVG ficam disponíveis para edição e os PNG são incorporados ao PDF. `documentacao.css` controla os estilos de leitura e impressão. Os scripts não recriam PDFs separados do anexo nem versões HTML ou Word na pasta `docs`.

O renderizador procura um Chromium no cache local do Playwright. Se necessário, defina `CHROMIUM_EXECUTABLE` com o caminho de um executável instalado. Ele bloqueia requisições HTTP durante a renderização, não inicia a aplicação e não acessa banco, gateway ou e-mail.

A seção 8 registra a documentação como vista e aceita pelo gerenciador de projetos, conforme confirmação da equipe. A versão de entrega foi definida sem campo de assinatura. A fonte do aceite é a informação fornecida pela equipe.
