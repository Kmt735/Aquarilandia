import { test as base, expect } from '@playwright/test'
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const requireBackend = createRequire(new URL('../../../backend/package.json', import.meta.url))
const pg = requireBackend('pg')
export const test = base.extend({
  sistema: [async ({ browserName }, use) => {
    if (browserName !== 'chromium') throw new Error('Este ciclo homologa o Chromium.')
    if (!process.env.TEST_DATABASE_URL) throw new Error('Defina TEST_DATABASE_URL apontando para PostgreSQL descartável. Nenhum teste de navegador será marcado como aprovado sem banco.')
    const schema = `ciclo1_${randomUUID().replaceAll('-', '')}`
    const cliente = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL })
    let servidor, vite, pool
    const cobrancas = new Map(), emails = []
    const restaurar = []
    await cliente.connect()
    try {
      await cliente.query(`CREATE SCHEMA ${schema}`)
      await cliente.query(`SET search_path TO ${schema}`)
      for (const arquivo of ['01_catalogo.sql', '10_clientes.sql', '20_vendas.sql', '35_entrega_logistica.sql']) {
        await cliente.query(await readFile(new URL(`../../../backend/db/init/${arquivo}`, import.meta.url), 'utf8'))
      }
      const inserir = async (nome, slug, preco, estoque = 3, ativo = true) => (await cliente.query(
        'INSERT INTO produtos (nome,categoria_id,preco,estoque,ativo) SELECT $1,id,$3,$4,$5 FROM categorias WHERE slug=$2 RETURNING id',
        [nome, slug, preco, estoque, ativo],
      )).rows[0].id
      const aquario = await inserir('Aquário API Ciclo 1', 'aquarios', 12345)
      await cliente.query("INSERT INTO aquarios (produto_id,volume_litros,comprimento_cm,largura_cm,altura_cm,material,tipo_agua) VALUES ($1,60,60,30,35,'vidro','doce')", [aquario])
      const semFicha = await inserir('Acessório API sem ficha', 'acessorios', 1050, 0)
      const peixe = await inserir('Peixe API Pacífico', 'peixes', 4999)
      const outroPeixe = await inserir('Peixe API Marinho', 'peixes', 20000, 0)
      for (const [id, cientifico, agua, dificuldade] of [[peixe, 'Species ciclo1 dulcis', 'doce', 'iniciante'], [outroPeixe, 'Species ciclo1 marina', 'marinho', 'avancado']]) {
        await cliente.query(`INSERT INTO peixes (produto_id,nome_cientifico,tipo_agua,tamanho_adulto_cm,temp_min_c,temp_max_c,ph_min,ph_max,aquario_min_litros,temperamento,dificuldade)
          VALUES ($1,$2,$3,5,24,28,6,7,40,'pacifico',$4)`, [id, cientifico, agua, dificuldade])
      }
      const inativo = await inserir('Produto API desativado', 'aquarios', 1000, 3, false)
      const peixeSemFicha = await inserir('Peixe API sem ficha', 'peixes', 1000)
      for (let n = 1; n <= 11; n++) await inserir(`Aquário Paginação ${String(n).padStart(2, '0')}`, 'aquarios', 5000 + n)
      await cliente.query("INSERT INTO categorias (nome,slug) VALUES ('Categoria API nova','categoria-api-nova')")
      for (const arquivo of ['15_orcamentos.sql', '21_vendas_idempotencia.sql', '22_pagamentos_estorno.sql',
        '30_estoque.sql', '31_estoque_vendas.sql', '32_produto_imagem.sql', '33_estoque_consultas.sql', '34_pagamentos_reconciliacao.sql', '36_pagamentos_cartao.sql']) {
        await cliente.query(await readFile(new URL(`../../../backend/db/init/${arquivo}`, import.meta.url), 'utf8'))
      }
      const url = new URL(process.env.TEST_DATABASE_URL)
      url.searchParams.set('options', `-c search_path=${schema}`)
      process.env.DATABASE_URL = url.toString()
      // Tabela explicitamente fictícia, sem rede externa nem tarifas reais.
      const transporte={tipoEntrega:'correios',transportadora:'Transportadora fixture',cepInicio:'01000000',cepFim:'99999999',rastreioCorreios:false,
        fatorCubagemCm3PorKg:6000,maxPesoG:30000,maxComprimentoCm:100,maxLarguraCm:100,maxAlturaCm:100,maxSomaDimensoesCm:200}
      process.env.FRETE_TRANSPORTE_JSON=JSON.stringify({servicos:[
        {...transporte,id:'economico',nome:'Econômico fixture',prazoTransporteDias:4,faixasPeso:[{ateGramas:1000,valorCentavos:1500},{ateGramas:30000,valorCentavos:2500}]},
        {...transporte,id:'rapido',nome:'Rápido fixture',prazoTransporteDias:1,faixasPeso:[{ateGramas:30000,valorCentavos:4500}]}]})
      await cliente.query('INSERT INTO produto_logistica(produto_id,peso_g,comprimento_cm,largura_cm,altura_cm,prazo_preparacao_dias,envio_convencional) VALUES($1,500,20,20,20,2,true)',[aquario])
      const { app } = await import('../../../backend/dist/app.js')
      const { db } = await import('../../../backend/dist/config/db.js')
      const { env } = await import('../../../backend/dist/config/env.js')
      const { gatewayPix, gatewayCartao, simuladorPix } = await import('../../../backend/dist/modulos/pagamentos/gateway.js')
      const { pagamentoService } = await import('../../../backend/dist/modulos/pagamentos/pagamento.service.js')
      const { cepService } = await import('../../../backend/dist/modulos/vendas/cep.service.js')
      const trocar = (obj, campo, valor) => { const anterior = obj[campo]; restaurar.push(() => { obj[campo] = anterior }); obj[campo] = valor }
      trocar(env, 'permitirSimulacaoPix', false)
      trocar(env, 'gatewayAccessToken', undefined)
      trocar(simuladorPix, 'simularPagamentoPix', async (id) => {
        if (!cobrancas.has(id)) throw new Error('Cobrança de fixture ausente')
        cobrancas.get(id).status = 'aprovado'
      })
      const definirSimulacaoPix = (ativa) => { env.permitirSimulacaoPix = ativa; env.gatewayAccessToken = ativa ? 'abc_dev_FIXTURE_SEM_REDE' : undefined }
      trocar(gatewayCartao, 'recuperarCheckout', async (referencia) => [...cobrancas.values()].find(p => p.externalId === referencia) ?? null)
      trocar(gatewayCartao, 'prepararProdutoCheckout', async () => {})
      trocar(gatewayCartao, 'criarCheckout', async ({ pagamentoId, vendaId, valor, referencia }) => {
        const id = `bill_fixture${pagamentoId}`
        const dados = { cobrancaId: id, status: 'pendente', valor, vendaId, pagamentoId, externalId: referencia, url: `https://app.abacatepay.com/pay/${id}` }
        cobrancas.set(id, dados); return dados
      })
      trocar(gatewayPix, 'criarCobrancaPix', async ({ pagamentoId, vendaId, valor, expiraEm }) => {
        const id = `pix_char_fixture${pagamentoId}`
        if (!cobrancas.has(id)) cobrancas.set(id, { cobrancaId: id, status: 'pendente', valor, vendaId, pagamentoId, externalId: `pagamento-${pagamentoId}` })
        return { cobrancaId: id, status: cobrancas.get(id).status, codigoPix: `PIX-FICTICIO-${pagamentoId}`,
          qrCodeImagem: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jT1sAAAAASUVORK5CYII=', expiraEm }
      })
      trocar(gatewayPix, 'consultarCobranca', async (id) => {
        if (!cobrancas.has(id)) throw new Error('Cobrança de fixture ausente')
        return { ...cobrancas.get(id) }
      })
      trocar(gatewayPix, 'estornar', async (id) => { cobrancas.get(id).status = 'estornado'; return { aprovado: true, jaEstornado: false } })
      trocar(cepService, 'consultar', async (cep) => ({ cep, ...(cep === '01001000'
        ? { cidade: 'São Paulo', uf: 'SP', municipioIbge: '3550308' }
        : { cidade: 'São João del Rei', uf: 'MG', municipioIbge: '3162500' }) }))
      trocar(env, 'emailApiKey', 'chave-ficticia-e2e')
      trocar(env, 'emailRemetente', 'fixture@example.invalid')
      const fetchOriginal = globalThis.fetch
      trocar(globalThis, 'fetch', async (url, opcoes) => {
        if (String(url) === 'https://api.resend.com/emails') {
          emails.push(JSON.parse(opcoes.body))
          return new Response(JSON.stringify({ id: 'email-fixture' }), { status: 200 })
        }
        if (/^http:\/\/(127\.0\.0\.1|localhost):/.test(String(url))) return fetchOriginal(url, opcoes)
        throw new Error('Rede externa bloqueada no E2E')
      })
      pool = db
      servidor = app.listen(0, '127.0.0.1')
      await once(servidor, 'listening')
      const backend = `http://127.0.0.1:${servidor.address().port}`
      const root = fileURLToPath(new URL('../..', import.meta.url))
      // Mesmo proxy do projeto, apontado para a porta efêmera do backend de testes.
      vite = await createServer({ root, configFile: `${root}/vite.config.js`, server: { host: '127.0.0.1', port: 0, proxy: { '/api': backend } } })
      await vite.listen()
      const origem = `http://127.0.0.1:${vite.httpServer.address().port}`
      trocar(env, 'corsOrigin', origem)
      trocar(env, 'corsOrigins', [origem])
      trocar(env, 'frontendUrl', origem)
      const confirmarPagamento = async (vendaId) => {
        const cobranca = [...cobrancas.values()].find((p) => p.vendaId === Number(vendaId))
        if (!cobranca) throw new Error('Cobrança não encontrada na fixture')
        cobranca.status = 'aprovado'
        await pagamentoService.processarCobranca(cobranca.cobrancaId)
      }
      await use({ origem, backend, cliente, emails, confirmarPagamento, definirSimulacaoPix, ids: { aquario, semFicha, peixe, outroPeixe, inativo, peixeSemFicha } })
    } finally {
      if (vite) await vite.close()
      if (servidor) await new Promise((resolve) => servidor.close(resolve))
      if (pool) await pool.end()
      for (const voltar of restaurar.reverse()) voltar()
      await cliente.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`)
      await cliente.end()
    }
  }, { scope: 'worker' }],
  baseURL: async ({ sistema }, use) => use(sistema.origem),
  page: async ({ page }, use) => {
    const erros = []
    page.on('pageerror', (erro) => erros.push(erro.message))
    await use(page)
    expect(erros, 'A navegação não deve causar erros React/JavaScript').toEqual([])
  },
})
export { expect }
