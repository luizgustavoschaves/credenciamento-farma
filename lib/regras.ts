// ──────────────────────────────────────────────────────────────────────────────
// Motor de Regras — Credenciamento de Atacadista de Medicamentos
// Base legal: Portaria GABIN 410/2025 + Anexo 4.24 RICMS/MA
// ──────────────────────────────────────────────────────────────────────────────

import {
  LinhaFaturamentoMensal,
  LinhaMovimentacaoNCM,
  LinhaSaidasGrupoEconomico,
  LinhaMovimentacaoGTIN,
  ResultadoAnalise,
  ResultadoRequisito,
  DetalheReq4,
  DetalheReq5,
  DetalheReq6,
  DetalheReq7,
  DetalheReq8,
  DadosMensais,
} from './types'
import {
  isPrioritario,
  isTabela1,
  calcularEmpregadosMinimos,
  descricaoFaixa,
} from './tabela1'

// ──────────────────────────────────────────────────────────────────────────────
// Utilitário de período — filtra os 12 meses anteriores à data do pedido
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Retorna o conjunto de competências (MM/AAAA) correspondentes aos 12 meses
 * anteriores ao mês de protocolo do pedido.
 * Ex: dataPedido = "2025-05"  →  {"05/2024","06/2024",...,"04/2025"}
 */
function competencias12Meses(dataPedido: string): Set<string> {
  const [anoP, mesP] = dataPedido.split('-').map(Number)
  const result = new Set<string>()
  for (let i = 1; i <= 12; i++) {
    let m = mesP - i
    let y = anoP
    while (m <= 0) { m += 12; y-- }
    result.add(`${String(m).padStart(2, '0')}/${y}`)
  }
  return result
}

function filtrarPorPeriodo<T extends { competencia: string }>(
  linhas: T[],
  competenciasValidas: Set<string>
): T[] {
  return linhas.filter(l => competenciasValidas.has(l.competencia))
}

// ──────────────────────────────────────────────────────────────────────────────
// Descarta meses com saídas zero ANTES do primeiro mês com faturamento real.
// Ex: se Jan–Mai têm saídas = 0 e Jun tem saídas > 0, descarta Jan–Mai.
// Isso evita penalizar empresas em início de atividade que ainda não operavam.
// ──────────────────────────────────────────────────────────────────────────────

function descartarMesesZeradosIniciais(linhas: LinhaFaturamentoMensal[]): LinhaFaturamentoMensal[] {
  const ordenado = [...linhas].sort((a, b) => compararCompetencia(a.competencia, b.competencia))
  const primeiro = ordenado.findIndex(l => l.valor_total_saidas > 0)
  if (primeiro <= 0) return ordenado   // nenhum mês zerado inicial ou array vazio
  return ordenado.slice(primeiro)       // mantém a partir do primeiro com faturamento
}

// ──────────────────────────────────────────────────────────────────────────────
// REQ-4 — Art. 3º, III — Faturamento x Entradas (3 meses consecutivos)
// Impedimento: 3 ou mais meses consecutivos com saídas < entradas nos últimos 12 meses
// ──────────────────────────────────────────────────────────────────────────────

function verificarReq4(linhas: LinhaFaturamentoMensal[]) {
  const mesesComProblema: string[] = []

  for (const l of linhas) {
    if (l.valor_total_saidas < l.valor_total_entradas) {
      mesesComProblema.push(l.competencia)
    }
  }

  // Detectar sequências consecutivas (meses ordenados cronologicamente)
  const ordenado = [...linhas].sort((a, b) => compararCompetencia(a.competencia, b.competencia))
  const sequencias: string[][] = []
  let seq: string[] = []

  for (const l of ordenado) {
    if (l.valor_total_saidas < l.valor_total_entradas) {
      seq.push(l.competencia)
    } else {
      if (seq.length > 0) { sequencias.push(seq); seq = [] }
    }
  }
  if (seq.length > 0) sequencias.push(seq)

  const maiorSequencia = sequencias.reduce((max, s) => Math.max(max, s.length), 0)
  const aprovado = maiorSequencia < 3

  const detalhe: DetalheReq4 = {
    meses_com_saidas_menor_entradas: mesesComProblema,
    sequencias_consecutivas: sequencias.filter(s => s.length >= 2),
    maior_sequencia: maiorSequencia,
  }

  return { resultado: (aprovado ? 'aprovado' : 'reprovado') as ResultadoRequisito, detalhe }
}

