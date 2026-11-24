import LogisticaProduto from '../../components/organisms/LogisticaProduto'
import FotoProduto from '../../components/organisms/FotoProduto'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import Button from '../../components/atoms/Button'
import Checkbox from '../../components/atoms/Checkbox'
import Input from '../../components/atoms/Input'
import Skeleton from '../../components/atoms/Skeleton'
import Textarea from '../../components/atoms/Textarea'
import Aviso from '../../components/molecules/Aviso'
import CampoOpcoes from '../../components/molecules/CampoOpcoes'
import ErroCompacto from '../../components/molecules/ErroCompacto'
import FormField from '../../components/molecules/FormField'
import { FICHAS, montarFicha, nomeCampo, preencherFicha, regrasFicha, valoresIniciaisFicha } from '../../data/fichas-admin'
import useConsulta from '../../hooks/useConsulta'
import useFormulario from '../../hooks/useFormulario'
import useTituloPagina from '../../hooks/useTituloPagina'
import useToast from '../../hooks/useToast'
import { criarItem, editarItem, obterItemAdmin } from '../../services/admin'
import { listarCategorias } from '../../services/catalogo'
import { atualizarImagemProduto } from '../../services/imagem-produto'
import { ROTAS } from '../../utils/rotas'
import { regras } from '../../utils/validacao'

const precoParaCentavos = (v) => Math.round(Number(String(v).trim().replace(',', '.')) * 100)
const regraPreco = (v) =>
  /^\d{1,8}([.,]\d{1,2})?$/.test(String(v).trim()) && precoParaCentavos(v) >= 0 && precoParaCentavos(v) <= 2147483647 ? null : 'Digite o preço em reais. Exemplo: 29,90.'

export default function AdminItemFormPage() {
  const { id } = useParams()
  const editando = Boolean(id)
  useTituloPagina(editando ? 'Editar item' : 'Novo item')
  const categorias = useConsulta(listarCategorias, [])
  const item = useConsulta(() => (editando ? obterItemAdmin(id) : Promise.resolve(null)), [id])

  if (categorias.carregando || item.carregando) {
    return (
      <div aria-busy="true" className="mx-auto grid max-w-[720px] gap-3">
        <span className="sr-only">Carregando…</span>
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
        <Skeleton className="h-40" />
      </div>
    )
  }
  const erro = categorias.erro ?? item.erro
  if (erro) {
    return (
      <ErroCompacto
        onTentar={() => {
          categorias.recarregar()
          item.recarregar()
        }}
      >
        {erro.message}
      </ErroCompacto>
    )
  }
  if (item.dados && item.dados.ativo === false) {
    return (
      <Aviso
        tipo="aviso"
        titulo="Este item está fora da loja"
        acao={
          <Button variant="secundario" tamanho="sm" asChild>
            <Link to={ROTAS.adminProdutos}>Voltar para a lista</Link>
          </Button>
        }
      >
        Coloque o item de volta na loja (botão “Colocar na loja”) para poder editar.
      </Aviso>
    )
  }
  return <FormularioItem key={id ?? 'novo'} item={item.dados} categorias={categorias.dados} />
}

