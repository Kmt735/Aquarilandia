import { BellRing } from 'lucide-react'
import { useState } from 'react'
import Button from '../atoms/Button'
import Input from '../atoms/Input'
import FormField from '../molecules/FormField'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import useAuth from '../../hooks/useAuth'
import useFormulario from '../../hooks/useFormulario'
import useUI from '../../hooks/useUI'
import { aviseMe } from '../../services/catalogo'
import { regras } from '../../utils/validacao'

const REGRAS = { email: regras.email }

// "Avise-me quando chegar" para itens esgotados (item 9)
export default function AviseMeModal() {
  const { fecharPaineis, itemAviseMe: item, devolverFoco } = useUI()
  const { usuario } = useAuth()
  const [pronto, setPronto] = useState(false)
  const { campo, enviar, enviando, erros, formRef, valores } = useFormulario({ email: usuario?.email ?? '' }, REGRAS)

  if (!item) return null

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && fecharPaineis()}>
      <DialogContent onCloseAutoFocus={devolverFoco} className="rounded-[20px] border-border-strong bg-surface-elevated p-6 sm:max-w-[440px]">
        <DialogHeader className="pr-10 text-left">
          <DialogTitle className="font-display text-h3 font-extrabold">Avise-me quando chegar</DialogTitle>
          <DialogDescription className="text-pequeno text-text-muted">
            {item.nome} está esgotado. Deixe seu e-mail e avisamos quando voltar.
          </DialogDescription>
        </DialogHeader>
        {pronto ? (
          <div role="status" className="text-center">
            <BellRing aria-hidden="true" className="mx-auto mb-3 size-10 text-success-text" />
            <p className="mb-5 text-corpo">
              Pronto! Vamos avisar em <strong>{valores.email}</strong> quando {item.nome} chegar.
            </p>
            <Button onClick={fecharPaineis}>Fechar</Button>
          </div>
        ) : (
          <form ref={formRef} noValidate onSubmit={enviar(async (d) => {
            await aviseMe({ itemId: item.id, email: d.email })
            setPronto(true)
          })}>
            <FormField id="aviso-email" label="E-mail" obrigatorio erro={erros.email}>
              <Input type="email" autoComplete="email" placeholder="nome@email.com" {...campo('email')} />
            </FormField>
            <Button type="submit" largo disabled={enviando}>
              {enviando ? 'Enviando…' : 'Quero ser avisado'}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
