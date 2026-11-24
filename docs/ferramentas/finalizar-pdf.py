"""Calcula páginas do sumário e aplica a paginação acadêmica ao PDF temporário."""
from pathlib import Path
import argparse
import json
import sys
import tempfile

# Permite a ferramenta isolada em /tmp sem alterar o ambiente da aplicação.
local_tools=Path(tempfile.gettempdir())/'aquarilandia-pdf-tools'
if local_tools.exists():sys.path.insert(0,str(local_tools))
try:
 from pypdf import PdfReader
 import pymupdf
except ImportError as exc:
 raise SystemExit('Instale as dependências de docs/ferramentas/requirements.txt no ambiente de documentação.') from exc

ROOT=Path(__file__).resolve().parents[2]
TEMP=Path(tempfile.gettempdir())/'aquarilandia-documentacao'
parser=argparse.ArgumentParser()
parser.add_argument('action',choices=['map','finish'])
parser.add_argument('pdf',type=Path)
parser.add_argument('--output',type=Path)
args=parser.parse_args()
reader=PdfReader(args.pdf)
page_map={name.lstrip('/'):reader.get_destination_page_number(destination) for name,destination in reader.named_destinations.items()}
assert 'capitulo1' in page_map and 'anexotecnico' in page_map
structure=json.loads((TEMP/'estrutura.json').read_text())
expected={row[1] for category in ['entries','figures','quadros'] for row in structure[category]}
assert expected<=page_map.keys(),sorted(expected-page_map.keys())

if args.action=='map':
 (TEMP/'paginacao.json').write_text(json.dumps(page_map,ensure_ascii=False,sort_keys=True,indent=2)+'\n')
 print(json.dumps({'pages':len(reader.pages),'first_text_index':page_map['capitulo1'],'anchors':len(page_map)}))
else:
 assert args.output is not None
 metadata=json.loads((ROOT/'docs/fontes/ELEMENTOS_PRE_TEXTUAIS.json').read_text())
 arial=Path(structure['font_dir'])/'arial.ttf'
 assert arial.exists(),'Fonte Arial não localizada para a paginação.'
 font=pymupdf.Font(fontfile=str(arial))
 doc=pymupdf.open(args.pdf)
 first_text=page_map['capitulo1']
 assert first_text>=5
 for i in range(first_text,len(doc)):
  page=doc[i];number=str(i)
  right=20*72/25.4;top=20*72/25.4
  x=page.rect.width-right-font.text_length(number,fontsize=10)
  y=top+font.ascender*10
  page.insert_text((x,y),number,fontname='ArialPagina',fontfile=str(arial),fontsize=10,color=(0,0,0),overlay=True)
 doc.set_metadata({'title':'Aquarilândia: documentação técnica do projeto','author':'; '.join(metadata['autores']),'subject':'Relatório acadêmico e apêndice técnico com apresentação ABNT','creator':'Aquarilândia — ferramentas de documentação','keywords':'Aquarilândia; Design de Interação; documentação técnica; ABNT'})
 doc.subset_fonts()
 doc.save(args.output,garbage=4,deflate=True)
 doc.close()
 final=PdfReader(args.output)
 assert len(final.pages)==len(reader.pages)
 final_map={key.lstrip('/'):final.get_destination_page_number(value) for key,value in final.named_destinations.items()}
 assert all(final_map.get(key)==value for key,value in page_map.items())
 pdf=pymupdf.open(args.output)
 non_black=[]
 for index,page in enumerate(pdf):
  assert abs(page.rect.width-595.28)<1 and abs(page.rect.height-841.89)<1
  for block in page.get_text('dict')['blocks']:
   for line in block.get('lines',[]):
    for span in line['spans']:
     if span['color']!=0:non_black.append((index+1,span['text'][:60],span['color']))
 assert not non_black,non_black[:8]
 for index in [first_text,len(pdf)-1]:
  words=pdf[index].get_text('words')
  numbers=[word for word in words if word[4]==str(index) and word[1]<75 and word[0]>450]
  assert numbers,('Numeração não localizada',index)
 print(json.dumps({'pages':len(pdf),'first_printed_number':first_text,'last_printed_number':len(pdf)-1,'native_text':'black','anchors_preserved':len(final_map)}))