// ──────────────────────────────────────────────────────────────────────────────
// REQ-5 — Art. 3º, IV — Faturamento mínimo
// Empresa estabelecida: R$ 4.000.000,00 em 12 meses
// Início de atividade (< 12 meses): média mensal ≥ R$ 333.333,33
// ──────────────────────────────────────────────────────────────────────────────

const FATURAMENTO_ANUAL_MIN = 4_000_000
const MEDIA_MENSAL_MIN = 333_333.33

function verificarReq5(linhas: LinhaFaturamentoMensal[], inicioAtividadeManual?: boolean) {
  const ordenado = [...linhas].sort((a, b) => compararCompetencia(a.competencia, b.competencia))
  const totalFaturamento = ordenado.reduce((s, l) => s + l.valor_total_saidas, 0)
  const meses = ordenado.length
  const mediaFaturamento = meses > 0 ? totalFaturamento / meses : 0
  // Início de atividade: menos de 12 meses de dados OU marcado manualmente pelo auditor
  const inicioAtividade = inicioAtividadeManual === true || meses < 12

  const minimo = inicioAtividade ? MEDIA_MENSAL_MIN : FATURAMENTO_ANUAL_MIN
  const valorParaComparar = inicioAtividade ? mediaFaturamento : totalFaturamento
  const aprovado = valorParaComparar >= minimo

  const mesesAnalisados = ordenado.map(l => l.competencia)
  const periodoRef = mesesAnalisados.length >= 2
    ? `${mesesAnalisados[0]} a ${mesesAnalisados[mesesAnalisados.length - 1]}`
    : mesesAnalisados[0] ?? '—'

  const detalhe: DetalheReq5 = {
    total_faturamento_12m: totalFaturamento,
    media_mensal: mediaFaturamento,
    inicio_atividade: inicioAtividade,
    minimo_exigido: minimo,
    meses_analisados: mesesAnalisados,
    periodo_referencia: periodoRef,
  }

  return { resultado: (aprovado ? 'aprovado' : 'reprovado') as ResultadoRequisito, detalhe }
}

// ──────────────────────────────────────────────────────────────────────────────
// REQ-6 — Art. 3º, VI — 70% das saídas em itens prioritários
// Itens prioritários: I, II, III, VII, IX, XII, XIII, XVII, XVIII, XIX
// Base: ano-calendário, apenas meses com benefício vigente
// ──────────────────────────────────────────────────────────────────────────────

const PERCENTUAL_MINIMO_PRIORITARIOS = 70

function verificarReq6(linhas: LinhaMovimentacaoNCM[]) {
  let totalTabela1 = 0
  let totalPrioritarios = 0

  for (const l of linhas) {
    if (isTabela1(l.ncm)) {
      totalTabela1 += l.valor_total_saidas
      if (isPrioritario(l.ncm)) {
        totalPrioritarios += l.valor_total_saidas
      }
    }
  }

  const percentual = totalTabela1 > 0
    ? (totalPrioritarios / totalTabela1) * 100
    : 0

  const aprovado = percentual >= PERCENTUAL_MINIMO_PRIORITARIOS

  const detalhe: DetalheReq6 = {
    total_saidas_tabela1: totalTabela1,
    total_saidas_prioritarios: totalPrioritarios,
    percentual_apurado: percentual,
    minimo_exigido: PERCENTUAL_MINIMO_PRIORITARIOS,
  }

  return { resultado: (aprovado ? 'aprovado' : 'reprovado') as ResultadoRequisito, detalhe }
}

// ──────────────────────────────────────────────────────────────────────────────
// REQ-7 — Art. 3º, VII — 30% de agregação nas vendas para varejistas do grupo
// CMV estimado por GTIN: custo_ratio = Σ_entradas_gtin / Σ_saidas_gtin (período)
// ──────────────────────────────────────────────────────────────────────────────

const PERCENTUAL_MINIMO_AGREGACAO = 30

