import { NextRequest, NextResponse } from 'next/server'
import { executarAnaliseDocumental } from '@/lib/analise-documentos'
import { supabase } from '@/lib/supabase'

// Permite uploads maiores (PDFs podem ser pesados)
export const maxDuration = 120  // 2 minutos de timeout

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  return Buffer.from(buffer).toString('base64')
}

function dataAtualBR(): string {
  return new Date().toLocaleDateString('pt-BR')  // DD/MM/AAAA
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()

    const pedidoId = formData.get('pedidoId') as string | null
    if (!pedidoId) {
      return NextResponse.json({ erro: 'pedidoId obrigatório' }, { status: 400 })
    }

    // ── Lê os 8 PDFs do FormData ──────────────────────────────────────────────
    const campos = [
      'contratoSocial', 'docsSocios', 'imovel', 'comprovanteEndereco',
      'irSocios', 'raisGfip', 'contratoContador', 'licencaAnvisa',
    ] as const

    const arquivos: Record<string, File> = {}
    for (const campo of campos) {
      const f = formData.get(campo)
      if (!f || !(f instanceof File)) {
        return NextResponse.json(
          { erro: `Campo obrigatório ausente: ${campo}` },
          { status: 400 }
        )
      }
      arquivos[campo] = f
    }

    // ── Busca dados da análise numérica ──────────────────────────────────────
    const { data: pedido } = await supabase
      .from('pedidos')
      .select('resultado_json')
      .eq('id', pedidoId)
      .single()

    const resultadoJson = pedido?.resultado_json as any

    const funcionariosMinimos: number =
      resultadoJson?.req8?.detalhe?.empregados_minimos_exigidos ?? 0

    // data_pedido vem no formato AAAA-MM (ex: "2026-02") → converte para MM/AAAA
    const dataPedidoRaw: string = resultadoJson?.data_pedido ?? ''
    const mesPedido = dataPedidoRaw.length === 7
      ? `${dataPedidoRaw.slice(5, 7)}/${dataPedidoRaw.slice(0, 4)}`
      : dataAtualBR()

    // ── Converte todos os arquivos para base64 em paralelo ────────────────────
    const [
      contratoSocialB64,
      docsSociosB64,
      imovelB64,
      comprovanteEnderecoB64,
      irSociosB64,
      raisGfipB64,
      contratoContadorB64,
      licencaAnvisaB64,
    ] = await Promise.all(campos.map(c => fileToBase64(arquivos[c])))

    // ── Executa análise documental (2 rodadas paralelas) ──────────────────────
    const resultado = await executarAnaliseDocumental({
      pdfs: {
        contratoSocial:      contratoSocialB64,
        docsSocios:          docsSociosB64,
        imovel:              imovelB64,
        comprovanteEndereco: comprovanteEnderecoB64,
        irSocios:            irSociosB64,
        raisGfip:            raisGfipB64,
        contratoContador:    contratoContadorB64,
        licencaAnvisa:       licencaAnvisaB64,
      },
      funcionariosMinimos,
      dataAtual: dataAtualBR(),  // data de hoje — usado para ANVISA
      mesPedido,                 // mês do protocolo — usado para Contrato do Contador
    })

    // ── Persiste no Supabase ──────────────────────────────────────────────────
    // Upsert: se já existe análise documental para esse pedido, substitui
    const { error } = await supabase
      .from('documentos_analise')
      .upsert(
        { pedido_id: pedidoId, resultado_json: resultado },
        { onConflict: 'pedido_id' }
      )

    if (error) {
      console.error('[analisar-documentos] Erro ao salvar:', error)
      // Não bloqueia o retorno — o resultado ainda é enviado ao cliente
    }

    return NextResponse.json({ resultado })
  } catch (err) {
    console.error('[analisar-documentos] Erro interno:', err)
    return NextResponse.json({ erro: 'Erro interno ao analisar documentos' }, { status: 500 })
  }
}
