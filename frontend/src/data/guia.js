// Conteúdo do guia "Meu Primeiro Aquário". RASCUNHO: cada seção tem um TODO para a loja validar.
// [[id]] ou [[id|texto]] vira um Termo do glossário (data/glossario.js): marque só a primeira vez que a palavra aparece.
// `categoria` só existe onde a loja tem produtos nessa categoria: é ela que liga o "Ver na loja".

export const passosGuia = [
  {
    id: 'equipamentos',
    titulo: 'Equipamentos',
    resumo: 'Filtro, bomba, iluminação e termostato compatíveis com o volume do aquário.',
    intro: [
      'Antes de pensar nos peixes, monte a casa deles. Escolha o aquário pelo tamanho ideal pro seu espaço e pro tipo de peixe que você quer ter.',
      'Aquários maiores costumam ser mais fáceis: a água muda mais devagar e os peixes sentem menos.',
    ],
  },
  {
    id: 'ciclagem',
    titulo: 'Ciclagem',
    resumo: 'O processo que estabiliza as bactérias boas da água antes de colocar peixes.',
    intro: [
      'A [[ciclagem|ciclagem]] é o tempo que as bactérias boas levam para se instalar no filtro. São elas que transformam a sujeira da água em algo menos perigoso.',
      'Por isso o aquário precisa ficar ligado, sem peixes, por algumas semanas. Parece demorado, mas é o passo que mais protege os seus peixes.',
    ],
  },
  {
    id: 'qualidade-da-agua',
    titulo: 'Qualidade da água',
    resumo: 'pH, amônia, nitrito e nitrato: garantindo que está tudo seguro.',
    intro: [
      'A água pode parecer limpa e mesmo assim fazer mal aos peixes. Só um teste mostra o que está acontecendo.',
      'Kits de teste medem a qualidade da água. Compare o resultado com a tabela abaixo.',
    ],
  },
  {
    id: 'escolha-dos-peixes',
    titulo: 'Escolha dos peixes',
    resumo: 'Espécies compatíveis entre si e com o tamanho do seu aquário.',
    intro: [
      'Com a água pronta, chegou a melhor parte. Escolha com calma: nem todo peixe combina com outro, e nem todo peixe cabe no seu aquário.',
      'Comece com poucos peixes resistentes. Depois de pegar o jeito, fica fácil aumentar a turma.',
    ],
  },
  {
    id: 'manutencao',
    titulo: 'Manutenção',
    resumo: 'Rotina de trocas de água, limpeza de filtro e alimentação.',
    intro: [
      'Um aquário saudável não dá muito trabalho, mas pede constância. Poucos minutos por dia e uma limpeza simples por semana já resolvem quase tudo.',
    ],
  },
]

// TODO: validar com a loja — lista de equipamentos e explicações
export const equipamentos = [
  { id: 'aquario', nome: 'Aquário', texto: 'O tanque de vidro onde os peixes vão morar.', categoria: 'Aquários' },
  { id: 'filtro', nome: 'Filtro', texto: 'Limpa a água o tempo todo e abriga as bactérias boas.', categoria: 'Filtros' },
  { id: 'termostato', nome: 'Termostato/aquecedor', termo: 'termostato', texto: 'Mantém a água na temperatura certa, sem sustos.' },
  { id: 'iluminacao', nome: 'Iluminação', texto: 'Luz para ver os peixes e as plantas crescerem.', categoria: 'Iluminação' },
  { id: 'substrato', nome: 'Substrato', termo: 'substrato', texto: 'O "chão" do aquário: base fértil ou neutra.', categoria: 'Substratos' },
  { id: 'condicionador', nome: 'Condicionador de água', termo: 'condicionador', texto: 'Deixa a água da torneira segura para os peixes.' },
  { id: 'teste', nome: 'Teste de parâmetros', termo: 'parametros', texto: 'Mostra se a água está segura para os peixes.' },
  { id: 'rede', nome: 'Rede', texto: 'Ajuda a mover os peixes com cuidado, sem usar as mãos.' },
]

