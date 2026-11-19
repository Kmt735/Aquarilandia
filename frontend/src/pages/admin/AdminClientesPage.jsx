import { useState } from 'react'
import Button from '../../components/atoms/Button'
import Input from '../../components/atoms/Input'
import Aviso from '../../components/molecules/Aviso'
import ErroCompacto from '../../components/molecules/ErroCompacto'
import useConsulta from '../../hooks/useConsulta'
import { definirClienteAtivo, listarClientes } from '../../services/admin-operacoes'

export default function AdminClientesPage() {
  const [busca, setBusca] = useState(''), [pagina, setPagina] = useState(1), [erro, setErro] = useState(null), [ocupado, setOcupado] = useState(null), [confirmar, setConfirmar] = useState(null)
  const consulta = useConsulta(() => listarClientes({ busca, pagina, limite: 20 }), [busca, pagina])
  return <section>
    <h2 className="mb-4 text-h2">Clientes</h2>
    <label className="mb-5 block">Buscar cliente<Input value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1) }} /></label>
    {erro && <Aviso tipo="erro" role="alert">{erro}</Aviso>}
    {consulta.carregando ? <p role="status">Carregando clientes…</p> : consulta.erro ? <ErroCompacto onTentar={consulta.recarregar}>{consulta.erro.message}</ErroCompacto> : <>
      <p className="mb-3">{consulta.dados.total} cliente(s)</p>
      <ul className="space-y-3">{consulta.dados.dados.map((c) => <li key={c.id} className="rounded-card border p-5">
        <h3 className="text-h3">{c.nome}</h3><p>{c.email ?? 'Conta removida'} · {c.telefone ?? 'Sem telefone'}</p><p>{c.quantidadeVendas} compra(s) · {c.ativo ? 'Ativo' : 'Desativado'}</p>
        {c.email && c.papel !== 'admin' && (confirmar === c.id ? <div className="mt-3 flex flex-wrap items-center gap-3">
          <p>{c.ativo ? 'Desativar a conta revoga suas sessões. Confirmar?' : 'Reativar esta conta?'}</p>
          <Button disabled={ocupado !== null} onClick={async () => {
            setOcupado(c.id); setErro(null)
            try { await definirClienteAtivo(c.id, !c.ativo); setConfirmar(null); consulta.recarregar() } catch (err) { setErro(err.message) } finally { setOcupado(null) }
          }}>Confirmar alteração</Button><Button variant="secundario" disabled={ocupado !== null} onClick={() => setConfirmar(null)}>Cancelar</Button>
        </div> : <Button className="mt-3" variant="secundario" onClick={() => setConfirmar(c.id)}>{c.ativo ? 'Desativar cliente' : 'Reativar cliente'}</Button>)}
      </li>)}</ul>
      <div className="mt-4 flex items-center gap-4"><Button disabled={pagina === 1} onClick={() => setPagina(pagina - 1)}>Anterior</Button><span>Página {pagina}</span><Button disabled={pagina * 20 >= consulta.dados.total} onClick={() => setPagina(pagina + 1)}>Próxima</Button></div>
    </>}
  </section>
}
