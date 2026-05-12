'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse'
import {
  LinhaFaturamentoMensal,
  LinhaMovimentacaoNCM,
  LinhaSaidasGrupoEconomico,
} from '@/lib/types'

// ──────────────────────────────────────────────────────────────────────────────
// Documentos formais (PDFs)
// ──────────────────────────────────────────────────────────────────────────────

type DocKey = 'contratoSocial' | 'docsSocios' | 'imovel' | 'comprovanteEndereco' | 'irSocios' | 'raisGfip' | 'contratoContador' | 'licencaAnvisa'
const DOC_KEYS: DocKey[] = ['contratoSocial', 'docsSocios', 'imovel', 'comprovanteEndereco', 'irSocios', 'raisGfip', 'contratoContador', 'licencaAnvisa']
const DOC_LABELS: Record<DocKey, { label: string; sub: string }> = {
  contratoSocial:      { label: 'Contrato Social',                            sub: 'Objeto social e constituição da empresa' },
  docsSocios:          { label: 'Docs. Pessoais dos Sócios/Diretores',        sub: 'RG, CPF, CNH ou passaporte' },
  imovel:              { label: 'Registro de Imóvel ou Contrato de Locação',  sub: 'Endereço do estabelecimento' },
  comprovanteEndereco: { label: 'Comprovante de Endereço',                    sub: 'Conta de energia ou similar (mês anterior ao pedido)' },
  irSocios:            { label: 'Imposto de Renda dos Sócios (3 últimos)',    sub: 'Pode ser um único PDF com todos os IRs' },
  raisGfip:            { label: 'RAIS ou GFIP',                               sub: 'Quadro de funcionários CLT' },
  contratoContador:    { label: 'Contrato do Contador + DHP',                 sub: 'Vigência atual do contrato e habilitação profissional' },
  licencaAnvisa:       { label: 'Licença ANVISA',                             sub: 'Autorização de funcionamento vigente' },
}

function PdfDropZone({ label, sublabel, arquivo, onFile }: {
  label: string; sublabel: string; arquivo: File | null; onFile: (f: File) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  const handle = (f: File | undefined) => { if (f && f.name.toLowerCase().endsWith('.pdf')) onFile(f) }
  return (
    <div
      className={`relative border-2 border-dashed rounded-lg p-3 transition-colors cursor-pointer
        ${drag ? 'border-sefaz-blue bg-blue-50' : arquivo ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-white hover:border-sefaz-blue'}`}
      onDragOver={e => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]) }}
      onClick={() => ref.current?.click()}
    >
      <input ref={ref} type="file" accept=".pdf" className="hidden" onChange={e => handle(e.target.files?.[0])} />
      <div className="flex items-start gap-2">
        <span className={`text-lg mt-0.5 ${arquivo ? 'text-green-500' : 'text-gray-400'}`}>{arquivo ? '✅' : '📄'}</span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-gray-700 leading-tight">{label}</p>
          <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>
          {arquivo && <p className="text-xs text-green-600 mt-0.5 font-medium truncate">{arquivo.name}</p>}
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers de parsing de CSV
// ──────────────────────────────────────────────────────────────────────────────

/** Parse com cabeçalho (CSV simples) */
function parseCsv<T>(file: File): Promise<T[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      delimiter: '',        // auto-detecta vírgula, ponto-e-vírgula, tab etc.
      complete: (result) => resolve(result.data as T[]),
      error: (err) => reject(err),
    })
  })
}

/** Parse sem cabeçalho — retorna array de arrays (usado para NF-e com colunas duplicadas) */
function parseCsvArray(file: File): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      dynamicTyping: false,
      delimiter: '',
      complete: (result) => resolve(result.data as string[][]),
      error: (err) => reject(err),
    })
  })
}

