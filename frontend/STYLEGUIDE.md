# Guia de estilo da Aquarilândia

Este é o "guia de estilo comum" da Atividade 05 (item 4). Os 4 integrantes seguem as mesmas regras, então o site
parece uma coisa só, não importa quem fez cada tela.

> **Regra de ouro:** use os tokens e os componentes daqui. Não escreva cor em hex, `text-white`, `bg-blue-500`
> nem `text-[13px]` em componente. Se faltar algo, crie o token ou o componente aqui primeiro.

---

## 1. Conceito visual: "aquário à noite"

- O fundo escuro é a água. O conteúdo parece iluminado pela luminária do aquário.
- O brilho (`shadow-glow`, `luz-luminaria`, bolhas) é **detalhe**: foco, borda em destaque e hover. Nunca é cor de
  texto corrido (item 23: neon em excesso polui; item 39: figura-fundo).
- O tema claro usa **os mesmos tokens**, com outros valores. Toda cor tem as duas versões em `src/index.css`.

## 2. Cores (tokens)

Definidos em `src/index.css` (`:root` = claro, `.dark` = escuro) e expostos ao Tailwind por `@theme inline`.
Os nomes ficaram em inglês porque o shadcn/ui depende deles. O glossário em português está abaixo.

### Glossário dos tokens

| Token (classe Tailwind) | Em português | Papel | Claro | Escuro |
| --- | --- | --- | --- | --- |
| `background` (`bg-background`) | cor-fundo | Fundo da página | `#ffffff` | `#071433` |
| `surface` (`bg-surface`) | cor-superfície | Cards, cabeçalho, gavetas | `#ffffff` | `#0b1c45` |
| `surface-elevated` | cor-superfície-elevada | Modais, toasts, popovers | `#ffffff` | `#102457` |
| `surface-tint` | cor-superfície-água | Hero, cabeçalho das páginas, área de imagem | `#eff6ff` | `#0e2150` |
| `surface-muted` | cor-superfície-neutra | Skeleton, selo neutro | `#f3f7fc` | `#11265a` |
| `foreground` (`text-foreground`) | cor-texto | Texto principal | `#0f2a6b` | `#e8eefc` |
| `text-muted` (`text-text-muted`) | cor-texto-secundário | Descrições, legendas | `#475569` | `#a9b8d6` |
| `border` | cor-borda | Divisórias decorativas | `#dce6f2` | `#1b3166` |
| `border-strong` | cor-borda-card | Contorno de cards | `#bfd0e6` | `#2a4580` |
| `border-control` | cor-borda-campo | Contorno de campos, botões secundários, rádios (3:1) | `#7d93b8` | `#5574b4` |
| `primary` (`bg-primary`) | **cor-ação** | Fundo do botão primário. **Única cor de ação principal.** | `#1d4ed8` | `#2f5fe0` |
| `primary-text` | cor-ação-texto | Links, preços em destaque, ícones, foco | `#1d4ed8` | `#8db0ff` |
| `primary-soft` | cor-ação-suave | Fundo de selos e ícones | `#dbeafe` | `#16306e` |
| `primary-dark` | cor-marinho | Faixas de chamada (CTA) | `#0f2a6b` | `#0f2a6b` |
| `accent` (`bg-accent`) | **cor-destaque** (dourado) | Só o carrinho do cabeçalho, o WhatsApp flutuante e detalhes (sublinhado, areia, "Em breve") | `#fbbf24` | `#fbbf24` |
| `accent-foreground` | cor-sobre-destaque | Texto sobre o amarelo (nunca branco) | `#0f2a6b` | `#0f2a6b` |
| `success-text` / `success-soft` | cor-sucesso | Disponível, pagamento aprovado | `#15803d` / `#f0fdf4` | `#4ade80` / `#0d2e2a` |
| `warning-text` / `warning-soft` | cor-aviso | Sob encomenda, conteúdo pendente | `#b45309` / `#fef3c7` | `#fbbf24` / `#3a2f10` |
| `danger` / `danger-text` / `danger-soft` | cor-erro | Contador do carrinho (fundo), erros (texto) | `#dc2626` / `#b91c1c` / `#fef2f2` | `#dc2626` / `#f87171` / `#3a1420` |
| `info-text` / `info-soft` | cor-informação | Entrega só em São João del Rei, dicas | = `primary-text` / `primary-soft` | idem |

