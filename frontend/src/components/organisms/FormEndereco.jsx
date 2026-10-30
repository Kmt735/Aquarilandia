import Button from '../atoms/Button'
import Checkbox from '../atoms/Checkbox'
import Input from '../atoms/Input'
import Aviso from '../molecules/Aviso'
import FormField from '../molecules/FormField'
import useFormulario from '../../hooks/useFormulario'
import { mascararCep } from '../../utils/cep'
import { regras } from '../../utils/validacao'

const REGRAS = {
  cep: regras.cep,
  logradouro: regras.obrigatorio,
  numero: regras.obrigatorio,
  bairro: regras.obrigatorio,
  cidade: regras.obrigatorio,
  uf: regras.obrigatorio,
}
const VAZIO = { apelido: '', cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '', principal: false }

// Endereço com validação por campo. INTEGRAÇÃO futura: preencher rua/bairro/cidade pelo CEP.
export default function FormEndereco({ inicial = VAZIO, onSalvar, onCancelar, rotuloSalvar = 'Salvar endereço', prefixo = 'end' }) {
  const { campo, erros, enviar, enviando, erroGeral, alterar, formRef } = useFormulario({ ...VAZIO, ...inicial }, REGRAS)
  const id = (n) => `${prefixo}-${n}`

  return (
    <form ref={formRef} noValidate onSubmit={enviar(onSalvar)} className="rounded-card border border-border-strong bg-surface p-5">
      {erroGeral && (
        <Aviso tipo="erro" role="alert" className="mb-4">
          {erroGeral}
        </Aviso>
      )}
      <div className="grid gap-x-4 sm:grid-cols-6">
        <FormField id={id('cep')} label="CEP" obrigatorio erro={erros.cep} className="sm:col-span-2">
          <Input inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" {...campo('cep')} onChange={(e) => alterar('cep', mascararCep(e.target.value))} />
        </FormField>
        <FormField id={id('apelido')} label="Nome do endereço" ajuda="Ex.: Casa, Trabalho" className="sm:col-span-4">
          <Input {...campo('apelido')} />
        </FormField>
        <FormField id={id('logradouro')} label="Rua ou avenida" obrigatorio erro={erros.logradouro} className="sm:col-span-4">
          <Input autoComplete="address-line1" {...campo('logradouro')} />
        </FormField>
        <FormField id={id('numero')} label="Número" obrigatorio erro={erros.numero} className="sm:col-span-2">
          <Input inputMode="numeric" {...campo('numero')} />
        </FormField>
        <FormField id={id('complemento')} label="Complemento" className="sm:col-span-3">
          <Input autoComplete="address-line2" {...campo('complemento')} />
        </FormField>
        <FormField id={id('bairro')} label="Bairro" obrigatorio erro={erros.bairro} className="sm:col-span-3">
          <Input {...campo('bairro')} />
        </FormField>
        <FormField id={id('cidade')} label="Cidade" obrigatorio erro={erros.cidade} className="sm:col-span-4">
          <Input autoComplete="address-level2" {...campo('cidade')} />
        </FormField>
        <FormField id={id('uf')} label="Estado (UF)" obrigatorio erro={erros.uf} className="sm:col-span-2">
          <Input autoComplete="address-level1" maxLength={2} placeholder="MG" {...campo('uf')} onChange={(e) => alterar('uf', e.target.value.toUpperCase())} />
        </FormField>
      </div>
      <Checkbox id={id('principal')} checked={campo('principal').value} onChange={(e) => alterar('principal', e.target.checked)}>
        Usar como endereço principal
      </Checkbox>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="submit" disabled={enviando}>
          {enviando ? 'Salvando…' : rotuloSalvar}
        </Button>
        {onCancelar && (
          <Button variant="secundario" onClick={onCancelar}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  )
}