function toNum(v: unknown): number {
  if (typeof v === 'number') return v
  const s = String(v).trim()
  // Formato brasileiro (vírgula = decimal): "805779,49" ou "1.234.567,89"
  // Prioridade: se contém vírgula, trata como BR — parseFloat para na vírgula e daria errado
  if (s.includes(',')) {
    const br = parseFloat(s.replace(/\./g, '').replace(',', '.'))
    if (!isNaN(br)) return br
  }
  // Formato com ponto decimal: "480000.00"
  const direct = parseFloat(s)
  return isNaN(direct) ? 0 : direct
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers de normalização para o formato real da EFD (separador ";", IND_OPER)
// ──────────────────────────────────────────────────────────────────────────────

/** Encontra o valor de uma coluna pelo nome parcial (insensível a maiúsculas/acentos).
 *  Dá preferência a colunas cujo nome COMEÇA com o keyword, evitando matches parciais
 *  como "ULTIMA_MES - ...do Periodo" quando se busca por "PERIODO". */
function getCol(row: Record<string, string>, keyword: string): string {
  const kw = keyword.replace(/[-_\s]/g, '').toUpperCase()
  const keys = Object.keys(row)
  const norm = (k: string) => k.replace(/[-_\s]/g, '').toUpperCase()
  // 1ª prioridade: chave que começa com o keyword
  const startKey = keys.find(k => norm(k).startsWith(kw))
  // 2ª prioridade: chave que apenas contém o keyword (fallback)
  const includeKey = keys.find(k => norm(k).includes(kw))
  const key = startKey ?? includeKey
  return key ? String(row[key] ?? '').trim() : ''
}

/** Remove sufixo ",00" e zeros à esquerda não significativos; retorna apenas dígitos */
function somenteDigitos(v: string): string {
  return v.replace(/[^0-9]/g, '')
}

/** Normaliza CNPJ para exatamente 14 dígitos.
 *  Remove parte decimal antes de extrair dígitos:
 *  "1163981000150,00" → "1163981000150" → padStart → "01163981000150" */
function normCnpj(v: string): string {
  const semDecimal = v.includes(',') ? v.split(',')[0] : v
  return somenteDigitos(semDecimal).padStart(14, '0')
}

/** Converte YYYYMM para MM/AAAA.
 *  Remove parte decimal antes de extrair dígitos:
 *  "202505,00" → "202505" → "05/2025" */
function normPeriodo(v: string): string {
  const semDecimal = v.includes(',') ? v.split(',')[0].trim() : v.trim()
  const p = somenteDigitos(semDecimal)
  if (p.length === 6) return `${p.slice(4, 6)}/${p.slice(0, 4)}`
  return v // devolve original se não reconhecer (ex: já está em MM/AAAA)
}

/** Detecta se o CSV usa o formato real da EFD (colunas IND_OPER / PERIODO) */
function isFormatoEFD(rows: Record<string, string>[]): boolean {
  if (!rows.length) return false
  const headers = Object.keys(rows[0]).join(' ').toUpperCase()
  return headers.includes('INDOPER') || headers.includes('IND_OPER') || headers.includes('PERIODO')
}

function normalizarFaturamento(rows: Record<string, string>[]): LinhaFaturamentoMensal[] {
  if (isFormatoEFD(rows)) {
    // ── Passo 1: acumula valores por CNPJ + PERIODO + SUBSTITUTIVA + IND_OPER ──
    // O campo de valor pode ser VL_OPR ou VL_DOC dependendo da consulta usada.
    // SUBSTITUTIVA: quando existe declaração substituta (valor mais alto), ela
    // substitui completamente a original — nunca somamos as duas.

    const subMap: Record<string, number> = {}    // chave: cnpj|periodo|sub|indoper → valor
    const maxSub: Record<string, number> = {}    // chave: cnpj|periodo → maior nível substituta

    for (const r of rows) {
      const cnpj        = normCnpj(getCol(r, 'CNPJ'))
      const competencia = normPeriodo(getCol(r, 'PERIODO'))
      const indOper     = somenteDigitos(getCol(r, 'INDOPER'))  // '0' ou '1'
      const subNivel    = Math.round(toNum(getCol(r, 'SUBSTITUTIVA')))  // 1=original, 2=substituta, etc.
      const valorRaw    = getCol(r, 'VLOPR') || getCol(r, 'VLDOC')
      const valor       = toNum(valorRaw)  // aceita ambos os nomes

      const periodKey = `${cnpj}|${competencia}`
      maxSub[periodKey] = Math.max(maxSub[periodKey] ?? 0, subNivel)

      const subKey = `${periodKey}|${subNivel}|${indOper}`
      subMap[subKey] = (subMap[subKey] ?? 0) + valor
    }

    // ── Passo 2: monta resultado usando apenas o nível substituta mais alto ──
    const map: Record<string, LinhaFaturamentoMensal> = {}

    for (const [subKey, valor] of Object.entries(subMap)) {
      const parts = subKey.split('|')  // [cnpj, periodo, subNivel, indOper]
      const cnpj        = parts[0]
      const competencia = parts[1]
      const subNivel    = Number(parts[2])
      const indOper     = parts[3]
      const periodKey   = `${cnpj}|${competencia}`

      if (subNivel !== maxSub[periodKey]) continue  // descarta declaração superada por substituta

      if (!map[periodKey]) map[periodKey] = { cnpj, competencia, valor_total_entradas: 0, valor_total_saidas: 0 }
      if (indOper === '0') map[periodKey].valor_total_entradas += valor
      if (indOper === '1') map[periodKey].valor_total_saidas   += valor
    }

    return Object.values(map)
  }

  // Formato legado (colunas diretas valor_total_entradas / valor_total_saidas)
  return rows.map(r => ({
    cnpj:                 String(r.cnpj ?? '').trim(),
    competencia:          String(r.competencia ?? '').trim(),
    valor_total_entradas: toNum(r.valor_total_entradas),
    valor_total_saidas:   toNum(r.valor_total_saidas),
  }))
}

// ──────────────────────────────────────────────────────────────────────────────
// Parser da NF-e emitida (CSV 2)
// Exportação do sistema de NF-e: uma linha por ITEM de nota fiscal
// Colunas com índice fixo (há colunas duplicadas — CNPJ aparece 2x)
// ──────────────────────────────────────────────────────────────────────────────

const NFE = {
  STATUS:     2,   // "AUTORIZADO" / "CANCELADO"
  CNPJ_EMIT:  3,   // CNPJ do emitente (atacadista)
  CNPJ_DEST:  6,   // CNPJ do destinatário (comprador)
  ANO_MES:    11,  // Período YYYYMM (ex: 202502)
  TIPO_OP:    14,  // "SAÍDA" / "ENTRADA"
  NCM:        23,  // Código NCM do produto
  VL_PROD:    28,  // Valor do produto (formato BR: "1.234,56" ou "1234,56")
} as const

interface ResultadoNFe {
  movimentacaoNcm: LinhaMovimentacaoNCM[]
  saidasGrupo:     LinhaSaidasGrupoEconomico[]
}

/**
 * Lê o CSV da NF-e emitida (array de arrays, sem cabeçalho).
 * Agrupa por período + NCM para REQ-6.
 * Filtra por CNPJ destinatário para extrair saídas ao grupo econômico (REQ-7).
 */
function normalizarNFeEmitidas(rows: string[][], cnpjsGrupo: string[]): ResultadoNFe {
  const mapNcm:   Record<string, LinhaMovimentacaoNCM>      = {}
  const mapGrupo: Record<string, LinhaSaidasGrupoEconomico> = {}

  // Linha 0 é o cabeçalho — pula
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    if (!r || r.length < 29) continue

    // Filtros obrigatórios
    if (r[NFE.STATUS]?.trim()  !== 'AUTORIZADO') continue
    if (r[NFE.TIPO_OP]?.trim() !== 'SAÍDA')      continue

    const ncm = r[NFE.NCM]?.trim() ?? ''
    if (!ncm || ncm === '0') continue            // produto sem NCM — ignora

    const cnpjEmit    = normCnpj(r[NFE.CNPJ_EMIT] ?? '')
    const cnpjDest    = normCnpj(r[NFE.CNPJ_DEST] ?? '')
    const competencia = normPeriodo(r[NFE.ANO_MES] ?? '')
    const valor       = toNum(r[NFE.VL_PROD] ?? '0')

    // Agrupamento por emitente + período + NCM (REQ-6)
    const keyNcm = `${cnpjEmit}|${competencia}|${ncm}`
    if (!mapNcm[keyNcm]) {
      mapNcm[keyNcm] = { cnpj: cnpjEmit, competencia, ncm, valor_total_entradas: 0, valor_total_saidas: 0 }
    }
    mapNcm[keyNcm].valor_total_saidas += valor

    // Se destinatário é varejista do grupo → registra para REQ-7
    if (cnpjsGrupo.includes(cnpjDest)) {
      const keyGrupo = `${cnpjEmit}|${cnpjDest}|${competencia}|${ncm}`
      if (!mapGrupo[keyGrupo]) {
        mapGrupo[keyGrupo] = {
          cnpj_remetente:    cnpjEmit,
          cnpj_destinatario: cnpjDest,
          competencia,
          ncm,
          valor_saidas_tabela1: 0,
        }
      }
      mapGrupo[keyGrupo].valor_saidas_tabela1 += valor
    }
  }

  return {
    movimentacaoNcm: Object.values(mapNcm),
    saidasGrupo:     Object.values(mapGrupo),
  }
}

