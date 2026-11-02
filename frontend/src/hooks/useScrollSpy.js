import { useEffect, useState } from 'react'

// Id da seção que está passando numa faixa fina no terço de cima da tela (null até chegar à primeira)
export default function useScrollSpy(ids) {
  const [ativo, setAtivo] = useState(null)
  const chave = ids.join(',')

  useEffect(() => {
    const observador = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((e) => {
          if (e.isIntersecting) setAtivo(e.target.id)
        })
      },
      { rootMargin: '-30% 0px -65% 0px' },
    )
    chave.split(',').forEach((id) => {
      const secao = document.getElementById(id)
      if (secao) observador.observe(secao)
    })
    return () => observador.disconnect()
  }, [chave])

  return ativo
}
