// Celular com DDD: 11 dígitos, máscara (32) 99999-0000 (regra do backend)
export function mascararTelefone(valor) {
  const digitos = valor.replace(/\D/g, '').slice(0, 11)
  if (digitos.length > 7) return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`
  if (digitos.length > 2) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`
  if (digitos.length > 0) return `(${digitos}`
  return ''
}

export const telefoneValido = (valor) => valor.replace(/\D/g, '').length === 11
