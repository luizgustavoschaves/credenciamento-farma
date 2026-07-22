'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ResultadoAnalise } from '@/lib/types'

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


// ──────────────────────────────────────────────────────────────────────────────
// Checklist documental manual
// ──────────────────────────────────────────────────────────────────────────────

type ChaveDoc =
  | 'cnae'
  | 'requerimento'
  | 'contrato_social'
  | 'docs_socios'
  | 'imovel'
  | 'comprovante_endereco'
  | 'ir_socios'
  | 'rais'
  | 'gfip'
  | 'contrato_contador'
  | 'licenca_anvisa'
  | 'regularidade_fiscal'
  | 'regularidade_dief'
  | 'grupo_economico'

type ChecklistManual = Record<ChaveDoc, { checked: boolean }>

const DOCS_CONFIG: { chave: ChaveDoc; id: string; titulo: string; criterio: string; dica: string; link?: string }[] = [
  {
    chave: 'cnae',
    id: 'DOC-1',
    titulo: 'CNAE enquadrado (4644-3/01 ou 4645-1/00)',
    criterio: 'CNAE principal ou secundário é comércio atacadista de medicamentos',
    dica: 'Verificar no cadastro estadual (CAGEF) se o CNAE 4644-3/01 (medicamentos para uso humano) ou 4645-1/00 (medicamentos para uso veterinário) consta como principal ou secundário. Art. 3º, inciso V da Portaria 410/2025.',
  },
  {
    chave: 'requerimento',
    id: 'DOC-2',
    titulo: 'Requerimento do pedido (SEFAZ)',
    criterio: 'Formulário de pedido de credenciamento protocolado na SEFAZ',
    dica: 'Verificar se o requerimento foi corretamente preenchido e protocolado, contendo CNPJ, razão social, endereço, número do processo SEI e assinatura do responsável legal. Art. 2º, inciso I da Portaria 410/2025.',
  },
  {
    chave: 'contrato_social',
    id: 'DOC-3',
    titulo: 'Instrumento constitutivo (Contrato Social)',
    criterio: 'Objeto social inclui atacado farmacêutico; constituição regular',
    dica: 'Analisar o objeto social da empresa e a data de constituição. Verificar se a última alteração contratual está registrada na JUCEMA. Art. 2º, inciso II, alínea a da Portaria 410/2025.',
  },
  {
    chave: 'docs_socios',
    id: 'DOC-4',
    titulo: 'Cédulas de identidade e CPF dos sócios',
    criterio: 'RG e CPF de todos os sócios listados no contrato social',
    dica: 'Verificar se a pessoa identificada no documento está nominada no contrato social. Conferir se todos os sócios com participação no capital estão com documentação atualizada. Art. 2º, inciso II, alínea b da Portaria 410/2025.',
  },
  {
    chave: 'imovel',
    id: 'DOC-5',
    titulo: 'Registro de Imóvel ou Contrato de Locação',
    criterio: 'Endereço confere com o estabelecimento credenciado',
    dica: 'Verificar se o endereço do imóvel ou da locação corresponde ao do estabelecimento. No caso de locação, o contrato deve estar vigente na data do pedido. Art. 2º, inciso II, alínea c da Portaria 410/2025.',
  },
  {
    chave: 'comprovante_endereco',
    id: 'DOC-6',
    titulo: 'Comprovante de Endereço (última conta de energia)',
    criterio: 'Mês anterior ao pedido; endereço bate com o imóvel/locação',
    dica: 'Deve ser a última conta de energia elétrica ou outro comprovante emitido no mês anterior ao pedido. Verificar se o endereço bate com o do registro de imóvel ou contrato de locação. Art. 2º, inciso II, alínea d da Portaria 410/2025.',
  },
  {
    chave: 'ir_socios',
    id: 'DOC-7',
    titulo: 'Três últimos IR dos sócios',
    criterio: 'Declarações dos últimos 3 anos de todos os sócios',
    dica: 'Verificar se as pessoas constantes nas declarações de IR são as mesmas listadas como sócias no contrato social. Checar se os exercícios são os três últimos antes do pedido. Art. 2º, inciso II, alínea e da Portaria 410/2025.',
  },
  {
    chave: 'rais',
    id: 'DOC-8',
    titulo: 'RAIS (Relação Anual de Informações Sociais)',
    criterio: 'Quadro de funcionários CLT declarado na RAIS',
    dica: 'Relação Anual de Informações Sociais do último exercício. Verificar a quantidade de funcionários declarados e se está condizente com o mínimo exigido pela faixa de faturamento apurada. Art. 2º, inciso II, alínea f da Portaria 410/2025.',
  },
  {
    chave: 'gfip',
    id: 'DOC-9',
    titulo: 'GFIP (12 meses)',
    criterio: 'Guias GFIP dos 12 meses anteriores ao pedido',
    dica: 'Guia de Recolhimento do FGTS e de Informações à Previdência Social dos últimos 12 meses. Conferir consistência entre a quantidade de empregados declarados na GFIP e na RAIS. Art. 2º, inciso II, alínea g da Portaria 410/2025.',
  },
  {
    chave: 'contrato_contador',
    id: 'DOC-10',
    titulo: 'Contrato do Contador + DHP',
    criterio: 'Contrato vigente no mês do pedido; DHP do contador em dia',
    dica: 'Contrato de prestação de serviços contábeis firmado com a empresa atacadista, acompanhado da Declaração de Habilitação Profissional (DHP) do contabilista. Verificar se o contrato está vigente na data do pedido de credenciamento. Art. 2º, inciso II, alínea h da Portaria 410/2025.',
    link: 'https://servicos.crcma.org.br:444/spwMA/consultacadastral/Externa.aspx',
  },
  {
    chave: 'licenca_anvisa',
    id: 'DOC-11',
    titulo: 'Licença da ANVISA',
    criterio: 'Autorização de funcionamento vigente (vencimento posterior ao pedido)',
    dica: 'Autorização de Funcionamento emitida pela Agência Nacional de Vigilância Sanitária (ANVISA). Verificar se a licença está vigente na data do pedido. Art. 2º, inciso II, alínea i da Portaria 410/2025.',
    link: 'https://consultas.anvisa.gov.br/#/empresas/empresas/',
  },
  {
    chave: 'regularidade_fiscal',
    id: 'DOC-12',
    titulo: 'Regularidade fiscal e cadastral',
    criterio: 'Certidões negativas estadual e federal em dia',
    dica: 'Verificar no sistema CAGEF se o contribuinte está com situação cadastral regular (ativo) e se não há débitos inscritos em dívida ativa estadual. Consultar também a Certidão de Débitos Relativos a Créditos Tributários da Receita Federal. Art. 2º, inciso I da Portaria 410/2025.',
  },
  {
    chave: 'regularidade_dief',
    id: 'DOC-13',
    titulo: 'Regularidade DIEF/GIA-ST',
    criterio: 'Declarações DIEF e GIA-ST entregues e sem pendências',
    dica: 'Verificar no sistema DIEF se todas as declarações do período estão entregues e sem pendências de retificação. Em caso de substituto tributário, verificar também a regularidade das GIA-ST. Art. 3º, inciso II da Portaria 410/2025.',
  },
  {
    chave: 'grupo_economico',
    id: 'DOC-14',
    titulo: 'Declaração de grupo econômico',
    criterio: 'Declaração identificando todos os estabelecimentos do grupo',
    dica: 'Declaração firmada pelo representante legal identificando todos os estabelecimentos do mesmo grupo econômico, conforme definição do Art. 3º, §1º da Portaria 410/2025. Verificar se os CNPJs listados constam como relacionados no sistema.',
  },
]

