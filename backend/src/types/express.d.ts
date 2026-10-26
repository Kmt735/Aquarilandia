import type { UsuarioLogado } from './index.js'

declare global{
    namespace Express{
        interface Request{
            usuario?:UsuarioLogado
        }
    }
}

