'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface PedidoResumo {
  id: string
  cnpj: string
  razao_social: string | null
  tipo: 'credenciamento' | 'renovacao'
  status: 'pendente' | 'aprovado' | 'indeferido'
  conclusao: 'deferido' | 'indeferido' | null
  motivos_resumo: string[] | null
  numero_if: string | null
  numero_processo: string | null
  data_pedido: string | null
  created_at: string
}

export default function HistoricoPage() {
  const router = useRouter()
  const [pedidos, setPedidos] = useState<PedidoResumo[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    async function carregar() {
      const { data } = await supabase
        .from('pedidos')
        .select('id, cnpj, razao_social, tipo, status, conclusao, motivos_resumo, numero_if, numero_processo, data_pedido, created_at')
        .order('created_at', { ascending: false })
        .limit(100)
      setPedidos((data ?? []) as PedidoResumo[])
      setCarregando(false)
    }
    carregar()
  }, [])

  function formatarCnpj(cnpj: string) {
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  }

  // Usa conclusao (novo) ou mapeia status (legado)
  function getConclusao(p: PedidoResumo): 'deferido' | 'indeferido' | null {
    if (p.conclusao) return p.conclusao
    if (p.status === 'indeferido') return 'indeferido'
    if (p.status === 'aprovado')   return 'deferido'
    return null
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Histórico de Análises</h2>
        <button
          onClick={() => router.push('/')}
          className="text-sm text-sefaz-blue hover:underline"
        >
          + Nova análise
        </button>
      </div>

      {carregando && (
        <p className="text-center py-12 text-gray-400">Carregando...</p>
      )}

      {!carregando && pedidos.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">📋</p>
          <p>Nenhuma análise realizada ainda.</p>
        </div>
      )}

      {!carregando && pedidos.length > 0 && (
        <div className="space-y-3">
          {pedidos.map(p => {
            const conclusao = getConclusao(p)
            const deferido  = conclusao === 'deferido'
            const indeferido = conclusao === 'indeferido'

            return (
              <div
                key={p.id}
                className={`bg-white rounded-xl shadow-sm border p-5 cursor-pointer hover:shadow-md transition-shadow
                  ${indeferido ? 'border-l-4 border-l-red-400' : deferido ? 'border-l-4 border-l-green-500' : 'border-gray-100'}`}
                onClick={() => router.push(`/analise/${p.id}`)}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Dados principais */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {p.numero_if && (
                        <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          IF {p.numero_if}
                        </span>
                      )}
                      {p.numero_processo && (
                        <span className="text-xs text-gray-400">
                          Proc. {p.numero_processo}
                        </span>
                      )}
                      <span className="text-xs text-gray-400 capitalize">
                        {p.tipo === 'credenciamento' ? 'Credenciamento' : 'Renovação'}
                      </span>
                    </div>

                    <p className="font-semibold text-gray-800 mt-1">
                      {formatarCnpj(p.cnpj)}
                    </p>
                    {p.razao_social && (
                      <p className="text-sm text-gray-500 truncate">{p.razao_social}</p>
                    )}

                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(p.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      {p.data_pedido && ` · Protocolo: ${p.data_pedido.slice(0, 7).split('-').reverse().join('/')}`}
                    </p>
                  </div>

                  {/* Conclusão */}
                  <div className="flex-shrink-0 text-right">
                    {conclusao ? (
                      <span className={`inline-block text-xs font-bold px-3 py-1 rounded-full
                        ${deferido ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {deferido ? 'DEFERIDO' : 'INDEFERIDO'}
                      </span>
                    ) : (
                      <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full bg-amber-100 text-amber-700">
                        Pendente
                      </span>
                    )}
                    <p className="text-xs text-sefaz-blue hover:underline mt-2">Ver →</p>
                  </div>
                </div>

                {/* Motivos do indeferimento — sem valores fiscais */}
                {indeferido && p.motivos_resumo && p.motivos_resumo.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs font-semibold text-red-600 mb-1">Motivos do indeferimento:</p>
                    <ul className="space-y-0.5">
                      {p.motivos_resumo.map((m, i) => (
                        <li key={i} className="text-xs text-gray-600 flex gap-1.5">
                          <span className="text-red-400 flex-shrink-0">•</span>
                          {m}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
