// Formato de erro da API: { erro, detalhes } — `detalhes` traz uma mensagem por campo.
export class ErroApi extends Error {
  constructor(erro, detalhes = {}, status = 400) {
    super(erro)
    this.erro = erro
    this.detalhes = detalhes
    this.status = status
  }
}

// Atraso de rede simulado, para os estados de carregamento (skeletons) aparecerem no protótipo.
// Ao ligar a API, cada service troca `simularRede()` por fetch('/api/...').
export const simularRede = (ms = 350) => new Promise((resolve) => setTimeout(resolve, ms))

export function lerSessao(chave, padrao) {
  try {
    const bruto = sessionStorage.getItem(chave)
    return bruto ? JSON.parse(bruto) : padrao
  } catch {
    return padrao
  }
}

export function gravarSessao(chave, valor) {
  try {
    sessionStorage.setItem(chave, JSON.stringify(valor))
  } catch {
    // armazenamento bloqueado: vale só enquanto a página estiver aberta
  }
}
