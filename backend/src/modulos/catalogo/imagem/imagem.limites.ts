export const limitesImagem = {
  bytes: 5 * 1024 * 1024,
  requisicaoBytes: 5 * 1024 * 1024 + 64 * 1024,
  dimensao: 4096,
  pixels: 12_000_000,
  processamentoSegundos: 5,
  recebimentoMs: 20_000,
  simultaneas: 2,
  idadeOrfaoMs: 24 * 60 * 60 * 1000,
} as const
export const padraoImagemId = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
export const urlImagem = (id: string): string => `/api/midias/produtos/${id}.webp`
