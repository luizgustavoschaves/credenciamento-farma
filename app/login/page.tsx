'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [senha, setSenha] = useState('')
  const [erro,  setErro]  = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setLoading(true)

    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senha }),
    })

    setLoading(false)

    if (res.ok) {
      router.push('/')
      router.refresh()
    } else {
      const data = await res.json()
      setErro(data.erro ?? 'Senha incorreta.')
      setSenha('')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo / cabeçalho */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-sefaz-blue text-white text-2xl mb-4 shadow">
            🏛️
          </div>
          <h1 className="text-xl font-bold text-gray-900">SEFAZ-MA</h1>
          <p className="text-sm text-gray-500 mt-1">
            Sistema de Credenciamento Farmacêutico
          </p>
        </div>

        {/* Card de login */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-base font-semibold text-gray-800 mb-6">Acesso restrito</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Senha de acesso
              </label>
              <input
                type="password"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                placeholder="Digite a senha"
                autoFocus
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm
                  focus:outline-none focus:ring-2 focus:ring-sefaz-blue"
              />
            </div>

            {erro && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                ⚠️ {erro}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !senha}
              className="w-full py-2.5 bg-sefaz-blue text-white font-semibold rounded-lg text-sm
                hover:bg-blue-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? 'Verificando...' : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          CEGAF-COTAF-ST · Substituição Tributária
        </p>
      </div>
    </div>
  )
}
