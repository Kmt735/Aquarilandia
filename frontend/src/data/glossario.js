// Explicações curtas dos termos do aquarismo (itens 2, 22, 32: jargão explicado para o iniciante).
// Textos gerais e educativos — o grupo pode revisar. Sem orientação de saúde animal.

// Uma linha por categoria da loja, ao lado do nome
export const descricaoCategoria = {
  Peixes: 'Peixes vivos, com temperamento e cuidados de cada um.',
  Aquários: 'O tanque de vidro onde os peixes vão morar.',
  Filtros: 'Limpam a água o tempo todo, sem você ver.',
  Bombas: 'Movimentam a água e ajudam a oxigenar.',
  Iluminação: 'Luz para ver os peixes e as plantas crescerem.',
  Termostatos: 'Mantêm a água na temperatura certa.',
  Rações: 'O alimento do dia a dia dos peixes.',
  Condicionadores: 'Deixam a água da torneira segura para os peixes.',
  'Condicionadores e medicamentos': 'Deixam a água da torneira segura para os peixes.',
  Substratos: 'O "chão" do aquário, onde as plantas enraízam.',
  Plantas: 'Plantas vivas que decoram e dão abrigo.',
  Decorações: 'Pedras, troncos e enfeites para o cenário.',
  Acessórios: 'Itens do dia a dia para cuidar do aquário.',
}

export const termos = {
  ciclagem: {
    termo: 'Ciclagem',
    texto:
      'Período de algumas semanas em que bactérias benéficas se instalam no filtro e passam a eliminar a amônia, que é tóxica. Pular essa etapa é uma das principais causas de morte de peixes em aquários novos.',
  },
  substrato: { termo: 'Substrato', texto: 'O material que forra o fundo do aquário (areia, cascalho ou base fértil). É nele que as plantas enraízam.' },
  condicionador: {
    termo: 'Condicionador',
    texto: 'Produtos que neutralizam o cloro da água da torneira e deixam a água segura para os peixes.',
  },
  ph: { termo: 'pH', texto: 'Mede se a água é ácida (abaixo de 7), neutra (7) ou alcalina (acima de 7). Cada espécie vive bem numa faixa de pH.' },
  temperatura: { termo: 'Temperatura', texto: 'A faixa de temperatura da água em que a espécie vive bem. Em geral é mantida com um termostato.' },
  tipoAgua: { termo: 'Tipo de água', texto: 'Água doce (rios e lagos) ou salgada (mar). Peixes de um tipo não vivem no outro.' },
  temperamento: {
    termo: 'Temperamento',
    texto: 'Como o peixe se comporta com os outros: pacífico convive bem; territorial defende o próprio espaço e pode brigar.',
  },
  aquarioMinimo: {
    termo: 'Aquário mínimo',
    texto: 'O menor volume de água, em litros, indicado para a espécie viver com espaço. Aquários maiores são mais estáveis.',
  },
  tamanhoAdulto: { termo: 'Tamanho adulto', texto: 'Quanto o peixe cresce. Escolha o aquário pensando no peixe adulto, não no filhote.' },
  dificuldade: { termo: 'Dificuldade', texto: 'O quanto a espécie exige de experiência e de cuidado com a água. "Fácil" é bom para começar.' },
  amonia: { termo: 'Amônia e nitrito', texto: 'Substâncias tóxicas que surgem dos restos de ração e das fezes. Precisam estar em zero antes de colocar os peixes.' },
  nitrato: { termo: 'Nitrato', texto: 'O que sobra depois que as bactérias do filtro transformam a amônia. É bem menos tóxico e sai nas trocas parciais de água.' },
  plantado: { termo: 'Aquário plantado', texto: 'Aquário montado com plantas vivas como parte principal do cenário (aquapaisagismo).' },
}

// Ordem do glossário na página "Meu Primeiro Aquário"
export const glossarioGuia = ['ciclagem', 'substrato', 'condicionador', 'ph', 'amonia', 'nitrato', 'aquarioMinimo', 'temperamento', 'plantado']
