import { useState } from 'react'
import { Link } from 'react-router'
import Button from '../../components/atoms/Button'
import CampoSenha from '../../components/atoms/CampoSenha'
import Aviso from '../../components/molecules/Aviso'
import FormField from '../../components/molecules/FormField'
import FormTemplate from '../../components/templates/FormTemplate'
import useFormulario from '../../hooks/useFormulario'
import { redefinirSenha } from '../../services/conta'
import { ROTAS } from '../../utils/rotas'
import { MENSAGENS, regras } from '../../utils/validacao'

const REGRAS = { senha: regras.senha, confirmarSenha: (v, todos) => (v === todos.senha ? null : MENSAGENS.confirmarSenha) }

// INTEGRAÇÃO: o link do e-mail traz ?token=...; enviar { token, senha } para a rota de redefinição
export default function RedefinirSenhaPage() {
  const [pronto, setPronto] = useState(false)
  const { campo, erros, enviar, enviando, erroGeral, formRef } = useFormulario({ senha: '', confirmarSenha: '' }, REGRAS)

  return (
    <FormTemplate titulo="Criar senha nova" descricao="Escolha uma senha com pelo menos 8 caracteres.">
      {pronto ? (
        <>
          <Aviso tipo="sucesso" role="status" titulo="Senha alterada">
            Agora é só entrar com a senha nova.
          </Aviso>
          <Button asChild tamanho="lg" largo className="mt-5">
            <Link to={ROTAS.entrar}>Entrar</Link>
          </Button>
        </>
      ) : (
        <form
          ref={formRef}
          noValidate
          onSubmit={enviar(async (d) => {
            await redefinirSenha(d)
            setPronto(true)
          })}
        >
          {erroGeral && (
            <Aviso tipo="erro" role="alert" className="mb-4">
              {erroGeral}
            </Aviso>
          )}
          <FormField id="red-senha" label="Senha nova" obrigatorio erro={erros.senha}>
            <CampoSenha autoComplete="new-password" {...campo('senha')} />
          </FormField>
          <FormField id="red-confirmar" label="Repita a senha nova" obrigatorio erro={erros.confirmarSenha}>
            <CampoSenha autoComplete="new-password" {...campo('confirmarSenha')} />
          </FormField>
          <Button type="submit" tamanho="lg" largo disabled={enviando}>
            {enviando ? 'Salvando…' : 'Salvar senha nova'}
          </Button>
        </form>
      )}
    </FormTemplate>
  )
}
