import { NextRequest, NextResponse } from 'next/server'
import { executarAnalise } from '@/lib/regras'
import { gerarParecerFallback } from '@/lib/parecer'
import { supabase } from '@/lib/supabase'
import {
  LinhaFaturamentoMensal,
  LinhaMovimentacaoNCM,
  LinhaSaidasGrupoEconomico,
  LinhaMovimentacaoGTIN,
} from '@/lib/types'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const {
      cnpj,
      tipo,
      dataPedido,
      razaoSocial,
      inscricaoEstadual,
      numeroIF,
      numeroProcesso,
      inicioAtividade,
      faturamentoMensal,
      movimentacaoNcm,
      saidasGrupo,
      movimentacaoGTIN,
    }: {
      cnpj: string
      tipo: 'credenciamento' | 'renovacao'
      dataPedido: string
      razaoSocial?: string
      inscricaoEstadual?: string
      numeroIF?: string
      numeroProcesso?: string
      inicioAtividade?: boolean
      faturamentoMensal: LinhaFaturamentoMensal[]
      movimentacaoNcm: LinhaMovimentacaoNCM[]
      saidasGrupo: LinhaSaidasGrupoEconomico[]
      movimentacaoGTIN: LinhaMovimentacaoGTIN[]
    } = body

    if (!cnpj || !tipo || !dataPedido || !faturamentoMensal?.length || !movimentacaoNcm?.length) {
      return NextResponse.json(
        { erro: 'Campos obrigatórios ausentes: cnpj, tipo, dataPedido, faturamentoMensal, movimentacaoNcm' },
        { status: 400 }
      )
    }

    // 1. Executar análise das regras
    const resultado = executarAnalise({
      cnpj,
      tipo,
      dataPedido,
      faturamentoMensal,
      movimentacaoNcm,
      saidasGrupo:      saidasGrupo      ?? [],
      movimentacaoGTIN: movimentacaoGTIN ?? [],
      inicioAtividadeManual: inicioAtividade ?? false,
    })

    // 2. Gerar parecer offline (sem custo de API)
    const textoParecer = gerarParecerFallback(resultado)
    const parecerGeradoPorIA = false

    // 3. Persistir no Supabase
    const { data: pedido, error: errPedido } = await supabase
      .from('pedidos')
      .insert({
        cnpj,
        razao_social:      razaoSocial      ?? null,
        inscricao_estadual: inscricaoEstadual ?? null,
        numero_if:         numeroIF          ?? null,
        numero_processo:   numeroProcesso    ?? null,
        tipo,
        status: 'pendente',
        resultado_json: resultado,
      })
      .select('id')
      .single()

    if (errPedido || !pedido) {
      console.error('Erro ao salvar pedido:', errPedido)
      return NextResponse.json({ erro: 'Erro ao salvar pedido no banco de dados' }, { status: 500 })
    }

    const { error: errParecer } = await supabase
      .from('pareceres')
      .insert({
        pedido_id: pedido.id,
        texto_gerado: textoParecer,
        texto_final: null,
        auditor: null,
        aprovado_em: null,
      })

    if (errParecer) {
      console.error('Erro ao salvar parecer:', errParecer)
    }

    return NextResponse.json({ pedidoId: pedido.id, resultado, textoParecer, parecerGeradoPorIA })
  } catch (err) {
    console.error('Erro interno:', err)
    return NextResponse.json({ erro: 'Erro interno do servidor' }, { status: 500 })
  }
}
