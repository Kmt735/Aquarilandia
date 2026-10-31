import { CircleCheck } from 'lucide-react'
import { useState } from 'react'
import Button from '../atoms/Button'
import Input from '../atoms/Input'
import Select from '../atoms/Select'
import Textarea from '../atoms/Textarea'
import WhatsAppIcon from '../icons/WhatsAppIcon'
import Aviso from '../molecules/Aviso'
import FormField from '../molecules/FormField'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { opcoesServico } from '../../data/servicos'
import useFormulario from '../../hooks/useFormulario'
import useUI from '../../hooks/useUI'
import useWhatsApp from '../../hooks/useWhatsApp'
import { enviarOrcamento } from '../../services/orcamentos'
import { mascararTelefone } from '../../utils/telefone'
import { regras } from '../../utils/validacao'

const REGRAS = { nome: regras.nome, telefone: regras.telefone, servico: regras.servico }

// Formulário de orçamento: erro embaixo de cada campo, foco no primeiro erro e confirmação clara (item 9)
export default function QuoteModal() {
  const { fecharPaineis, servicoOrcamento, devolverFoco } = useUI()
  const abrirWhatsApp = useWhatsApp()
  const [enviado, setEnviado] = useState(false)
  const form = useFormulario(
    { nome: '', telefone: '', servico: opcoesServico.includes(servicoOrcamento) ? servicoOrcamento : '', mensagem: '' },
    REGRAS,
  )
  const { valores, campo, enviar, enviando, erroGeral, alterar, formRef } = form

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && fecharPaineis()}>
      <DialogContent onCloseAutoFocus={devolverFoco} className="max-h-[92vh] overflow-auto rounded-[20px] border-border-strong bg-surface-elevated p-6 sm:max-w-[500px]">
        <DialogHeader className="mb-1 pr-10 text-left">
          <DialogTitle className="font-display text-h3 font-extrabold">{enviado ? 'Pedido enviado' : 'Solicitar orçamento'}</DialogTitle>
          <DialogDescription className="text-pequeno text-text-muted">
            {enviado ? 'A loja vai responder pelo WhatsApp informado.' : 'Valor sob orçamento. Conte o que precisa e a loja responde pelo seu WhatsApp.'}
          </DialogDescription>
        </DialogHeader>

        {enviado ? (
          <div className="pt-2 text-center" role="status">
            <CircleCheck aria-hidden="true" className="mx-auto mb-3 size-12 text-success-text" />
            <p className="mb-1 font-display text-h4 font-extrabold">Recebemos seu pedido, {valores.nome.trim().split(' ')[0]}!</p>
            <p className="mb-6 text-corpo text-text-muted">
              Orçamento de <strong className="text-foreground">{valores.servico.toLowerCase()}</strong>. A resposta chega no WhatsApp {valores.telefone}. Prazo de resposta: a definir com a loja.
            </p>
            <Button onClick={fecharPaineis}>Fechar</Button>
          </div>
        ) : (
          <form ref={formRef} noValidate onSubmit={enviar(async (dados) => {
            await enviarOrcamento(dados)
            setEnviado(true)
          })}>
            <p className="mb-4 text-legenda text-text-muted">
              Campos com <span className="text-danger-text">*</span> são obrigatórios.
            </p>
            {erroGeral && (
              <Aviso tipo="erro" role="alert" className="mb-4">
                {erroGeral}
              </Aviso>
            )}
            <FormField id="q-nome" label="Seu nome" obrigatorio erro={form.erros.nome}>
              <Input autoComplete="name" placeholder="Como podemos te chamar?" {...campo('nome')} />
            </FormField>
            <FormField id="q-tel" label="Celular com WhatsApp" obrigatorio erro={form.erros.telefone} ajuda="Com DDD. Exemplo: (32) 99999-0000.">
              <Input
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="(32) 99999-0000"
                {...campo('telefone')}
                onChange={(e) => alterar('telefone', mascararTelefone(e.target.value))}
              />
            </FormField>
            <FormField id="q-serv" label="Serviço" obrigatorio erro={form.erros.servico}>
              <Select opcoes={opcoesServico} {...campo('servico')} />
            </FormField>
            <FormField id="q-msg" label="Conte um pouco do que precisa">
              <Textarea rows={3} placeholder="Ex.: aquário de 100 L para a sala, com plantas" {...campo('mensagem')} />
            </FormField>
            <Button type="submit" tamanho="lg" largo disabled={enviando}>
              {enviando ? 'Enviando…' : 'Enviar pedido de orçamento'}
            </Button>
            <p className="mt-3 text-center text-legenda text-text-muted">
              Prefere conversar agora?{' '}
              <button type="button" onClick={() => abrirWhatsApp('um orçamento')} className="alvo-toque inline-flex items-center gap-1 font-bold text-primary-text underline underline-offset-4">
                <WhatsAppIcon className="size-3.5" />
                Fale no WhatsApp
              </button>
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
