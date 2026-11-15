import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile, mkdtemp, mkdir, writeFile, utimes, stat, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { it } from 'node:test'
import pg from 'pg'

const url = process.env.TEST_DATABASE_URL
const executar = promisify(execFile)
it('CLI migra base existente duas vezes e limpa somente órfãos antigos, preservando legado e saldo',
  { skip: !url && 'Defina TEST_DATABASE_URL descartável.' }, async () => {
    const schema = `imagem_migracao_${randomUUID().replaceAll('-', '')}`
    const c = new pg.Client({ connectionString: url })
    const pasta = await mkdtemp(join(tmpdir(), 'imagem-cli-'))
    await c.connect()
    try {
      await c.query(`CREATE SCHEMA ${schema}`); await c.query(`SET search_path TO ${schema}`)
      await c.query(await readFile(new URL('../../db/init/01_catalogo.sql', import.meta.url), 'utf8'))
      await c.query("INSERT INTO produtos(categoria_id,nome,preco,estoque,ativo,imagem_url) SELECT id,'Legado',12345,7,false,'/assets/antiga.jpg' FROM categorias WHERE slug='acessorios'")
      const colunas = 'id,categoria_id,nome,preco,estoque,ativo,imagem_url,atualizado_em'
      const antes = (await c.query(`SELECT ${colunas} FROM produtos`)).rows
      const u = new URL(url); u.searchParams.set('options', `-c search_path=${schema}`)
      const env = { ...process.env, NODE_ENV: 'test', DATABASE_URL: u.toString(), IMAGENS_DIR: pasta }
      const rodar = (script) => executar('npm', ['run', script], { cwd: fileURLToPath(new URL('../..', import.meta.url)), env, timeout: 20000 })
      for (let i = 0; i < 2; i++) assert.match((await rodar('db:migrar-imagens')).stdout, /Migração de imagem aplicada\/verificada/)
      assert.deepEqual((await c.query(`SELECT ${colunas} FROM produtos`)).rows, antes)
      assert.equal((await c.query('SELECT imagem_arquivo_id FROM produtos')).rows[0].imagem_arquivo_id, null)
      await mkdir(join(pasta, 'temporarios'))
      const antigo = join(pasta, `${randomUUID()}.webp`), recente = join(pasta, `${randomUUID()}.webp`)
      await writeFile(antigo, 'fixture'); await writeFile(recente, 'fixture'); await writeFile(join(pasta, 'antiga.jpg'), 'asset fixture')
      const passado = new Date(Date.now() - 25 * 3600000); await utimes(antigo, passado, passado)
      assert.match((await rodar('imagens:limpar')).stdout, /removidos: 1, preservados: 0, erros: 0/)
      await assert.rejects(stat(antigo), (e) => e.code === 'ENOENT')
      assert.ok(await stat(recente)); assert.ok(await stat(join(pasta, 'antiga.jpg')))
      assert.deepEqual((await c.query(`SELECT ${colunas} FROM produtos`)).rows, antes)
      // Erro de schema não expõe SQL, URL, nome de pasta ou mensagem livre do driver.
      await c.query('DROP TABLE produtos CASCADE')
      await assert.rejects(rodar('db:migrar-imagens'), (e) => {
        assert.equal(e.code, 1); assert.match(e.stderr, /Não foi possível aplicar\/verificar/)
        assert.doesNotMatch(e.stderr, /postgres:\/\/|ALTER TABLE|relation|imagem-cli-/)
        return true
      })
    } finally {
      await c.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await c.end(); await rm(pasta, { recursive: true, force: true })
    }
  })
