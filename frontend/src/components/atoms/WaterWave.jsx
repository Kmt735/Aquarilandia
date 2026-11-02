import { useEffect, useRef } from 'react'
import useReducedMotion from '../../hooks/useReducedMotion'

// Superfície de água viva: 2–3 ondas SVG sobrepostas. Decorativa (aria-hidden).
// Tudo roda num único requestAnimationFrame que reescreve o atributo `d` dos paths, sem re-render do React:
// o desvio local do mouse e do clique não dá para fazer com transform.
// Scroll e mouse só guardam valores; o laço lê uma vez por quadro (é o próprio throttle).

const LARGURA = 1440 // viewBox
const ALTURA = 120
const PASSO = 24 // distância entre pontos da curva (unidades do viewBox)
const DOIS_PI = Math.PI * 2
const MAXIMO_RESPINGOS = 3
const DURACAO_RESPINGO = 2.2 // s
const VELOCIDADE_RESPINGO = 260 // unidades do viewBox por segundo
const ONDA_RESPINGO = 90

const VARIANTES = {
<<<<<<< Updated upstream
  // Faixa azul de categorias: a camada da frente é a própria cor da faixa
  faixa: [
    { cor: 'var(--wave-back)', opacidade: 0.55, base: 44, amp: 11, onda1: 560, onda2: 250, periodo: 15, sentido: 1, parallax: 0.12, ripple: 0.45, fase: 0 },
    { cor: 'var(--wave-mid)', opacidade: 0.8, base: 60, amp: 10, onda1: 430, onda2: 190, periodo: 11, sentido: -1, parallax: 0.26, ripple: 0.7, fase: 1.7 },
    { cor: 'var(--wave-front)', opacidade: 1, base: 78, amp: 9, onda1: 680, onda2: 310, periodo: 13, sentido: 1, parallax: 0.45, ripple: 1, fase: 3.1 },
  ],
=======
  // Transição do hero para o fundo: a camada da frente é a cor do fundo; as de trás dão o volume da água.
  // `alcance` = px acima/abaixo da faixa em que o mouse ainda levanta a água; `clique` = respingo ao clicar.
  faixa: {
    classe: 'h-16 sm:h-20 desk:h-28',
    agitacao: 0.5,
    velocidadeAgitacao: 1.2,
    rippleAltura: 24,
    rippleRaio: 130,
    alcance: 180,
    clique: true,
    camadas: [
      { cor: 'var(--wave-back)', opacidade: 0.6, base: 46, amp: 18, onda1: 420, onda2: 190, periodo: 9, sentido: 1, parallax: 0.2, ripple: 0.45, fase: 0 },
      { cor: 'var(--wave-mid)', opacidade: 0.95, base: 62, amp: 16, onda1: 320, onda2: 150, periodo: 8, sentido: -1, parallax: 0.45, ripple: 0.7, fase: 1.7 },
      { cor: 'var(--background)', opacidade: 1, base: 80, amp: 14, onda1: 520, onda2: 240, periodo: 11, sentido: 1, parallax: 0.75, ripple: 1, fase: 3.1 },
    ],
  },
>>>>>>> Stashed changes
  // Divisor discreto acima do rodapé (azul-claro sobre branco)
  rodape: {
    classe: 'h-12 sm:h-16 desk:h-20',
    agitacao: 0.6,
    velocidadeAgitacao: 2.5,
    rippleAltura: 16,
    rippleRaio: 110,
    alcance: 0,
    clique: false,
    camadas: [
      { cor: 'var(--primary-soft)', opacidade: 0.6, base: 64, amp: 9, onda1: 600, onda2: 270, periodo: 15, sentido: -1, parallax: 0.1, ripple: 0.5, fase: 0.6 },
      { cor: 'var(--surface-tint)', opacidade: 1, base: 82, amp: 8, onda1: 720, onda2: 330, periodo: 12, sentido: 1, parallax: 0.22, ripple: 1, fase: 2.4 },
    ],
  },
}

// Anel que sai do ponto do clique e perde força com o tempo
function alturaRespingo(x, r) {
  const d = Math.abs(x - r.x)
  const frente = r.idade * VELOCIDADE_RESPINGO
  const distancia = d - frente
  return r.forca * Math.exp(-r.idade * 2.2) * Math.exp(-(distancia * distancia) / (2 * ONDA_RESPINGO * ONDA_RESPINGO)) * Math.cos((distancia / ONDA_RESPINGO) * Math.PI)
}

// Gera o path de uma camada. `desloc` = scroll suavizado, `ganho` = amplitude extra, `mx`/`forca` = ripple do mouse.
function caminho(c, t, desloc, ganho, mx, forca, config, respingos) {
  const k1 = DOIS_PI / c.onda1
  const k2 = DOIS_PI / c.onda2
  const w = (DOIS_PI / c.periodo) * t * c.sentido
  const amp = c.amp * ganho
  const pulso = 0.85 + 0.15 * Math.sin(t * 3.2)
  let d = ''
  let px = 0
  let py = 0

  for (let x = 0; x <= LARGURA; x += PASSO) {
    const xs = x + desloc * c.parallax
    let y = c.base + amp * (0.65 * Math.sin(k1 * xs + w + c.fase) + 0.35 * Math.sin(k2 * xs - w * 1.3 + c.fase))
    if (forca > 0.001) {
      const dx = x - mx
      y -= forca * c.ripple * config.rippleAltura * pulso * Math.exp(-(dx * dx) / (2 * config.rippleRaio * config.rippleRaio))
    }
    for (const r of respingos) y -= c.ripple * alturaRespingo(x, r)
    if (x === 0) {
      d = `M0 ${ALTURA} L0 ${y.toFixed(1)}`
    } else {
      // curva suave: controle no ponto anterior, termina no ponto médio
      d += ` Q${px} ${py.toFixed(1)} ${((px + x) / 2).toFixed(1)} ${((py + y) / 2).toFixed(1)}`
    }
    px = x
    py = y
  }
  return `${d} L${LARGURA} ${py.toFixed(1)} L${LARGURA} ${ALTURA} Z`
}