function FormularioItem({ item, categorias }) {
  const { toast } = useToast()
  const navigate = useNavigate()
  const editando = Boolean(item)
  const [categoriaId, setCategoriaId] = useState(item ? String(item.categoriaId) : '')
  const [erroCategoria, setErroCategoria] = useState(null)
  const [arquivoFoto, setArquivoFoto] = useState(null)
  const categoria = categorias.find((c) => c.id === Number(categoriaId))
  const slug = categoria?.slug
  const fichaCampos = FICHAS[slug] ?? []

  const [inicial] = useState(() => ({
    nome: item?.nome ?? '',
    marca: item?.marca ?? '',
    descricao: item?.descricao ?? '',
    preco: item ? (item.preco / 100).toFixed(2).replace('.', ',') : '',
    ...valoresIniciaisFicha(),
    ...(item ? preencherFicha(item.categoria, item.ficha?.dados) : {}),
  }))

  const regrasCampos = { nome: regras.obrigatorio, preco: regraPreco, ...regrasFicha(slug) }
  const { campo, erros, enviar, enviando, erroGeral, formRef } = useFormulario(inicial, regrasCampos)

  // Erros do servidor para campos que não existem na tela são mostrados em lista
  const visiveis = new Set(['nome', 'marca', 'descricao', 'preco', ...fichaCampos.map((c) => nomeCampo(slug, c.nome))])
  const outrosErros = Object.entries(erros).filter(([nome]) => !visiveis.has(nome))

  const salvar = enviar(async (v) => {
    if (!categoria) {
      setErroCategoria('Escolha a categoria do item.')
      return
    }
    const dados = {
      nome: v.nome.trim(),
      descricao: v.descricao.trim() || null,
      marca: v.marca.trim() || null,
      preco: precoParaCentavos(v.preco),
      ficha: montarFicha(slug, v),
    }
    try {
      if (editando) {
        const { ficha, ...basicos } = dados
        await editarItem(item.id, { ...basicos, ...(ficha && { ficha: { dados: ficha.dados } }) })
        toast(`“${dados.nome}” foi atualizado.`, { tipo: 'sucesso' })
      } else {
        const criado = await criarItem({ ...dados, categoriaId: categoria.id })
        if (arquivoFoto) {
          try {
            await atualizarImagemProduto(criado.id, arquivoFoto)
          } catch {
            toast('Produto cadastrado, mas não foi possível enviar a foto. Selecione a imagem novamente na edição.', { tipo: 'erro' })
            navigate(`${ROTAS.adminProdutos}/${criado.id}/editar`)
            return
          }
        }
        toast(`“${dados.nome}” foi cadastrado.`, { tipo: 'sucesso' })
      }
      navigate(ROTAS.adminProdutos)
    } catch (erro) {
      if (erro.detalhes) {
        if (erro.detalhes.categoriaId) setErroCategoria(erro.detalhes.categoriaId)
        erro.detalhes = Object.fromEntries(Object.entries(erro.detalhes).map(([chave, mensagem]) => [
          chave.startsWith('ficha.dados.') ? nomeCampo(slug, chave.slice('ficha.dados.'.length)) : chave, mensagem,
        ]))
      }
      throw erro
    }
  })

  return (
    <div className="mx-auto max-w-[720px]">
      <Link
        to={ROTAS.adminProdutos}
        className="alvo-toque mb-6 inline-flex items-center gap-2 text-pequeno font-semibold text-primary-text underline underline-offset-4"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Voltar para a lista
      </Link>
      <h2 className="mb-6 text-h3">{editando ? `Editar: ${item.nome}` : 'Novo item'}</h2>

      <form ref={formRef} noValidate onSubmit={salvar} className="rounded-card border border-border-strong bg-surface p-6 desk:p-8">
        {erroGeral && (
          <Aviso tipo="erro" role="alert" className="mb-4">
            {erroGeral}
            {outrosErros.length > 0 && (
              <ul className="mt-1 list-disc pl-5">
                {outrosErros.map(([nome, mensagem]) => (
                  <li key={nome}>
                    {nome}: {mensagem}
                  </li>
                ))}
              </ul>
            )}
          </Aviso>
        )}

        {editando ? (
          <div className="mb-4">
            <p className="mb-1.5 text-pequeno font-semibold">Categoria</p>
            <p className="text-corpo">{categoria?.nome ?? item.categoria}</p>
          </div>
        ) : (
          <FormField id="item-categoria" label="Categoria" obrigatorio erro={erroCategoria} ajuda="Escolha “Peixes” para cadastrar um peixe.">
            <CampoOpcoes
              name="categoria"
              placeholder="Escolha a categoria"
              opcoes={categorias.map((c) => [String(c.id), c.nome])}
              value={categoriaId}
              onChange={(e) => {
                setCategoriaId(e.target.value)
                setErroCategoria(null)
              }}
            />
          </FormField>
        )}

        <FormField id="item-nome" label="Nome" obrigatorio erro={erros.nome}>
          <Input autoComplete="off" {...campo('nome')} />
        </FormField>

        <div className="grid gap-x-4 sm:grid-cols-2">
          <FormField id="item-preco" label="Preço (R$)" obrigatorio erro={erros.preco} ajuda="Em reais, com vírgula. Exemplo: 29,90.">
            <Input inputMode="decimal" placeholder="29,90" {...campo('preco')} />
          </FormField>
          <FormField id="item-marca" label="Marca" erro={erros.marca}>
            <Input autoComplete="off" {...campo('marca')} />
          </FormField>
        </div>

        <FormField id="item-descricao" label="Descrição" erro={erros.descricao}>
          <Textarea rows={3} {...campo('descricao')} />
        </FormField>

        {!editando && <FormField id="item-foto" label="Arquivo da foto" ajuda="Opcional. Escolha uma imagem JPEG, PNG ou WebP do seu computador.">
          <Input type="file" accept="image/jpeg,image/png,image/webp" disabled={enviando}
            onChange={(e) => setArquivoFoto(e.target.files?.[0] ?? null)} />
        </FormField>}

        {fichaCampos.length > 0 && (
          <fieldset className="mt-6 border-t border-border pt-6">
            <legend className="mb-4 font-display text-h4 font-extrabold">Ficha técnica</legend>
            <div className="grid gap-x-4 sm:grid-cols-2">
              {fichaCampos.map((spec) => (
                <CampoFicha key={spec.nome} slug={slug} spec={spec} campo={campo} erros={erros} />
              ))}
            </div>
          </fieldset>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <Button type="submit" tamanho="lg" disabled={enviando}>
            {enviando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Cadastrar item'}
          </Button>
          <Button variant="terciario" tamanho="lg" asChild>
            <Link to={ROTAS.adminProdutos}>Cancelar</Link>
          </Button>
        </div>
      </form>
      {editando ? <><FotoProduto produtoId={item.id} imagemInicial={item.imagemUrl} /><LogisticaProduto produtoId={item.id} /></> : <p className="mt-4 text-pequeno text-text-muted">Após cadastrar o produto, abra a edição para informar embalagem e condições de envio.</p>}
    </div>
  )
}

function CampoFicha({ slug, spec, campo, erros }) {
  const nome = nomeCampo(slug, spec.nome)
  const id = `ficha-${nome}`

  if (spec.tipo === 'sim-nao') {
    const { name, value, onChange } = campo(nome)
    return (
      <div className="sm:col-span-2">
        <Checkbox id={id} name={name} checked={value} onChange={onChange}>
          {spec.rotulo}
        </Checkbox>
      </div>
    )
  }
  return (
    <FormField id={id} label={spec.rotulo} obrigatorio={spec.obrigatorio} erro={erros[nome]}>
      {spec.tipo === 'opcoes' ? (
        <CampoOpcoes opcoes={spec.opcoes} placeholder="Selecione…" {...campo(nome)} />
      ) : (
        <Input inputMode={spec.tipo === 'numero' ? 'decimal' : undefined} {...campo(nome)} />
      )}
    </FormField>
  )
}
