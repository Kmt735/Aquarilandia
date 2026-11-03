// Regras de compatibilidade do aquário — FONTE ÚNICA para o "Monte seu Aquário" e para o carrinho.
// Funções puras (sem React, sem API): recebem dados simples e devolvem avisos. Fáceis de testar
// (testes/compatibilidade.test.mjs) e de ajustar.
//
// TODO(loja): todos os números abaixo são PROVISÓRIOS e conservadores. A loja precisa validar cada um.

/** Litros de água por centímetro de peixe adulto (regra simples de lotação). TODO(loja): validar. */
export const LITROS_POR_CM_DE_PEIXE = 2
/** Acima de (capacidade × fator) a lotação deixa de ser "Atenção" e vira "Incompatível". TODO(loja): validar. */
export const FATOR_LOTACAO_CRITICA = 1.5
/** Peixe cuja temperatura mínima é igual ou maior que este valor precisa de aquecedor. TODO(loja): validar. */
export const TEMPERATURA_PEDE_AQUECEDOR_C = 22
/** A ficha de planta não tem tipo de água: todas são tratadas como de água doce. TODO(API): campo tipoAgua. */
export const AGUA_DAS_PLANTAS = 'doce'
/**
 * Substrato: kg por dm² (10 × 10 cm) de fundo. 0,75 ≈ camada de 5 cm de areia/cascalho (~1,5 kg por litro).
 * TODO(loja): validar a camada e o peso por tipo de substrato.
 */
export const SUBSTRATO_KG_POR_DM2 = 0.75
/**
 * "Já tenho um aquário" só informa litros. Para estimar o fundo, supõe o formato mais comum:
 * comprimento = 2 × largura e altura = largura. TODO(loja): validar.
 */
export const PROPORCAO_AQUARIO_PROPRIO = { comprimento: 2, largura: 1, altura: 1 }
/** Luminária "recomendada" quando o comprimento dela fica até esta diferença do comprimento do aquário. */
export const TOLERANCIA_LUMINARIA_CM = 10

export const NIVEL = { atencao: 'atencao', incompativel: 'incompativel' }

const AGUA_ROTULO = { doce: 'água doce', marinho: 'água salgada', salobra: 'água salobra' }
const TEMPERAMENTO_ROTULO = { pacifico: 'pacífico', semi_agressivo: 'semiagressivo', agressivo: 'agressivo' }
const nomes = (lista) => lista.map((x) => x.nome).join(', ')
const numero = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const fmt = (n) => String(Math.round(n * 10) / 10).replace('.', ',')

// ---------------------------------------------------------------------------------------------------
// Equipamentos: o que atende o volume escolhido
// ---------------------------------------------------------------------------------------------------

/** O filtro atende o volume? `null` quando a ficha não informa o limite. */
export function filtroAtende(filtro, litros) {
  const max = numero(filtro?.aquarioMaxLitros)
  if (max == null || numero(litros) == null) return null
  return litros <= max
}

/** O termostato/aquecedor atende o volume? Considera mínimo e máximo, quando informados. */
export function termostatoAtende(termostato, litros) {
  const min = numero(termostato?.aquarioMinLitros)
  const max = numero(termostato?.aquarioMaxLitros)
  if (numero(litros) == null || (min == null && max == null)) return null
  return (min == null || litros >= min) && (max == null || litros <= max)
}

/** A luminária tem o comprimento do aquário (± tolerância)? `null` sem medida. */
export function luminariaAtende(luminaria, comprimentoAquarioCm) {
  const c = numero(luminaria?.comprimentoCm)
  if (c == null || numero(comprimentoAquarioCm) == null) return null
  return Math.abs(c - comprimentoAquarioCm) <= TOLERANCIA_LUMINARIA_CM
}

export const precisaAquecedor = (peixe) => numero(peixe?.tempMinC) != null && peixe.tempMinC >= TEMPERATURA_PEDE_AQUECEDOR_C

// ---------------------------------------------------------------------------------------------------
// Medidas e substrato
// ---------------------------------------------------------------------------------------------------

