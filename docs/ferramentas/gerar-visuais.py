"""Gera os vetores de documentação sem alterar a aplicação."""
from pathlib import Path
from html import escape
import textwrap

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/visuais'
OUT.mkdir(parents=True,exist_ok=True)

class Canvas:
 def __init__(self,w,h):
  self.w=w;self.h=h
  self.parts=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img"><title>Documentação visual da Aquarilândia</title><rect width="100%" height="100%" fill="#f2f5fa"/>']
 def rect(self,x,y,w,h,fill='white',stroke='none',r=0,dash=False):
  self.parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke}" stroke-width="1.5"'+(' stroke-dasharray="6 5"' if dash else '')+'/>')
 def line(self,x,y,x2,y2,color='#94a3b8'):
  self.parts.append(f'<path d="M{x},{y} L{x2},{y2}" fill="none" stroke="{color}" stroke-width="2"/>')
 def text(self,x,y,value,size=18,color='#24364b',weight=400):
  self.parts.append(f'<text x="{x}" y="{y}" font-family="DejaVu Sans, Arial, sans-serif" font-size="{size}" fill="{color}" font-weight="{weight}">{escape(value)}</text>')
 def wrap(self,x,y,value,width=48,size=18,color='#475569',weight=400,leading=None):
  leading=leading or size*1.45
  for i,line in enumerate(textwrap.wrap(value,width=width)):
   self.text(x,y+i*leading,line,size,color,weight)
  return y+len(textwrap.wrap(value,width=width))*leading
 def fish(self,x,y,w=180,h=85,color='#1d4ed8'):
  self.parts.append(f'<g transform="translate({x},{y})"><ellipse cx="{w*.48}" cy="{h*.5}" rx="{w*.34}" ry="{h*.34}" fill="{color}"/><path d="M{w*.73},{h*.5} L{w},{h*.1} L{w},{h*.9} Z" fill="{color}"/><circle cx="{w*.28}" cy="{h*.42}" r="4" fill="white"/></g>')
 def save(self,name):
  p=OUT/name;p.write_text(''.join(self.parts)+'</svg>');return p

