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
  created_at: string
}

const statusLabel: Record<string, { label: string; cls: string }> = {
  pendente:   { label: 'Pendente',   cls: 'bg-amber-100 text-amber-700'  },
  aprovado:   { label: 'Aprovado',   cls: 'bg-green-100 text-green-700'  },
  indeferido: { label: 'Indeferido', cls: 'bg-red-100 text-red-700'      },
}

export default function HistoricoPage() {
  const router = useRouter()
  const [pedidos, setPedidos] = useState<PedidoResumo[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    async function carregar() {
      const { data } = await supabase
        .from('pedidos')
        .select('id, cnpj, razao_social, tipo, status, created_at')
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">CNPJ / Empresa</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Data</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pedidos.map(p => {
                const st = statusLabel[p.status] ?? statusLabel.pendente
                return (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{formatarCnpj(p.cnpj)}</p>
                      {p.razao_social && (
                        <p className="text-xs text-gray-400 truncate max-w-xs">{p.razao_social}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 capitalize">
                      {p.tipo === 'credenciamento' ? 'Credenciamento' : 'Renovação'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(p.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => router.push(`/analise/${p.id}`)}
                        className="text-xs text-sefaz-blue hover:underline font-medium"
                      >
                        Ver →
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