### Papéis fixos (item 4 · consistência; item 39 · semelhança)

- **Azul preenchido = ação principal**, sempre: "Adicionar ao carrinho", "Finalizar compra", "Solicitar orçamento",
  "Entrar", "Continuar". A mesma ação tem a mesma cor em todo o site.
- **Amarelo = atalho persistente**: o carrinho no cabeçalho e o WhatsApp flutuante. Nunca é botão dentro do conteúdo.
- **WhatsApp é canal de dúvida**, não de compra: dentro do conteúdo ele é sempre botão **secundário** ou link.
- **Verde, âmbar e vermelho** só indicam estado, e sempre vêm com **ícone e texto** (nada depende só da cor).

### Contraste (WCAG 2.1 AA, item 25)

Todos os pares foram medidos nos dois temas: texto ≥ 4,5:1; componentes e bordas de campo ≥ 3:1. Os tons que
precisaram de ajuste aparecem como `AA:` no `index.css`:

| Token | Antes → depois | Contraste antes → depois |
| --- | --- | --- |
| `border-control` claro (novo; antes os campos usavam `border-strong`) | `#bfd0e6` → `#7d93b8` | 1,57 → 3,12 (no branco) |
| `border-control` escuro | `#2a4580` → `#5574b4` | 1,79 → 3,59 (na superfície) |
| `danger` escuro (fundo do contador) | `#ef4444` → `#dc2626` | 3,76 → 4,83 (texto branco) |
| `danger-text` claro (novo, erro em texto) | `#dc2626` → `#b91c1c` | 4,83 → 6,47 (no branco) |
| `danger-text` escuro (novo, erro em texto) | `#ef4444` → `#f87171` | 4,82 → 6,56 (no fundo) |

## 3. Tipografia

Famílias: **Nunito** (títulos, `font-display`) e **Nunito Sans** (texto, `font-sans`). A escala é modular, com
razão 1,25. Os títulos são fluidos entre 375 e 1440 px.

| Classe | Tamanho | Uso |
| --- | --- | --- |
| `text-display` | 40 → 64 px | Só o H1 do hero |
| `text-h1` | 32 → 52 px | H1 das páginas (**um por página**) |
| `text-h2` | 24 → 36 px | Título de seção |
| `text-h3` | 20 px | Título de bloco, modal |
| `text-h4` | 18 px | Título de card |
| `text-corpo-lg` | 18 px | Texto de abertura |
| `text-corpo` | 16 px (entrelinha 1,65) | Texto corrido |
| `text-pequeno` | 14 px | Botões, listas, rótulos |
| `text-legenda` | 13 px | Ajuda, notas |
| `text-micro` | 12 px | Selos e contador (mínimo do site) |

Hierarquia: **um H1 por página**. As seções usam H2 e os cards usam H3. Não pule níveis (`SectionHead` e
`CardItem` aceitam `nivel`/`nivelTitulo`).

## 4. Espaço, raios, sombras, camadas e movimento

- **Espaçamento:** grade de 4 px (escala padrão do Tailwind: `gap-2` = 8 px, `p-5` = 20 px…). Use só a escala.
- **Largura do conteúdo:** `max-w-[1200px]` com `px-4 sm:px-6 desk:px-10`. Breakpoint `desk` = 900 px.
- **Raios:** `rounded-sm` 8 · `rounded-lg` 12 · `rounded-card` 16 (cards) · `rounded-faixa` 24 (faixas, cartões de
  formulário) · `rounded-full` (botões, selos).
- **Sombras:** `shadow-soft` (leve), `shadow-pop` (o que flutua), `shadow-glow` (hover e foco de destaque,
  azul), `shadow-glow-accent` (hover do amarelo).
- **Camadas:** `z-(--z-header)` 40 · `z-(--z-flutuante)` 45 · `z-(--z-overlay)` 50 · `z-(--z-toast)` 100.
- **Movimento:** `duration-(--dur-rapida)` 150 ms · `--dur-media` 250 ms · `--dur-lenta` 400 ms · `ease-saida`.
  Tudo para quando o sistema pede `prefers-reduced-motion` (regra global no `index.css` e `useReducedMotion`).
