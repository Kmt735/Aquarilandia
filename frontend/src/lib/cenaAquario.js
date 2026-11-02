// Motor do AquariumBackground: um único canvas e um único requestAnimationFrame.
// O estado fica em objetos simples (sem React), para o laço não causar re-render.

const DOIS_PI = Math.PI * 2
const COR_TOKENS = ['--primary', '--primary-dark', '--primary-text', '--accent', '--accent-hover', '--surface', '--warning-text']

// Do maior (mais perto, mais rápido) ao menor (mais longe, mais lento e transparente)
const CARDUME = [
  { cor: '--primary', largura: 34, opacidade: 0.75, dur: 17 },
  { cor: '--accent', largura: 26, opacidade: 0.65, dur: 21 },
  { cor: '--accent-hover', largura: 20, opacidade: 0.55, dur: 25 },
  { cor: '--surface', largura: 16, opacidade: 0.45, dur: 29 },
  { cor: '--primary-dark', largura: 14, opacidade: 0.4, dur: 30 },
]

// Mesmo desenho da IlustracaoAquario, olhando para a direita (viewBox 64 × 36)
const LARGURA_DESENHO = 64
const ALTURA_DESENHO = 36
const CORPO = new Path2D()
CORPO.ellipse(38, 18, 25, 15, 0, 0, DOIS_PI)
const CAUDA = new Path2D('M16 18 L1 6 V30 Z')
const OLHO = new Path2D()
OLHO.arc(51, 14, 3, 0, DOIS_PI)
const LISTRA = new Path2D('M36 7 q7 11 0 22')

export const MAXIMO_PEIXES = CARDUME.length

// O que nunca dispara efeito: controles e imagens; o texto é medido à parte em `sobreTexto`
const NAO_E_AGUA = 'a, button, summary, input, select, textarea, label, svg, img, [role="button"], [tabindex]'
const RAIO_FOME = 280
const MAXIMO_FLOCOS = { desktop: 12, celular: 6 }
const MAXIMO_ONDAS = { desktop: 3, celular: 2 }
const DURACAO_ONDA = 0.9
const RAIO_ONDA = 60
const RAIO_SUSTO = 90
const DURACAO_SUSTO = 0.7
const VELOCIDADE_SUSTO = 300
const RAIO_MOUSE = 120
const MAXIMO_RASTRO = 8
const INTERVALO_RASTRO = 250 // ms; no máximo 4 bolhinhas por segundo
const MAXIMO_ESTOUROS = 4 // 5 partículas cada; só no desktop
const DURACAO_ESTOURO = 0.45
const PARTICULAS_ESTOURO = 5
const VELOCIDADE_MOUSE_RAPIDO = 900 // px/s
const ESPERA_CURIOSO = 2 // s com o mouse parado até um peixe vir ver
const INTERVALO_MOUSE = 50 // ms; o movimento do mouse é lido no máximo 20 vezes por segundo

function sortear(min, max) {
  return min + Math.random() * (max - min)
}

function limitar(valor, min, max) {
  return Math.min(Math.max(valor, min), max)
}

// Aceita px (número) ou porcentagem da altura (string)
function medida(valor, total) {
  return typeof valor === 'string' ? (parseFloat(valor) / 100) * total : valor
}

function sobreTexto(el, x, y) {
  for (const no of el.childNodes) {
    if (no.nodeType !== Node.TEXT_NODE || !no.textContent.trim()) continue
    const faixa = document.createRange()
    faixa.selectNodeContents(no)
    for (const r of faixa.getClientRects()) {
      if (x >= r.left - 4 && x <= r.right + 4 && y >= r.top - 4 && y <= r.bottom + 4) return true
    }
  }
  return false
}

// true só quando o ponteiro está na água livre, fora de links, botões, cartões e texto
function aguaLivre(area, alvo, x, y) {
  if (alvo === area) return true
  const controle = alvo.closest(NAO_E_AGUA)
  if (controle && area.contains(controle)) return false
  const fundo = getComputedStyle(alvo).backgroundColor
  if (fundo !== 'transparent' && fundo !== 'rgba(0, 0, 0, 0)') return false
  return !sobreTexto(alvo, x, y)
}

