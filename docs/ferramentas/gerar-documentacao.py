"""Prepara a composição ABNT de um único PDF, com sumário e listas calculados."""
from pathlib import Path
from html import escape
import json
import os
import re
import tempfile

ROOT=Path(__file__).resolve().parents[2]
DOCS=ROOT/'docs';FONTES=DOCS/'fontes'
OUTPUT=Path(tempfile.gettempdir())/'aquarilandia-documentacao'
OUTPUT.mkdir(parents=True,exist_ok=True)
CSS=(DOCS/'ferramentas/documentacao.css').read_text()
META=json.loads((FONTES/'ELEMENTOS_PRE_TEXTUAIS.json').read_text())
MAP_FILE=OUTPUT/'paginacao.json'
PAGE_MAP=json.loads(MAP_FILE.read_text()) if MAP_FILE.exists() else {}
ENTRIES=[];FIGURES=[];QUADROS=[]

font_dir=Path(os.environ.get('AQUARILANDIA_ARIAL_DIR','/mnt/c/Windows/Fonts'))
font_faces=[]
for file,weight,style in [('arial.ttf',400,'normal'),('arialbd.ttf',700,'normal'),('ariali.ttf',400,'italic'),('arialbi.ttf',700,'italic')]:
 p=font_dir/file
 assert p.is_file(),f'Fonte Arial ausente: {p}. Defina AQUARILANDIA_ARIAL_DIR.'
 font_faces.append(f'@font-face{{font-family:ArialRelatorio;src:url("{p.as_uri()}");font-weight:{weight};font-style:{style};font-display:block}}')


def link_row(label,anchor,level='secondary'):
 page=PAGE_MAP.get(anchor)
 number=str(page) if page is not None else '00'
 return f'<li class="toc-row {level}-entry"><a href="#{anchor}"><span class="toc-text">{escape(label)}</span><span class="toc-dots" aria-hidden="true"></span><span class="toc-page">{number}</span></a></li>'


