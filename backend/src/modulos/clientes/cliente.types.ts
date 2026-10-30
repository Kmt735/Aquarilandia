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