function criarBolha(i, parada) {
  return {
    x: sortear(0.01, 0.98), // fração da largura
    t: parada ? sortear(0.05, 0.9) : Math.random(), // progresso da subida
    dur: sortear(12, 24),
    diametro: Math.round(sortear(2, 10)),
    deriva: Math.round(sortear(6, 18)) * (i % 2 ? 1 : -1),
    cheia: i % 4 === 0,
    espera: 0, // depois de estourar, tempo até subir de novo
  }
}

export function criarCena(canvas, { peixes, bolhas, raias, animado, interativo, celular }) {
  const ctx = canvas.getContext('2d')
  const area = canvas.parentElement
  const limite = celular ? 'celular' : 'desktop'
  const cores = {}
  let W = 0
  let H = 0
  let frame = 0
  let ultimo = 0
  let visivel = false
  let relogio = 0

  const cardume = CARDUME.slice(0, peixes).map((c, i) => {
    const raia = raias[i]
    return {
      ...c,
      raia,
      altura: (c.largura * ALTURA_DESENHO) / LARGURA_DESENHO,
      progresso: animado ? Math.random() : 0.2 + i * 0.18, // posição inicial na raia
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      casaY: 0,
      sentido: i % 2 ? -1 : 1,
      olhar: i % 2 ? -1 : 1, // -1 a 1: passa pelo zero ao virar, dando a impressão de giro
      fase: sortear(0, DOIS_PI),
      ondaVel: DOIS_PI / (3 + i * 0.7),
      cauda: sortear(0, DOIS_PI),
      ritmo: 1,
      pausa: 0,
      mordida: 0,
      susto: 0,
      fugaX: 0,
      fugaY: 0,
      proximaManha: sortear(3, 9),
    }
  })
  const cardumeBolhas = Array.from({ length: bolhas }, (_, i) => criarBolha(i, !animado))
  const flocos = []
  const ondas = []
  const estouros = []
  const rastro = []
  let rastroEm = 0
  let curioso = null
  const mouse = { x: 0, y: 0, naAgua: false, velocidade: 0, lidoEm: 0, movidoEm: -1 }

  function limitesRaia(p) {
    const de = (p.raia.de / 100) * W + p.largura / 2
    const ate = (p.raia.ate / 100) * W - p.largura / 2
    return { de, ate }
  }

  function lerCores() {
    const estilo = getComputedStyle(canvas)
    for (const token of COR_TOKENS) cores[token] = estilo.getPropertyValue(token).trim()
  }

  function medir() {
    const r = canvas.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const inicial = W === 0
    W = r.width
    H = r.height
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    for (const p of cardume) {
      const { de, ate } = limitesRaia(p)
      p.casaY = p.raia.top !== undefined ? medida(p.raia.top, H) + p.altura / 2 : H - medida(p.raia.bottom, H) - p.altura / 2
      if (inicial) {
        p.x = de + (ate - de) * p.progresso
        p.y = p.casaY
      } else {
        p.x = limitar(p.x, p.largura / 2, W - p.largura / 2)
        p.y = limitar(p.y, p.altura / 2, H - p.altura / 2)
      }
    }
  }

  // Pequenas manias de cada peixe, para o nado não virar um laço perfeito
  function sortearManha(p) {
    const sorte = Math.random()
    if (sorte < 0.35) p.pausa = sortear(0.5, 1.5)
    else if (sorte < 0.6) p.sentido *= -1
    else p.ritmo = sortear(0.7, 1.3)
    p.proximaManha = sortear(4, 10)
  }

  function flocoMaisProximo(p) {
    let escolhido = null
    let menor = RAIO_FOME
    for (const f of flocos) {
      const distancia = Math.hypot(f.x - p.x, f.y - p.y)
      if (distancia < menor) {
        menor = distancia
        escolhido = f
      }
    }
    return escolhido
  }

  function nadarNaRaia(p, dt) {
    const { de, ate } = limitesRaia(p)
    const alvoX = p.sentido > 0 ? ate : de
    const distancia = Math.abs(alvoX - p.x)
    if (distancia < 2) p.sentido *= -1

    p.proximaManha -= dt
    if (p.proximaManha <= 0) sortearManha(p)
    p.pausa = Math.max(p.pausa - dt, 0)

    const velocidade = p.pausa > 0 ? 0 : ((ate - de) / (p.dur / 2)) * p.ritmo * limitar(distancia / 60, 0.25, 1)
    const onda = Math.sin(relogio * p.ondaVel + p.fase) * 3
    return [p.sentido * velocidade, (p.casaY + onda - p.y) * 2]
  }

  // Vai até o floco; quando a boca alcança, come e dá uma mordidinha
  function irAoFloco(p, floco) {
    const boca = p.x + Math.sign(p.olhar) * p.largura * 0.4
    if (Math.hypot(floco.x - boca, floco.y - p.y) < 4 + p.largura * 0.2) {
      flocos.splice(flocos.indexOf(floco), 1)
      p.mordida = 0.3
      return [0, 0]
    }
    const dx = floco.x - p.x
    const dy = floco.y - p.y
    const distancia = Math.hypot(dx, dy) || 1
    const velocidade = 70 + p.largura * 1.5
    return [(dx / distancia) * velocidade, (dy / distancia) * velocidade]
  }

  // Dispara na direção oposta ao susto; a força cai até o peixe voltar ao normal
  function assustar(p, deX, deY) {
    const dx = p.x - deX
    const dy = p.y - deY
    const distancia = Math.hypot(dx, dy) || 1
    p.fugaX = dx / distancia
    p.fugaY = dy / distancia
    p.susto = DURACAO_SUSTO
    p.mordida = 0
    p.pausa = 0
  }

  // Mouse devagar por perto: só um desvio suave
  function desvio(p) {
    if (relogio - mouse.movidoEm > 0.25) return [0, 0]
    const dx = p.x - mouse.x
    const dy = p.y - mouse.y
    const distancia = Math.hypot(dx, dy) || 1
    if (distancia > RAIO_MOUSE) return [0, 0]
    const forca = (1 - distancia / RAIO_MOUSE) * 70
    return [(dx / distancia) * forca, (dy / distancia) * forca * 0.5]
  }

  // Mouse parado na água: o peixe mais próximo vem devagar e fica ao lado; ao mexer, cada um segue o seu nado
  function escolherCurioso() {
    if (!mouse.naAgua || relogio - mouse.movidoEm < ESPERA_CURIOSO) {
      curioso = null
      return
    }
    if (curioso) return
    let menor = Infinity
    for (const p of cardume) {
      const distancia = Math.hypot(p.x - mouse.x, p.y - mouse.y)
      if (p.susto === 0 && distancia < menor) {
        menor = distancia
        curioso = p
      }
    }
  }

  function chegarPerto(p) {
    const lado = p.x < mouse.x ? -1 : 1
    const alvoX = mouse.x + lado * (p.largura / 2 + 26)
    const alvoY = mouse.y + Math.sin(relogio * 1.5 + p.fase) * 5
    const dx = alvoX - p.x
    const dy = alvoY - p.y
    const distancia = Math.hypot(dx, dy) || 1
    const velocidade = Math.min(45, distancia * 2)
    return [(dx / distancia) * velocidade, (dy / distancia) * velocidade]
  }

  function vontade(p, dt, floco) {
    if (p.susto > 0) {
      const forca = (p.susto / DURACAO_SUSTO) * VELOCIDADE_SUSTO
      return [p.fugaX * forca, p.fugaY * forca]
    }
    if (p.mordida > 0) return [0, 0]
    if (floco) return irAoFloco(p, floco)
    return p === curioso ? chegarPerto(p) : nadarNaRaia(p, dt)
  }

  function atualizarPeixe(p, dt) {
    p.mordida = Math.max(p.mordida - dt, 0)
    p.susto = Math.max(p.susto - dt, 0)
    const floco = flocoMaisProximo(p)
    const [nadoX, nadoY] = vontade(p, dt, floco)
    const [desvioX, desvioY] = desvio(p)
    const desejadoX = nadoX + desvioX
    const desejadoY = nadoY + desvioY

    const resposta = 1 - Math.exp(-dt * (p.susto > 0 ? 12 : floco ? 6 : 3))
    p.vx += (desejadoX - p.vx) * resposta
    p.vy += (desejadoY - p.vy) * resposta
    p.x = limitar(p.x + p.vx * dt, p.largura / 2, W - p.largura / 2)
    p.y = limitar(p.y + p.vy * dt, p.altura / 2, H - p.altura / 2)

    const direcao = p === curioso ? Math.sign(mouse.x - p.x) : Math.abs(p.vx) > 1 ? Math.sign(p.vx) : 0
    if (direcao) p.olhar += (direcao - p.olhar) * (1 - Math.exp(-dt * 8))
    p.cauda += dt * (4 + Math.hypot(p.vx, p.vy) * 0.06)
  }

  function soltarFlocos(x, y) {
    const quantidade = Math.min(Math.round(sortear(3, 6)), MAXIMO_FLOCOS[limite] - flocos.length)
    for (let i = 0; i < quantidade; i++) {
      flocos.push({
        x: x + sortear(-20, 20),
        y: y + sortear(-6, 6),
        raio: sortear(1.5, 2.5),
        vel: sortear(18, 30),
        fase: sortear(0, DOIS_PI),
        cor: i % 2 ? '--accent' : '--warning-text',
        opacidade: 1,
      })
    }
  }

  function atualizarFlocos(dt) {
    for (let i = flocos.length - 1; i >= 0; i--) {
      const f = flocos[i]
      f.y += f.vel * dt
      f.x += Math.sin(relogio * 1.6 + f.fase) * 8 * dt
      if (f.y > H - 24) f.opacidade -= dt / 1.5 // os que sobram somem no fundo
      if (f.opacidade <= 0) flocos.splice(i, 1)
    }
  }

  function desenharFloco(f) {
    ctx.globalAlpha = f.opacidade * 0.9
    ctx.fillStyle = cores[f.cor]
    ctx.beginPath()
    ctx.arc(f.x, f.y, f.raio, 0, DOIS_PI)
    ctx.fill()
  }

  function baterNoVidro(x, y) {
    if (ondas.length >= MAXIMO_ONDAS[limite]) ondas.shift()
    ondas.push({ x, y, idade: 0 })
    for (const p of cardume) {
      if (Math.hypot(p.x - x, p.y - y) < RAIO_SUSTO) assustar(p, x, y)
    }
  }

  function atualizarOndas(dt) {
    for (let i = ondas.length - 1; i >= 0; i--) {
      ondas[i].idade += dt
      if (ondas[i].idade >= DURACAO_ONDA) ondas.splice(i, 1)
    }
  }

  function desenharOnda(o) {
    const t = o.idade / DURACAO_ONDA
    ctx.globalAlpha = (1 - t) * 0.3
    ctx.strokeStyle = cores['--primary-text']
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(o.x, o.y, 6 + t * RAIO_ONDA, 0, DOIS_PI)
    ctx.stroke()
  }

  function posicaoBolha(b) {
    return { x: b.x * W + b.deriva * Math.sin(b.t * DOIS_PI), y: H + 6 - b.t * (H + 12) }
  }

  function estourarBolhas(x, y) {
    if (celular) return
    for (const b of cardumeBolhas) {
      if (b.espera > 0) continue
      const pos = posicaoBolha(b)
      if (Math.hypot(pos.x - x, pos.y - y) > b.diametro / 2 + 6) continue
      b.espera = sortear(1.5, 5)
      b.t = 0
      if (estouros.length >= MAXIMO_ESTOUROS) estouros.shift()
      estouros.push({ x: pos.x, y: pos.y, raio: b.diametro / 2, idade: 0 })
    }
  }

  function deixarRastro(x, y, agora) {
    if (agora - rastroEm < INTERVALO_RASTRO || rastro.length >= MAXIMO_RASTRO) return
    rastroEm = agora
    rastro.push({ x, y, raio: sortear(0.75, 1.75), vel: sortear(40, 70), vida: sortear(1.2, 2), idade: 0, fase: sortear(0, DOIS_PI) })
  }

  function atualizarRastro(dt) {
    for (let i = rastro.length - 1; i >= 0; i--) {
      const r = rastro[i]
      r.idade += dt
      r.y -= r.vel * dt
      r.x += Math.sin(relogio * 3 + r.fase) * 10 * dt
      if (r.idade >= r.vida) rastro.splice(i, 1)
    }
  }

  function desenharRastro(r) {
    ctx.globalAlpha = (1 - r.idade / r.vida) * 0.45
    ctx.strokeStyle = cores['--primary-text']
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(r.x, r.y, r.raio, 0, DOIS_PI)
    ctx.stroke()
  }

  function atualizarEstouros(dt) {
    for (let i = estouros.length - 1; i >= 0; i--) {
      estouros[i].idade += dt
      if (estouros[i].idade >= DURACAO_ESTOURO) estouros.splice(i, 1)
    }
  }

  function desenharEstouro(e) {
    const t = e.idade / DURACAO_ESTOURO
    const alcance = e.raio + 3 + t * 9
    ctx.globalAlpha = (1 - t) * 0.5
    ctx.strokeStyle = cores['--primary-text']
    ctx.fillStyle = cores['--primary-text']
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(e.x, e.y, e.raio + t * 6, 0, DOIS_PI)
    ctx.stroke()
    for (let i = 0; i < PARTICULAS_ESTOURO; i++) {
      const angulo = (i / PARTICULAS_ESTOURO) * DOIS_PI + 0.4
      ctx.beginPath()
      ctx.arc(e.x + Math.cos(angulo) * alcance, e.y + Math.sin(angulo) * alcance, 1, 0, DOIS_PI)
      ctx.fill()
    }
  }

  function atualizarBolha(b, dt) {
    if (b.espera > 0) {
      b.espera -= dt
      return
    }
    b.t += dt / b.dur
    if (b.t >= 1) b.t -= 1
  }

  function desenharBolha(b) {
    if (b.espera > 0) return
    const raio = b.diametro / 2
    const { x, y } = posicaoBolha(b)
    let opacidade = 0.4
    if (animado) opacidade = b.t < 0.08 ? (b.t / 0.08) * 0.8 : b.t > 0.8 ? ((1 - b.t) / 0.2) * 0.6 : 0.7
    ctx.globalAlpha = opacidade
    ctx.beginPath()
    ctx.arc(x, y, raio, 0, DOIS_PI)
    if (b.cheia) {
      ctx.fillStyle = cores['--primary-text']
      ctx.globalAlpha = opacidade * 0.15
      ctx.fill()
      ctx.globalAlpha = opacidade
    }
    ctx.strokeStyle = cores['--primary-text']
    ctx.lineWidth = 1
    ctx.globalAlpha = opacidade * 0.5
    ctx.stroke()
  }

  function desenharPeixe(p) {
    const escala = p.largura / LARGURA_DESENHO
    const virada = Math.abs(p.olhar) < 0.08 ? 0.08 * (p.olhar < 0 ? -1 : 1) : p.olhar
    ctx.save()
    ctx.globalAlpha = p.opacidade
    ctx.translate(p.x, p.y)
    const mordida = 1 + Math.sin((p.mordida / 0.3) * Math.PI) * 0.14
    ctx.scale(virada * escala * mordida, escala * mordida)
    ctx.translate(-LARGURA_DESENHO / 2, -ALTURA_DESENHO / 2)

    ctx.fillStyle = cores[p.cor]
    ctx.save()
    ctx.translate(16, 18)
    ctx.rotate(Math.sin(p.cauda) * 0.17)
    ctx.translate(-16, -18)
    ctx.fill(CAUDA)
    ctx.restore()
    ctx.fill(CORPO)

    ctx.fillStyle = cores['--primary-dark']
    ctx.fill(OLHO)
    ctx.globalAlpha = p.opacidade * 0.25
    ctx.strokeStyle = cores['--primary-dark']
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.stroke(LISTRA)
    ctx.restore()
  }

  function desenhar() {
    ctx.clearRect(0, 0, W, H)
    for (const b of cardumeBolhas) desenharBolha(b)
    for (const r of rastro) desenharRastro(r)
    for (const e of estouros) desenharEstouro(e)
    for (const o of ondas) desenharOnda(o)
    for (const f of flocos) desenharFloco(f)
    for (const p of cardume) desenharPeixe(p)
    ctx.globalAlpha = 1
  }

  function quadro(agora) {
    const dt = Math.min((agora - ultimo) / 1000, 0.05) // depois de pausar, não dá salto
    ultimo = agora
    relogio += dt
    for (const b of cardumeBolhas) atualizarBolha(b, dt)
    atualizarFlocos(dt)
    atualizarOndas(dt)
    atualizarEstouros(dt)
    atualizarRastro(dt)
    escolherCurioso()
    for (const p of cardume) atualizarPeixe(p, dt)
    desenhar()
    frame = requestAnimationFrame(quadro)
  }

  function pontoNaTela(e) {
    const r = canvas.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  // `click` (e não pointerdown): rolar a página no celular não alimenta os peixes.
  // Só observa: nunca chama preventDefault, então links e botões seguem iguais.
  function aoClicar(e) {
    if (!aguaLivre(area, e.target, e.clientX, e.clientY)) return
    if (!document.getSelection()?.isCollapsed) return
    const { x, y } = pontoNaTela(e)
    soltarFlocos(x, y)
    baterNoVidro(x, y)
    estourarBolhas(x, y)
  }

  function aoMover(e) {
    if (e.pointerType !== 'mouse') return
    const agora = performance.now()
    const intervalo = agora - mouse.lidoEm
    if (intervalo < INTERVALO_MOUSE) return
    const { x, y } = pontoNaTela(e)
    mouse.velocidade = (Math.hypot(x - mouse.x, y - mouse.y) / intervalo) * 1000
    mouse.x = x
    mouse.y = y
    mouse.lidoEm = agora
    mouse.movidoEm = relogio
    mouse.naAgua = aguaLivre(area, e.target, e.clientX, e.clientY)
    if (mouse.naAgua) {
      estourarBolhas(x, y)
      deixarRastro(x, y, agora)
    }
    if (mouse.velocidade < VELOCIDADE_MOUSE_RAPIDO) return
    for (const p of cardume) {
      if (Math.hypot(p.x - x, p.y - y) < RAIO_MOUSE) assustar(p, x, y)
    }
  }

  function aoSair() {
    mouse.naAgua = false
  }

  function sincronizar() {
    const rodar = animado && visivel && !document.hidden
    if (rodar && !frame) {
      ultimo = performance.now()
      frame = requestAnimationFrame(quadro)
    } else if (!rodar && frame) {
      cancelAnimationFrame(frame)
      frame = 0
    }
  }

  lerCores()
  medir()
  desenhar()

  const aoRedimensionar = new ResizeObserver(() => {
    medir()
    desenhar()
  })
  aoRedimensionar.observe(canvas)

  const aoTrocarTema = new MutationObserver(() => {
    lerCores()
    desenhar()
  })
  aoTrocarTema.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

  const observador = new IntersectionObserver(([entrada]) => {
    visivel = entrada.isIntersecting
    sincronizar()
  })
  observador.observe(canvas)
  document.addEventListener('visibilitychange', sincronizar)

  const escutar = interativo && animado
  if (escutar) area.addEventListener('click', aoClicar, { passive: true })
  if (escutar && !celular && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    area.addEventListener('pointermove', aoMover, { passive: true })
    area.addEventListener('pointerleave', aoSair, { passive: true })
  }

  return function destruir() {
    cancelAnimationFrame(frame)
    aoRedimensionar.disconnect()
    aoTrocarTema.disconnect()
    observador.disconnect()
    document.removeEventListener('visibilitychange', sincronizar)
    area.removeEventListener('click', aoClicar)
    area.removeEventListener('pointermove', aoMover)
    area.removeEventListener('pointerleave', aoSair)
  }
}
