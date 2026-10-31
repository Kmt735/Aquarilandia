import { Link, useNavigate, useSearchParams } from 'react-router'
import Button from '../../components/atoms/Button'
import CampoSenha from '../../components/atoms/CampoSenha'
import Input from '../../components/atoms/Input'
import Aviso from '../../components/molecules/Aviso'
import FormField from '../../components/molecules/FormField'
import FormTemplate from '../../components/templates/FormTemplate'
import useAuth from '../../hooks/useAuth'
import useFormulario from '../../hooks/useFormulario'
import useToast from '../../hooks/useToast'
import { ROTAS } from '../../utils/rotas'
import { regras } from '../../utils/validacao'

const REGRAS = { email: regras.email, senha: regras.senhaLogin }

export default function EntrarPage() {
  const { entrar } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const voltar = params.get('voltar') || ROTAS.minhaConta
  const { campo, erros, enviar, enviando, erroGeral, formRef } = useFormulario({ email: '', senha: '' }, REGRAS)

  return (
    <FormTemplate
      titulo="Entrar"
      descricao="Acesse suas compras, endereços salvos e finalize pedidos mais rápido."
      rodape={
        <>
          Ainda não tem conta?{' '}
          <Link to={`${ROTAS.criarConta}?voltar=${encodeURIComponent(voltar)}`} className="alvo-toque font-bold text-primary-text underline underline-offset-4">
            Criar conta
          </Link>
        </>
      }
    >
      <form
        ref={formRef}
        noValidate
        onSubmit={enviar(async (d) => {
          await entrar(d)
          toast('Você entrou na sua conta.', { tipo: 'sucesso' })
          navigate(voltar)
        })}
      >
        {erroGeral && (
          <Aviso tipo="erro" role="alert" className="mb-4">
            {erroGeral}
          </Aviso>
        )}
        <FormField id="login-email" label="E-mail" obrigatorio erro={erros.email}>
          <Input type="email" autoComplete="email" placeholder="nome@email.com" {...campo('email')} />
        </FormField>
        <FormField id="login-senha" label="Senha" obrigatorio erro={erros.senha}>
          <CampoSenha autoComplete="current-password" {...campo('senha')} />
        </FormField>
        <div className="-mt-2 mb-5 text-right">
          <Link to={ROTAS.esqueciSenha} className="alvo-toque text-pequeno font-semibold text-primary-text underline underline-offset-4">
            Esqueci a senha
          </Link>
        </div>
        <Button type="submit" tamanho="lg" largo disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </Button>
        <p className="mt-4 text-center text-legenda text-text-muted">Protótipo: qualquer e-mail válido entra numa conta de exemplo.</p>
      </form>
    </FormTemplate>
  )
}