- **Alvo de toque:** mínimo 44 × 44 px. Botões já têm `h-11`. Elementos visualmente menores usam a classe
  `alvo-toque`, que aumenta a área clicável sem mudar o desenho.

## 5. Botões

`components/atoms/Button.jsx`: `variant` × `tamanho` (`sm`, `md`, `lg`) e `largo` (largura total).

| Variante | Visual | Quando usar |
| --- | --- | --- |
| `primario` | Azul preenchido | A ação principal do bloco. **No máximo 1 por bloco** (item 29). |
| `secundario` | Contorno | Alternativa: "Tirar dúvida no WhatsApp", "Voltar", "Avise-me quando chegar" |
| `terciario` | Texto azul | Ações leves: "Limpar filtros", "Editar", "Sair" |
| `link` | Sublinhado | Dentro de texto |
| `perigo` | Vermelho | Confirmação destrutiva ("Sim, cancelar") |
| `destaque` | Amarelo | Reservado (carrinho do cabeçalho) |

Botão só de ícone: `atoms/IconButton` com `aria-label` **obrigatório**.

## 6. Componentes base

| Componente | Arquivo | Para quê | Acessibilidade |
| --- | --- | --- | --- |
| **CardItem** (card único) | `molecules/CardItem.jsx` | Peixes **e** produtos: imagem → selos → nome → nome científico → até 3 chips → preço → "Adicionar ao carrinho". Esgotado: botão desabilitado + "Avise-me quando chegar". | O card inteiro abre os detalhes por um link esticado no nome; o botão fica acima e não dispara o clique do card. |
| CardItemSkeleton | `molecules/CardItem.jsx` | Carregamento das grades | `aria-busy` na lista |
| StatusBadge | `atoms/StatusBadge.jsx` | `disponivel`, `encomenda`, `esgotado`, `entrega-local` | Ícone + texto |
| StatusPedidoBadge | `atoms/StatusPedidoBadge.jsx` | Status da compra (`utils/statusPedido.js`) | Ícone + texto |
| InfoChip | `atoms/InfoChip.jsx` | Dado de compatibilidade no card (temperamento, aquário mínimo, temperatura) | Rótulo `sr-only` |
| Preco | `atoms/Preco.jsx` | **Todo preço** do site, via `formatarPreco` | — |
| Imagem | `atoms/Imagem.jsx` | Foto com proporção fixa; sem foto, mostra uma cena ilustrada com o ícone da categoria | `alt` vem do dado |
| Galeria | `molecules/Galeria.jsx` | Foto principal + miniaturas (quando houver mais de uma) | `aria-current` |
| Termo | `atoms/Termo.jsx` | "O que é isso?" dos termos técnicos (`data/glossario.js`) | Popover: abre no toque, no clique e no teclado; Esc fecha |
| Input, Select, Textarea, CampoSenha, Checkbox | `atoms/` | Campos (borda `border-control`) | `aria-invalid` automático |
| FormField | `molecules/FormField.jsx` | Rótulo + campo + ajuda + erro embaixo | Liga o erro com `aria-describedby`; marca obrigatórios |
| SeletorQuantidade | `molecules/SeletorQuantidade.jsx` | −/+ com máximo = estoque | Valor anunciado (`aria-live`) |
| Aviso | `molecules/Aviso.jsx` | Caixa info / sucesso / aviso / erro | Ícone + texto; `role="alert"` em erro |
| AvisoEntregaPeixe | `molecules/AvisoEntregaPeixe.jsx` | Regra dos peixes (ficha, carrinho, checkout) | — |
| Toast | `molecules/Toast.jsx` + `organisms/ToastStack.jsx` | Retorno rápido (`toast(msg, { tipo, acao, onAcao })`) | Região `aria-live`; botão de fechar |
| EmptyState | `molecules/EmptyState.jsx` | Vazio (`tom="vazio"`) e erro (`tom="erro"`), sempre com o que fazer | `role="alert"` em erro |
| Stepper | `molecules/Stepper.jsx` | Etapas do checkout | `aria-current="step"`; etapas feitas viram link |
| Paginacao | `molecules/Paginacao.jsx` | Listagens | `aria-current="page"` |
| Skeleton | `atoms/Skeleton.jsx` | Blocos de carregamento | `aria-hidden` |
| Drawer | `components/ui/sheet.jsx` (CartDrawer, filtros e menu no celular) | Gavetas | Foco preso, Esc fecha, foco volta a quem abriu (`devolverFoco` do `useUI`) |
| Modal | `components/ui/dialog.jsx` (busca, orçamento, avise-me, confirmação) | Diálogos | Idem |
| SectionHead / PageHead / Trilha | `molecules/` | Títulos de seção e de página, breadcrumb | Hierarquia de títulos correta |
| CatalogoLayout + GradeItens | `organisms/` | Busca, filtros, ordenação, contagem e grade (Loja e Peixes) | Filtros em rádio nativo; contagem `aria-live` |

