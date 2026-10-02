// H10 · Ajuda e documentação: "?" com explicação ao passar o mouse ou focar
export default function Tip({ texto, ...props }) {
  return (
    <span
      tabIndex={0}
      aria-label={texto}
      onClick={(e) => e.stopPropagation()}
      className="group relative ml-[5px] inline-flex size-[17px] cursor-help items-center justify-center rounded-full border border-cyan bg-panel-2 align-[2px] font-sans text-[10px] font-extrabold text-cyan outline-none"
      {...props}
    >
      ?
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-[135%] left-1/2 z-30 w-60 -translate-x-1/2 rounded-lg bg-foam px-3 py-2.5 text-left font-sans text-xs font-medium normal-case leading-[1.45] tracking-normal text-bg shadow-[0_8px_24px_rgba(0,0,0,.4)] group-hover:visible group-focus:visible"
      >
        {texto}
      </span>
    </span>
  )
}