const BOLHAS = [
  { left: '12%', size: 8, dur: 11, delay: 0.5 },
  { left: '38%', size: 6, dur: 13, delay: 4 },
  { left: '67%', size: 10, dur: 12, delay: 7.5 },
  { left: '86%', size: 7, dur: 14, delay: 2.5 },
]

export default function WaterWave({ variante = 'faixa', bolhas = false, className = '' }) {
  const config = VARIANTES[variante]
  const { camadas } = config
  const reduzido = useReducedMotion()
  const raiz = useRef(null)
  const paths = useRef([])

  useEffect(() => {
    if (reduzido) return
    const el = raiz.current
    if (!el) return

    const finoComHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    const inicio = performance.now()
    let frame = 0
    let visivel = false
    let ultimoScroll = window.scrollY
    let scrollSuave = ultimoScroll
    let agitacao = 0 // 0–1, sobe com a velocidade do scroll e assenta sozinha
    let mouseX = LARGURA / 2
    let forca = 0
    let alvoForca = 0
    let ultimoT = inicio
    const respingos = []

    const quadro = (agora) => {
      const t = (agora - inicio) / 1000
      const dt = Math.max(agora - ultimoT, 1)
      ultimoT = agora

      const y = window.scrollY
      const velocidade = Math.abs(y - ultimoScroll) / dt // px/ms
      ultimoScroll = y
      const alvoAgitacao = Math.min(velocidade / config.velocidadeAgitacao, 1)
      agitacao += (alvoAgitacao - agitacao) * (alvoAgitacao > agitacao ? 0.12 : 0.03)
      scrollSuave += (y - scrollSuave) * 0.12
      forca += (alvoForca - forca) * 0.07

      for (let i = respingos.length - 1; i >= 0; i--) {
        respingos[i].idade += dt / 1000
        if (respingos[i].idade >= DURACAO_RESPINGO) respingos.splice(i, 1)
      }

      const ganho = 1 + config.agitacao * agitacao
      for (let i = 0; i < camadas.length; i++) {
        paths.current[i]?.setAttribute('d', caminho(camadas[i], t, scrollSuave, ganho, mouseX, forca, config, respingos))
      }
      frame = requestAnimationFrame(quadro)
    }

    const sincronizar = () => {
      const rodar = visivel && !document.hidden
      if (rodar && !frame) {
        ultimoT = performance.now()
        ultimoScroll = window.scrollY
        frame = requestAnimationFrame(quadro)
      } else if (!rodar && frame) {
        cancelAnimationFrame(frame)
        frame = 0
      }
    }

    const observador = new IntersectionObserver(([entrada]) => {
      visivel = entrada.isIntersecting
      sincronizar()
    })
    observador.observe(el)
    document.addEventListener('visibilitychange', sincronizar)

    // O mouse é ouvido na janela: a água reage antes de ele chegar à faixa, e a força cai com a distância
    const mover = (e) => {
      if (!visivel) return
      const r = el.getBoundingClientRect()
      const fora = Math.max(r.top - e.clientY, e.clientY - r.bottom, 0)
      if (fora > config.alcance) {
        alvoForca = 0
        return
      }
      mouseX = ((e.clientX - r.left) / r.width) * LARGURA
      alvoForca = config.alcance ? 1 - fora / config.alcance : 1
    }
    const sair = () => {
      alvoForca = 0
    }
    if (finoComHover) {
      window.addEventListener('pointermove', mover, { passive: true })
      document.documentElement.addEventListener('pointerleave', sair, { passive: true })
    }

    const clicar = (e) => {
      const r = el.getBoundingClientRect()
      if (respingos.length >= MAXIMO_RESPINGOS) respingos.shift()
      respingos.push({ x: ((e.clientX - r.left) / r.width) * LARGURA, idade: 0, forca: 22 })
    }
    if (config.clique) el.addEventListener('click', clicar, { passive: true })

    return () => {
      cancelAnimationFrame(frame)
      observador.disconnect()
      document.removeEventListener('visibilitychange', sincronizar)
      window.removeEventListener('pointermove', mover)
      document.documentElement.removeEventListener('pointerleave', sair)
      el.removeEventListener('click', clicar)
    }
  }, [reduzido, camadas, config])

  return (
    <div ref={raiz} aria-hidden="true" className={`relative ${className}`}>
<<<<<<< Updated upstream
      <svg
        viewBox={`0 0 ${LARGURA} ${ALTURA}`}
        preserveAspectRatio="none"
        focusable="false"
        className="block h-[64px] w-full sm:h-[84px] desk:h-[110px]"
      >
=======
      <svg viewBox={`0 0 ${LARGURA} ${ALTURA}`} preserveAspectRatio="none" focusable="false" className={`block w-full ${config.classe}`}>
>>>>>>> Stashed changes
        {camadas.map((c, i) => (
          <path
            key={i}
            ref={(el) => {
              paths.current[i] = el
            }}
            d={caminho(c, 0, 0, 1, 0, 0, config, [])}
            style={{ fill: c.cor, opacity: c.opacidade }}
          />
        ))}
      </svg>
      {bolhas && !reduzido && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-0">
          {BOLHAS.map((b) => (
            <span
              key={b.left}
              className="absolute bottom-[-56px] animate-bolha rounded-full border-2 border-white/70"
              style={{ left: b.left, width: b.size, height: b.size, animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s` }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
