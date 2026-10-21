export interface DadosCadastro {
    nome: string
    email: string
    senha: string
    telefone: string
    aceiteTermos: boolean
}

export interface DadosLogin{
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