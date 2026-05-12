import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { pedidoId, checklist } = await req.json()

    if (!pedidoId || !checklist) {
      return NextResponse.json({ erro: 'pedidoId e checklist são obrigatórios' }, { status: 400 })
    }

    const { error } = await supabase
      .from('documentos_analise')
      .upsert(
        { pedido_id: pedidoId, resultado_json: checklist },
        { onConflict: 'pedido_id' }
      )

    if (error) {
      console.error('[documentos-manual] Erro ao salvar:', error)
      return NextResponse.json({ erro: 'Erro ao salvar checklist' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[documentos-manual] Erro interno:', err)
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }
}