for stage,label,subtitle in [
 ('baixo','Baixo nível','Blocos de conteúdo e caminhos principais, antes do detalhamento dos componentes.'),
 ('medio','Médio nível','Hierarquia, rótulos e controles organizados para consulta pelo celular.'),
 ('alto','Alto nível','Referência visual com cores e componentes da interface disponível.')]:
 c=Canvas(1100,1240);high=stage=='alto';low=stage=='baixo'
 primary='#1d4ed8' if high else '#475569';ink='#0f2a6b' if high else '#24364b';soft='#eff6ff' if high else '#eef0f3';accent='#fbbf24' if high else '#e2e8f0'
 c.text(48,44,'AQUARILÂNDIA  /  REGISTROS VISUAIS',17,'#475569',700)
 c.text(48,92,f'Wireframes de {label.lower()}',36,ink,700)
 c.wrap(48,127,subtitle,width=98,size=18)
 for panel,x in [('01  Início',52),('02  Catálogo de peixes',574)]:
  c.text(x+8,190,panel,20,ink,700)
  c.rect(x,210,474,834,'#ffffff','#c2cedf',26)
  c.rect(x+12,222,450,810,'#ffffff','#e2e8f0',18)
  ix=x+30;iy=240
  c.text(ix,iy+27,'Aquarilândia' if not low else 'LOGO',23,ink,700)
  for yy in [iy+11,iy+18,iy+25]:c.line(x+355,yy,x+377,yy,ink)
  c.rect(x+396,iy,42,38,accent,'#94a3b8' if not high else 'none',10)
  c.parts.append(f'<path d="M{x+403},{iy+9} h5 l4,14 h17 l4,-11 h-23" fill="none" stroke="{ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="{x+413}" cy="{iy+29}" r="2.5" fill="{ink}"/><circle cx="{x+428}" cy="{iy+29}" r="2.5" fill="{ink}"/>')
  c.line(ix,iy+52,x+444,iy+52,'#dce6f2')
  if panel.startswith('01'):
   if low:
    blocks=[(315,148,'MENSAGEM PRINCIPAL'),(477,48,'AÇÃO: CONSULTAR CATÁLOGO'),(539,48,'AÇÃO: GUIA DO INICIANTE'),(609,84,'CATEGORIAS'),(709,144,'PEIXES EM DESTAQUE'),(869,96,'ORIENTAÇÃO E CONFIANÇA')]
    for yy,hh,txt in blocks:
     c.rect(ix,yy,414,hh,'#fafafa','#94a3b8',4,True)
     c.wrap(ix+20,yy+34,txt,width=30,size=18,weight=600)
    c.line(ix+25,440,ix+386,367);c.line(ix+25,367,ix+386,440)
   else:
    c.rect(ix,309,414,303,soft,r=16)
    c.text(ix+20,344,'PEIXES, PLANTAS E AQUÁRIOS',15,primary,700)
    c.text(ix+20,387,'Seu aquário é um',29,ink,700)
    c.text(ix+20,426,'ecossistema.',32,ink,700)
    if high:c.line(ix+20,439,ix+258,439,accent)
    c.wrap(ix+20,463,'A qualidade que você já conhece, agora pertinho de você.',width=37,size=17)
    c.rect(ix+20,520,180,48,primary,r=24);c.text(ix+42,551,'Ver produtos',19,'#ffffff',700)
    c.rect(ix+214,520,180,48,'white',primary,24);c.text(ix+233,551,'Sou iniciante',18,primary,700)
    c.text(ix,649,'Encontre o que precisa',23,ink,700)
    for j,t in enumerate(['Peixes','Aquários','Plantas','Filtros']):
     xx=ix+(j%2)*214;yy=670+(j//2)*52
     c.rect(xx,yy,200,42,soft,'#cbd5e1',12);c.text(xx+16,yy+28,t,18,ink,600)
    c.text(ix,802,'Peixes em destaque',23,ink,700)
    c.rect(ix,820,414,54,'#ffffff','#cbd5e1',12);c.text(ix+18,854,'Ficha e disponibilidade atualizadas',17,ink)
    c.rect(ix,892,414,91,ink,r=14)
    c.text(ix+18,927,'Meu Primeiro Aquário',21,'white',700)
    c.text(ix+18,958,'Ciclagem, água e cuidados →',17,'white')
  else:
   if low:
    blocks=[(315,74,'TÍTULO E ORIENTAÇÃO'),(405,48,'BUSCA'),(467,48,'FILTROS'),(531,50,'FILTROS APLICADOS'),(601,244,'CARD: FOTO, FICHA E ESTADO'),(863,100,'AJUDA / PRÓXIMA AÇÃO')]
    for yy,hh,txt in blocks:
     c.rect(ix,yy,414,hh,'#fafafa','#94a3b8',4,True)
     c.wrap(ix+18,yy+32,txt,width=30,size=18,weight=600)
    c.line(ix+25,672,ix+386,815);c.line(ix+25,815,ix+386,672)
   else:
    c.text(ix,326,'Início  /  Loja  /  Peixes',15,'#64748b')
    c.text(ix,370,'Peixes',32,ink,700)
    c.wrap(ix,402,'Conheça a ficha antes de escolher. Confira os cuidados de cada espécie.',width=42,size=17)
    c.rect(ix,466,414,46,'#ffffff','#94a3b8',12);c.text(ix+18,496,'Buscar peixes',18,'#64748b')
    c.rect(ix,526,190,44,primary,r=22);c.text(ix+22,555,'Filtros',18,'white',700)
    c.rect(ix+208,526,206,44,'white','#94a3b8',22);c.text(ix+227,555,'Ordenar',18,ink)
    c.rect(ix,585,142,33,soft,r=16);c.text(ix+12,608,'Água doce ×',15,ink)
    c.rect(ix+151,585,124,33,soft,r=16);c.text(ix+163,608,'Iniciante ×',15,ink)
    c.rect(ix+284,585,130,33,soft,r=16);c.text(ix+295,608,'Disponível ×',14,ink)
    c.rect(ix,638,414,308,'white','#cbd5e1',14)
    c.rect(ix+1,639,412,110,soft,r=14)
    c.fish(ix+127,658,160,70,primary if high else '#94a3b8')
    c.text(ix+18,781,'Peixe do catálogo',22,ink,700)
    c.text(ix+18,809,'Temperamento · Aquário mínimo',16,'#475569')
    c.text(ix+18,836,'Temperatura e pH na ficha',16,'#475569')
    c.text(ix+18,866,'Preço na ficha',18,primary,700)
    c.rect(ix+18,887,378,42,primary,r=21);c.text(ix+127,915,'Ver detalhes',18,'white',700)
    c.text(ix+3,982,'Compare as fichas antes de decidir.',17,ink)
 c.text(52,1092,'FOCO DA PERSONA',16,primary,700)
 c.wrap(52,1124,'Juliana consulta pelo celular, quer conhecer o catálogo antes de sair de casa e precisa de orientação para cuidar do aquário.',width=99,size=18,color=ink)
 c.wrap(52,1192,'Reconstrução atual · 23/11/2026 · Conteúdo ilustrativo; não representa estoque ou preços reais.',width=110,size=15)
 c.save(f'wireframe-{stage}.svg')

c=Canvas(1100,1030)
c.text(48,48,'AQUARILÂNDIA  /  PERSONA E CONTEXTO',17,'#475569',700)
c.text(48,99,'Mapa de empatia de Juliana',36,'#0f2a6b',700)
c.text(48,138,'38 anos · Analista administrativa · São João del-Rei · Aquário de água doce de cerca de 60 L',17,'#475569')
c.rect(48,167,1004,100,'#163a70',r=16)
c.text(72,203,'NECESSIDADE CENTRAL',15,'#fbbf24',700)
c.wrap(72,235,'Cuidar do aquário com segurança e consultar a loja antes de sair de casa.',width=90,size=20,color='white',weight=600)
cards=[
 ('O que vê','Vitrine da Aquarilândia; Instagram no cotidiano; vídeos de aquarismo no YouTube; o aquário na sala.','Base: descrição fornecida.'),
 ('O que ouve','Orientações da proprietária da loja, em quem confia para escolher e cuidar dos peixes.','Base: descrição fornecida.'),
 ('O que faz','Volta à loja mensalmente; compra peixes; procura explicações em vídeos; consulta a loja quando tem dúvidas.','Base: descrição fornecida.'),
 ('O que pensa e sente','Busca relaxamento e autonomia. A perda de peixes pode gerar insegurança e receio de repetir erros.','Insegurança e receio: inferências.'),
 ('Dores e obstáculos','Já perdeu peixes sem entender o motivo; não compreende ciclagem e pH; nem sempre tem tempo de ir à loja.','Base: descrição fornecida.'),
 ('Ganhos desejados','Peixes saudáveis; orientação confiável; segurança nos cuidados; catálogo acessível pelo celular antes da visita.','Base: descrição fornecida.')]
for i,(title,content,origin) in enumerate(cards):
 x=48+(i%2)*514;y=292+(i//2)*213
 c.rect(x,y,490,192,'white','#dce6f2',16)
 c.text(x+22,y+36,title,23,'#163a70',700)
 c.wrap(x+22,y+68,content,width=42,size=18)
 c.text(x+22,y+168,origin,14,'#64748b')
c.wrap(48,976,'Elaborado a partir da persona fornecida pela equipe. Pensamentos e emoções inferidos não são falas de uma entrevista.',width=114,size=15)
c.save('mapa-empatia-juliana.svg')
print('Gerados 3 níveis de wireframes e mapa de empatia em docs/visuais/.')
