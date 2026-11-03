import { Lightbulb, Sprout } from 'lucide-react'
import { useId, useState } from 'react'
import Button from '../atoms/Button'
import Input from '../atoms/Input'
import Termo from '../atoms/Termo'
import Aviso from '../molecules/Aviso'
import CompatibilityWarning from '../molecules/CompatibilityWarning'
import ItemPickerCard from '../molecules/ItemPickerCard'
import { gruposEquipamentos } from '../../data/montagem'
import { avisosDoItem } from '../../lib/compatibilidade'
import { fichaDe, ordenarPorRecomendacao, recomendado, sugestaoSubstrato } from '../../lib/montagem'

// Conteúdo de cada etapa do "Monte seu Aquário". Todas recebem o mesmo `ctx` da página.
const TEMPERAMENTO = { pacifico: 'Pacífico', semi_agressivo: 'Semiagressivo', agressivo: 'Agressivo' }
const AGUA = { doce: 'Água doce', marinho: 'Água salgada', salobra: 'Água salobra', ambos: 'Doce ou salgada' }
const MATERIAL = { resina: 'Resina', pedra: 'Pedra natural', tronco: 'Tronco natural', ceramica: 'Cerâmica', plastico: 'Plástico' }
const POSICAO = { frente: 'Frente', meio: 'Meio', fundo: 'Fundo', flutuante: 'Flutuante', epifita: 'Presa em pedra ou tronco' }
const SUBSTRATO = { areia: 'Areia', cascalho: 'Cascalho', fertil: 'Fértil', argila: 'Argila', coral: 'Coral' }
const num = (n) => String(n).replace('.', ',')

const GRADE = 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3'

function chipsDe(item) {
  const f = fichaDe(item)
  switch (item.categoriaSlug) {
    case 'aquarios': return [
      { id: 'volume', rotulo: `${f.volumeLitros} L`, titulo: 'Volume' },
      { id: 'aquario', rotulo: `${num(f.comprimentoCm)} × ${num(f.larguraCm)} × ${num(f.alturaCm)} cm`, titulo: 'Medidas (comprimento × largura × altura)' },
      { id: 'categoria', rotulo: AGUA[f.tipoAgua], titulo: 'Tipo de água' },
    ]
    case 'filtros': return [
      f.aquarioMaxLitros && { id: 'capacidade', rotulo: `Até ${f.aquarioMaxLitros} L`, titulo: 'Aquário máximo' },
      f.vazaoLh && { id: 'categoria', rotulo: `${f.vazaoLh} L/h`, titulo: 'Vazão' },
    ]
    case 'termostatos': return [
      (f.aquarioMinLitros || f.aquarioMaxLitros) && { id: 'capacidade', rotulo: `${f.aquarioMinLitros ?? 0}–${f.aquarioMaxLitros ?? '?'} L`, titulo: 'Indicado para aquários de' },
      f.potenciaW && { id: 'categoria', rotulo: `${num(f.potenciaW)} W`, titulo: 'Potência' },
    ]
    case 'iluminacao': return [
      f.comprimentoCm && { id: 'aquario', rotulo: `${num(f.comprimentoCm)} cm`, titulo: 'Comprimento' },
      f.espectro && { id: 'categoria', rotulo: f.espectro === 'plantado' ? 'Para plantas' : f.espectro === 'marinho' ? 'Marinha' : 'Luz branca', titulo: 'Tipo de luz' },
    ]
    case 'substratos': return [
      f.pesoKg && { id: 'categoria', rotulo: `${num(f.pesoKg)} kg`, titulo: 'Peso do pacote' },
      f.tipo && { id: 'aquario', rotulo: SUBSTRATO[f.tipo], titulo: 'Tipo' },
    ]
    case 'decoracoes': return [
      f.material && { id: 'categoria', rotulo: MATERIAL[f.material], titulo: 'Material' },
      f.seguroMarinho != null && { id: 'volume', rotulo: f.seguroMarinho ? 'Pode em água salgada' : 'Só água doce', titulo: 'Tipo de água' },
    ]
    case 'plantas': return [f.posicao && { id: 'categoria', rotulo: POSICAO[f.posicao], titulo: 'Posição no aquário' }]
    case 'peixes': return [
      f.temperamento && { id: 'temperamento', rotulo: TEMPERAMENTO[f.temperamento], titulo: 'Temperamento' },
      f.aquarioMinLitros && { id: 'aquario', rotulo: `Mín. ${f.aquarioMinLitros} L`, titulo: 'Aquário mínimo' },
      f.tamanhoAdultoCm && { id: 'volume', rotulo: `Adulto: ${num(f.tamanhoAdultoCm)} cm`, titulo: 'Tamanho adulto' },
      f.tempMinC != null && { id: 'temperatura', rotulo: `${num(f.tempMinC)}–${num(f.tempMaxC)} °C`, titulo: 'Temperatura da água' },
      f.tipoAgua && { id: 'categoria', rotulo: AGUA[f.tipoAgua], titulo: 'Tipo de água' },
    ]
    default: return []
  }
}