function checklistInicial(): ChecklistManual {
  return Object.fromEntries(DOCS_CONFIG.map(d => [d.chave, { checked: false }])) as ChecklistManual
}

function ChecklistDocumental({
  pedidoId,
  valorInicial,
}: {
  pedidoId: string
  valorInicial: ChecklistManual | null
}) {
  const [itens, setItens]       = useState<ChecklistManual>(valorInicial ?? checklistInicial())
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo]       = useState(!!valorInicial)

  const toggle = (chave: ChaveDoc) => {
    setSalvo(false)
    setItens(prev => ({ ...prev, [chave]: { checked: !prev[chave].checked } }))
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

  const totalMarcados = DOCS_CONFIG.filter(d => itens[d.chave].checked).length

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400 mb-3">
        {totalMarcados}/{DOCS_CONFIG.length} documentos verificados
      </p>

      {DOCS_CONFIG.map(({ chave, id, titulo, dica, link }) => {
        const checked = itens[chave].checked
        return (
          <label
            key={chave}
            className={`flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer transition-all
              ${checked
                ? 'border-green-300 bg-green-50'
                : 'border-gray-100 bg-white hover:border-gray-300'}`}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggle(chave)}
              className="mt-0.5 h-4 w-4 rounded accent-green-600 flex-shrink-0 cursor-pointer"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-gray-400">{id}</span>
                <span className={`text-sm font-semibold ${checked ? 'text-green-700' : 'text-gray-800'}`}>
                  {titulo}
                </span>
                {/* Ícone de dica */}
                <span className="relative group flex-shrink-0" onClick={e => e.preventDefault()}>
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-xs font-bold cursor-default select-none hover:bg-blue-100 hover:text-blue-600 transition-colors">
                    ?
                  </span>
                  <span className="absolute left-0 top-5 z-10 hidden group-hover:block w-72 bg-gray-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg leading-relaxed">
                    {dica}
                  </span>
                </span>
                {/* Link externo de consulta */}
                {link && (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="inline-flex items-center gap-0.5 text-xs text-blue-600 hover:text-blue-800 hover:underline flex-shrink-0"
                  >
                    ↗ Consultar
                  </a>
                )}
              </div>
            </div>
            {checked && <span className="text-green-500 text-base flex-shrink-0">✓</span>}
          </label>
        )
      })}

      <div className="flex justify-end pt-2">
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
        const rj = docAnalise.resultado_json as any
        // Aceita novo formato (chave 'cnae') ou formato legado (chave 'contrato_social')
        if (
          ('cnae' in rj && 'checked' in (rj.cnae ?? {})) ||
          ('contrato_social' in rj && 'checked' in (rj.contrato_social ?? {}))
        ) {
          // Mescla com o inicial para preencher chaves novas ausentes
          const inicial = checklistInicial()
          const merged = { ...inicial, ...rj } as ChecklistManual
          setChecklistDocs(merged)
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
            {'Marque cada documento após verificação. O checklist é salvo no banco de dados.'}
          </p>
        </div>
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
            <div className="flex items-center gap-1 flex-wrap">
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
                href={`/api/exportar-pdf?id=${id}${matricula ? `&matricula=${encodeURIComponent(matricula)}` : ''}${auditor ? `&nome=${encodeURIComponent(auditor)}` : ''}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-sefaz-blue text-white text-xs font-semibold
                  rounded-lg hover:bg-blue-900 transition-colors"
                title="Exportar como Informação Fiscal (PDF para impressão)"
              >
                📄 Exportar PDF
              </a>
              <a
                href={`/api/exportar-docx?id=${id}${matricula ? `&matricula=${encodeURIComponent(matricula)}` : ''}${auditor ? `&nome=${encodeURIComponent(auditor)}` : ''}`}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-700 text-white text-xs font-semibold
                  rounded-lg hover:bg-green-900 transition-colors"
                title="Exportar como documento Word (.docx)"
              >
                📝 Exportar Word
              </a>
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-400 mb-2">Revise e complemente o texto antes de aprovar.</p>
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
