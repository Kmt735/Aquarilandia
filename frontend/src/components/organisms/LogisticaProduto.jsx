import { useState } from 'react'
import Button from '../atoms/Button'
import Input from '../atoms/Input'
import Aviso from '../molecules/Aviso'
import FormField from '../molecules/FormField'
import useConsulta from '../../hooks/useConsulta'
import { requisitarApi } from '../../services/api'

const campos = [
  ['pesoG','Peso da unidade embalada (g)',1,1000000],
  ['comprimentoCm','Comprimento da embalagem (cm)',1,300],
  ['larguraCm','Largura da embalagem (cm)',1,300],
  ['alturaCm','Altura da embalagem (cm)',1,300],
  ['prazoPreparacaoDias','Prazo de preparação (dias)',0,60],
]
export default function LogisticaProduto({ produtoId }) {
  const consulta = useConsulta(() => requisitarApi(`/produtos/${produtoId}/logistica`),[produtoId])
  if (consulta.carregando) return <p role="status">Carregando dados de envio…</p>
  if (consulta.erro) return <Aviso tipo="erro">{consulta.erro.message} <Button onClick={consulta.recarregar}>Tentar novamente</Button></Aviso>
  return <Formulario key={produtoId} produtoId={produtoId} logistica={consulta.dados.logistica} />
}
function Formulario({ produtoId, logistica }) {
  const [valores,setValores] = useState(() => Object.fromEntries(campos.map(([c]) => [c,logistica?.[c] ?? ''])))
  const [envio,setEnvio] = useState(logistica?.envioConvencional ?? false)
  const [estado,setEstado] = useState({ocupado:false,erro:null,sucesso:false})
  return <section className="mt-8 rounded-card border border-border-strong bg-surface p-6">
    <h3 className="text-h3">Embalagem e envio</h3>
    <p className="my-3 text-pequeno text-text-muted">Informe peso e medidas da embalagem pronta para transporte de uma unidade. Cada unidade será cotada como um volume separado. Sem esses dados, o produto continua disponível para retirada.</p>
    <form onSubmit={async (e) => {
      e.preventDefault();setEstado({ocupado:true,erro:null,sucesso:false})
      try {
        await requisitarApi(`/produtos/${produtoId}/logistica`,{metodo:'PUT',corpo:{...Object.fromEntries(campos.map(([c]) => [c,valores[c]==='' ? null : Number(valores[c])])),envioConvencional:envio}})
        setEstado({ocupado:false,erro:null,sucesso:true})
      } catch (erro) { setEstado({ocupado:false,erro,sucesso:false}) }
    }}>
      {estado.erro && <Aviso tipo="erro" role="alert" className="mb-4">{estado.erro.message}</Aviso>}
      {estado.sucesso && <Aviso tipo="sucesso" role="status" className="mb-4">Dados de envio salvos.</Aviso>}
      {campos.map(([c,label,min,max]) => <FormField key={c} id={`logistica-${c}`} label={label} obrigatorio erro={estado.erro?.detalhes?.[c]}>
        <Input type="number" min={min} max={max} step="1" required value={valores[c]} onChange={(e) => setValores({...valores,[c]:e.target.value})} />
      </FormField>)}
      <label className="mb-4 flex items-center gap-3"><input type="checkbox" checked={envio} onChange={(e) => setEnvio(e.target.checked)} />Permitir envio por Correios ou transportadora</label>
      <p className="mb-4 text-pequeno text-text-muted">Marque somente se a embalagem e o produto forem aceitos no transporte convencional. Peixes continuam bloqueados para essa modalidade.</p>
      <Button type="submit" disabled={estado.ocupado}>{estado.ocupado ? 'Salvando…' : 'Salvar dados de envio'}</Button>
    </form>
  </section>
}
