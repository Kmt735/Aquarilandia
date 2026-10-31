import { useCallback, useRef, useState } from 'react'
import { validar } from '../utils/validacao'

// Estado de formulário com erro por campo (mesmo formato de `detalhes` da API).
// Ao enviar com erro, o foco vai para o primeiro campo inválido (item 9).
export default function useFormulario(inicial, regrasCampos) {
  const [valores, setValores] = useState(inicial)
  const [erros, setErros] = useState({})
  const [enviando, setEnviando] = useState(false)
  const [erroGeral, setErroGeral] = useState(null)
  const formRef = useRef(null)

  const focarPrimeiroErro = (lista) => {
    const primeiro = Object.keys(regrasCampos).find((c) => lista[c]) ?? Object.keys(lista)[0]
    if (!primeiro) return
    requestAnimationFrame(() => formRef.current?.querySelector(`[name="${primeiro}"]`)?.focus())
  }

  const alterar = useCallback(
    (campo, valor) => {
      setValores((v) => ({ ...v, [campo]: valor }))
      // Depois de errar, o erro some assim que o campo fica certo
      setErros((e) => {
        if (!e[campo]) return e
        const msg = regrasCampos[campo]?.(valor, { ...valores, [campo]: valor })
        const novo = { ...e }
        if (msg) novo[campo] = msg
        else delete novo[campo]
        return novo
      })
    },
    [regrasCampos, valores],
  )

  const validarCampo = useCallback(
    (campo) => {
      const msg = regrasCampos[campo]?.(valores[campo], valores)
      setErros((e) => {
        const novo = { ...e }
        if (msg) novo[campo] = msg
        else delete novo[campo]
        return novo
      })
    },
    [regrasCampos, valores],
  )

  // enviar(acao): valida tudo; se ok, chama a ação; erros da API ({ erro, detalhes }) vão para os campos
  const enviar = (acao) => async (e) => {
    e?.preventDefault()
    setErroGeral(null)
    const lista = validar(valores, regrasCampos)
    setErros(lista)
    if (Object.keys(lista).length) {
      focarPrimeiroErro(lista)
      return
    }
    setEnviando(true)
    try {
      await acao(valores)
    } catch (erro) {
      if (erro?.detalhes && Object.keys(erro.detalhes).length) {
        setErros(erro.detalhes)
        focarPrimeiroErro(erro.detalhes)
      }
      setErroGeral(erro?.erro ?? 'Não foi possível concluir agora. Confira sua conexão e tente de novo.')
    } finally {
      setEnviando(false)
    }
  }

  // Liga um campo ao estado: <Input {...campo('email')} />
  const campo = (nome) => ({
    name: nome,
    value: valores[nome],
    erro: erros[nome],
    onChange: (e) => alterar(nome, e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e),
    onBlur: () => valores[nome] !== inicial[nome] && validarCampo(nome),
  })

  return { valores, erros, enviando, erroGeral, alterar, enviar, campo, formRef, setValores }
}
