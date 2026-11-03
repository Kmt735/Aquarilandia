export type PapelCliente = "cliente" | "admin"

export interface Cliente {
    id:number
    nome:string
    email:string | null
    telefone:string | null
    papel:PapelCliente
    ativo:boolean
    criadoEm:Date
    atualizadoEm:Date
}

export interface NovoCliente {
    nome:string
    email:string 
    telefone:string 
    senhaHash:string
}

export type AtualizacaoCliente = Partial<Pick<Cliente, 'nome' | 'email' | 'telefone'>>

export interface ClienteComSenha extends Cliente {
    senhaHash : string
}

// Como o admin vê o cliente: inclui os desativados e os anonimizados (anonimizadoEm preenchido)
export interface ClienteAdmin extends Cliente {
    anonimizadoEm: Date | null
}

export interface FiltrosClienteAdmin {
    busca?: string
    papel: PapelCliente
    limite: number
    offset: number
}

export type ResumoClienteAdmin = Pick<
    ClienteAdmin,
    'id' | 'nome' | 'email' | 'telefone' | 'papel' | 'ativo' | 'criadoEm'
> & {
    quantidadeVendas: number
}

export interface ListaClientesAdmin {
    dados: ResumoClienteAdmin[]
    total: number
    pagina: number
    limite: number
}

export interface DetalheClienteAdmin extends ClienteAdmin {
    enderecos: Endereco[]
    totalVendas: number
    totalGasto: number
}

export interface Endereco {
    id: number
    clienteId: number
    apelido: string | null
    cep: string
    logradouro: string
    numero: string
    complemento: string | null
    bairro: string
    cidade: string
    uf: string
    principal: boolean
    criadoEm: Date
    atualizadoEm: Date
}

export type NovoEndereco = Pick<
    Endereco,
    'apelido' | 'cep' | 'logradouro' | 'numero' | 'complemento' | 'bairro' | 'cidade' | 'uf' | 'principal'
>

export type AtualizacaoEndereco = Partial<NovoEndereco>
