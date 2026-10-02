export function mascararTelefone(valor) {
  const digitos = valor.replace(/\D/g, '').slice(0, 11)
  if (digitos.length > 7) {
    const corte = digitos.length === 11 ? 7 : 6
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, corte)}-${digitos.slice(corte)}`
  }
  if (digitos.length > 2) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`
  return digitos
}

export function telefoneValido(valor) {
  const total = valor.replace(/\D/g, '').length
  return total === 10 || total === 11
}