// Avisos da etapa que não pertencem a um card desta etapa (ex.: "Falta um filtro")
function AvisosGerais({ ctx, etapa }) {
  const ids = new Set(ctx.linhas[etapa].map((l) => l.id))
  const gerais = ctx.avisos.filter((a) => a.etapa === etapa && !a.itens.some((id) => ids.has(id)))
  if (!gerais.length) return null
  return <div className="mb-5 flex flex-col gap-2">{gerais.map((a) => <CompatibilityWarning key={a.id} aviso={a} />)}</div>
}

function Grade({ ctx, etapa, itens, rotulo, qtdInicial = () => 1, nota, comQuantidade = true, nivelTitulo = 3, unico = false }) {
  if (!itens?.length) return <p className="text-pequeno text-text-muted">Nenhum item disponível nesta categoria no momento.</p>
  const escolhidos = new Map(ctx.montagem.escolhas[etapa].map((x) => [x.id, x.qtd]))
  return (
    <ul aria-label={rotulo} className={GRADE}>
      {ordenarPorRecomendacao(itens, ctx.aquario).map((item) => {
        const selecionado = escolhidos.has(item.id)
        return (
          <li key={item.id} className="flex">
            <div className="flex w-full flex-col [&>article]:flex-1">
              <ItemPickerCard
                item={item}
                selecionado={selecionado}
                qtd={escolhidos.get(item.id) ?? 1}
                recomendado={recomendado(item, ctx.aquario)}
                chips={chipsDe(item).filter(Boolean)}
                nota={nota?.(item)}
                avisos={selecionado ? avisosDoItem(ctx.avisos, item.id) : []}
                comQuantidade={comQuantidade}
                nivelTitulo={nivelTitulo}
                onAlternar={() => (unico
                  ? (selecionado ? ctx.remover(etapa, item.id) : ctx.escolherAquario(item.id))
                  : ctx.alternar(etapa, item.id, qtdInicial(item)))}
                onQtd={(q) => ctx.definirQtd(etapa, item.id, q)}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function SemAquario({ ctx, texto }) {
  return (
    <Aviso tipo="info" className="mb-5" acao={<Button variant="secundario" tamanho="sm" onClick={() => ctx.irPara(0)}>Escolher o aquário</Button>}>
      {texto}
    </Aviso>
  )
}

// ---------------------------------------------------------------------------------------------------

export function EtapaAquario({ ctx }) {
  return (
    <>
      <Grade ctx={ctx} etapa="aquario" itens={ctx.catalogo.aquarios} rotulo="Aquários" comQuantidade={false} unico />
      <AquarioProprio ctx={ctx} />
    </>
  )
}

function AquarioProprio({ ctx }) {
  const atual = ctx.montagem.aquarioProprio
  const [aberto, setAberto] = useState(Boolean(atual))
  const [litros, setLitros] = useState(atual ? String(atual.litros) : '')
  const [tipoAgua, setTipoAgua] = useState(atual?.tipoAgua ?? 'doce')
  const [erro, setErro] = useState(null)
  const id = useId()

  const salvar = (e) => {
    e.preventDefault()
    const valor = Number(litros.replace(',', '.'))
    if (!Number.isFinite(valor) || valor < 5 || valor > 5000) {
      setErro('Informe quantos litros tem o seu aquário (entre 5 e 5000).')
      return
    }
    setErro(null)
    ctx.usarAquarioProprio({ litros: Math.round(valor), tipoAgua })
  }

  return (
    <section aria-labelledby={`${id}-titulo`} className="mt-6 rounded-card border border-dashed border-border-control p-5">
      <h3 id={`${id}-titulo`} className="text-h4">Já tenho um aquário</h3>
      <p className="mt-1 text-pequeno text-text-muted">Conte o tamanho dele e montamos o resto a partir daí.</p>
      {!aberto ? (
        <Button variant="secundario" className="mt-3" onClick={() => setAberto(true)}>Informar o meu aquário</Button>
      ) : (
        <form onSubmit={salvar} noValidate className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-litros`} className="text-pequeno font-bold">Quantos litros?</label>
            <Input
              id={`${id}-litros`} inputMode="numeric" value={litros} erro={erro} className="max-w-40"
              aria-describedby={erro ? `${id}-erro` : `${id}-ajuda`} onChange={(e) => setLitros(e.target.value.replace(/[^\d,.]/g, ''))}
            />
            <p id={`${id}-ajuda`} className="text-legenda text-text-muted">
              Não sabe? Multiplique comprimento × largura × altura em cm e divida por 1000.
            </p>
            {erro && <p id={`${id}-erro`} className="text-legenda font-semibold text-danger-text">{erro}</p>}
          </div>
          <fieldset>
            <legend className="text-pequeno font-bold"><Termo id="tipoAgua">Tipo de água</Termo></legend>
            <div className="mt-2 flex flex-wrap gap-4">
              {[['doce', 'Doce'], ['marinho', 'Salgada']].map(([valor, rotulo]) => (
                <label key={valor} className="flex min-h-11 items-center gap-2 text-pequeno">
                  <input type="radio" name={`${id}-agua`} value={valor} checked={tipoAgua === valor} onChange={() => setTipoAgua(valor)} className="size-5 accent-primary" />
                  {rotulo}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap gap-3">
            <Button type="submit">{atual ? 'Atualizar o meu aquário' : 'Usar o meu aquário'}</Button>
            {atual && <Button variant="terciario" onClick={() => { ctx.usarAquarioProprio(null); setAberto(false) }}>Não usar</Button>}
          </div>
          {atual && <p role="status" className="text-pequeno text-success-text">Usando o seu aquário de {atual.litros} L ({atual.tipoAgua === 'marinho' ? 'água salgada' : 'água doce'}).</p>}
        </form>
      )}
    </section>
  )
}

export function EtapaEquipamentos({ ctx }) {
  return (
    <>
      {!ctx.aquario && <SemAquario ctx={ctx} texto="Escolha o aquário primeiro: assim mostramos os equipamentos que servem para ele." />}
      <AvisosGerais ctx={ctx} etapa="equipamentos" />
      <div className="flex flex-col gap-8">
        {gruposEquipamentos.map((g) => (
          <section key={g.slug} aria-labelledby={`grupo-equip-${g.slug}`}>
            <h3 id={`grupo-equip-${g.slug}`} className="mb-3 text-h3">
              {g.termo ? <Termo id={g.termo}>{g.titulo}</Termo> : g.titulo}
            </h3>
            <Grade ctx={ctx} etapa="equipamentos" itens={ctx.catalogo[g.slug]} rotulo={g.titulo} nivelTitulo={4} />
          </section>
        ))}
      </div>
    </>
  )
}

export function EtapaSubstrato({ ctx }) {
  const m = ctx.aquario?.medidas
  const base = m && sugestaoSubstrato(ctx.aquario, null)
  return (
    <>
      <p className="mb-4 text-pequeno"><Termo id="substrato">O que é substrato?</Termo></p>
      {!ctx.aquario ? (
        <SemAquario ctx={ctx} texto="Escolha o aquário primeiro para calcularmos quanto substrato você precisa." />
      ) : base && (
        <Aviso tipo="info" className="mb-5" titulo={`Sugestão: cerca de ${base.kg} kg de substrato`}>
          Para um fundo de {m.comprimentoCm} × {m.larguraCm} cm{m.estimadas ? ' (medida estimada pelos litros)' : ''}, com uma camada de uns 5 cm.
          Ao escolher, já colocamos a quantidade de pacotes. É um cálculo aproximado: a loja confirma para você.
          {/* TODO(loja): validar a regra (SUBSTRATO_KG_POR_DM2 e PROPORCAO_AQUARIO_PROPRIO em lib/compatibilidade.js) */}
        </Aviso>
      )}
      <Grade
        ctx={ctx} etapa="substrato" itens={ctx.catalogo.substratos} rotulo="Substratos"
        qtdInicial={(item) => sugestaoSubstrato(ctx.aquario, item)?.pacotes ?? 1}
        nota={(item) => {
          const s = sugestaoSubstrato(ctx.aquario, item)
          const f = fichaDe(item)
          return (
            <>
              {s?.pacotes && <p><strong>Para o seu aquário:</strong> {s.pacotes} {s.pacotes === 1 ? 'pacote' : 'pacotes'} (≈ {s.kg} kg)</p>}
              {f.alteraPh && <p className="mt-1 text-text-muted">Deixa a água mais alcalina (<Termo id="ph" mostrarRotulo={false} /> mais alto).</p>}
            </>
          )
        }}
      />
    </>
  )
}

export function EtapaDecoracao({ ctx }) {
  return (
    <>
      <AvisosGerais ctx={ctx} etapa="decoracao" />
      <Grade ctx={ctx} etapa="decoracao" itens={ctx.catalogo.decoracoes} rotulo="Decorações" />
    </>
  )
}

export function EtapaPlantas({ ctx }) {
  return (
    <>
      <AvisosGerais ctx={ctx} etapa="plantas" />
      <Grade
        ctx={ctx} etapa="plantas" itens={ctx.catalogo.plantas} rotulo="Plantas"
        nota={(item) => {
          const f = fichaDe(item)
          const forte = f.iluminacaoExigida === 'alta'
          return (
            <ul className="flex flex-col gap-1">
              <li className="flex items-center gap-1.5">
                {forte ? <Lightbulb aria-hidden="true" className="size-4 text-warning-text" /> : <Sprout aria-hidden="true" className="size-4 text-success-text" />}
                {forte ? 'Precisa de luz forte' : f.iluminacaoExigida === 'media' ? 'Luz média' : 'Fácil: luz fraca já basta'}
              </li>
              {f.precisaCo2 && (
                <li className="flex items-center gap-1.5">
                  <Lightbulb aria-hidden="true" className="size-4 text-warning-text" />
                  <span>Precisa de <Termo id="co2">CO₂</Termo></span>
                </li>
              )}
            </ul>
          )
        }}
      />
    </>
  )
}

export function EtapaPeixes({ ctx }) {
  return (
    <>
      <Aviso tipo="info" className="mb-4">
        Antes de colocar os peixes, o aquário precisa passar pela <Termo id="ciclagem">ciclagem</Termo>, que leva algumas semanas.
      </Aviso>
      <p className="mb-5 flex flex-wrap gap-x-4 gap-y-1 text-pequeno text-text-muted">
        <span>Entenda os termos:</span>
        <Termo id="temperamento" />
        <Termo id="aquarioMinimo" />
        <Termo id="tamanhoAdulto" />
        <Termo id="cardume" />
      </p>
      {!ctx.aquario && <SemAquario ctx={ctx} texto="Escolha o aquário primeiro: assim avisamos quais peixes cabem nele." />}
      <AvisosGerais ctx={ctx} etapa="peixes" />
      <Grade
        ctx={ctx} etapa="peixes" itens={ctx.catalogo.peixes} rotulo="Peixes"
        qtdInicial={(item) => Math.max(1, fichaDe(item).cardumeMinimo ?? 1)}
        nota={(item) => (fichaDe(item).cardumeMinimo > 1 ? <p>Vive em <Termo id="cardume">cardume</Termo>: pelo menos {fichaDe(item).cardumeMinimo}.</p> : null)}
      />
    </>
  )
}