def render(source,appendix=False):
 text=source.read_text()
 if appendix:
  text=text[text.index('## 1. Arquitetura e organização do código'):]
  text=re.sub(r'^(#{2,3}) (\d+)\.',lambda m:f'{m[1]} A.{m[2]}'+('' if m[1]=='##' else '.'),text,flags=re.M)
 else:text=text[text.index('## 1 Introdução'):]
 lines=text.splitlines();out=[];i=0;references=False;current_title='Identificação';main_quadros=0;appendix_quadros=0
 if appendix:
  label='APÊNDICE A — DOCUMENTAÇÃO TÉCNICA DE CÓDIGO'
  out.append('<h2 class="post-title" id="anexotecnico">'+label+'</h2>')
  out.append('<p>Este apêndice reúne a documentação de arquitetura, banco, API, segurança, estoque, pagamentos, imagens, testes e implantação. As referências de código e as datas dos relatórios de cada entrega foram preservadas.</p>')
  ENTRIES.append((label,'anexotecnico','primary'))
 def href(url):
  if url.startswith(('https://','http://','#')):return url
  path,marker,fragment=url.partition('#')
  return (source.parent/path).resolve().as_uri()+('#'+fragment if marker else '')
 def inline(value):
  result=[]
  for token in re.split(r'(\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*)',value):
   m=re.fullmatch(r'\[([^\]]+)\]\(([^)]+)\)',token)
   if m:result.append(f'<a href="{escape(href(m[2]),quote=True)}">{escape(m[1])}</a>')
   elif token.startswith('`') and token.endswith('`'):result.append('<code>'+escape(token[1:-1])+'</code>')
   elif token.startswith('**') and token.endswith('**'):result.append('<strong>'+escape(token[2:-2])+'</strong>')
   else:result.append(escape(token))
  return ''.join(result)
 while i<len(lines):
  line=lines[i]
  if not line.strip():i+=1;continue
  heading=re.match(r'^(#{2,4}) (.*)',line)
  if heading:
   level=len(heading[1]);title=heading[2]
   if references:out.append('</section>');references=False
   if title.casefold()=='referências':
    out.append('<h2 class="post-title" id="referencias">REFERÊNCIAS</h2><section class="references">')
    ENTRIES.append(('REFERÊNCIAS','referencias','primary'));references=True;i+=1;continue
   number_title=re.match(r'^((?:A\.)?\d+(?:\.\d+)*)\s+(.*)',title)
   assert number_title,(source,line)
   number,label=number_title.groups();current_title=label
   anchor=('anexo'+number[2:].replace('.','-')) if number.startswith('A.') else ('capitulo'+number.replace('.','-'))
   display_label=label.upper() if level==2 else label
   classes='section-heading '+('primary' if level==2 else 'secondary')
   if appendix and number=='A.1':classes+=' appendix-first'
   out.append(f'<h{level} class="{classes}" id="{anchor}"><span class="section-number">{escape(number)}</span><span class="section-title">{inline(display_label)}</span></h{level}>')
   ENTRIES.append((number+' '+display_label,anchor,'primary' if level==2 else 'secondary'))
   i+=1;continue
  if line=='---':i+=1;continue
  if line.startswith('```'):
   language=line[3:].strip();code=[];i+=1
   while i<len(lines) and not lines[i].startswith('```'):code.append(lines[i]);i+=1
   prompt=not appendix and current_title=='Histórico selecionado de prompts reais'
   cls='prompt-quote' if prompt else 'code'
   out.append(f'<pre class="{cls}"><code>'+escape('\n'.join(code))+'</code></pre>');i+=1;continue
  image=re.fullmatch(r'!\[([^\]]*)\]\(([^)]+)\)',line)
  if image:
   path=(source.parent/image[2]).resolve();assert path.exists(),path
   number=len(FIGURES)+1;anchor=f'figura{number}';label=f'Figura {number} — {image[1]}'
   FIGURES.append((label,anchor,'secondary'));i+=1
   while i<len(lines) and not lines[i].strip():i+=1
   note=''
   if i<len(lines) and lines[i].startswith('Figura '):
    note=re.sub(r'^Figura \d+\s*[—–-]\s*','',lines[i]);i+=1
   if number==1:origin='Fonte: elaboração a partir da persona Juliana fornecida pela equipe (2026c).'
   elif number==5:origin='Fonte: protótipo HTML v4 do repositório do projeto (Equipe Aquarilândia, 2026a).'
   else:origin='Fonte: registros visuais elaborados para esta revisão, com base no projeto (2026).'
   out.append(f'<figure id="{anchor}"><p class="figure-title">{escape(label)}</p><img src="{escape(path.as_uri(),quote=True)}" alt="{escape(image[1],quote=True)}"><figcaption><p class="source-note">{escape(origin)}</p>'+('<p class="figure-note">Nota: '+escape(note)+'</p>' if note else '')+'</figcaption></figure>')
   continue
  if line.startswith('|'):
   rows=[]
   while i<len(lines) and lines[i].startswith('|'):
    row=[v.strip() for v in lines[i].strip().strip('|').split('|')]
    if not all(re.fullmatch(':?-+:?',v) for v in row):rows.append(row)
    i+=1
   assert all(len(row)==len(rows[0]) for row in rows)
   if appendix:appendix_quadros+=1;number='A.'+str(appendix_quadros);anchor='quadro-a-'+str(appendix_quadros)
   else:main_quadros+=1;number=str(main_quadros);anchor='quadro'+str(main_quadros)
   label='Quadro '+number+' — '+current_title
   if not appendix:QUADROS.append((label,anchor,'secondary'))
   out.append(f'<div class="quadro" id="{anchor}"><p class="quadro-title">{escape(label)}</p><table><thead><tr>'+''.join('<th scope="col">'+inline(v)+'</th>' for v in rows[0])+'</tr></thead><tbody>')
   for row in rows[1:]:out.append('<tr>'+''.join('<td>'+inline(v)+'</td>' for v in row)+'</tr>')
   origin='Fonte: elaboração a partir da persona Juliana (Equipe Aquarilândia, 2026c).' if not appendix and anchor in ['quadro4','quadro5','quadro6'] else 'Fonte: elaboração a partir dos registros e do código do projeto (Equipe Aquarilândia, 2026a, 2026b).'
   if not appendix and current_title=='Identificação do registro':origin='Fonte: confirmação fornecida pela equipe do projeto nesta revisão documental (23 nov. 2026).'
   out.append('</tbody></table><p class="source-note">'+origin+'</p></div>');continue
  if line.startswith('- '):
   out.append('<ul>')
   while i<len(lines) and lines[i].startswith('- '):
    value=lines[i][2:]
    if value.startswith('[ ] '):value='☐ '+value[4:]
    elif value.startswith('[x] '):value='☑ '+value[4:]
    out.append('<li>'+inline(value)+'</li>');i+=1
   out.append('</ul>');continue
  paragraph=[line];i+=1
  while i<len(lines) and lines[i].strip() and not re.match(r'^(#|\||```|- |---|!\[)',lines[i]):paragraph.append(lines[i]);i+=1
  out.append('<p>'+inline(' '.join(paragraph))+'</p>')
 if references:out.append('</section>')
 return '\n'.join(out)


