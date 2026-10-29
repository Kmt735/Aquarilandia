export const WHATSAPP_NUMERO = '5532998660951' 

export function linkWhatsApp(mensagem = '') {
  const texto = encodeURIComponent(mensagem)
  return `https://wa.me/${WHATSAPP_NUMERO}${texto ? `?text=${texto}` : ''}`
}