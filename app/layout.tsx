import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Credenciamento Atacadista de Medicamentos — SEFAZ-MA',
  description: 'Sistema de análise de credenciamento de atacadistas de produtos farmacêuticos',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-sefaz-gray font-sans antialiased">
        <header className="bg-sefaz-blue text-white shadow-md">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
            <div>
              <p className="text-xs font-medium tracking-widest uppercase opacity-75">
                SEFAZ-MA · Substituição Tributária
              </p>
              <h1 className="text-lg font-bold leading-tight">
                Credenciamento de Atacadista de Medicamentos
              </h1>
            </div>
          </div>
        </header>

        <nav className="bg-white border-b border-gray-200">
          <div className="max-w-5xl mx-auto px-6 flex gap-6 text-sm font-medium">
            <a href="/" className="py-3 border-b-2 border-transparent hover:border-sefaz-blue hover:text-sefaz-blue transition-colors">
              Nova Análise
            </a>
            <a href="/historico" className="py-3 border-b-2 border-transparent hover:border-sefaz-blue hover:text-sefaz-blue transition-colors">
              Histórico
            </a>
          </div>
        </nav>

        <main className="max-w-5xl mx-auto px-6 py-8">
          {children}
        </main>

        <footer className="mt-16 border-t border-gray-200 bg-white">
          <div className="max-w-5xl mx-auto px-6 py-4 text-xs text-gray-400">
            Portaria GABIN nº 410/2025 · Anexo 4.24 do RICMS/MA
          </div>
        </footer>
      </body>
    </html>
  )
}