main=render(FONTES/'DOCUMENTACAO_COMPLETA_AQUARILANDIA.md')
annex=render(FONTES/'ANEXO_TECNICO_AQUARILANDIA.md',appendix=True)
authors=''.join('<p>'+escape(name.upper())+'</p>' for name in META['autores'])
title='<div class="work-title"><h1>'+escape(META['titulo'])+'</h1><p>'+escape(META['subtitulo'])+'</p></div>'
place='<div class="place"><p>'+escape(META['cidade'])+'</p><p>'+META['ano']+'</p></div>'
cover='<section class="frontpage cover"><div class="institution"><p>'+escape(META['instituicao'])+'</p><p>'+escape(META['campus'])+'</p><p>'+escape(META['curso'])+'</p></div><div class="authors">'+authors+'</div>'+title+place+'</section>'
face='<section class="frontpage titlepage" id="folha-rosto"><div class="authors">'+authors+'</div>'+title+'<div class="nature"><p>'+escape(META['natureza'])+'</p></div>'+place+'</section>'
resumo='<section class="pretext abstract"><h2 class="pretext-title">RESUMO</h2><p>'+escape(META['resumo'])+'</p><p class="keywords"><strong>Palavras-chave:</strong> '+escape('; '.join(META['palavras_chave']))+'.</p></section>'
abstract='<section class="pretext abstract" lang="en"><h2 class="pretext-title">ABSTRACT</h2><p>'+escape(META['abstract'])+'</p><p class="keywords"><strong>Keywords:</strong> '+escape('; '.join(META['keywords']))+'.</p></section>'
def listing(title,rows):return '<section class="pretext"><h2 class="pretext-title">'+title+'</h2><ul class="pretext-list">'+''.join(link_row(*row) for row in rows)+'</ul></section>'
figures=listing('LISTA DE ILUSTRAÇÕES',FIGURES)
quadros=listing('LISTA DE QUADROS',QUADROS)
siglas=[('ABNT','Associação Brasileira de Normas Técnicas'),('API','Application Programming Interface'),('CEFET-MG','Centro Federal de Educação Tecnológica de Minas Gerais'),('CSP','Content Security Policy'),('E2E','End-to-end'),('GOMS','Goals, Operators, Methods and Selection Rules'),('HTML','HyperText Markup Language'),('HTTP','Hypertext Transfer Protocol'),('IA','Inteligência artificial'),('PDF','Portable Document Format'),('SQL','Structured Query Language')]
siglas_html='<section class="pretext"><h2 class="pretext-title">LISTA DE SIGLAS</h2><dl class="siglas">'+''.join('<dt>'+escape(k)+'</dt><dd>'+escape(v)+'</dd>' for k,v in siglas)+'</dl></section>'
toc='<section class="pretext" id="sumario"><h2 class="pretext-title">SUMÁRIO</h2><ul class="toc-list">'+''.join(link_row(*row) for row in ENTRIES)+'</ul></section>'
page='<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Aquarilândia — Documentação técnica</title><style>'+''.join(font_faces)+CSS+'</style></head><body><main>'+cover+face+resumo+abstract+figures+quadros+siglas_html+toc+main+annex+'</main></body></html>'
(OUTPUT/'DOCUMENTACAO_COMPLETA_AQUARILANDIA.html').write_text(page)
(OUTPUT/'estrutura.json').write_text(json.dumps({'entries':ENTRIES,'figures':FIGURES,'quadros':QUADROS,'font_dir':str(font_dir)},ensure_ascii=False,indent=2)+'\n')
assert page.count('<img ')==5
assert 'id="anexotecnico"' in page and 'id="capitulo1"' in page and 'id="anexo11"' in page
print('Composição ABNT preparada:',len(ENTRIES),'entradas no sumário,',len(QUADROS),'quadros e',len(FIGURES),'figuras.')
