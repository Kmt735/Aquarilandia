// Não copie mensagem, stack, SQL, parâmetros ou propriedades arbitrárias de um erro para o log.
export function registrarErro(err: unknown, contexto: 'api' | 'pool' | 'criar-admin'): void {
  const valor = typeof err === 'object' && err !== null && 'code' in err ? err.code : undefined
  const codigo = typeof valor === 'string' && /^[0-9A-Z]{5}$/.test(valor) ? valor : 'NAO_CLASSIFICADO'
  console.error('Erro interno do servidor', { contexto, codigo })
}
