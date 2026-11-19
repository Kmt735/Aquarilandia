import { useEffect, useId, useState } from 'react'
import Input from '../atoms/Input'
import FilterGroup from './FilterGroup'
import { faixasPreco } from '../../data/categorias'

// Faixa de preço: atalhos prontos + campos de mínimo e máximo (em reais). Os campos aplicam sozinhos
// depois de uma pausa na digitação (ou no Enter / ao sair do campo). Mínimo maior que o máximo
// mostra o erro junto do campo e não muda a lista.
const VALIDO = /^\d{1,7}([.,]\d{1,2})?$/
const numero = (t) => Number(String(t).replace(',', '.'))

// Atalhos em reais. "Até R$ 49,99" etc. continuam iguais aos dos links antigos (?preco=)
const CURTOS = { 'ate-50': 'Até R$ 49,99', '50-200': 'R$ 50 a 199,99', 'acima-200': 'R$ 200 ou mais' }
const ATALHOS = faixasPreco.map((x) => ({
  valor: x.valor,
  rotulo: CURTOS[x.valor] ?? x.rotulo,
  min: x.min ? String(x.min / 100) : '',
  max: Number.isFinite(x.max) ? (x.max / 100).toFixed(2).replace('.', ',') : '',
}))

export default function FiltroPreco({ min = '', max = '', preco = '', onAplicar }) {
  const id = useId()
  const [campos, setCampos] = useState({ min, max })
  const [daUrl, setDaUrl] = useState({ min, max })

  // Quando a URL muda por fora (chip removido, "Limpar", voltar), os campos acompanham
  if (daUrl.min !== min || daUrl.max !== max) {
    setDaUrl({ min, max })
    setCampos({ min, max })
  }

  const erroMin = campos.min && !VALIDO.test(campos.min) ? 'Use só números, ex.: 50 ou 49,90.' : ''
  const erroMax = campos.max && !VALIDO.test(campos.max) ? 'Use só números, ex.: 200 ou 199,90.' : ''
  const invertido = !erroMin && !erroMax && campos.min && campos.max && numero(campos.min) > numero(campos.max)
  const valido = !erroMin && !erroMax && !invertido

  const aplicar = () => {
    if (!valido) return
    if (campos.min === min && campos.max === max) return
    onAplicar({ min: campos.min, max: campos.max, preco: '' })
  }

  // Aplica sozinho 600 ms depois da última tecla
  useEffect(() => {
    const t = setTimeout(aplicar, 600)
    return () => clearTimeout(t)
  })

  // Atalho ativo: o de ?preco= (link antigo) ou o que bate com os campos
  // Com uma faixa digitada que não bate com nenhum atalho, nenhum atalho fica marcado (nem "Qualquer preço")
  const atalho = preco || ATALHOS.find((a) => a.min === (min || '') && a.max === (max || ''))?.valor || (min || max ? 'personalizada' : '')
  const escolherAtalho = (valor) => {
    const a = ATALHOS.find((x) => x.valor === valor)
    const novo = { min: a?.min ?? '', max: a?.max ?? '' }
    setCampos(novo)
    onAplicar({ ...novo, preco: '' })
  }

  const campo = (chave, rotulo, placeholder, erro) => (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <label htmlFor={`${id}-${chave}`} className="text-legenda font-semibold text-text-muted">
        {rotulo}
      </label>
      <div className="relative">
        <span aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-pequeno text-text-muted">
          R$
        </span>
        <Input
          id={`${id}-${chave}`}
          inputMode="decimal"
          autoComplete="off"
          placeholder={placeholder}
          value={campos[chave]}
          erro={erro || (invertido ? 'invertido' : '')}
          aria-describedby={erro ? `${id}-${chave}-erro` : invertido ? `${id}-invertido` : undefined}
          onChange={(e) => setCampos((c) => ({ ...c, [chave]: e.target.value.trim() }))}
          onBlur={aplicar}
          onKeyDown={(e) => e.key === 'Enter' && aplicar()}
          className="pl-10"
        />
      </div>
      {erro && (
        <p id={`${id}-${chave}-erro`} className="text-legenda text-danger-text">
          {erro}
        </p>
      )}
    </div>
  )

  return (
    <div>
      <FilterGroup titulo="Faixas de preço" nome="faixa-preco" legendaOculta variante="pilulas" itens={[{ valor: '', rotulo: 'Qualquer' }, ...ATALHOS]} ativo={atalho} onSelecionar={escolherAtalho} />
      <fieldset className="mt-3">
        <legend className="mb-2 text-legenda font-bold tracking-[.08em] text-text-muted uppercase">Ou digite a faixa</legend>
        <div className="flex gap-3">
          {campo('min', 'Mínimo', '0', erroMin)}
          {campo('max', 'Máximo', 'Sem limite', erroMax)}
        </div>
        {invertido && (
          <p id={`${id}-invertido`} role="alert" className="mt-2 text-legenda text-danger-text">
            O mínimo está maior que o máximo.
          </p>
        )}
      </fieldset>
    </div>
  )
}