// TODO: validar com a loja — prazos e o que acontece em cada semana da ciclagem
export const semanasCiclagem = [
  {
    semana: 1,
    titulo: 'Tudo ligado',
    texto: 'Encha o aquário, use o condicionador e ligue o filtro. Restos de ração começam a gerar [[amonia|amônia]].',
    sinais: ['Amônia: sobe'],
  },
  {
    semana: 2,
    titulo: 'Bactérias chegando',
    texto: 'As primeiras bactérias boas transformam a amônia em [[nitrito|nitrito]]. A água pode ficar turva: é normal.',
    sinais: ['Amônia: começa a cair', 'Nitrito: sobe'],
  },
  {
    semana: 3,
    titulo: 'Quase lá',
    texto: 'Outras bactérias transformam o nitrito em [[nitrato|nitrato]], que é bem menos tóxico.',
    sinais: ['Nitrito: começa a cair', 'Nitrato: aparece'],
  },
  {
    semana: 4,
    titulo: 'Hora de testar',
    texto: 'Se amônia e nitrito estiverem em zero, faça uma [[trocaParcial|troca parcial]] e prepare a chegada dos peixes.',
    sinais: ['Amônia: zero', 'Nitrito: zero'],
  },
]

// TODO: validar com a loja — faixas ideais (valores comuns e conservadores para iniciantes em água doce)
export const parametrosAgua = [
  { id: 'temperatura', nome: 'Temperatura', ideal: '24 a 26 °C', significado: 'Boa para a maioria dos peixes tropicais. Confira na ficha do seu peixe.' },
  { id: 'ph', nome: 'pH', ideal: '6,5 a 7,5', significado: 'Mostra se a água é ácida ou alcalina. Evite mudanças bruscas.' },
  { id: 'amonia', nome: 'Amônia', ideal: '0 ppm', significado: 'Tóxica. Qualquer valor acima de zero pede atenção.' },
  { id: 'nitrito', nome: 'Nitrito', ideal: '0 ppm', significado: 'Também é tóxico. Precisa estar em zero.' },
  { id: 'nitrato', nome: 'Nitrato', ideal: 'Abaixo de 40 ppm', significado: 'Bem menos tóxico. Quanto menor, melhor; sai nas trocas de água.' },
]

// TODO: validar com a loja — frequência dos testes
export const frequenciaTestes = [
  { quando: 'Durante a ciclagem', frequencia: '2 a 3 vezes por semana' },
  { quando: 'No primeiro mês com peixes', frequencia: '1 vez por semana' },
  { quando: 'Depois disso', frequencia: 'A cada 15 dias' },
  { quando: 'Se algo parecer estranho', frequencia: 'Na hora' },
]

// TODO: validar com a loja — dicas de escolha dos peixes
export const dicasPeixes = [
  { id: 'resistentes', titulo: 'Comece com poucos e resistentes', texto: 'Peixes de dificuldade "Fácil" perdoam melhor os erros de quem está começando.' },
  { id: 'temperamento', titulo: 'Veja se eles combinam', texto: 'Confira o [[temperamento|temperamento]] de cada espécie e com quem ela convive bem.' },
  { id: 'tamanho', titulo: 'Respeite o tamanho do aquário', texto: 'Veja o [[aquarioMinimo|aquário mínimo]] e pense no [[tamanhoAdulto|tamanho adulto]], não no filhote.' },
  { id: 'aos-poucos', titulo: 'Adicione aos poucos', texto: 'Coloque poucos peixes de cada vez e faça a [[aclimatacao|aclimatação]]. Assim as bactérias acompanham o aumento de sujeira.' },
]

// TODO: validar com a loja — rotina, quantidades e porcentagem da troca de água
export const rotinaManutencao = [
  {
    id: 'diaria',
    titulo: 'Diária',
    itens: ['Alimente pouco: só o que eles comem em cerca de 2 minutos', 'Observe se os peixes estão ativos e comendo', 'Veja se o filtro está ligado e a temperatura, certa'],
  },
  {
    id: 'semanal',
    titulo: 'Semanal',
    itens: ['Troque cerca de 20% a 30% da água', 'Use condicionador na água nova', 'Limpe o vidro por dentro', 'Teste a água'],
  },
  {
    id: 'mensal',
    titulo: 'Mensal',
    itens: ['Enxágue o filtro com a água tirada do aquário', 'Aspire a sujeira do substrato', 'Confira se os equipamentos estão funcionando bem'],
  },
]
