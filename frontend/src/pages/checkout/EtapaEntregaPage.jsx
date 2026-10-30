import { ArrowLeft, ArrowRight, Store, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import Button from '../../components/atoms/Button'
import Skeleton from '../../components/atoms/Skeleton'
import Aviso from '../../components/molecules/Aviso'
import AvisoEntregaPeixe from '../../components/molecules/AvisoEntregaPeixe'
import FormEndereco from '../../components/organisms/FormEndereco'
import ResumoPedido from '../../components/organisms/ResumoPedido'
import useAuth from '../../hooks/useAuth'
import useCart from '../../hooks/useCart'
import useCheckout from '../../hooks/useCheckout'
import useConsulta from '../../hooks/useConsulta'
import useTituloPagina from '../../hooks/useTituloPagina'
import { listarEnderecos, salvarEndereco } from '../../services/conta'
import { calcularFrete } from '../../services/frete'
import { textoEndereco } from '../../utils/endereco'
import { formatarPreco } from '../../utils/format'
import { ROTAS, urlEtapaCheckout } from '../../utils/rotas'

// Etapa 2 · endereço salvo, endereço novo ou retirada na loja.
// Com peixe no carrinho e CEP fora de São João del Rei, explica e oferece a retirada (item 18).
export default function EtapaEntregaPage() {
  useTituloPagina('Entrega · Finalizar compra')
  const { usuario } = useAuth()
  const { linhas, temPeixe } = useCart()
  const { rascunho, salvar } = useCheckout()
  const navigate = useNavigate()
  const { dados: salvos, carregando } = useConsulta(() => (usuario ? listarEnderecos() : Promise.resolve([])), [usuario])
  const [enderecos, setEnderecos] = useState(null)
  const lista = enderecos ?? salvos ?? []
  const escolha = rascunho.entrega?.escolha ?? (lista.find((e) => e.principal)?.id || null)
  const [erroEscolha, setErroEscolha] = useState(null)
  const enderecoEscolhido = lista.find((e) => e.id === escolha)

  // Recalcula o frete sempre que o endereço escolhido muda
  const { dados: freteResultado, carregando: freteCarregando } = useConsulta(
    () => (enderecoEscolhido ? calcularFrete(enderecoEscolhido.cep, linhas) : Promise.resolve(null)),
    [enderecoEscolhido?.id, enderecoEscolhido?.cep, linhas.map((l) => l.id).join()],
  )
  const frete = { carregando: Boolean(enderecoEscolhido) && freteCarregando, resultado: freteResultado }

  if (!usuario) {
    return (
      <div className="mx-auto max-w-[560px] rounded-card border border-border-strong bg-surface p-6 text-center">
        <UserRound aria-hidden="true" className="mx-auto mb-3 size-10 text-primary-text" />
        <h2 className="text-h3">Entre para continuar</h2>
        <p className="mt-2 text-corpo text-text-muted">Para entregar e acompanhar sua compra, precisamos da sua conta. Seu carrinho fica guardado.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Button asChild tamanho="lg">
            <Link to={`${ROTAS.entrar}?voltar=${encodeURIComponent(urlEtapaCheckout('entrega'))}`}>Entrar</Link>
          </Button>
          <Button asChild tamanho="lg" variant="secundario">
            <Link to={`${ROTAS.criarConta}?voltar=${encodeURIComponent(urlEtapaCheckout('entrega'))}`}>Criar conta</Link>
          </Button>
        </div>
      </div>
    )
  }

  const opcaoEntrega = frete.resultado?.opcoes.find((o) => o.id === 'endereco')
  const entregaBloqueada = escolha && escolha !== 'retirada' && escolha !== 'novo' && opcaoEntrega && !opcaoEntrega.disponivel
  const valorFrete = escolha === 'retirada' ? 0 : opcaoEntrega?.disponivel ? opcaoEntrega.valor : undefined

  const escolher = (valor) => {
    setErroEscolha(null)
    salvar({ entrega: { escolha: valor } })
  }

  const continuar = () => {
    if (!escolha || escolha === 'novo') return setErroEscolha('Escolha um endereço ou a retirada na loja.')
    if (entregaBloqueada) return setErroEscolha(opcaoEntrega.motivo)
    const entrega =
      escolha === 'retirada'
        ? { tipo: 'retirada', escolha, resumo: 'Retirada na loja (unidade e horário a combinar com a loja)', frete: 0 }
        : { tipo: 'endereco', escolha, resumo: textoEndereco(enderecoEscolhido), frete: opcaoEntrega?.valor ?? null, prazo: opcaoEntrega?.prazo ?? null }
    salvar({ entrega })
    navigate(urlEtapaCheckout('pagamento'))
  }

  const opcao = (valor, conteudo) => (
    <label
      className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-card border p-4 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary-text ${escolha === valor ? 'border-primary-text bg-primary-soft/50 shadow-glow' : 'border-border-strong bg-surface hover:border-primary-text/50'}`}
    >
      <input type="radio" name="entrega" value={valor} checked={escolha === valor} onChange={() => escolher(valor)} className="mt-1 size-5 shrink-0 accent-primary" />
      <span className="min-w-0 flex-1">{conteudo}</span>
    </label>
  )

  const itens = linhas.map((l) => ({ id: l.id, nome: l.item.nome, preco: l.item.preco, qtd: l.qtd }))

  return (
    <div className="grid items-start gap-8 desk:grid-cols-[1fr_360px]">
      <section aria-labelledby="titulo-etapa">
        <h2 id="titulo-etapa" className="mb-4 text-h2">
          Como você quer receber?
        </h2>
        {temPeixe && <AvisoEntregaPeixe className="mb-4" />}

        <fieldset aria-describedby={erroEscolha ? 'erro-entrega' : undefined}>
          <legend className="sr-only">Forma de entrega</legend>
          {carregando ? (
            <Skeleton className="h-24 rounded-card" />
          ) : (
            <div className="flex flex-col gap-3">
              {lista.map((e) => (
                <div key={e.id}>
                  {opcao(
                    e.id,
                    <>
                      <span className="block font-bold">
                        {e.apelido || 'Endereço'} {e.principal && <span className="text-legenda font-semibold text-info-text">· principal</span>}
                      </span>
                      <span className="block text-pequeno text-text-muted">{textoEndereco(e)}</span>
                      {escolha === e.id && (
                        <span aria-live="polite" className="mt-2 block text-pequeno">
                          {frete.carregando && 'Calculando frete…'}
                          {opcaoEntrega && opcaoEntrega.disponivel && (
                            <>
                              Frete: <strong>{opcaoEntrega.valor == null ? 'a definir com a loja' : formatarPreco(opcaoEntrega.valor)}</strong>
                              {opcaoEntrega.prazo && ` · prazo ${opcaoEntrega.prazo}`} <span className="text-legenda text-text-muted">(valores provisórios de exemplo)</span>
                            </>
                          )}
                          {opcaoEntrega && !opcaoEntrega.disponivel && <span className="font-semibold text-danger-text">{opcaoEntrega.motivo}</span>}
                        </span>
                      )}
                    </>,
                  )}
                </div>
              ))}
              {opcao(
                'retirada',
                <>
                  <span className="flex items-center gap-2 font-bold">
                    <Store aria-hidden="true" className="size-4 text-primary-text" />
                    Retirar na loja · grátis
                  </span>
                  <span className="block text-pequeno text-text-muted">Unidade e horário de retirada: a combinar com a loja. Vale para peixes e produtos.</span>
                </>,
              )}
              {opcao('novo', <span className="font-bold">Entregar em um endereço novo</span>)}
            </div>
          )}
        </fieldset>

        {escolha === 'novo' && (
          <div className="mt-4">
            <FormEndereco
              prefixo="novo"
              rotuloSalvar="Salvar e usar este endereço"
              onSalvar={async (valores) => {
                const nova = await salvarEndereco(valores)
                setEnderecos(nova)
                escolher(nova[nova.length - 1].id)
              }}
            />
          </div>
        )}

        {erroEscolha && (
          <Aviso id="erro-entrega" tipo="erro" role="alert" className="mt-4">
            {erroEscolha}
            {entregaBloqueada && (
              <button type="button" onClick={() => escolher('retirada')} className="alvo-toque ml-1 font-bold text-primary-text underline underline-offset-4">
                Escolher retirada na loja
              </button>
            )}
          </Aviso>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <Button variant="secundario" tamanho="lg" onClick={() => navigate(urlEtapaCheckout('carrinho'))}>
            <ArrowLeft aria-hidden="true" />
            Voltar
          </Button>
        </div>
      </section>

      <ResumoPedido itens={itens} frete={valorFrete}>
        <Button tamanho="lg" largo className="mt-5" onClick={continuar}>
          Continuar para o pagamento
          <ArrowRight aria-hidden="true" />
        </Button>
      </ResumoPedido>
    </div>
  )
}
