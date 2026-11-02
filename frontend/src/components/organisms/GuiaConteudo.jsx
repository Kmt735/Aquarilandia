import { ArrowRight, Droplets, Fish, FlaskConical, Layers, Lightbulb, Package, TestTube, ThermometerSun } from 'lucide-react'
import { Link } from 'react-router'
import Button from '../atoms/Button'
import Termo from '../atoms/Termo'
import TextoComTermos from '../atoms/TextoComTermos'
import AquarioIcon from '../icons/AquarioIcon'
import Callout from '../molecules/Callout'
import MaintenanceChecklist from '../molecules/MaintenanceChecklist'
import ParameterTable from '../molecules/ParameterTable'
import { dicasPeixes, equipamentos, frequenciaTestes, parametrosAgua, rotinaManutencao, semanasCiclagem } from '../../data/guia'
import { urlCategoria, urlPeixes } from '../../utils/rotas'

const ICONES = {
  aquario: AquarioIcon,
  filtro: Droplets,
  termostato: ThermometerSun,
  iluminacao: Lightbulb,
  substrato: Layers,
  condicionador: FlaskConical,
  teste: TestTube,
  rede: Package,
}

// TODO: validar com a loja — textos dos avisos deste arquivo (Dica/Atenção de cada passo)
function PassoEquipamentos() {
  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2">
        {equipamentos.map((item) => {
          const Icone = ICONES[item.id]
          return (
            <li key={item.id} className="flex gap-3 rounded-card border border-border-strong bg-surface p-4">
              <Icone aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-primary-text" />
              <div className="min-w-0">
                <h3 className="text-h4">{item.termo ? <Termo id={item.termo}>{item.nome}</Termo> : item.nome}</h3>
                <p className="mt-1 text-pequeno text-text-muted">{item.texto}</p>
                {item.categoria && (
                  <Link
                    to={urlCategoria(item.categoria)}
                    className="alvo-toque mt-2 inline-flex items-center gap-1 rounded-sm text-pequeno font-bold text-primary-text underline decoration-transparent decoration-2 underline-offset-4 transition-colors hover:decoration-accent"
                  >
                    Ver na loja<span className="sr-only">: {item.categoria}</span>
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </Link>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      <Callout>
        Filtro, bomba, iluminação e termostato precisam ser compatíveis com o volume do aquário. Na hora de decorar, use pedras e troncos pensando também nos peixes escolhidos.
      </Callout>
    </>
  )
}

function PassoCiclagem() {
  return (
    <>
      <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-3">
        {semanasCiclagem.map((s, i) => (
          <li key={s.semana}>
            <div aria-hidden="true" className="mb-3 flex items-center gap-2">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft font-display text-pequeno font-extrabold text-primary-text tabular-nums">{s.semana}</span>
              {i < semanasCiclagem.length - 1 && <span className="h-0.5 flex-1 rounded-full bg-border-strong max-sm:hidden" />}
            </div>
            <p className="text-legenda font-bold text-primary-text">Semana {s.semana}</p>
            <h3 className="text-h4">{s.titulo}</h3>
            <p className="mt-1 text-pequeno text-text-muted">
              <TextoComTermos>{s.texto}</TextoComTermos>
            </p>
            <ul className="mt-2 space-y-1">
              {s.sinais.map((sinal) => (
                <li key={sinal} className="text-legenda font-semibold">
                  {sinal}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <Callout tipo="atencao">
        Cada aquário tem seu tempo, e a ciclagem pode levar mais de 4 semanas. Pular essa etapa é uma das principais causas de morte de peixes em aquários novos. Amônia e nitrito precisam estar em zero antes de colocar os peixes.
      </Callout>
    </>
  )
}

function PassoAgua() {
  return (
    <>
      <ParameterTable parametros={parametrosAgua} legenda="Parâmetros da água, faixa ideal e o que cada um significa" />
      <p className="text-pequeno text-text-muted">
        <TextoComTermos>Os testes mostram o resultado em [[ppm]]. Peixes de água fria ou de outras regiões podem pedir valores diferentes.</TextoComTermos>
      </p>
      <div>
        <h3 className="text-h4">Como e quando testar</h3>
        <p className="mt-1 max-w-[640px] text-pequeno text-text-muted">Pegue um pouco de água do aquário, siga a bula do kit e compare a cor com a tabela que vem na embalagem.</p>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {frequenciaTestes.map((f) => (
            <li key={f.quando} className="rounded-xl border border-border bg-surface px-4 py-3 text-pequeno">
              <span className="block text-text-muted">{f.quando}</span>
              <span className="font-bold">{f.frequencia}</span>
            </li>
          ))}
        </ul>
      </div>
      <Callout tipo="atencao">Se amônia ou nitrito estiverem acima de zero com peixes no aquário, não espere: fale com a loja.</Callout>
    </>
  )
}

function PassoPeixes() {
  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2">
        {dicasPeixes.map((d) => (
          <li key={d.id} className="rounded-card border border-border-strong bg-surface p-4">
            <h3 className="text-h4">{d.titulo}</h3>
            <p className="mt-1 text-pequeno text-text-muted">
              <TextoComTermos>{d.texto}</TextoComTermos>
            </p>
          </li>
        ))}
      </ul>
      <Button variant="secundario" asChild>
        <Link to={urlPeixes({ dificuldade: 'Fácil' })}>
          <Fish aria-hidden="true" />
          Ver peixes para iniciantes
        </Link>
      </Button>
    </>
  )
}

function PassoManutencao() {
  return (
    <>
      <MaintenanceChecklist grupos={rotinaManutencao} />
      <Callout tipo="atencao">Nunca lave o filtro na torneira: o cloro da água mata as bactérias boas que você esperou semanas para criar.</Callout>
    </>
  )
}

const CONTEUDO_PASSO = {
  equipamentos: PassoEquipamentos,
  ciclagem: PassoCiclagem,
  'qualidade-da-agua': PassoAgua,
  'escolha-dos-peixes': PassoPeixes,
  manutencao: PassoManutencao,
}

// Conteúdo de um passo do guia, pelo id
export default function GuiaConteudo({ id }) {
  const Conteudo = CONTEUDO_PASSO[id]
  return <Conteudo />
}
