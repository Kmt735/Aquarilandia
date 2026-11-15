// Campos da ficha técnica de cada categoria no formulário do administrador.
// Os nomes e valores seguem os dados que a API devolve (veja src/mocks/catalogo-api.js).
// Se o servidor recusar algum valor, a mensagem aparece na tela; é só ajustar a lista aqui.
const n = (nome, rotulo, extra = {}) => ({ nome, rotulo, tipo: 'numero', ...extra })
const t = (nome, rotulo, extra = {}) => ({ nome, rotulo, tipo: 'texto', ...extra })
const o = (nome, rotulo, opcoes, extra = {}) => ({ nome, rotulo, tipo: 'opcoes', opcoes, ...extra })
const s = (nome, rotulo, extra = {}) => ({ nome, rotulo, tipo: 'sim-nao', ...extra })

const AGUA = [['doce', 'Doce'], ['salobra', 'Salobra'], ['marinho', 'Salgada']]
const AGUA_AMBOS = [...AGUA, ['ambos', 'Doce e salgada']]
const VOLTAGEM = [['bivolt', 'Bivolt'], ['110v', '110 V'], ['220v', '220 V']]

export const FICHAS = {
  peixes: [
    t('nomeCientifico', 'Nome científico', { obrigatorio: true }),
    o('tipoAgua', 'Tipo de água', AGUA, { obrigatorio: true }),
    n('tamanhoAdultoCm', 'Tamanho adulto (cm)', { obrigatorio: true }),
    n('aquarioMinLitros', 'Aquário mínimo (litros)', { obrigatorio: true }),
    o('temperamento', 'Temperamento', [['pacifico', 'Pacífico'], ['semi_agressivo', 'Semiagressivo'], ['agressivo', 'Agressivo']], { obrigatorio: true }),
    o('dificuldade', 'Dificuldade', [['iniciante', 'Iniciante'], ['intermediario', 'Intermediário'], ['avancado', 'Avançado']], { obrigatorio: true }),
    t('origem', 'Origem'),
    n('tempMinC', 'Temperatura mínima (°C)'),
    n('tempMaxC', 'Temperatura máxima (°C)'),
    n('phMin', 'pH mínimo'),
    n('phMax', 'pH máximo'),
    n('cardumeMinimo', 'Quantidade mínima no cardume'),
    n('aquarioMaxLitros', 'Aquário máximo (litros)'),
    o('nivelNatacao', 'Onde nada', [['fundo', 'Fundo'], ['meio', 'Meio'], ['superficie', 'Superfície']]),
    o('dieta', 'Dieta', [['onivoro', 'Onívoro'], ['carnivoro', 'Carnívoro'], ['herbivoro', 'Herbívoro']]),
  ],
  aquarios: [
    n('volumeLitros', 'Volume (litros)', { obrigatorio: true }),
    n('comprimentoCm', 'Comprimento (cm)'),
    n('larguraCm', 'Largura (cm)'),
    n('alturaCm', 'Altura (cm)'),
    o('material', 'Material', [['vidro', 'Vidro'], ['acrilico', 'Acrílico']]),
    o('tipoAgua', 'Tipo de água', AGUA_AMBOS),
  ],
  filtros: [
    o('tipo', 'Tipo', [['interno', 'Interno'], ['hang_on', 'Pendurado (hang-on)'], ['canister', 'Externo (canister)']], { obrigatorio: true }),
    n('vazaoLh', 'Vazão (litros por hora)'),
    n('aquarioMaxLitros', 'Aquário máximo (litros)'),
    n('potenciaW', 'Potência (W)'),
    o('voltagem', 'Voltagem', VOLTAGEM),
  ],
  termostatos: [
    n('potenciaW', 'Potência (W)', { obrigatorio: true }),
    n('aquarioMinLitros', 'Aquário mínimo (litros)'),
    n('aquarioMaxLitros', 'Aquário máximo (litros)'),
    n('tempMinC', 'Temperatura mínima (°C)'),
    n('tempMaxC', 'Temperatura máxima (°C)'),
    s('ajustavel', 'Temperatura ajustável'),
    o('voltagem', 'Voltagem', VOLTAGEM),
  ],
  iluminacao: [
    t('tecnologia', 'Tecnologia (exemplo: led)'),
    n('potenciaW', 'Potência (W)'),
    n('comprimentoCm', 'Comprimento (cm)'),
    o('espectro', 'Espectro', [['branco', 'Branco'], ['plantado', 'Plantado'], ['marinho', 'Marinho']]),
    n('temperaturaCorK', 'Temperatura de cor (K)'),
    o('voltagem', 'Voltagem', VOLTAGEM),
  ],
  substratos: [
    o('tipo', 'Tipo', [['areia', 'Areia'], ['cascalho', 'Cascalho'], ['fertil', 'Fértil'], ['coral', 'Coral']], { obrigatorio: true }),
    n('pesoKg', 'Peso (kg)'),
    n('granulometriaMm', 'Tamanho do grão (mm)'),
    t('cor', 'Cor'),
    s('alteraPh', 'Altera o pH da água'),
  ],
  decoracoes: [
    o('material', 'Material', [['pedra', 'Pedra'], ['tronco', 'Tronco'], ['resina', 'Resina'], ['ceramica', 'Cerâmica']], { obrigatorio: true }),
    s('materialNatural', 'Material natural'),
    s('seguroMarinho', 'Seguro para aquário marinho'),
    n('comprimentoCm', 'Comprimento (cm)'),
    n('larguraCm', 'Largura (cm)'),
    n('alturaCm', 'Altura (cm)'),
  ],
  plantas: [
    t('nome', 'Nome científico', { obrigatorio: true }),
    o('posicao', 'Posição no aquário', [['epifita', 'Epífita (presa em pedras e troncos)'], ['fundo', 'Fundo'], ['frente', 'Frente']]),
    o('iluminacaoExigida', 'Iluminação exigida', [['baixa', 'Baixa'], ['media', 'Média'], ['alta', 'Alta']]),
    s('precisaCo2', 'Precisa de CO₂'),
    o('dificuldade', 'Dificuldade', [['iniciante', 'Iniciante'], ['avancado', 'Avançado']]),
    n('tempMinC', 'Temperatura mínima (°C)'),
    n('tempMaxC', 'Temperatura máxima (°C)'),
  ],
  racoes: [
    t('formato', 'Formato (exemplo: flocos)'),
    n('pesoG', 'Peso (g)'),
    o('tipoAgua', 'Tipo de água', AGUA_AMBOS),
    t('indicadaPara', 'Indicada para'),
  ],
  condicionadores: [
    t('tipo', 'Tipo (exemplo: condicionador)'),
    n('volumeMl', 'Volume (mL)'),
    t('dosagem', 'Dosagem'),
    t('principioAtivo', 'Princípio ativo'),
    o('tipoAgua', 'Tipo de água', AGUA_AMBOS),
  ],
  // bombas e acessorios: ainda sem campos conhecidos na ficha
}

