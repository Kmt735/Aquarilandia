// Aquário ilustrado, chapado: só cores do tema (azuis, marinho e amarelo da areia), sem gradientes.
// Decorativo — a imagem não carrega informação.
export default function IlustracaoAquario({ className = '' }) {
  return (
    <svg viewBox="0 0 480 400" className={className} aria-hidden="true" focusable="false">
      {/* Móvel */}
      <rect x="64" y="338" width="352" height="22" rx="8" fill="var(--primary-dark)" />
      <rect x="92" y="358" width="18" height="34" rx="6" fill="var(--primary-dark)" />
      <rect x="370" y="358" width="18" height="34" rx="6" fill="var(--primary-dark)" />

      {/* Vidro */}
      <rect x="44" y="58" width="392" height="284" rx="22" fill="var(--surface)" stroke="var(--primary-dark)" strokeWidth="6" />
      {/* Água */}
      <path
        d="M50 104 C96 92 142 116 188 104 S280 92 326 104 S398 116 430 104 V318 a18 18 0 0 1 -18 18 H68 a18 18 0 0 1 -18 -18 Z"
        fill="var(--primary-soft)"
      />
      {/* Tampa */}
      <rect x="32" y="40" width="416" height="26" rx="10" fill="var(--primary-dark)" />
      <rect x="196" y="47" width="88" height="12" rx="6" fill="var(--accent)" />

      {/* Plantas */}
      <g fill="var(--primary)">
        <path d="M104 314 C92 270 98 224 118 186 C126 230 124 276 116 314 Z" />
        <path d="M120 316 C126 268 146 236 170 218 C162 258 148 292 132 318 Z" />
        <path d="M96 316 C80 290 70 262 72 232 C90 252 102 282 106 316 Z" />
      </g>
      <g fill="var(--primary-dark)">
        <path d="M364 316 C352 276 356 234 374 200 C384 240 382 280 374 316 Z" />
        <path d="M380 318 C388 282 402 258 420 244 C414 276 402 300 390 320 Z" />
      </g>

      {/* Areia e pedras */}
      <path
        d="M50 300 C110 286 160 306 226 298 S350 284 430 300 V318 a18 18 0 0 1 -18 18 H68 a18 18 0 0 1 -18 -18 Z"
        fill="var(--accent)"
      />
      <ellipse cx="300" cy="306" rx="26" ry="12" fill="var(--primary-dark)" />
      <ellipse cx="328" cy="312" rx="14" ry="8" fill="var(--primary)" />

      {/* Peixe amarelo */}
      <g>
        <path d="M296 170 l30 -22 v44 z" fill="var(--accent)" />
        <ellipse cx="258" cy="170" rx="46" ry="28" fill="var(--accent)" />
        <path d="M246 143 q14 -14 30 -2" fill="none" stroke="var(--accent)" strokeWidth="9" strokeLinecap="round" />
        <circle cx="232" cy="164" r="5" fill="var(--primary-dark)" />
        <path d="M258 152 q8 18 0 36" fill="none" stroke="var(--primary-dark)" strokeWidth="3" strokeLinecap="round" opacity="0.25" />
      </g>

      {/* Peixe azul */}
      <g>
        <path d="M158 238 l-22 -16 v32 z" fill="var(--primary)" />
        <ellipse cx="186" cy="238" rx="32" ry="19" fill="var(--primary)" />
        <circle cx="203" cy="234" r="4" fill="var(--surface)" />
      </g>

      {/* Peixinho marinho */}
      <g>
        <path d="M352 236 l16 -11 v22 z" fill="var(--primary-dark)" />
        <ellipse cx="334" cy="236" rx="20" ry="12" fill="var(--primary-dark)" />
        <circle cx="324" cy="233" r="2.5" fill="var(--surface)" />
      </g>

      {/* Bolhas */}
      <g fill="none" stroke="var(--primary)" strokeWidth="3">
        <circle cx="214" cy="126" r="7" />
        <circle cx="226" cy="146" r="4" />
        <circle cx="160" cy="150" r="5" />
        <circle cx="392" cy="148" r="8" />
        <circle cx="380" cy="176" r="4" />
      </g>
    </svg>
  )
}
