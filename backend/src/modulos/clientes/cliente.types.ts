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