import { CircleCheck } from 'lucide-react'
import { useState } from 'react'
import Button from '../atoms/Button'
import Input from '../atoms/Input'
import Select from '../atoms/Select'
import Textarea from '../atoms/Textarea'
import FormField from '../molecules/FormField'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { linkWhatsApp } from '../../data/contato'
import useUI from '../../hooks/useUI'
import { opcoesServico } from '../../data/servicos'
import { mascararTelefone, telefoneValido } from '../../utils/telefone'

function montarMensagem({ nome, telefone, servico, mensagem }) {
  return [
    'Olá!',
    'Gostaria de pedir um orçamento pelo site da Aquarilândia.',
    '',
    '',
    `*Nome*: ${nome.trim()}`,
    `*Serviço*: ${servico}`,
    mensagem.trim() ? `*Detalhes*: ${mensagem.trim()}` : null,
    '',
    `Aguardo o retorno. Obrigado(a)!`,
  ]
    .filter((linha) => linha !== null)
    .join('\n')
}

export default function QuoteModal() {
  const { fecharPaineis, servicoOrcamento } = useUI()
  const [form, setForm] = useState({
    nome: '',
    telefone: '',
    servico: opcoesServico.includes(servicoOrcamento) ? servicoOrcamento : '',
    mensagem: '',
  })
  const [tocados, setTocados] = useState(() => new Set())
  const [status, setStatus] = useState('editando') // 'editando' | 'enviado'

  const validos = {
    nome: form.nome.trim().length >= 2,
    telefone: telefoneValido(form.telefone),
    servico: form.servico !== '',
  }
  const tudoValido = Object.values(validos).every(Boolean)
  const estado = (campo) => (validos[campo] ? 'ok' : tocados.has(campo) ? 'erro' : undefined)

  const atualizar = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }))
  const tocar = (campo) => setTocados((t) => new Set(t).add(campo))

  const abrirWhatsApp = () => window.open(linkWhatsApp(montarMensagem(form)), '_blank', 'noopener,noreferrer')
  const enviar = () => {
    abrirWhatsApp()
    setStatus('enviado')
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && fecharPaineis()}>
      <DialogContent className="max-h-[90vh] overflow-auto rounded-[20px] border-border bg-surface-elevated p-6 sm:max-w-[480px]">
      <DialogHeader className="mb-2">
        <DialogTitle className="font-display text-[23px] font-extrabold">Solicitar orçamento</DialogTitle>
        <DialogDescription className="sr-only">Formulário de pedido de orçamento</DialogDescription>
      </DialogHeader>

      {status === 'enviado' ? (
        <div className="pt-4 pb-1 text-center">
          <CircleCheck aria-hidden="true" className="mx-auto mb-3 size-11 text-primary-text" />
          <h4 className="mb-2 text-[20px]">Quase lá!</h4>
          <p className="mb-5 text-[14.5px] leading-relaxed text-text-muted">
            Abrimos o WhatsApp da loja com o seu pedido de {form.servico.toLowerCase()}, {form.nome.trim().split(' ')[0]}.
            É só tocar em enviar por lá para a gente receber. Se a conversa não abriu, use o primeiro botão.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button onClick={abrirWhatsApp}>Abrir o WhatsApp de novo</Button>
            <Button variant="ghost" onClick={fecharPaineis}>
              Fechar
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <FormField
            id="q-nome"
            label="Seu nome"
            obrigatorio
            estado={estado('nome')}
            erro="Digite seu nome (pelo menos 2 letras)."
          >
            <Input
              id="q-nome"
              autoFocus
              autoComplete="name"
              placeholder="Como podemos te chamar?"
              value={form.nome}
              estado={estado('nome')}
              onChange={(e) => atualizar('nome', e.target.value)}
              onBlur={() => tocar('nome')}
            />
          </FormField>

          <FormField
            id="q-tel"
            label="WhatsApp"
            obrigatorio
            estado={estado('telefone')}
            erro="Telefone incompleto. Exemplo: (32) 99999-0000"
          >
            <Input
              id="q-tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="(32) 99999-0000"
              value={form.telefone}
              estado={estado('telefone')}
              onChange={(e) => atualizar('telefone', mascararTelefone(e.target.value))}
              onBlur={() => tocar('telefone')}
            />
          </FormField>

          <FormField id="q-serv" label="Serviço" obrigatorio estado={estado('servico')} erro="Escolha um serviço da lista.">
            <Select
              id="q-serv"
              opcoes={opcoesServico}
              value={form.servico}
              estado={estado('servico')}
              onChange={(e) => {
                atualizar('servico', e.target.value)
                tocar('servico')
              }}
              onBlur={() => tocar('servico')}
            />
          </FormField>

          <FormField id="q-msg" label="Conte um pouco do que precisa">
            <Textarea
              id="q-msg"
              rows={3}
              placeholder="Ex.: aquário de 100L para a sala, com plantas"
              value={form.mensagem}
              onChange={(e) => atualizar('mensagem', e.target.value)}
            />
          </FormField>

          <Button variant="submit" disabled={!tudoValido} onClick={enviar}>
            Enviar pelo WhatsApp
          </Button>
          <div className="mt-3 text-center text-[12.5px] text-text-muted">
            {tudoValido
              ? 'Tudo certo! Vamos abrir o WhatsApp da loja com o seu pedido.'
              : 'Preencha os campos marcados com * para enviar.'}
          </div>
        </div>
      )}
      </DialogContent>
    </Dialog>
  )
}