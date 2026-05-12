import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/pareceres?pedidoId=xxx  — buscar parecer de um pedido
export async function GET(req: NextRequest) {
  const pedidoId = req.nextUrl.searchParams.get('pedidoId')
  if (!pedidoId) {
    return NextResponse.json({ erro: 'pedidoId é obrigatório' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('pareceres')
    .select('*')
    .eq('pedido_id', pedidoId)
    .single()

  if (error) return NextResponse.json({ erro: 'Parecer não encontrado' }, { status: 404 })
  return NextResponse.json(data)
}

// PATCH /api/pareceres — aprovar/salvar texto final
export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { pedidoId, textoFinal, auditor } = body

  if (!pedidoId || !textoFinal) {
    return NextResponse.json({ erro: 'pedidoId e textoFinal são obrigatórios' }, { status: 400 })
  }

  const { error: errParecer } = await supabase
    .from('pareceres')
    .update({
      texto_final: textoFinal,
      auditor: auditor ?? null,
      aprovado_em: new Date().toISOString(),
    })
    .eq('pedido_id', pedidoId)

  if (errParecer) return NextResponse.json({ erro: 'Erro ao salvar parecer' }, { status: 500 })

  // Atualizar status do pedido
  const { data: resultado } = await supabase
    .from('pedidos')
    .select('resultado_json')
    .eq('id', pedidoId)
    .single()

  const conclusao = (resultado?.resultado_json as any)?.conclusao
  const novoStatus = conclusao === 'deferido' ? 'aprovado' : 'indeferido'

  await supabase
    .from('pedidos')
    .update({ status: novoStatus, updated_at: new Date().toISOString() })
    .eq('id', pedidoId)

  return NextResponse.json({ ok: true })
}
