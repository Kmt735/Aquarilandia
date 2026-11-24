import { useState } from 'react'
import Button from '../atoms/Button'
import Input from '../atoms/Input'
import Aviso from '../molecules/Aviso'
import { imagemSegura } from '../../services/catalogo-mapeamento'
import { atualizarImagemProduto } from '../../services/imagem-produto'

export default function FotoProduto({ produtoId, imagemInicial }) {
  const [arquivo, setArquivo] = useState(null), [foto, setFoto] = useState(imagemInicial)
  const [ocupado, setOcupado] = useState(false), [erro, setErro] = useState(null), [mensagem, setMensagem] = useState(null)
  async function salvar(arquivo) {
    setOcupado(true); setErro(null); setMensagem(null)
    try {
      const dados = await atualizarImagemProduto(produtoId, arquivo)
      setFoto(dados.imagemUrl); setMensagem(arquivo ? 'Foto salva.' : 'Foto removida.')
      return true
    } catch (e) { setErro(e.message); return false } finally { setOcupado(false) }
  }
  const url = imagemSegura(foto)
  return <section className="mt-8 rounded-card border border-border-strong bg-surface p-6">
    <h3 className="mb-3 text-h3">Foto do produto</h3>
    {erro && <Aviso tipo="erro" role="alert">{erro}</Aviso>}
    {mensagem && <Aviso tipo="sucesso" role="status">{mensagem}</Aviso>}
    {url && <img className="my-4 max-h-56 rounded-lg object-contain" src={url} alt="Foto atual do produto" />}
    <form className="mt-4 space-y-3" onSubmit={async (e) => {
      e.preventDefault(); if (!arquivo || ocupado) return
      const formulario = e.currentTarget
      if (await salvar(arquivo)) { setArquivo(null); formulario.reset() }
    }}>
      <label className="block">Arquivo da foto<Input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} /></label>
      <p className="text-pequeno text-text-muted">Envie JPEG, PNG ou WebP. A foto é processada e armazenada pelo servidor.</p>
      <div className="flex flex-wrap gap-3"><Button type="submit" disabled={!arquivo || ocupado}>{ocupado ? 'Atualizando…' : 'Enviar foto'}</Button>
        {url && <Button variant="secundario" disabled={ocupado} onClick={() => salvar()}>Remover foto</Button>}
      </div>
    </form>
  </section>
}