## 7. Formulários e mensagens (ux-copy)

- Use `hooks/useFormulario`: valida por campo, mostra o erro **embaixo do campo** e põe o foco no primeiro campo
  com erro. Erros da API (`{ erro, detalhes }`) vão direto para os campos.
- Mensagens iguais às do backend (`utils/validacao.js` › `MENSAGENS`). Exemplo: "Digite um celular com DDD.
  Exemplo: (32) 99999-0000."
- Celular: 11 dígitos, máscara `(32) 99999-0000` (`utils/telefone.js`). CEP: `00000-000` (`utils/cep.js`).
- O botão de enviar fica **habilitado**. Ao tocar, ele mostra os erros (não esconde o porquê).
- Tom: amigável, frases curtas, verbo no botão ("Adicionar ao carrinho", "Finalizar compra", "Solicitar orçamento").
- Erro sempre diz **o que houve + como resolver** (item 9).
- Dado que falta: "a definir com a loja" ou "— a confirmar com a loja". **Nunca** mostrar placeholder cru como "X".

### Glossário de interface

| Use | Não use |
| --- | --- |
| Adicionar ao carrinho | Comprar, Ver peixe, Solicitar (no card) |
| Finalizar compra | Finalizar pedido pelo WhatsApp |
| Solicitar orçamento | Pedir preço, Orçar |
| Tirar dúvida no WhatsApp | Verificar disponibilidade |
| Avise-me quando chegar | Sob consulta |
| Entrar / Criar conta / Sair | Login, Logar, Cadastre-se |
| Minha conta · Minhas compras | Meus pedidos, Painel |
| Disponível · Sob encomenda · Esgotado | Em estoque / Sob consulta (misturados) |

## 8. Regras de negócio que aparecem na interface

- **Peixe vivo só é entregue em São João del Rei**: selo no card, aviso na ficha, no carrinho e no checkout
  (`AvisoEntregaPeixe`). Com CEP de fora, a entrega aparece indisponível e o site oferece a retirada.
- **O pagamento é na página do gateway**: nenhum campo de cartão no site (`data/loja.js` › `AVISO_PAGAMENTO`).
- **A página de sucesso não confia na URL**: ela mostra "Confirmando seu pagamento…" até o status real chegar.
- **Cancelar** só aparece até antes do envio (`utils/statusPedido.js` › `STATUS_CANCELAVEIS`).

## 9. Dados e integração com a API

- `src/data/` mantém o formato original (preços em reais). **Não mude**.
- `src/services/` é a única camada que os componentes chamam. Hoje ela lê `src/data` e `src/mocks`; amanhã chama
  `/api`. Cada arquivo diz o endpoint em um comentário `INTEGRAÇÃO:`.
- `src/mocks/` só tem **dados de exemplo** (estoque, cliente, compras, regra de frete). Veja `src/mocks/LEIA-ME.md`.
- Preço: sempre `formatarPreco(valor)`. Quando a API mandar centavos: `formatarPreco(valor, { centavos: true })`.

## 10. Checklist antes de abrir um PR

- [ ] Nenhuma cor fixa (hex, `text-white`, paleta padrão do Tailwind) nem tamanho de fonte arbitrário.
- [ ] Um H1 por página; títulos sem pular nível.
- [ ] No máximo 1 botão primário por bloco; WhatsApp como secundário.
- [ ] Todo campo com `FormField` (rótulo e erro ligados); botões só de ícone com `aria-label`.
- [ ] Estados de carregamento, vazio e erro tratados.
- [ ] Testado em 375, 768, 1280 e 1440 px, nos temas claro e escuro, e só com o teclado.
- [ ] `npm run lint` e `npm run build` sem erros.
