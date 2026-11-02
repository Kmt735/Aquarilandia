import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'test-results', 'playwright-report']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    files: ['testes/**/*.mjs', 'playwright.config.mjs'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  {
    // Componentes gerados pelo shadcn/ui exportam variantes (cva) junto com os componentes
    files: ['src/components/ui/**/*.jsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
])
export const peixes = [
  {
    id: 'acara-disco',
    nome: 'Acará Disco',
    cientifico: 'Symphysodon spp.',
    categoria: 'Peixes',
    preco: 30,
    icone: '🐠',
    foto: '/peixes/acara-disco.jpg',
    descricao: 'Corpo achatado e redondo, como um disco, com nadadeiras longas que acompanham o formato do corpo. Tem muitos padrões e cores, de listras turquesa a tons de vermelho e marrom. Vive melhor em grupo e é muito sensível à qualidade da água.',
    tamanhoAdulto: '15 a 20 cm',
    cores: 'Turquesa, vermelho, marrom e laranja (variam bastante entre as linhagens)',
    agua: 'Doce · 28-30°C',
    temperamento: 'Pacífico',
    aquarioMinimo: '150L',
    dificuldade: '●●● Avançado',
    disponivel: true,
    compativelCom: 'Néon Cardinal e Corydoras',
    caracteristicas: { doce: true, salgada: false, pacifico: true, facil: false },
  },
  {
    id: 'betta-splendens',
    nome: 'Betta Splendens',
    cientifico: 'Betta splendens',
    categoria: 'Peixes',
    preco: 20,
    icone: '🐟',
    foto: '/peixes/betta-splendens.jpg',
    descricao: 'O macho se destaca pelas nadadeiras longas e coloridas, que abrem como um leque quando ele se exibe. Aparece em azul, vermelho, branco e várias misturas. As fêmeas são menores e têm cores mais discretas.',
    tamanhoAdulto: '6 a 7 cm',
    cores: 'Azul, vermelho, branco e combinações',
    ph: 'X',
    agua: 'Doce · 24-27°C',
    temperamento: 'Territorial',
    aquarioMinimo: '20L',
    dificuldade: '●○○ Fácil',
    disponivel: true,
    compativelCom: 'Corydoras; evite peixes de nadadeira longa e outros bettas machos',
    caracteristicas: { doce: true, salgada: false, pacifico: false, facil: true },
  },
  {
    id: 'kinguio-ranchu',
    nome: 'Kinguio Ranchu',
    cientifico: 'Carassius auratus',
    categoria: 'Peixes',
    preco: 40,
    icone: '🥇',
    ph: 'X',
    foto: '/peixes/kinguio-ranchu.jpg',
    descricao: 'Corpo curto e arredondado, com o dorso curvo e sem nadadeira dorsal. É conhecido pelo "capuz", um crescimento carnudo sobre a cabeça. A cauda é curta, em formato de leque.',
    tamanhoAdulto: 'Cerca de 15 cm',
    cores: 'Laranja, vermelho e branco',
    agua: 'Doce · 18-22°C',
    temperamento: 'Pacífico',
    aquarioMinimo: '80L',
    dificuldade: '●○○ Fácil',
    disponivel: false,
    compativelCom: 'outros kinguios (peixes de água mais fria)',
    caracteristicas: { doce: true, salgada: false, pacifico: true, facil: true },
  },
]
