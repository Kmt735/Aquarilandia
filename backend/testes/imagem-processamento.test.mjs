import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import sharp from 'sharp'
import { processarImagem } from '../src/modulos/catalogo/imagem/imagem.processamento.ts'
import { limitesImagem as l } from '../src/modulos/catalogo/imagem/imagem.limites.ts'
const arquivo = (buffer, mimetype = 'image/png', originalname = 'imagem.png') => ({ buffer, mimetype, originalname })
describe('Imagem principal — conteúdo real e reprocessamento', () => {
  for (const [formato, mime, ext] of [['jpeg','image/jpeg','jpg'],['png','image/png','png'],['webp','image/webp','webp']]) {
    it(`${formato} real vira WebP sem metadados`, async () => {
      const b = await sharp({ create: { width: 8, height: 4, channels: 3, background: '#129abc' } }).withExif({ IFD0: { Artist: 'NAO_PRESERVAR' } })[formato]().toBuffer()
      const saida = await processarImagem(arquivo(b, mime, `foto.${ext}`)), m = await sharp(saida).metadata()
      assert.equal(m.format,'webp'); assert.equal(m.width,8); assert.equal(m.height,4); assert.equal(m.exif,undefined); assert.equal(m.icc,undefined)
    })
  }
  it('aceita limite exato de bytes e remove conteúdo adicional na reencodificação', async () => {
    const jpeg = await sharp({ create: { width: 1, height: 1, channels: 3, background: 'red' } }).jpeg().toBuffer()
    const b = Buffer.concat([jpeg,Buffer.alloc(l.bytes-jpeg.length)])
    assert.ok((await processarImagem(arquivo(b,'image/jpeg','foto.jpg'))).length < 1000)
    await assert.rejects(processarImagem(arquivo(Buffer.alloc(l.bytes+1))), e => e.statusCode===413)
  })
  it('não confia no MIME nem na extensão e recusa conteúdo inválido', async () => {
    const png=await sharp({create:{width:2,height:2,channels:3,background:'red'}}).png().toBuffer()
    for (const f of [arquivo(png,'image/jpeg'),arquivo(png,'image/png','a.svg'),arquivo(png.subarray(0,30)),arquivo(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),'image/svg+xml','a.svg'),arquivo(Buffer.from('GIF89a'),'image/gif','a.gif'),arquivo(Buffer.alloc(0))]) await assert.rejects(processarImagem(f),e=>e.statusCode===400)
  })
  it('recusa animação PNG/WebP antes de invocar decoder de formatos não permitidos', async () => {
    const png=await sharp({create:{width:2,height:2,channels:3,background:'red'}}).png().toBuffer()
    const actl=Buffer.alloc(20);actl.writeUInt32BE(8);actl.write('acTL',4)
    await assert.rejects(processarImagem(arquivo(Buffer.concat([png.subarray(0,33),actl,png.subarray(33)]))),e=>e.statusCode===400)
    const webp=Buffer.alloc(30);webp.write('RIFF');webp.writeUInt32LE(22,4);webp.write('WEBPVP8X',8);webp.writeUInt32LE(10,16);webp[20]=2
    await assert.rejects(processarImagem(arquivo(webp,'image/webp','a.webp')),e=>e.statusCode===400)
  })
  it('WebP animado real, com dois frames, é recusado', async () => {
    const pixels=Buffer.from([255,0,0,255,0,0,255,0,0,255,0,0,0,0,255,0,0,255,0,0,255,0,0,255])
    const b=await sharp(pixels,{raw:{width:2,height:4,pageHeight:2,channels:3}}).webp({loop:0,delay:[100,100]}).toBuffer()
    assert.equal((await sharp(b,{animated:true}).metadata()).pages,2)
    await assert.rejects(processarImagem(arquivo(b,'image/webp','animado.webp')),e=>e.statusCode===400)
  })
  it('limites de dimensão e pixels são efetivos', async () => {
    for(const [width,height] of [[4097,1],[4000,4000]]) {
      const b=await sharp({create:{width,height,channels:3,background:'red'}}).png().toBuffer()
      await assert.rejects(processarImagem(arquivo(b)),e=>e.statusCode===400)
    }
    const b=await sharp({create:{width:4096,height:1,channels:3,background:'red'}}).png().toBuffer()
    assert.equal((await sharp(await processarImagem(arquivo(b))).metadata()).width,4096)
  })
})