function verificarReq7(
  linhasGrupo: LinhaSaidasGrupoEconomico[],
  movimentacaoGTIN: LinhaMovimentacaoGTIN[]
) {
  // Se não há operações com grupo econômico, requisito não se aplica
  if (linhasGrupo.length === 0) {
    return { resultado: 'nao_aplicavel' as const, detalhe: null }
  }

  // Custo médio por GTIN: razão entradas/saidas no período analisado
  // (entradas = custo de compra; saidas = receita de venda ao mercado total)
  const custoRatioPorGTIN: Record<string, number> = {}

  const agrupadoPorGTIN: Record<string, { entradas: number; saidas: number }> = {}
  for (const l of movimentacaoGTIN) {
    if (!agrupadoPorGTIN[l.gtin]) agrupadoPorGTIN[l.gtin] = { entradas: 0, saidas: 0 }
    agrupadoPorGTIN[l.gtin].entradas += l.valor_entradas
    agrupadoPorGTIN[l.gtin].saidas  += l.valor_saidas
  }

  for (const [gtin, vals] of Object.entries(agrupadoPorGTIN)) {
    // Razão custo/receita (ex: 0.75 = custo é 75% do preço de venda)
    // Fallback 0.8 quando não há dados de entrada para o GTIN
    custoRatioPorGTIN[gtin] = vals.saidas > 0 ? vals.entradas / vals.saidas : 0.8
  }

  // Calcular CMV estimado para as saídas destinadas ao grupo econômico
  // Apenas GTINs com dados reais no CSV3 entram na conta — sem fallback
  let totalSaidasGrupo = 0
  let totalCmvEstimado = 0

  for (const l of linhasGrupo) {
    const razaoCusto = custoRatioPorGTIN[l.gtin]
    if (razaoCusto === undefined) continue  // GTIN sem dados no CSV3 → exclui da conta
    totalSaidasGrupo += l.valor_saidas_tabela1
    totalCmvEstimado += l.valor_saidas_tabela1 * razaoCusto
  }

  const percentualAgregacao = totalCmvEstimado > 0
    ? ((totalSaidasGrupo - totalCmvEstimado) / totalCmvEstimado) * 100
    : 0

  const aprovado = percentualAgregacao >= PERCENTUAL_MINIMO_AGREGACAO

  const detalhe: DetalheReq7 = {
    total_saidas_grupo: totalSaidasGrupo,
    cmv_estimado: totalCmvEstimado,
    percentual_agregacao: percentualAgregacao,
    minimo_exigido: PERCENTUAL_MINIMO_AGREGACAO,
  }

  return { resultado: (aprovado ? 'aprovado' : 'reprovado') as ResultadoRequisito, detalhe }
}

// ──────────────────────────────────────────────────────────────────────────────
// REQ-8 — Art. 4º — Informativo de empregados mínimos
// Calculado com base no faturamento médio mensal apurado no REQ-5
// ──────────────────────────────────────────────────────────────────────────────

function calcularReq8(mediaFaturamentoMensal: number, empregadosComprovados?: number) {
  const empregadosMinimos = calcularEmpregadosMinimos(mediaFaturamentoMensal)
  const detalhe: DetalheReq8 = {
    faixa_faturamento: descricaoFaixa(mediaFaturamentoMensal),
    empregados_minimos_exigidos: empregadosMinimos,
    empregados_comprovados: empregadosComprovados,
  }
  // Se o auditor informou a quantidade comprovada, compara; caso contrário, fica informativo
  const resultado = empregadosComprovados !== undefined
    ? (empregadosComprovados >= empregadosMinimos ? 'aprovado' : 'reprovado')
    : 'informativo'
  return { resultado: resultado as 'aprovado' | 'reprovado' | 'informativo', detalhe }
}

// ──────────────────────────────────────────────────────────────────────────────
// Função principal — executa todas as regras e consolida o resultado
// ──────────────────────────────────────────────────────────────────────────────

