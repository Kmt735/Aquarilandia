import Button from '../../components/atoms/Button'
import Input from '../../components/atoms/Input'
import Aviso from '../../components/molecules/Aviso'
import FormField from '../../components/molecules/FormField'
import useAuth from '../../hooks/useAuth'
import useFormulario from '../../hooks/useFormulario'
import useTituloPagina from '../../hooks/useTituloPagina'
import useToast from '../../hooks/useToast'
import { mascararTelefone } from '../../utils/telefone'
import { regras } from '../../utils/validacao'

const REGRAS = { nome: regras.nome, email: regras.email, telefone: regras.telefone }

export default function MeusDadosPage() {
  useTituloPagina('Meus dados')
  const { usuario, atualizar } = useAuth()
  const { toast } = useToast()
  const { campo, erros, enviar, enviando, erroGeral, alterar, formRef } = useFormulario(
    { nome: usuario.nome, email: usuario.email, telefone: usuario.telefone },
    REGRAS,
  )

  return (
    <section aria-labelledby="titulo-dados" className="max-w-[560px]">
      <h2 id="titulo-dados" className="mb-6 text-h2">
        Meus dados
      </h2>
      <form
        ref={formRef}
        noValidate
        onSubmit={enviar(async (d) => {
          await atualizar(d)
          toast('Dados salvos.', { tipo: 'sucesso' })
        })}
        className="rounded-card border border-border-strong bg-surface p-5"
      >
        {erroGeral && (
          <Aviso tipo="erro" role="alert" className="mb-4">
            {erroGeral}
          </Aviso>
        )}
        <FormField id="dados-nome" label="Nome" obrigatorio erro={erros.nome}>
          <Input autoComplete="name" {...campo('nome')} />
        </FormField>
        <FormField id="dados-email" label="E-mail" obrigatorio erro={erros.email}>
          <Input type="email" autoComplete="email" {...campo('email')} />
        </FormField>
        <FormField id="dados-tel" label="Celular" obrigatorio erro={erros.telefone} ajuda="Com DDD. Exemplo: (32) 99999-0000.">
          <Input type="tel" inputMode="numeric" {...campo('telefone')} onChange={(e) => alterar('telefone', mascararTelefone(e.target.value))} />
        </FormField>
        <Button type="submit" disabled={enviando}>
          {enviando ? 'Salvando…' : 'Salvar dados'}
        </Button>
      </form>
    </section>
  )
}
