import { Link, useNavigate, useSearchParams } from 'react-router'
import Button from '../../components/atoms/Button'
import CampoSenha from '../../components/atoms/CampoSenha'
import Checkbox from '../../components/atoms/Checkbox'
import Input from '../../components/atoms/Input'
import Aviso from '../../components/molecules/Aviso'
import FormField from '../../components/molecules/FormField'
import FormTemplate from '../../components/templates/FormTemplate'
import useAuth from '../../hooks/useAuth'
import useFormulario from '../../hooks/useFormulario'
import useToast from '../../hooks/useToast'
import { ROTAS, urlPolitica } from '../../utils/rotas'
import { mascararTelefone } from '../../utils/telefone'
import { regras } from '../../utils/validacao'

// Mensagens de erro idênticas às do backend (utils/validacao.js)
const REGRAS = { nome: regras.nome, email: regras.email, senha: regras.senha, telefone: regras.telefone, aceiteTermos: regras.aceiteTermos }

export default function CriarContaPage() {
  const { cadastrar } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const voltar = params.get('voltar') || ROTAS.minhaConta
  const { campo, erros, enviar, enviando, erroGeral, alterar, formRef, valores } = useFormulario(
    { nome: '', email: '', senha: '', telefone: '', aceiteTermos: false },
    REGRAS,
  )

  return (
    <FormTemplate
      titulo="Criar conta"
      descricao="Com a conta, você acompanha suas compras e não precisa digitar o endereço de novo."
      rodape={
        <>
          Já tem conta?{' '}
          <Link to={`${ROTAS.entrar}?voltar=${encodeURIComponent(voltar)}`} className="alvo-toque font-bold text-primary-text underline underline-offset-4">
            Entrar
          </Link>
        </>
      }
    >
      <form
        ref={formRef}
        noValidate
        onSubmit={enviar(async (d) => {
          await cadastrar(d)
          toast('Conta criada! Bem-vindo(a) à Aquarilândia.', { tipo: 'sucesso' })
          navigate(voltar)
        })}
      >
        <p className="mb-4 text-legenda text-text-muted">
          Campos com <span className="text-danger-text">*</span> são obrigatórios.
        </p>
        {erroGeral && (
          <Aviso tipo="erro" role="alert" className="mb-4">
            {erroGeral}
          </Aviso>
        )}
        <FormField id="cad-nome" label="Nome" obrigatorio erro={erros.nome}>
          <Input autoComplete="name" {...campo('nome')} />
        </FormField>
        <FormField id="cad-email" label="E-mail" obrigatorio erro={erros.email}>
          <Input type="email" autoComplete="email" placeholder="nome@email.com" {...campo('email')} />
        </FormField>
        <FormField id="cad-senha" label="Senha" obrigatorio erro={erros.senha} ajuda="Pelo menos 8 caracteres.">
          <CampoSenha autoComplete="new-password" {...campo('senha')} />
        </FormField>
        <FormField id="cad-tel" label="Celular" obrigatorio erro={erros.telefone} ajuda="Com DDD. Exemplo: (32) 99999-0000.">
          <Input
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="(32) 99999-0000"
            {...campo('telefone')}
            onChange={(e) => alterar('telefone', mascararTelefone(e.target.value))}
          />
        </FormField>
        <div className="mb-5">
          <Checkbox
            id="cad-termos"
            name="aceiteTermos"
            checked={valores.aceiteTermos}
            erro={erros.aceiteTermos}
            describedBy={erros.aceiteTermos ? 'cad-termos-erro' : undefined}
            onChange={(e) => alterar('aceiteTermos', e.target.checked)}
          >
            Li e aceito os{' '}
            <Link to={urlPolitica('termos')} target="_blank" className="font-semibold text-primary-text underline underline-offset-4">
              termos de uso<span className="sr-only"> (abre em nova aba)</span>
            </Link>{' '}
            e a{' '}
            <Link to={urlPolitica('privacidade')} target="_blank" className="font-semibold text-primary-text underline underline-offset-4">
              política de privacidade<span className="sr-only"> (abre em nova aba)</span>
            </Link>
            . <span className="text-danger-text" aria-hidden="true">*</span>
          </Checkbox>
          {erros.aceiteTermos && (
            <p id="cad-termos-erro" className="mt-1 text-legenda font-semibold text-danger-text">
              {erros.aceiteTermos}
            </p>
          )}
        </div>
        <Button type="submit" tamanho="lg" largo disabled={enviando}>
          {enviando ? 'Criando conta…' : 'Criar conta'}
        </Button>
      </form>
    </FormTemplate>
  )
}
