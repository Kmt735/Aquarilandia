import { db } from '../src/config/db.js'
import { imagemService } from '../src/modulos/catalogo/imagem/imagem.service.js'
try {
  const resultado = await imagemService.limparOrfaos()
  console.info('Limpeza de imagens concluída.', resultado)
  if (resultado.erros) process.exitCode = 1
} catch { console.error('Não foi possível verificar/limpar imagens. Nenhuma varredura externa foi executada.'); process.exitCode = 1 }
finally { await db.end() }
