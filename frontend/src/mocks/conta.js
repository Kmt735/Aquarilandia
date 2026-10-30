// DADOS DE EXEMPLO — cliente fictício para visualizar "Minha conta" (o real vem da API de clientes)
export const USUARIO_EXEMPLO = {
  id: 'exemplo-1',
  nome: 'Cliente de Exemplo',
  email: 'cliente@exemplo.com',
  telefone: '(32) 99999-0000',
}

export const ENDERECOS_EXEMPLO = [
  {
    id: 'end-1',
    apelido: 'Casa',
    cep: '36300-000',
    logradouro: 'Rua de Exemplo',
    numero: '100',
    complemento: 'Apto 1',
    bairro: 'Centro',
    cidade: 'São João del Rei',
    uf: 'MG',
    principal: true,
  },
  {
    id: 'end-2',
    apelido: 'Trabalho',
    cep: '30100-000',
    logradouro: 'Avenida de Exemplo',
    numero: '200',
    complemento: '',
    bairro: 'Centro',
    cidade: 'Belo Horizonte',
    uf: 'MG',
    principal: false,
  },
]
