import { useState } from 'react'
import { Link } from 'react-router'
import Button from '../../components/atoms/Button'
import Input from '../../components/atoms/Input'
import Aviso from '../../components/molecules/Aviso'
import FormField from '../../components/molecules/FormField'
import FormTemplate from '../../components/templates/FormTemplate'
import useFormulario from '../../hooks/useFormulario'
import { esqueciSenha, MENSAGEM_ESQUECI } from '../../services/conta'
import { ROTAS } from '../../utils/rotas'
import { regras } from '../../utils/validacao'

const REGRAS = { email: regras.email }

export default function EsqueciSenhaPage() {
  const [enviado, setEnviado] = useState(false)
  const { campo, erros, enviar, enviando, erroGeral, formRef } = useFormulario({ email: '' }, REGRAS)

  return (
    <FormTemplate
      titulo="Esqueci a senha"
      descricao="Digite o e-mail da sua conta. Vamos mandar um link para você criar uma senha nova."
      trilha={[{ rotulo: 'Entrar', to: ROTAS.entrar }, { rotulo: 'Esqueci a senha' }]}
      rodape={
        <Link to={ROTAS.entrar} className="alvo-toque font-bold text-primary-text underline underline-offset-4">
          Voltar para Entrar
        </Link>
      }
    >
      {enviado ? (
        <Aviso tipo="sucesso" role="status" titulo="Pedido recebido">
          {/* Mensagem sempre igual: não revela se o e-mail tem conta */}
          {MENSAGEM_ESQUECI}
        </Aviso>
      ) : (
        <form
          ref={formRef}
          noValidate
          onSubmit={enviar(async (d) => {
            await esqueciSenha(d)
            setEnviado(true)
          })}
        >
          {erroGeral && (
            <Aviso tipo="erro" role="alert" className="mb-4">
              {erroGeral}
            </Aviso>
          )}
          <FormField id="esq-email" label="E-mail" obrigatorio erro={erros.email}>
            <Input type="email" autoComplete="email" placeholder="nome@email.com" {...campo('email')} />
          </FormField>
          <Button type="submit" tamanho="lg" largo disabled={enviando}>
            {enviando ? 'Enviando…' : 'Enviar link'}
          </Button>
          <p className="mt-4 text-center text-legenda text-text-muted">
            Protótipo: para ver a tela seguinte, abra <Link className="text-primary-text underline" to={`${ROTAS.redefinirSenha}?token=exemplo`}>redefinir senha</Link>.
          </p>
        </form>
      )}
    </FormTemplate>
  )
}
