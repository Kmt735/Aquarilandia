export const textoEndereco = (e) =>
  `${e.logradouro}, ${e.numero}${e.complemento ? ` · ${e.complemento}` : ''} · ${e.bairro} · ${e.cidade}/${e.uf} · CEP ${e.cep}`