// Cada campo do formulário tem um nome único: "<categoria>__<campo>"
export const nomeCampo = (slug, nome) => `${slug}__${nome}`

const numero = (v) => Number(String(v).trim().replace(',', '.'))

export function valoresIniciaisFicha() {
  const valores = {}
  for (const [slug, campos] of Object.entries(FICHAS)) {
    for (const c of campos) valores[nomeCampo(slug, c.nome)] = c.tipo === 'sim-nao' ? false : ''
  }
  return valores
}

// Preenche o formulário com a ficha de um item que já existe
export function preencherFicha(slug, dados) {
  const valores = {}
  for (const c of FICHAS[slug] ?? []) {
    const v = dados?.[c.nome]
    valores[nomeCampo(slug, c.nome)] =
      c.tipo === 'sim-nao' ? Boolean(v) : v == null ? '' : c.tipo === 'numero' ? String(v).replace('.', ',') : String(v)
  }
  return valores
}

export function regrasFicha(slug) {
  const regras = {}
  for (const c of FICHAS[slug] ?? []) {
    if (c.tipo === 'sim-nao') continue
    regras[nomeCampo(slug, c.nome)] = (v) => {
      if (String(v ?? '').trim() === '') return c.obrigatorio ? 'Preencha este campo.' : null
      if (c.tipo === 'numero' && (!Number.isFinite(numero(v)) || numero(v) < 0)) return 'Digite um número. Exemplo: 6,5.'
      return null
    }
  }
  return regras
}

// Monta { tipo, dados } no formato da API; campos em branco ficam de fora
export function montarFicha(slug, valores) {
  const campos = FICHAS[slug] ?? []
  if (!campos.length) return undefined
  const dados = {}
  for (const c of campos) {
    const v = valores[nomeCampo(slug, c.nome)]
    if (c.tipo === 'sim-nao') dados[c.nome] = Boolean(v)
    else if (String(v ?? '').trim() !== '') dados[c.nome] = c.tipo === 'numero' ? numero(v) : String(v).trim()
  }
  return { tipo: slug, dados }
}