/** Medidas do aquário: as da ficha ou, para "Já tenho um aquário", estimadas pelos litros. */
export function medidasAquario({ litros, comprimentoCm, larguraCm, alturaCm }) {
  if (numero(comprimentoCm) && numero(larguraCm)) return { comprimentoCm, larguraCm, alturaCm: numero(alturaCm), estimadas: false }
  if (!numero(litros) || litros <= 0) return null
  const { comprimento, largura, altura } = PROPORCAO_AQUARIO_PROPRIO
  // litros × 1000 = (c·x)(l·x)(a·x) → x = raiz cúbica
  const x = Math.cbrt((litros * 1000) / (comprimento * largura * altura))
  return { comprimentoCm: Math.round(comprimento * x), larguraCm: Math.round(largura * x), alturaCm: Math.round(altura * x), estimadas: true }
}

/** Sugestão de substrato: kg totais e quantos pacotes de `pesoKg` comprar. TODO(loja): validar a regra. */
export function sugerirSubstrato(medidas, pesoKgPacote) {
  if (!medidas) return null
  const areaDm2 = (medidas.comprimentoCm / 10) * (medidas.larguraCm / 10)
  const kg = Math.max(1, Math.round(areaDm2 * SUBSTRATO_KG_POR_DM2))
  const pacotes = numero(pesoKgPacote) && pesoKgPacote > 0 ? Math.max(1, Math.ceil(kg / pesoKgPacote)) : null
  return { kg, pacotes, areaDm2 }
}

// ---------------------------------------------------------------------------------------------------
// Peixes
// ---------------------------------------------------------------------------------------------------

/** Lotação em litros: soma do tamanho adulto × quantidade × litros por cm. */
export function litrosNecessarios(peixes) {
  return peixes.reduce((s, p) => s + (numero(p.tamanhoAdultoCm) ?? 0) * (p.qtd ?? 1), 0) * LITROS_POR_CM_DE_PEIXE
}

export const faixasSeSobrepoem = (a, b) =>
  [a.tempMinC, a.tempMaxC, b.tempMinC, b.tempMaxC].every((v) => numero(v) != null) ? Math.max(a.tempMinC, b.tempMinC) <= Math.min(a.tempMaxC, b.tempMaxC) : true

/** Água do conjunto: a do aquário, se for definida; senão, a dos peixes. */
function aguaDaMontagem(aquario, peixes) {
  if (aquario?.tipoAgua === 'doce' || aquario?.tipoAgua === 'marinho') return aquario.tipoAgua
  const tipos = new Set(peixes.map((p) => p.tipoAgua).filter((t) => t === 'doce' || t === 'marinho'))
  return tipos.size === 1 ? [...tipos][0] : null
}

function conflitoTemperamento(a, b) {
  const par = [a.temperamento, b.temperamento]
  if (par.includes('agressivo') && par.includes('pacifico')) return NIVEL.incompativel
  if (par.includes('semi_agressivo') && par.includes('pacifico')) return NIVEL.atencao
  return null
}

// ---------------------------------------------------------------------------------------------------
// Análise completa
// ---------------------------------------------------------------------------------------------------

/**
 * Avisos da montagem. Nenhum aviso bloqueia: o cliente sempre pode continuar.
 *
 * @param {object} m
 * @param {{ nome: string, litros: number|null, tipoAgua: 'doce'|'marinho'|'ambos'|null }|null} m.aquario
 * @param {Array<{ id, nome, qtd, tipoAgua, tempMinC, tempMaxC, aquarioMinLitros, temperamento, tamanhoAdultoCm, cardumeMinimo, incompativelCom }>} m.peixes
 * @param {Array<{ id, nome, aquarioMaxLitros }>} m.filtros
 * @param {Array<{ id, nome, aquarioMinLitros, aquarioMaxLitros }>} m.termostatos
 * @param {Array<{ id, nome, tempMinC, tempMaxC }>} m.plantas
 * @param {Array<{ id, nome, seguroMarinho }>} m.decoracoes
 * @returns {Array<{ id: string, nivel: 'atencao'|'incompativel', etapa: string, itens: number[], titulo: string, motivo: string, solucao: string }>}
 */
