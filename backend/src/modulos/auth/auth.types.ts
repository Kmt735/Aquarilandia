import { PapelCliente } from '../clientes/cliente.types.js'

export interface DadosCadastro {
    nome: string
    email: string
    senha: string
    telefone: string
    aceiteTermos: boolean
}

export interface DadosLogin {
    email:string
    senha:string
}

export interface NovaSessao {
    tokenHash:string
    clienteId:number
    expiraEm:Date
    ip:string | null
    userAgent:string | null
}

export interface UsuarioLogado {
    id: number
    papel: PapelCliente
}