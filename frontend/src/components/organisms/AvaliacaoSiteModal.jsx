import { CircleCheck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import Button from '../atoms/Button'
import Textarea from '../atoms/Textarea'
import Aviso from '../molecules/Aviso'
import EstrelasNota from '../molecules/EstrelasNota'
import OpcoesRapidas from '../molecules/OpcoesRapidas'
import { ENCONTROU, LIMITE_COMENTARIO, MOTIVOS_VISITA, MSG_PENDENTE } from '../../data/avaliacao-site'
import useMediaQuery from '../../hooks/useMediaQuery'
import useUI from '../../hooks/useUI'
import { enviarAvaliacao, registrarDispensa } from '../../services/avaliacoes'

// Publicada na hora (AVALIACOES_PUBLICAR_DIRETO no backend): o agradecimento de antes
const OBRIGADO_PUBLICADA = 'Obrigado! Sua opinião ajuda a melhorar a loja.'
const FECHAR_EM = 3500 // ms: tempo para ler o agradecimento antes de fechar sozinho (o botão Fechar fica disponível)

// Avaliação do SITE (não de produto). Diálogo no desktop, folha de baixo no celular.
// Radix prende o foco, Esc fecha e o foco volta para quem abriu (devolverFoco).
export default function AvaliacaoSiteModal() {
  const { fecharPaineis, devolverFoco, origemAvaliacao } = useUI()
  const largo = useMediaQuery('(min-width: 640px)')
  const { pathname } = useLocation()
  const [nota, setNota] = useState(0)
  const [motivo, setMotivo] = useState(null)
  const [encontrou, setEncontrou] = useState(null)
  const [comentario, setComentario] = useState('')
  const [fase, setFase] = useState('preenchendo') // preenchendo | enviando | enviada
  const [erro, setErro] = useState('')
  const [publicada, setPublicada] = useState(false)
  const fecharRef = useRef(null)

  // Agradecimento: foco no "Fechar" (o formulário sumiu) e fechamento automático
  useEffect(() => {
    if (fase !== 'enviada') return
    fecharRef.current?.focus()
    const t = setTimeout(fecharPaineis, FECHAR_EM)
    return () => clearTimeout(t)
  }, [fase, fecharPaineis])

  const fechar = () => {
    if (fase === 'preenchendo') registrarDispensa()
    fecharPaineis()
  }

  const enviar = async (e) => {
    e.preventDefault()
    if (!nota || fase !== 'preenchendo') return
    setFase('enviando')
    setErro('')
    try {
      const enviada = await enviarAvaliacao({ nota, motivo, encontrou, comentario, origem: origemAvaliacao, pagina: pathname })
      setPublicada(enviada?.status === 'aprovada')
      setFase('enviada')
    } catch (err) {
      setErro(err?.erro ?? 'Não foi possível enviar agora. Tente de novo em instantes.')
      setFase('preenchendo')
    }
  }

  const restantes = LIMITE_COMENTARIO - comentario.length
  const enviada = fase === 'enviada'

  const corpo = (
    <>
      {/* Região viva sempre presente: o leitor de tela anuncia o agradecimento quando ele aparece */}
      <div role="status" aria-live="polite">
        {enviada && (
          <div className="py-4 text-center">
            <CircleCheck aria-hidden="true" className="mx-auto mb-3 size-12 text-success-text" />
            <p className="font-display text-h4 font-extrabold text-foreground">{publicada ? OBRIGADO_PUBLICADA : MSG_PENDENTE}</p>
          </div>
        )}
      </div>

      {enviada ? (
        <div className="flex justify-center pb-2">
          <Button ref={fecharRef} variant="secundario" tamanho="lg" onClick={fecharPaineis}>
            Fechar
          </Button>
        </div>
      ) : (
        <form noValidate onSubmit={enviar} className="flex flex-col gap-6">
          <EstrelasNota id="av-nota" legenda="Como foi sua experiência no site?" valor={nota} onChange={setNota} />
          <OpcoesRapidas id="av-motivo" legenda="O que você veio fazer?" opcoes={MOTIVOS_VISITA} valor={motivo} onChange={setMotivo} />
          <OpcoesRapidas id="av-encontrou" legenda="Conseguiu encontrar o que procurava?" opcoes={ENCONTROU} valor={encontrou} onChange={setEncontrou} />

          <div>
            <Label htmlFor="av-comentario" className="mb-1.5 text-corpo font-bold">
              Quer contar mais alguma coisa? <span className="text-pequeno font-normal text-text-muted">(opcional)</span>
            </Label>
            <Textarea
              id="av-comentario"
              rows={3}
              maxLength={LIMITE_COMENTARIO}
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              aria-describedby="av-contador"
              placeholder="Ex.: senti falta de… / gostei de…"
            />
            <p id="av-contador" className="mt-1.5 text-right text-legenda text-text-muted tabular-nums">
              {comentario.length}/{LIMITE_COMENTARIO} caracteres
            </p>
            {/* Só avisa o leitor de tela perto do limite, para não anunciar cada tecla */}
            <p className="sr-only" aria-live="polite">
              {restantes <= 20 ? `Restam ${restantes} caracteres.` : ''}
            </p>
          </div>

          {erro && (
            <Aviso tipo="erro" role="alert">
              {erro}
            </Aviso>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Button variant="terciario" tamanho="lg" onClick={fechar}>
              Agora não
            </Button>
            <Button type="submit" tamanho="lg" disabled={!nota || fase === 'enviando'} aria-describedby={nota ? undefined : 'av-dica'}>
              {fase === 'enviando' ? 'Enviando…' : 'Enviar avaliação'}
            </Button>
          </div>
          {!nota && (
            <p id="av-dica" className="-mt-4 text-center text-legenda text-text-muted sm:text-right">
              Escolha uma nota para enviar.
            </p>
          )}
        </form>
      )}
    </>
  )

  const titulo = enviada ? 'Avaliação enviada' : 'Avalie o site'
  const descricao = enviada
    ? 'Recebemos suas respostas.'
    : 'Leva menos de 1 minuto. Não é sobre os produtos: queremos saber como foi navegar por aqui.'
  const aoMudar = (aberto) => !aberto && fechar()
  // Volta o foco a quem abriu; se foi a aba lateral e ela sumiu (já avaliou), vai para o conteúdo da página
  const aoFechar = (e) => {
    devolverFoco(e)
    if (e.defaultPrevented) return
    e.preventDefault()
    document.getElementById('conteudo')?.focus({ preventScroll: true })
  }

  if (!largo) {
    return (
      <Sheet open onOpenChange={aoMudar}>
        <SheetContent
          side="bottom"
          onCloseAutoFocus={aoFechar}
          className="max-h-[92dvh] gap-0 overflow-y-auto rounded-t-[20px] border-border-strong bg-surface-elevated px-4 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        >
          <SheetHeader className="mb-4 px-0 pr-12">
            <SheetTitle className="font-display text-h3 font-extrabold">{titulo}</SheetTitle>
            <SheetDescription className="text-pequeno text-text-muted">{descricao}</SheetDescription>
          </SheetHeader>
          {corpo}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open onOpenChange={aoMudar}>
      <DialogContent onCloseAutoFocus={aoFechar} className="max-h-[92vh] overflow-auto rounded-[20px] border-border-strong bg-surface-elevated p-6 sm:max-w-[540px]">
        <DialogHeader className="mb-1 pr-10 text-left">
          <DialogTitle className="font-display text-h3 font-extrabold">{titulo}</DialogTitle>
          <DialogDescription className="text-pequeno text-text-muted">{descricao}</DialogDescription>
        </DialogHeader>
        {corpo}
      </DialogContent>
    </Dialog>
  )
}
