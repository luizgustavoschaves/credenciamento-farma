'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ResultadoAnalise } from '@/lib/types'
import { ResultadoDocumentos } from '@/lib/tipos-documentos'

function fmtBRL(v: number) {
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtPct(v: number) {
  return v.toFixed(2).replace('.', ',') + '%'
}

// ──────────────────────────────────────────────────────────────────────────────
// Badge de resultado (numérico + documental)
// ──────────────────────────────────────────────────────────────────────────────

function Badge({ resultado }: { resultado: string }) {
  const map: Record<string, string> = {
    aprovado:         'bg-green-100 text-green-800',
    reprovado:        'bg-red-100 text-red-800',
    nao_aplicavel:    'bg-gray-100 text-gray-600',
    informativo:      'bg-blue-100 text-blue-800',
    pendente_auditor: 'bg-amber-100 text-amber-800',
  }
  const label: Record<string, string> = {
    aprovado:         'Aprovado',
    reprovado:        'Reprovado',
    nao_aplicavel:    'N/A',
    informativo:      'Informativo',
    pendente_auditor: 'Verificar',
  }
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${map[resultado] ?? 'bg-gray-100'}`}>
      {label[resultado] ?? resultado}
    </span>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Card genérico reutilizável
// ──────────────────────────────────────────────────────────────────────────────

function RequisitCard({
  id, titulo, base, resultado, children,
}: {
  id: string; titulo: string; base: string; resultado: string; children: React.ReactNode
}) {
  const border: Record<string, string> = {
    aprovado:         'border-l-green-500',
    reprovado:        'border-l-red-500',
    nao_aplicavel:    'border-l-gray-300',
    informativo:      'border-l-blue-400',
    pendente_auditor: 'border-l-amber-400',
  }
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 p-5 ${border[resultado] ?? ''}`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <span className="text-xs font-bold text-gray-400 uppercase">{id}</span>
          <h4 className="font-semibold text-gray-800 text-sm mt-0.5">{titulo}</h4>
          <p className="text-xs text-gray-400">{base}</p>
        </div>
        <Badge resultado={resultado} />
      </div>
      <div className="text-sm text-gray-600 space-y-1">{children}</div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Converte resultado da IA para checklist inicial do auditor
// ──────────────────────────────────────────────────────────────────────────────

function aiParaChecklist(rd: ResultadoDocumentos): ChecklistManual {
  const mapStatus = (r: string): StatusDoc =>
    r === 'aprovado' ? 'aprovado' : r === 'reprovado' ? 'reprovado' : 'pendente_auditor'

  return {
    contrato_social:      { status: mapStatus(rd.contrato_social.resultado),      observacao: rd.contrato_social.observacoes.join('; ') },
    docs_socios:          { status: mapStatus(rd.docs_socios.resultado),           observacao: rd.docs_socios.observacoes.join('; ') },
    imovel:               { status: mapStatus(rd.imovel.resultado),                observacao: rd.imovel.observacoes.join('; ') },
    comprovante_endereco: { status: mapStatus(rd.comprovante_endereco.resultado),  observacao: rd.comprovante_endereco.observacoes.join('; ') },
    ir_socios:            { status: mapStatus(rd.ir_socios.resultado),             observacao: rd.ir_socios.observacoes.join('; ') },
    rais_gfip:            { status: mapStatus(rd.rais_gfip.resultado),             observacao: rd.rais_gfip.observacoes.join('; ') },
    contrato_contador:    { status: mapStatus(rd.contrato_contador.resultado),     observacao: rd.contrato_contador.observacoes.join('; ') },
    licenca_anvisa:       { status: mapStatus(rd.licenca_anvisa.resultado),        observacao: rd.licenca_anvisa.observacoes.join('; ') },
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Resumo colapsável dos resultados detalhados da IA
// ──────────────────────────────────────────────────────────────────────────────

function ResumoIA({ rd }: { rd: ResultadoDocumentos }) {
  const [aberto, setAberto] = useState(false)

  const itens = [
    { id: 'DOC-1', titulo: 'Contrato Social',              resultado: rd.contrato_social.resultado,      detalhe: rd.contrato_social.objeto_social_extraido ? `Objeto: "${rd.contrato_social.objeto_social_extraido.slice(0, 80)}..."` : '' },
    { id: 'DOC-2', titulo: 'Docs. Sócios',                 resultado: rd.docs_socios.resultado,           detalhe: rd.docs_socios.socios_confirmados.length ? `Confirmados: ${rd.docs_socios.socios_confirmados.join(', ')}` : '' },
    { id: 'DOC-3', titulo: 'Imóvel / Locação',             resultado: rd.imovel.resultado,                detalhe: rd.imovel.endereco_extraido ?? '' },
    { id: 'DOC-4', titulo: 'Comprovante de Endereço',      resultado: rd.comprovante_endereco.resultado,  detalhe: rd.comprovante_endereco.enderecos_batem ? 'Endereços conferem' : '⚠️ Endereços divergentes' },
    { id: 'DOC-5', titulo: 'IR dos Sócios',                resultado: rd.ir_socios.resultado,             detalhe: rd.ir_socios.anos_encontrados.length ? `Anos: ${rd.ir_socios.anos_encontrados.join(', ')}` : '' },
    { id: 'DOC-6', titulo: 'RAIS / GFIP',                  resultado: rd.rais_gfip.resultado,             detalhe: `${rd.rais_gfip.funcionarios_declarados} funcionário(s) declarado(s)` },
    { id: 'DOC-7', titulo: 'Contrato Contador + DHP',      resultado: rd.contrato_contador.resultado,     detalhe: rd.contrato_contador.vigencia_indeterminada ? 'Prazo indeterminado' : rd.contrato_contador.vigencia_fim ? `Vigência até ${rd.contrato_contador.vigencia_fim}` : '' },
    { id: 'DOC-8', titulo: 'Licença ANVISA',               resultado: rd.licenca_anvisa.resultado,        detalhe: rd.licenca_anvisa.numero_autorizacao ? `Nº ${rd.licenca_anvisa.numero_autorizacao} · vence ${rd.licenca_anvisa.vigencia_fim ?? '?'}` : '' },
  ]

  const cor: Record<string, string> = {
    aprovado: 'text-green-700 bg-green-50',
    reprovado: 'text-red-700 bg-red-50',
    pendente_auditor: 'text-amber-700 bg-amber-50',
  }
  const label: Record<string, string> = { aprovado: 'OK', reprovado: 'NOK', pendente_auditor: 'Verificar' }

  return (
    <div className="mb-4 border border-blue-100 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setAberto(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 hover:bg-blue-100 transition-colors text-left"
      >
        <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
          🤖 Pré-análise da IA — clique para {aberto ? 'recolher' : 'expandir'}
        </span>
        <span className="text-blue-400 text-lg">{aberto ? '▲' : '▼'}</span>
      </button>

      {aberto && (
        <div className="divide-y divide-gray-100">
          {itens.map(item => (
            <div key={item.id} className="flex items-start gap-3 px-4 py-2.5">
              <span className="text-xs font-bold text-gray-400 w-12 flex-shrink-0 pt-0.5">{item.id}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">{item.titulo}</p>
                {item.detalhe && <p className="text-xs text-gray-400 mt-0.5 truncate">{item.detalhe}</p>}
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${cor[item.resultado] ?? 'text-gray-500 bg-gray-100'}`}>
                {label[item.resultado] ?? item.resultado}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Checklist documental manual
// ──────────────────────────────────────────────────────────────────────────────

type StatusDoc = 'aprovado' | 'reprovado' | 'pendente_auditor' | ''

interface ItemChecklist {
  status: StatusDoc
  observacao: string
}

type ChaveDoc =
  | 'contrato_social' | 'docs_socios' | 'imovel' | 'comprovante_endereco'
  | 'ir_socios' | 'rais_gfip' | 'contrato_contador' | 'licenca_anvisa'

type ChecklistManual = Record<ChaveDoc, ItemChecklist>

const DOCS_CONFIG: { chave: ChaveDoc; id: string; titulo: string; criterio: string }[] = [
  { chave: 'contrato_social',      id: 'DOC-1', titulo: 'Contrato Social',                          criterio: 'Objeto social inclui atacado farmacêutico; constituição regular' },
  { chave: 'docs_socios',          id: 'DOC-2', titulo: 'Docs. Pessoais dos Sócios/Diretores',      criterio: 'RG, CPF, CNH ou passaporte de todos os sócios do contrato social' },
  { chave: 'imovel',               id: 'DOC-3', titulo: 'Registro de Imóvel ou Contrato de Locação',criterio: 'Endereço confere com o estabelecimento credenciado' },
  { chave: 'comprovante_endereco', id: 'DOC-4', titulo: 'Comprovante de Endereço',                  criterio: 'Mês anterior ao pedido; endereço bate com o imóvel/locação' },
  { chave: 'ir_socios',            id: 'DOC-5', titulo: 'Imposto de Renda dos Sócios (3 últimos)',  criterio: 'Declarações dos últimos 3 anos de todos os sócios' },
  { chave: 'rais_gfip',            id: 'DOC-6', titulo: 'RAIS ou GFIP',                             criterio: 'Quadro de funcionários CLT atinge o mínimo exigido pelo REQ-8' },
  { chave: 'contrato_contador',    id: 'DOC-7', titulo: 'Contrato do Contador + DHP',               criterio: 'Contrato vigente no mês do pedido; DHP do contador em dia' },
  { chave: 'licenca_anvisa',       id: 'DOC-8', titulo: 'Licença ANVISA',                           criterio: 'Autorização de funcionamento vigente (vencimento posterior ao pedido)' },
]

function itemInicial(): ItemChecklist { return { status: '', observacao: '' } }

function checklistInicial(): ChecklistManual {
  return Object.fromEntries(DOCS_CONFIG.map(d => [d.chave, itemInicial()])) as ChecklistManual
}

function ChecklistDocumental({
  pedidoId,
  valorInicial,
}: {
  pedidoId: string
  valorInicial: ChecklistManual | null
}) {
  const [itens, setItens]     = useState<ChecklistManual>(valorInicial ?? checklistInicial())
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo]     = useState(!!valorInicial)

  const setStatus = (chave: ChaveDoc, status: StatusDoc) => {
    setSalvo(false)
    setItens(prev => ({ ...prev, [chave]: { ...prev[chave], status } }))
  }
  const setObs = (chave: ChaveDoc, observacao: string) => {
    setSalvo(false)
    setItens(prev => ({ ...prev, [chave]: { ...prev[chave], observacao } }))
  }

  async function salvar() {
    setSalvando(true)
    await fetch('/api/documentos-manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pedidoId, checklist: itens }),
    })
    setSalvando(false)
    setSalvo(true)
  }

  const statusLabel: Record<StatusDoc, string> = {
    aprovado:         'Aprovado',
    reprovado:        'Reprovado',
    pendente_auditor: 'Verificar',
    '':               'Não verificado',
  }
  const statusCor: Record<StatusDoc, string> = {
    aprovado:         'bg-green-100 text-green-800 border-green-300',
    reprovado:        'bg-red-100 text-red-800 border-red-300',
    pendente_auditor: 'bg-amber-100 text-amber-800 border-amber-300',
    '':               'bg-gray-100 text-gray-500 border-gray-200',
  }

  return (
    <div className="space-y-3">
      {DOCS_CONFIG.map(({ chave, id, titulo, criterio }) => {
        const item = itens[chave]
        return (
          <div
            key={chave}
            className={`rounded-xl border border-gray-100 border-l-4 p-4 bg-white
              ${item.status === 'aprovado' ? 'border-l-green-500'
              : item.status === 'reprovado' ? 'border-l-red-500'
              : item.status === 'pendente_auditor' ? 'border-l-amber-400'
              : 'border-l-gray-200'}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-400 uppercase">{id}</span>
                  <h4 className="font-semibold text-gray-800 text-sm">{titulo}</h4>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{criterio}</p>
              </div>

              {/* Seletor de status */}
              <div className="flex gap-1.5 flex-shrink-0">
                {(['aprovado', 'reprovado', 'pendente_auditor'] as StatusDoc[]).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(chave, item.status === s ? '' : s)}
                    className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-all
                      ${item.status === s ? statusCor[s] : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'}`}
                  >
                    {statusLabel[s]}
                  </button>
                ))}
              </div>
            </div>

            {/* Campo de observação */}
            <input
              type="text"
              value={item.observacao}
              onChange={e => setObs(chave, e.target.value)}
              placeholder="Observação (opcional)"
              className="mt-2 w-full text-xs border border-gray-200 rounded-lg px-3 py-1.5
                focus:outline-none focus:ring-1 focus:ring-sefaz-blue text-gray-700 placeholder-gray-300"
            />
          </div>
        )
      })}

      <div className="flex justify-end pt-1">
        <button
          onClick={salvar}
          disabled={salvando}
          className="px-5 py-2 bg-sefaz-blue text-white text-sm font-semibold rounded-lg
            hover:bg-blue-900 transition-colors disabled:opacity-50"
        >
          {salvando ? 'Salvando...' : salvo ? '✅ Checklist salvo' : 'Salvar checklist'}
        </button>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Página principal de análise
// ──────────────────────────────────────────────────────────────────────────────

export default function AnalisePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  // ── Estado da análise numérica ──
  const [resultado,      setResultado]      = useState<ResultadoAnalise | null>(null)
  const [parecerGerado,  setParecerGerado]  = useState('')
  const [parecerFinal,   setParecerFinal]   = useState('')
  const [razaoSocial,    setRazaoSocial]    = useState('')
  const [auditor,        setAuditor]        = useState('')
  const [salvando,       setSalvando]       = useState(false)
  const [salvo,          setSalvo]          = useState(false)
  const [carregando,     setCarregando]     = useState(true)
  const [matricula,      setMatricula]      = useState('')

  // ── Estado da análise documental ──
  const [resultadoDocs,  setResultadoDocs]  = useState<ResultadoDocumentos | null>(null)
  const [checklistDocs,  setChecklistDocs]  = useState<ChecklistManual | null>(null)

  useEffect(() => {
    async function carregar() {
      const { data: pedido } = await supabase
        .from('pedidos')
        .select('resultado_json, razao_social')
        .eq('id', id)
        .single()

      const { data: parecer } = await supabase
        .from('pareceres')
        .select('texto_gerado, texto_final, auditor, aprovado_em')
        .eq('pedido_id', id)
        .single()

      const { data: docAnalise } = await supabase
        .from('documentos_analise')
        .select('resultado_json')
        .eq('pedido_id', id)
        .single()

      if (pedido) {
        setResultado(pedido.resultado_json as ResultadoAnalise)
        setRazaoSocial(pedido.razao_social ?? '')
      }
      if (parecer) {
        setParecerGerado(parecer.texto_gerado ?? '')
        setParecerFinal(parecer.texto_final ?? parecer.texto_gerado ?? '')
        if (parecer.auditor) setAuditor(parecer.auditor)
        if (parecer.aprovado_em) setSalvo(true)
      }
      if (docAnalise?.resultado_json) {
        // resultado_json pode ser ResultadoDocumentos (IA) ou ChecklistManual (manual)
        const rj = docAnalise.resultado_json as any
        if ('contrato_social' in rj && 'status' in (rj.contrato_social ?? {})) {
          // Formato manual (ChecklistManual)
          setChecklistDocs(rj as ChecklistManual)
        } else if ('contrato_social' in rj) {
          // Formato IA (ResultadoDocumentos) — converte para checklist inicial
          setResultadoDocs(rj as ResultadoDocumentos)
          setChecklistDocs(aiParaChecklist(rj as ResultadoDocumentos))
        }
      }
      setCarregando(false)
    }
    carregar()
  }, [id])

  async function handleAprovar() {
    setSalvando(true)
    const res = await fetch('/api/pareceres', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pedidoId: id, textoFinal: parecerFinal, auditor }),
    })
    setSalvando(false)
    if (res.ok) setSalvo(true)
  }

  if (carregando) return <div className="text-center py-20 text-gray-400">Carregando análise...</div>
  if (!resultado)  return <div className="text-center py-20 text-red-500">Análise não encontrada.</div>

  const { req4, req5, req6, req7, req8, conclusao, motivos_indeferimento, cnpj, data_analise, tipo } = resultado
  const deferido = conclusao === 'deferido'

  return (
    <div className="space-y-6">

      {/* Cabeçalho do resultado numérico */}
      <div className={`rounded-xl p-6 text-white ${deferido ? 'bg-sefaz-green' : 'bg-red-600'}`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium opacity-80 uppercase tracking-wide">
              {tipo === 'credenciamento' ? 'Credenciamento' : 'Renovação'} · {new Date(data_analise).toLocaleDateString('pt-BR')}
            </p>
            <h2 className="text-2xl font-bold mt-1">
              {deferido ? '✅ Deferido' : '❌ Indeferido'}
            </h2>
            <p className="text-sm opacity-90 mt-1">
              CNPJ: {cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}
              {razaoSocial ? ` · ${razaoSocial}` : ''}
            </p>
          </div>
          {salvo && (
            <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">
              Parecer Aprovado
            </span>
          )}
        </div>
        {!deferido && motivos_indeferimento.length > 0 && (
          <ul className="mt-4 space-y-1">
            {motivos_indeferimento.map((m, i) => (
              <li key={i} className="text-sm opacity-90">• {m}</li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Checklist Documental ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="mb-4">
          <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
            Checklist Documental
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {resultadoDocs
              ? 'Pré-análise feita pela IA — revise e confirme cada documento abaixo.'
              : 'Marque cada documento após verificação. O checklist é salvo no banco de dados.'}
          </p>
        </div>
        {resultadoDocs && <ResumoIA rd={resultadoDocs} />}
        <ChecklistDocumental pedidoId={id} valorInicial={checklistDocs} />
      </div>

      {/* ── Análise Numérica ── */}
      <div>
        <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide mb-3">
          Checklist Numérico — EFD / NF-e
        </h3>
        <div className="space-y-3">
          <RequisitCard id="REQ-4" titulo="Faturamento ≥ Entradas (sem 3 meses consecutivos)" base="Art. 3º, III — Portaria 410/2025" resultado={req4.resultado}>
            <p>Maior sequência consecutiva com problema: <strong>{req4.detalhe.maior_sequencia} mês(es)</strong></p>
            {req4.detalhe.meses_com_saidas_menor_entradas.length > 0 && (
              <p className="text-xs text-gray-400">Meses: {req4.detalhe.meses_com_saidas_menor_entradas.join(', ')}</p>
            )}
          </RequisitCard>

          <RequisitCard id="REQ-5" titulo="Faturamento mínimo" base="Art. 3º, IV — Portaria 410/2025" resultado={req5.resultado}>
            <div className="grid grid-cols-3 gap-3 mt-1">
              <div><p className="text-xs text-gray-400">Total 12 meses</p><p className="font-semibold text-gray-800">{fmtBRL(req5.detalhe.total_faturamento_12m)}</p></div>
              <div><p className="text-xs text-gray-400">Média mensal</p><p className="font-semibold text-gray-800">{fmtBRL(req5.detalhe.media_mensal)}</p></div>
              <div><p className="text-xs text-gray-400">Mínimo exigido</p><p className="font-semibold text-gray-800">{fmtBRL(req5.detalhe.minimo_exigido)}</p></div>
            </div>
            {req5.detalhe.periodo_referencia && (
              <p className="text-xs text-gray-400 mt-2">
                Período analisado: <strong>{req5.detalhe.periodo_referencia}</strong>
                {' '}({req5.detalhe.meses_analisados?.length ?? 0} meses)
              </p>
            )}
            {req5.detalhe.inicio_atividade && (
              <p className="text-xs text-blue-600 mt-1">★ Empresa em início de atividade — base: média mensal</p>
            )}
          </RequisitCard>

          <RequisitCard id="REQ-6" titulo="Itens prioritários ≥ 70% das saídas da Tabela I" base="Art. 3º, VI — Portaria 410/2025" resultado={req6.resultado}>
            <div className="grid grid-cols-3 gap-3 mt-1">
              <div><p className="text-xs text-gray-400">Total Tabela I</p><p className="font-semibold text-gray-800">{fmtBRL(req6.detalhe.total_saidas_tabela1)}</p></div>
              <div><p className="text-xs text-gray-400">Itens prioritários</p><p className="font-semibold text-gray-800">{fmtBRL(req6.detalhe.total_saidas_prioritarios)}</p></div>
              <div>
                <p className="text-xs text-gray-400">Percentual</p>
                <p className={`font-semibold ${req6.resultado === 'aprovado' ? 'text-sefaz-green' : 'text-red-600'}`}>{fmtPct(req6.detalhe.percentual_apurado)}</p>
              </div>
            </div>
          </RequisitCard>

          <RequisitCard id="REQ-7" titulo="Agregação ≥ 30% nas vendas ao grupo econômico" base="Art. 3º, VII — Portaria 410/2025" resultado={req7.resultado}>
            {req7.resultado === 'nao_aplicavel' ? (
              <p className="text-gray-400 italic">Sem operações com estabelecimentos do mesmo grupo econômico.</p>
            ) : req7.detalhe ? (
              <div className="grid grid-cols-3 gap-3 mt-1">
                <div><p className="text-xs text-gray-400">Saídas ao grupo</p><p className="font-semibold text-gray-800">{fmtBRL(req7.detalhe.total_saidas_grupo)}</p></div>
                <div><p className="text-xs text-gray-400">CMV estimado</p><p className="font-semibold text-gray-800">{fmtBRL(req7.detalhe.cmv_estimado)}</p></div>
                <div>
                  <p className="text-xs text-gray-400">Agregação</p>
                  <p className={`font-semibold ${req7.resultado === 'aprovado' ? 'text-sefaz-green' : 'text-red-600'}`}>{fmtPct(req7.detalhe.percentual_agregacao)}</p>
                </div>
              </div>
            ) : null}
          </RequisitCard>

          <RequisitCard id="REQ-8" titulo="Empregados mínimos (informativo)" base="Art. 4º — Portaria 410/2025" resultado="informativo">
            <p>Faixa de faturamento: <strong>{req8.detalhe.faixa_faturamento}</strong></p>
            <p>Empregados mínimos exigidos pela legislação:{' '}
              <strong className="text-sefaz-blue">{req8.detalhe.empregados_minimos_exigidos} funcionários CLT</strong>
            </p>
          </RequisitCard>
        </div>
      </div>

      {/* ── Parecer Fiscal ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Parecer Fiscal</h3>
          <div className="flex items-center gap-2">
            {!salvo
              ? <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Aguardando aprovação</span>
              : <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">✅ Parecer aprovado</span>
            }
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={matricula}
                onChange={e => setMatricula(e.target.value)}
                placeholder="Matrícula"
                maxLength={20}
                className="w-28 px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
                title="Informe sua matrícula funcional antes de exportar"
              />
              <a
                href={`/api/exportar-pdf?id=${id}${matricula ? `&matricula=${encodeURIComponent(matricula)}` : ''}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-sefaz-blue text-white text-xs font-semibold
                  rounded-lg hover:bg-blue-900 transition-colors"
                title="Exportar como Informação Fiscal (PDF)"
              >
                📄 Exportar IF
              </a>
            </div>
          </div>
        </div>
        {parecerGerado.includes('Parecer gerado automaticamente (modo offline)') ? (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
            ⚠️ A IA não estava disponível no momento da análise. Revise antes de aprovar.
          </p>
        ) : (
          <p className="text-xs text-gray-400 mb-2">Texto gerado pela IA. Edite se necessário antes de aprovar.</p>
        )}
        <textarea
          value={parecerFinal}
          onChange={e => setParecerFinal(e.target.value)}
          disabled={salvo}
          rows={16}
          className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm font-mono text-gray-800
            focus:outline-none focus:ring-2 focus:ring-sefaz-blue disabled:bg-gray-50 disabled:text-gray-600 resize-y"
        />
        {!salvo && (
          <div className="mt-4 flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Nome do auditor responsável</label>
              <input
                type="text" value={auditor} onChange={e => setAuditor(e.target.value)}
                placeholder="Nome completo"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sefaz-blue"
              />
            </div>
            <button
              onClick={handleAprovar}
              disabled={salvando || !parecerFinal.trim()}
              className="px-6 py-2 bg-sefaz-green text-white font-semibold rounded-lg text-sm
                hover:bg-green-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {salvando ? 'Salvando...' : 'Aprovar Parecer'}
            </button>
          </div>
        )}
      </div>

      <div className="text-center">
        <button onClick={() => router.push('/')} className="text-sm text-sefaz-blue hover:underline">
          ← Nova análise
        </button>
      </div>

    </div>
  )
}
