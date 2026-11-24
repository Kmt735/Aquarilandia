import { useRef, useState } from 'react'
import Button from '../atoms/Button'
import Input from '../atoms/Input'
import Aviso from '../molecules/Aviso'
import ErroAdmin from '../molecules/ErroAdmin'
import FormField from '../molecules/FormField'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog'
import useAuth from '../../hooks/useAuth'
import useConsulta from '../../hooks/useConsulta'
import useFormulario from '../../hooks/useFormulario'
import useToast from '../../hooks/useToast'
import { gravarSessao, lerSessao } from '../../services/http'
import { obterSaldo, registrarEntrada } from '../../services/estoque'

const REGRAS = {
  quantidade: v => /^\d+$/.test(v) && Number(v) > 0 && Number(v) <= 2147483647 ? null : 'Informe uma quantidade inteira positiva.',
  motivo: v => v.trim() && [...v.trim()].length <= 300 ? null : 'Informe o motivo em até 300 caracteres.',
}

export default function EntradaEstoqueDialog({ item, aoFechar, aoSalvar }) {
  const { usuario } = useAuth()
  const { toast } = useToast()
  // Guarda a mesma intenção até resolver uma resposta perdida. Não guarda cookie ou papel.
  const chaveStorage = `aquarilandia-entrada-pendente:${usuario.id}:${item.id}`
  const [pendente, setPendente] = useState(() => lerSessao(chaveStorage, null))
  const intencaoAtual = useRef(pendente)
  const [resultado, setResultado] = useState(null)
  const saldo = useConsulta(() => obterSaldo(item.id), [item.id])
  const { campo, erros, enviar, enviando, erroGeral, formRef } = useFormulario({
    quantidade: String(pendente?.dados?.quantidade ?? ''), motivo: pendente?.dados?.motivo ?? '',
  }, REGRAS)
  const salvar = evento => enviar(async v => {
    const intencao = intencaoAtual.current ?? { chave: crypto.randomUUID(), dados: { produtoId: item.id, quantidade: Number(v.quantidade), motivo: v.motivo.trim() } }
    intencaoAtual.current = intencao
    setPendente(intencao)
    gravarSessao(chaveStorage, intencao)
    try {
      const movimento = await registrarEntrada(intencao.dados, intencao.chave)
      gravarSessao(chaveStorage, null)
      intencaoAtual.current = null
      setPendente(null)
      setResultado(movimento)
      saldo.recarregar()
      aoSalvar()
      toast('Entrada de estoque registrada.', { tipo: 'sucesso' })
    } catch (erro) {
      // 4xx é recusa definitiva. Rede/5xx pode ter perdido uma resposta após COMMIT: manter chave e corpo.
      if (erro.status >= 400 && erro.status < 500) { intencaoAtual.current = null; setPendente(null); gravarSessao(chaveStorage, null) }
      throw erro
    }
  })(evento)
  return <Dialog open onOpenChange={aberto => { if (!aberto && !enviando) aoFechar() }}>
    <DialogContent showCloseButton={!enviando} className="max-h-[90dvh] overflow-y-auto">
      <DialogTitle>Dar entrada no estoque</DialogTitle>
      <DialogDescription>{item.nome}. O servidor registra quantidade, motivo e responsável no histórico.</DialogDescription>
      {saldo.carregando ? <p role="status">Consultando saldo…</p>
        : saldo.erro ? <ErroAdmin erro={saldo.erro} recarregar={saldo.recarregar} />
          : <p role="status">Saldo atual: <strong>{saldo.dados.saldoAtual}</strong> unidades.</p>}
      {resultado ? <>
        <Aviso tipo="sucesso" role="status">Entrada registrada: {resultado.quantidade} unidades. Saldo após a operação: {resultado.saldoAtual}.</Aviso>
        <Button onClick={aoFechar}>Concluir</Button>
      </> : <form ref={formRef} noValidate onSubmit={salvar}>
        {pendente && <Aviso tipo="aviso" className="mb-4">Há uma entrada aguardando confirmação. Tente novamente para conferir a mesma operação, sem duplicar unidades.</Aviso>}
        {erroGeral && <Aviso tipo="erro" role="alert" className="mb-4">{erroGeral}</Aviso>}
        <FormField id="entrada-quantidade" label="Quantidade" obrigatorio erro={erros.quantidade}>
          <Input inputMode="numeric" disabled={enviando || Boolean(pendente)} {...campo('quantidade')} />
        </FormField>
        <FormField id="entrada-motivo" label="Motivo" obrigatorio erro={erros.motivo}>
          <Input maxLength={300} disabled={enviando || Boolean(pendente)} {...campo('motivo')} />
        </FormField>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={enviando || saldo.carregando || Boolean(saldo.erro)}>{enviando ? 'Registrando…' : pendente ? 'Confirmar a mesma entrada' : 'Registrar entrada'}</Button>
          <Button variant="terciario" disabled={enviando} onClick={aoFechar}>Fechar</Button>
        </div>
      </form>}
    </DialogContent>
  </Dialog>
}
