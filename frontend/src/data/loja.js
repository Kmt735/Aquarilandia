// Informações institucionais usadas no rodapé, na seção de confiança e nas políticas.
// Onde falta dado real, o texto diz "a definir com a loja" (nada inventado).
import { politicasComerciais } from './politicas'

export const A_DEFINIR = 'a definir com a loja'

export const unidades = [
  {
    id: 'centro',
    unidade: 'Centro',
    linhas: ['Rua Antônio Rocha, 27', 'Centro · São João del Rei/MG'],
    horario: null,
    mapaUrl:
      'https://www.google.com/maps/place/Aquaril%C3%A2ndia/@-21.1324225,-44.2587924,17z/data=!3m1!4b1!4m6!3m5!1s0xa1c88596df8fb1:0xe9529c471598d2b3!8m2!3d-21.1324225!4d-44.2562175!16s%2Fg%2F1th600p_?entry=ttu&g_ep=EgoyMDI2MTAxMy4wIKXMDSoASAFQAw%3D%3D',
  },
  {
    id: 'matosinhos',
    unidade: 'Matosinhos',
    linhas: ['Avenida Josué de Queiroz, 115', 'São João del Rei/MG'],
    horario: null,
    mapaUrl:
      'https://www.google.com/maps/place/Aquaril%C3%A2ndia+Matosinhos+Aquarismo/@-21.1279278,-44.2426833,17z/data=!3m1!4b1!4m6!3m5!1s0xa1c7758e94b9b9:0x33cd0a02d79b42e!8m2!3d-21.1279278!4d-44.2401084!16s%2Fg%2F11vc2rs2x9?entry=ttu&g_ep=EgoyMDI2MTAxMy4wIKXMDSoASAFQAw%3D%3D',
  },
]

export const redes = [
  { nome: 'Instagram', url: 'https://www.instagram.com/aquarilandia/' },
  { nome: 'Facebook', url: 'https://www.facebook.com/aquarilandiasjdr/?locale=pt_BR' },
]

export const formasPagamento = ['PIX']
export const AVISO_PAGAMENTO =
  'O pagamento é feito por Pix no próprio site, com QR code e copia e cola gerados pela AbacatePay. A compra é confirmada após a confirmação do pagamento.'

export const politicas = {
  ...politicasComerciais,
  privacidade: {
    titulo: 'Política de privacidade',
    provisoria: true,
    secoes: [{ titulo: 'Texto em produção', texto: 'Texto da política de privacidade: a definir com a loja.' }],
  },
  termos: {
    titulo: 'Termos de uso',
    provisoria: true,
    secoes: [{ titulo: 'Texto em produção', texto: 'Texto dos termos de uso: a definir com a loja.' }],
      acessibilidade: {
    titulo: 'Acessibilidade',
    provisoria: false,
    secoes: [
      {
        titulo: 'Libras no site',
        texto:
          'O site usa o VLibras, o tradutor de português para Libras do governo federal. Clique no ícone do VLibras que aparece na tela, espere o avatar abrir e depois clique ou selecione o texto que você quer ver em Libras. A tradução é automática e pode ter imperfeições. Se algo não ficar claro, fale com a gente.',
      },
      {
        titulo: 'Atendimento sem precisar de voz',
        texto:
          'Você não precisa ligar nem falar para comprar ou pedir um orçamento. Tudo pode ser feito pelo site e pelo WhatsApp, por texto.',
      },
      {
        titulo: 'Uso pelo teclado',
        texto:
          'Use a tecla Tab para andar pela página. O link "Pular para o conteúdo" aparece no começo de cada página. A tecla / abre a busca e a tecla Esc fecha janelas e painéis.',
      },
      {
        titulo: 'Encontrou um problema?',
        texto:
          'Se alguma parte do site for difícil de usar para você, conte pelo WhatsApp (por texto). Vamos corrigir o quanto antes.',
      },
    ],
  },
  },
}


// Página "Perguntas frequentes" (item 10): entrega, trocas e pagamento
export const perguntasLoja = [
  {
    grupo: 'Entrega',
    pergunta: 'Vocês entregam em todo o Brasil?',
    resposta: 'Produtos, sim: entregamos para todo o Brasil. Peixes vivos, só em São João del Rei. Fora daqui, você pode retirar os peixes na loja.',
  },
  {
    grupo: 'Entrega',
    pergunta: 'Posso retirar na loja?',
    resposta: 'A retirada é gratuita nas unidades Centro e Matosinhos e depende da confirmação de disponibilidade do pedido na unidade escolhida. Clientes de qualquer cidade podem retirar, inclusive pedidos com peixes.',
  },
  { grupo: 'Entrega', pergunta: 'Qual o prazo e o valor do frete?', resposta: 'O frete aparece no carrinho depois que você informa o CEP. Valores e prazos: a definir com a loja.', pendente: true },
  { grupo: 'Pagamento', pergunta: 'Quais as formas de pagamento?', resposta: 'Pix, com QR code e copia e cola na página da compra.' },
  {
    grupo: 'Pagamento',
    pergunta: 'Paguei. Como sei que deu certo?',
    resposta: 'Depois do pagamento você volta para o site e vê a confirmação. O status da compra também aparece em Minha conta › Minhas compras.',
  },
  { grupo: 'Trocas e cancelamento', pergunta: 'Posso cancelar a compra?', resposta: 'Pode, pelo site, até antes do envio: em Minha conta › Minhas compras, abra a compra e toque em "Cancelar compra".' },
  { grupo: 'Trocas e cancelamento', pergunta: 'Como faço uma troca ou devolução?', resposta: 'Solicite pelos canais oficiais de atendimento, informando o pedido e o motivo. Em compras pela internet, o prazo de arrependimento é de até 7 dias corridos do recebimento. Produtos com defeito, avarias e ocorrências com peixes são atendidos conforme a política de trocas e devoluções, preservando os direitos do consumidor.' },
]
