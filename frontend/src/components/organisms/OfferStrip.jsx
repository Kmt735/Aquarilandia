import { useNavigate } from 'react-router'
import Button from '../atoms/Button'
import Section from '../atoms/Section'
import { urlLoja } from '../../utils/rotas'

export default function OfferStrip() {
  const navigate = useNavigate()

  return (
    <Section>
      <div className="flex flex-col items-start justify-between gap-6 rounded-card bg-ocean px-10 py-9 text-white desk:flex-row desk:items-center">
        <div>
          <h3 className="text-[22px]">Kit Primeiro Aquário 40L — 15% off</h3>
          <p className="mt-1.5 text-[13px] text-[#BEEFF3]">Aquário + filtro + termostato + substrato, tudo compatível.</p>
        </div>
        <Button onClick={() => navigate(urlLoja({ categoria: 'Aquários' }))}>Aproveitar oferta</Button>
      </div>
    </Section>
  )
}