export function executarAnalise(params: {
  cnpj: string
  tipo: 'credenciamento' | 'renovacao'
  dataPedido: string            // AAAA-MM — ex: "2025-05"
  faturamentoMensal: LinhaFaturamentoMensal[]
  movimentacaoNcm: LinhaMovimentacaoNCM[]
  saidasGrupo: LinhaSaidasGrupoEconomico[]
  movimentacaoGTIN: LinhaMovimentacaoGTIN[]
  inicioAtividadeManual?: boolean
  empregadosComprovados?: number
}): ResultadoAnalise {
  const { cnpj, tipo, dataPedido, faturamentoMensal, movimentacaoNcm, saidasGrupo, movimentacaoGTIN, inicioAtividadeManual, empregadosComprovados } = params

  // Filtra apenas os 12 meses anteriores à data do pedido
  const periodo    = competencias12Meses(dataPedido)
  const fat12mRaw  = filtrarPorPeriodo(faturamentoMensal, periodo)
  // Descarta meses zerados antes do primeiro mês com faturamento real
  const fat12m     = descartarMesesZeradosIniciais(fat12mRaw)
  const ncm12m     = filtrarPorPeriodo(movimentacaoNcm,   periodo)
  const grp12m     = filtrarPorPeriodo(saidasGrupo,       periodo)
  const gtin12m    = filtrarPorPeriodo(movimentacaoGTIN,  periodo)

  const req4 = verificarReq4(fat12m)
  const req5 = verificarReq5(fat12m, inicioAtividadeManual)
  const req6 = verificarReq6(ncm12m)
  const req7 = verificarReq7(grp12m, gtin12m)
  const req8 = calcularReq8(req5.detalhe.media_mensal, empregadosComprovados)

  // Dados mensais ordenados cronologicamente (para tabelas do PDF)
  const dadosMensais: DadosMensais[] = [...fat12m]
    .sort((a, b) => compararCompetencia(a.competencia, b.competencia))
    .map(l => ({
      competencia: l.competencia,
      entradas:    l.valor_total_entradas,
      saidas:      l.valor_total_saidas,
    }))

  // Consolidar conclusão
  const reprovados: string[] = []

  if (req4.resultado === 'reprovado') {
    reprovados.push(
      `REQ-4: Apresentou faturamento inferior às entradas por ${req4.detalhe.maior_sequencia} meses consecutivos ` +
      `(Art. 3º, III da Portaria 410/2025)`
    )
  }
  if (req5.resultado === 'reprovado') {
    reprovados.push(
      `REQ-5: Faturamento de R$ ${fmtBRL(req5.detalhe.total_faturamento_12m)} inferior ao mínimo exigido de ` +
      `R$ ${fmtBRL(req5.detalhe.minimo_exigido)} ` +
      `(Art. 3º, IV da Portaria 410/2025)`
    )
  }
  if (req6.resultado === 'reprovado') {
    reprovados.push(
      `REQ-6: Percentual de itens prioritários de ${req6.detalhe.percentual_apurado.toFixed(2)}% inferior ao ` +
      `mínimo de ${req6.detalhe.minimo_exigido}% ` +
      `(Art. 3º, VI da Portaria 410/2025)`
    )
  }
  if (req7.resultado === 'reprovado') {
    reprovados.push(
      `REQ-7: Percentual de agregação de ${req7.detalhe!.percentual_agregacao.toFixed(2)}% inferior ao mínimo ` +
      `de ${req7.detalhe!.minimo_exigido}% nas vendas ao grupo econômico ` +
      `(Art. 3º, VII da Portaria 410/2025)`
    )
  }

  return {
    cnpj,
    data_analise: new Date().toISOString(),
    data_pedido: dataPedido,
    tipo,
    req4,
    req5,
    req6,
    req7,
    req8,
    conclusao: reprovados.length === 0 ? 'deferido' : 'indeferido',
    motivos_indeferimento: reprovados,
    inicio_atividade_manual: inicioAtividadeManual ?? false,
    dados_mensais: dadosMensais,
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Utilitários
// ──────────────────────────────────────────────────────────────────────────────

/** Compara duas competências no formato MM/AAAA */
function compararCompetencia(a: string, b: string): number {
  const [ma, ya] = a.split('/').map(Number)
  const [mb, yb] = b.split('/').map(Number)
  if (ya !== yb) return ya - yb
  return ma - mb
}

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
