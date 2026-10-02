const estilos = {
  info: 'border-gold/35 bg-gold/8 text-gold-light',
  alerta: 'border-gold/35 bg-gold/8 text-gold-light',
  ok: 'border-mint/40 bg-mint/8 text-[#8FF0C4]',
}

export default function Hint({ tipo = 'info', children }) {
  return <div className={`mt-3.5 rounded-[10px] border px-3 py-2.5 text-xs leading-[1.45] ${estilos[tipo]}`}>{children}</div>
}