/**
 * CSV 3 — EFD Entradas por NCM (somente para REQ-7 — cálculo do CMV).
 * Formato simples: cnpj, competencia, ncm, valor_total_entradas
 * Preenche valor_total_entradas; valor_total_saidas permanece 0.
 */
function normalizarEntradasNCM(rows: Record<string, string>[]): LinhaMovimentacaoNCM[] {
  return rows.map(r => ({
    cnpj:                 String(r.cnpj ?? '').trim(),
    competencia:          String(r.competencia ?? '').trim(),
    ncm:                  String(r.ncm ?? '').trim(),
    valor_total_entradas: toNum(r.valor_total_entradas),
    valor_total_saidas:   0,
  }))
}

// ──────────────────────────────────────────────────────────────────────────────
// Componente de Upload de arquivo individual
// ──────────────────────────────────────────────────────────────────────────────

function DropZone({
  label, sublabel, arquivo, onFile, obrigatorio = true, desabilitado = false,
}: {
  label: string
  sublabel: string
  arquivo: File | null
  onFile: (f: File) => void
  obrigatorio?: boolean
  desabilitado?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [drag, setDrag]   = useState(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDrag(false)
    if (desabilitado) return
    const f = e.dataTransfer.files[0]
    if (f && f.name.endsWith('.csv')) onFile(f)
  }

  return (
    <div
      className={`relative border-2 border-dashed rounded-lg p-5 transition-colors
        ${desabilitado
          ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
          : drag
            ? 'border-sefaz-blue bg-blue-50 cursor-pointer'
            : arquivo
              ? 'border-sefaz-green bg-green-50 cursor-pointer'
              : 'border-gray-300 bg-white hover:border-sefaz-blue cursor-pointer'
        }`}
      onDragOver={e => { if (!desabilitado) { e.preventDefault(); setDrag(true) } }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
      onClick={() => !desabilitado && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        disabled={desabilitado}
        onChange={e => { if (e.target.files?.[0]) onFile(e.target.files[0]) }}
      />
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 text-2xl ${arquivo ? 'text-sefaz-green' : 'text-gray-400'}`}>
          {arquivo ? '✅' : obrigatorio ? '📄' : '📎'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-gray-800">
            {label}
            {!obrigatorio && <span className="ml-1 text-xs font-normal text-gray-400">(opcional)</span>}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{sublabel}</p>
          {arquivo && (
            <p className="text-xs text-sefaz-green mt-1 font-medium truncate">{arquivo.name}</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Página principal
// ──────────────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter()

  const [cnpj, setCnpj]                    = useState('')
  const [razaoSocial, setRS]               = useState('')
  const [inscricaoEstadual, setIE]         = useState('')
  const [tipo, setTipo]                    = useState<'credenciamento' | 'renovacao'>('credenciamento')
  const [dataPedido, setDataPedido]        = useState('')   // formato AAAA-MM
  const [numeroIF, setNumeroIF]            = useState('')   // ex: 49/2026
  const [numeroProcesso, setNumeroProcesso]= useState('')   // ex: 001234/2026
  const [grupoEconomico, setGrupo]         = useState(false)
  const [cnpjsGrupo, setCnpjsGrupo]        = useState<string[]>([''])

  const [pdfs, setPdfs] = useState<Partial<Record<DocKey, File>>>({})
  const setPdf = (key: DocKey) => (f: File) => setPdfs(prev => ({ ...prev, [key]: f }))

  const [csv1, setCsv1] = useState<File | null>(null)
  const [csv2, setCsv2] = useState<File | null>(null)
  const [csv3, setCsv3] = useState<File | null>(null)

  const [loading,    setLoading]    = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [erro, setErro]             = useState<string | null>(null)

  const formatarCnpj = (v: string) => {
    const n = v.replace(/\D/g, '').slice(0, 14)
    return n
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
  }

  const adicionarCnpjGrupo = () => setCnpjsGrupo(prev => [...prev, ''])
  const removerCnpjGrupo   = (i: number) => setCnpjsGrupo(prev => prev.filter((_, idx) => idx !== i))
  const atualizarCnpjGrupo = (i: number, val: string) =>
    setCnpjsGrupo(prev => prev.map((c, idx) => idx === i ? formatarCnpj(val) : c))

  const todosDocsPresentes = DOC_KEYS.every(k => pdfs[k])

  const podeEnviar =
    cnpj.replace(/\D/g, '').length === 14 &&
    dataPedido !== '' &&
    todosDocsPresentes &&
    csv1 !== null && csv2 !== null &&
    (!grupoEconomico || csv3 !== null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!podeEnviar) return
    setErro(null)
    setLoading(true)

    try {
      const cnpjsGrupoNorm = grupoEconomico
        ? cnpjsGrupo.map(c => c.replace(/\D/g, '')).filter(c => c.length === 14)
        : []

      setLoadingMsg('Analisando planilhas...')

      const rawFat = await parseCsv<Record<string, string>>(csv1!)
      const rawNfe = await parseCsvArray(csv2!)
      const { movimentacaoNcm, saidasGrupo } = normalizarNFeEmitidas(rawNfe, cnpjsGrupoNorm)

      let entradasNcm: LinhaMovimentacaoNCM[] = []
      if (csv3) {
        const rawEnt = await parseCsv<Record<string, string>>(csv3)
        entradasNcm = normalizarEntradasNCM(rawEnt)
      }

      const mapMovimentacao: Record<string, LinhaMovimentacaoNCM> = {}
      for (const m of movimentacaoNcm) {
        mapMovimentacao[`${m.cnpj}|${m.competencia}|${m.ncm}`] = { ...m }
      }
      for (const e of entradasNcm) {
        const key = `${e.cnpj}|${e.competencia}|${e.ncm}`
        if (mapMovimentacao[key]) {
          mapMovimentacao[key].valor_total_entradas += e.valor_total_entradas
        } else {
          mapMovimentacao[key] = { ...e }
        }
      }

      const payload = {
        cnpj:              cnpj.replace(/\D/g, ''),
        razaoSocial:       razaoSocial || undefined,
        inscricaoEstadual: inscricaoEstadual || undefined,
        numeroIF:          numeroIF || undefined,
        numeroProcesso:    numeroProcesso || undefined,
        tipo,
        dataPedido,
        grupoEconomico,
        cnpjsGrupo:        cnpjsGrupoNorm,
        faturamentoMensal: normalizarFaturamento(rawFat),
        movimentacaoNcm:   Object.values(mapMovimentacao),
        saidasGrupo,
      }

      const res1 = await fetch('/api/analisar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res1.ok) {
        const data = await res1.json()
        throw new Error(data.erro ?? 'Erro na análise numérica')
      }

      const { pedidoId } = await res1.json()

      // ── Etapa 2: análise documental com IA (Haiku) ──────────────────────────
      setLoadingMsg('Analisando documentos com IA... (pode levar até 1 minuto)')
      const formData = new FormData()
      formData.append('pedidoId', pedidoId)
      for (const key of DOC_KEYS) formData.append(key, pdfs[key]!)
      const res2 = await fetch('/api/analisar-documentos', { method: 'POST', body: formData })
      if (!res2.ok) console.warn('Análise documental falhou:', (await res2.json()).erro)

      router.push(`/analise/${pedidoId}`)
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao processar análise.')
    } finally {
      setLoading(false)
      setLoadingMsg('')
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Nova Análise</h2>
        <p className="text-sm text-gray-500 mt-1">
          Preencha os dados do contribuinte, selecione o tipo de pedido e faça o upload dos relatórios extraídos da EFD.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Dados do contribuinte */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
            Dados do Contribuinte
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">CNPJ *</label>
              <input
                type="text"
                value={cnpj}
                onChange={e => setCnpj(formatarCnpj(e.target.value))}
                placeholder="00.000.000/0001-00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sefaz-blue"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Inscrição Estadual</label>
              <input
                type="text"
                value={inscricaoEstadual}
                onChange={e => setIE(e.target.value)}
                placeholder="Ex: 12.345.678-9"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sefaz-blue"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Razão Social</label>
            <input
              type="text"
              value={razaoSocial}
              onChange={e => setRS(e.target.value)}
              placeholder="Razão social do contribuinte"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sefaz-blue"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">N° Informação Fiscal</label>
              <input
                type="text"
                value={numeroIF}
                onChange={e => setNumeroIF(e.target.value)}
                placeholder="Ex: 49/2026"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sefaz-blue"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">N° Processo</label>
              <input
                type="text"
                value={numeroProcesso}
                onChange={e => setNumeroProcesso(e.target.value)}
                placeholder="Ex: 001234/2026"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sefaz-blue"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Tipo de Pedido *</label>
              <div className="flex gap-4 pt-1">
                {(['credenciamento', 'renovacao'] as const).map(t => (
                  <label key={t} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="tipo"
                      value={t}
                      checked={tipo === t}
                      onChange={() => setTipo(t)}
                      className="accent-sefaz-blue"
                    />
                    <span className="text-sm text-gray-700">
                      {t === 'credenciamento' ? 'Credenciamento' : 'Renovação'}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Mês do Protocolo do Pedido *
              </label>
              <input
                type="month"
                value={dataPedido}
                onChange={e => setDataPedido(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sefaz-blue"
                required
              />
              {dataPedido && (
                <p className="text-xs text-gray-400 mt-1">
                  Período analisado: {(() => {
                    const [y, m] = dataPedido.split('-').map(Number)
                    const fim = new Date(y, m - 2)  // mês anterior
                    const ini = new Date(y, m - 14) // 12 meses antes do fim
                    return `${String(ini.getMonth()+1).padStart(2,'0')}/${ini.getFullYear()} a ${String(fim.getMonth()+1).padStart(2,'0')}/${fim.getFullYear()}`
                  })()}
                </p>
              )}
            </div>
          </div>

          {/* Grupo econômico */}
          <div className="border-t border-gray-100 pt-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={grupoEconomico}
                onChange={e => {
                  setGrupo(e.target.checked)
                  if (!e.target.checked) { setCsv3(null); setCnpjsGrupo(['']) }
                }}
                className="w-4 h-4 accent-sefaz-blue"
              />
              <span className="text-sm font-medium text-gray-800">
                Contribuinte pertence a grupo econômico
              </span>
            </label>
            <p className="text-xs text-gray-400 mt-1 ml-7">
              Marque se houver estabelecimentos varejistas no mesmo grupo — ativa a verificação do REQ-7 (Art. 3º, VII)
            </p>

            {grupoEconomico && (
              <div className="mt-4 ml-7 space-y-2">
                <p className="text-xs font-medium text-gray-600">
                  CNPJs dos estabelecimentos varejistas do mesmo grupo:
                </p>
                {cnpjsGrupo.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={c}
                      onChange={e => atualizarCnpjGrupo(i, e.target.value)}
                      placeholder="00.000.000/0001-00"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sefaz-blue"
                    />
                    {cnpjsGrupo.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removerCnpjGrupo(i)}
                        className="text-red-400 hover:text-red-600 text-lg leading-none"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={adicionarCnpjGrupo}
                  className="text-xs text-sefaz-blue hover:underline mt-1"
                >
                  + Adicionar outro CNPJ
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Upload dos documentos formais */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-3">
          <div>
            <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
              Documentos Formais (PDF)
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {DOC_KEYS.filter(k => pdfs[k]).length} de {DOC_KEYS.length} documentos carregados · analisados automaticamente pela IA
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {DOC_KEYS.map(key => (
              <PdfDropZone
                key={key}
                label={DOC_LABELS[key].label}
                sublabel={DOC_LABELS[key].sub}
                arquivo={pdfs[key] ?? null}
                onFile={setPdf(key)}
              />
            ))}
          </div>
        </section>

        {/* Upload dos relatórios */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-3">
          <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
            Relatórios (CSV)
          </h3>
          <p className="text-xs text-gray-400 -mt-1">
            CSV 1 extraído da EFD · CSV 2 extraído do sistema de NF-e emitidas
          </p>

          <DropZone
            label="CSV 1 — Faturamento Mensal (EFD)"
            sublabel="Exportação da EFD — colunas: CNPJ, PERIODO, IND_OPER, VL_OPR"
            arquivo={csv1}
            onFile={setCsv1}
          />
          <DropZone
            label="CSV 2 — NF-e Emitidas por Item (Saídas)"
            sublabel="Exportação do sistema de NF-e — uma linha por item de nota, com coluna NCM e Valor Produto"
            arquivo={csv2}
            onFile={setCsv2}
          />
          <DropZone
            label="CSV 3 — EFD Entradas por NCM (para cálculo de CMV)"
            sublabel="Necessário apenas para calcular o REQ-7 — colunas: cnpj, competencia, ncm, valor_total_entradas"
            arquivo={csv3}
            onFile={setCsv3}
            obrigatorio={grupoEconomico}
            desabilitado={!grupoEconomico}
          />
          {grupoEconomico && !csv3 && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              ⚠️ CSV 3 é necessário para calcular o CMV e verificar o REQ-7 (agregação mínima de 30%)
            </p>
          )}
        </section>

        {erro && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            ⚠️ {erro}
          </div>
        )}

        <button
          type="submit"
          disabled={!podeEnviar || loading}
          className="w-full py-3 px-6 bg-sefaz-blue text-white font-semibold rounded-xl
            hover:bg-blue-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? `⏳ ${loadingMsg}` : 'Analisar Pedido →'}
        </button>
      </form>
    </div>
  )
}
