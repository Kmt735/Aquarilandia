export function mascararCep(valor) {
  const digitos = valor.replace(/\D/g, '').slice(0, 8)
  return digitos.length > 5 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : digitos
}

export const cepValido = (valor) => valor.replace(/\D/g, '').length === 8