export function analisarMontagem({ aquario = null, peixes = [], filtros = [], termostatos = [], plantas = [], decoracoes = [] }) {
  const avisos = []
  const add = (aviso) => avisos.push(aviso)
  const litros = numero(aquario?.litros)
  const agua = aguaDaMontagem(aquario, peixes)

  // 1. Aquário mínimo de cada espécie
  if (litros != null) {
    for (const p of peixes) {
      if (numero(p.aquarioMinLitros) != null && p.aquarioMinLitros > litros) {
        add({
          id: `minimo-${p.id}`, nivel: NIVEL.incompativel, etapa: 'peixes', itens: [p.id],
          titulo: `${p.nome} precisa de um aquário maior`,
          motivo: `Essa espécie precisa de pelo menos ${p.aquarioMinLitros} L, e o seu aquário tem ${fmt(litros)} L.`,
          solucao: `Escolha um aquário de ${p.aquarioMinLitros} L ou mais, ou troque por um peixe menor.`,
        })
      }
    }
  }

  // 2. Lotação (regra simples: LITROS_POR_CM_DE_PEIXE)
  if (litros != null && peixes.length) {
    const precisa = litrosNecessarios(peixes)
    if (precisa > litros) {
      const critico = precisa > litros * FATOR_LOTACAO_CRITICA
      add({
        id: 'lotacao', nivel: critico ? NIVEL.incompativel : NIVEL.atencao, etapa: 'peixes', itens: peixes.map((p) => p.id),
        titulo: 'Peixes demais para o tamanho do aquário',
        motivo: `Somando o tamanho adulto de todos, o ideal seria cerca de ${Math.ceil(precisa)} L de água, e o aquário tem ${fmt(litros)} L. Com pouco espaço a água suja rápido e os peixes ficam estressados.`,
        solucao: 'Diminua a quantidade de peixes ou escolha um aquário maior.',
      })
    }
  }

  // 3. Cardume mínimo
  for (const p of peixes) {
    if (numero(p.cardumeMinimo) > 1 && (p.qtd ?? 1) < p.cardumeMinimo) {
      add({
        id: `cardume-${p.id}`, nivel: NIVEL.atencao, etapa: 'peixes', itens: [p.id],
        titulo: `${p.nome} vive melhor em grupo`,
        motivo: `É um peixe de cardume: o recomendado é ter pelo menos ${p.cardumeMinimo} juntos. Sozinho ou em poucos, ele fica estressado.`,
        solucao: `Aumente para ${p.cardumeMinimo} ou mais.`,
      })
    }
  }

  // 4. Pares de peixes: lista de incompatíveis, temperamento e temperatura
  for (let i = 0; i < peixes.length; i++) {
    for (let j = i + 1; j < peixes.length; j++) {
      const a = peixes[i]
      const b = peixes[j]
      const marcado = a.incompativelCom?.includes(b.id) || b.incompativelCom?.includes(a.id)
      const temperamento = conflitoTemperamento(a, b)
      if (marcado) {
        add({
          id: `par-${a.id}-${b.id}`, nivel: NIVEL.incompativel, etapa: 'peixes', itens: [a.id, b.id],
          titulo: `${a.nome} e ${b.nome} não combinam`,
          motivo: 'A loja marcou essas espécies como incompatíveis: uma pode atacar ou estressar a outra.',
          solucao: `Fique com só uma delas: tire ${a.nome} ou ${b.nome}.`,
        })
      } else if (temperamento) {
        const [bravo, calmo] = a.temperamento === 'pacifico' ? [b, a] : [a, b]
        add({
          id: `temperamento-${a.id}-${b.id}`, nivel: temperamento, etapa: 'peixes', itens: [a.id, b.id],
          titulo: `${bravo.nome} pode brigar com ${calmo.nome}`,
          motivo: `${bravo.nome} é ${TEMPERAMENTO_ROTULO[bravo.temperamento]} e ${calmo.nome} é pacífico. O mais bravo pode perseguir ou machucar o mais calmo.`,
          solucao: 'Escolha peixes de temperamento parecido, ou fale com a loja antes de juntar os dois.',
        })
      }
      if (!faixasSeSobrepoem(a, b)) {
        add({
          id: `temperatura-${a.id}-${b.id}`, nivel: NIVEL.incompativel, etapa: 'peixes', itens: [a.id, b.id],
          titulo: `${a.nome} e ${b.nome} gostam de temperaturas diferentes`,
          motivo: `${a.nome} vive entre ${fmt(a.tempMinC)} e ${fmt(a.tempMaxC)} °C, e ${b.nome} entre ${fmt(b.tempMinC)} e ${fmt(b.tempMaxC)} °C. Não existe uma temperatura boa para os dois.`,
          solucao: 'Escolha só uma das espécies, ou outra que viva na mesma faixa de temperatura.',
        })
      }
    }
  }

  // 5. Tipo de água: aquário × peixes, peixes entre si, plantas e decoração
  const doces = peixes.filter((p) => p.tipoAgua === 'doce')
  const marinhos = peixes.filter((p) => p.tipoAgua === 'marinho')
  if (doces.length && marinhos.length) {
    add({
      id: 'agua-peixes', nivel: NIVEL.incompativel, etapa: 'peixes', itens: [...doces, ...marinhos].map((p) => p.id),
      titulo: 'Peixes de água doce e salgada juntos',
      motivo: `${nomes(doces)} ${doces.length > 1 ? 'são' : 'é'} de água doce, e ${nomes(marinhos)} de água salgada. Um não sobrevive na água do outro.`,
      solucao: 'Escolha peixes de um tipo de água só.',
    })
  }
  if (aquario?.tipoAgua === 'doce' || aquario?.tipoAgua === 'marinho') {
    const errados = peixes.filter((p) => (p.tipoAgua === 'doce' || p.tipoAgua === 'marinho') && p.tipoAgua !== aquario.tipoAgua)
    if (errados.length) {
      add({
        id: 'agua-aquario', nivel: NIVEL.incompativel, etapa: 'peixes', itens: errados.map((p) => p.id),
        titulo: 'Peixe com tipo de água diferente do aquário',
        motivo: `O aquário é de ${AGUA_ROTULO[aquario.tipoAgua]}, e ${nomes(errados)} ${errados.length > 1 ? 'são' : 'é'} de ${AGUA_ROTULO[errados[0].tipoAgua]}.`,
        solucao: 'Troque os peixes ou mude o tipo de água do aquário.',
      })
    }
  }
  const salobras = peixes.filter((p) => p.tipoAgua === 'salobra')
  if (salobras.length && (doces.length || marinhos.length || aquario?.tipoAgua === 'doce' || aquario?.tipoAgua === 'marinho')) {
    add({
      id: 'agua-salobra', nivel: NIVEL.atencao, etapa: 'peixes', itens: salobras.map((p) => p.id),
      titulo: 'Peixe de água salobra',
      motivo: `${nomes(salobras)} vive em água salobra (um pouco salgada), que é diferente da água do restante da montagem.`,
      solucao: 'Peça orientação da loja antes de juntar essas espécies.',
    })
  }
  if (agua === 'marinho' && plantas.length) {
    add({
      id: 'agua-plantas', nivel: NIVEL.incompativel, etapa: 'plantas', itens: plantas.map((p) => p.id),
      titulo: 'Plantas de água doce em aquário de água salgada',
      motivo: `${nomes(plantas)} ${plantas.length > 1 ? 'são' : 'é'} de água doce e não sobrevive${plantas.length > 1 ? 'm' : ''} na água salgada.`,
      solucao: 'Tire as plantas ou monte um aquário de água doce.',
    })
  }
  const naoMarinhas = decoracoes.filter((d) => d.seguroMarinho === false)
  if (agua === 'marinho' && naoMarinhas.length) {
    add({
      id: 'agua-decoracao', nivel: NIVEL.atencao, etapa: 'decoracao', itens: naoMarinhas.map((d) => d.id),
      titulo: 'Decoração não indicada para água salgada',
      motivo: `${nomes(naoMarinhas)} pode soltar substâncias ou se desgastar na água salgada.`,
      solucao: 'Troque por uma decoração marcada como segura para água salgada.',
    })
  }

  // 6. Plantas × temperatura dos peixes
  for (const planta of plantas) {
    const fora = peixes.filter((p) => !faixasSeSobrepoem(planta, p))
    if (fora.length) {
      add({
        id: `temperatura-planta-${planta.id}`, nivel: NIVEL.atencao, etapa: 'plantas', itens: [planta.id, ...fora.map((p) => p.id)],
        titulo: `${planta.nome} prefere outra temperatura`,
        motivo: `A planta vive entre ${fmt(planta.tempMinC)} e ${fmt(planta.tempMaxC)} °C, fora da faixa de ${nomes(fora)}.`,
        solucao: 'Escolha outra planta ou confirme com a loja.',
      })
    }
  }

  // 7. Filtro: falta ou não aguenta o volume
  if (peixes.length && !filtros.length) {
    add({
      id: 'sem-filtro', nivel: NIVEL.atencao, etapa: 'equipamentos', itens: [],
      titulo: 'Falta um filtro',
      motivo: 'Todo aquário com peixes precisa de filtro: é ele que mantém a água limpa e abriga as bactérias boas da ciclagem.',
      solucao: 'Escolha um filtro na etapa Equipamentos (ou ignore se você já tem um).',
    })
  }
  if (litros != null && filtros.length && !filtros.some((f) => filtroAtende(f, litros) !== false)) {
    for (const f of filtros) {
      add({
        id: `filtro-${f.id}`, nivel: NIVEL.incompativel, etapa: 'equipamentos', itens: [f.id],
        titulo: `${f.nome} é pequeno para o aquário`,
        motivo: `Esse filtro atende aquários de até ${f.aquarioMaxLitros} L, e o seu tem ${fmt(litros)} L. A água não ficaria limpa o bastante.`,
        solucao: `Escolha um filtro para ${fmt(litros)} L ou mais.`,
      })
    }
  }

  // 8. Aquecedor: falta (para peixes tropicais) ou não combina com o volume
  const tropicais = peixes.filter(precisaAquecedor)
  if (tropicais.length && !termostatos.length) {
    add({
      id: 'sem-aquecedor', nivel: NIVEL.atencao, etapa: 'equipamentos', itens: tropicais.map((p) => p.id),
      titulo: 'Falta um termostato/aquecedor',
      motivo: `${nomes(tropicais)} precisa${tropicais.length > 1 ? 'm' : ''} de água a partir de ${fmt(Math.max(...tropicais.map((p) => p.tempMinC)))} °C. Sem aquecedor, a água esfria à noite e no inverno.`,
      solucao: 'Escolha um termostato/aquecedor na etapa Equipamentos (ou ignore se você já tem um).',
    })
  }
  if (litros != null && termostatos.length && !termostatos.some((t) => termostatoAtende(t, litros) !== false)) {
    for (const t of termostatos) {
      const pequeno = numero(t.aquarioMaxLitros) != null && litros > t.aquarioMaxLitros
      add({
        id: `termostato-${t.id}`, nivel: NIVEL.atencao, etapa: 'equipamentos', itens: [t.id],
        titulo: pequeno ? `${t.nome} é fraco para o aquário` : `${t.nome} é forte demais para o aquário`,
        motivo: pequeno
          ? `Ele aquece aquários de até ${t.aquarioMaxLitros} L, e o seu tem ${fmt(litros)} L. A água pode não chegar à temperatura certa.`
          : `Ele é indicado a partir de ${t.aquarioMinLitros} L, e o seu tem ${fmt(litros)} L. Em pouca água, a temperatura pode variar demais.`,
        solucao: `Escolha um modelo indicado para ${fmt(litros)} L.`,
      })
    }
  }

  // Incompatíveis primeiro
  return avisos.sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === NIVEL.incompativel ? -1 : 1))
}

export const avisosDoItem = (avisos, id) => avisos.filter((a) => a.itens.includes(id))
