import { cepService } from '../../src/modulos/vendas/cep.service.ts'

export const destinosFixture = {
  '36300000': { cidade: 'São João del Rei', uf: 'MG', municipioIbge: '3162500' },
  '36307000': { cidade: 'São João del Rei', uf: 'MG', municipioIbge: '3162500' },
  '01001000': { cidade: 'São Paulo', uf: 'SP', municipioIbge: '3550308' },
  '30100000': { cidade: 'Belo Horizonte', uf: 'MG', municipioIbge: '3106200' },
}
export function instalarCepFixture(mock) {
  mock.method(cepService, 'consultar', async (cep) => {
    const destino = destinosFixture[cep]
    if (!destino) throw new Error('Cadastre o CEP fictício no teste, sem acessar a rede.')
    return { cep, ...destino }
  })
}
