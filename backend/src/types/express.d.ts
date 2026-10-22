import type { UsuarioLogado } from '../modulos/auth/auth.types.js'

declare global{
    namespace Express{
        interface Request{
            usuario?:UsuarioLogado
        }
    }
}

