export default function FaqItem({ pergunta, resposta, pendente = false }) {
  return (
    <details className="mb-2.5 rounded-xl border border-line bg-panel px-[18px] py-[15px]">
      <summary className="cursor-pointer text-sm font-bold">{pergunta}</summary>
      <p className="mt-2.5 text-[13.5px] leading-[1.6] text-ink-soft">{pendente ? <em>{resposta}</em> : resposta}</p>
    </details>
  )
}
