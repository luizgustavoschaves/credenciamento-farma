// ──────────────────────────────────────────
// Tipos dos CSVs de entrada
// ──────────────────────────────────────────

export interface LinhaFaturamentoMensal {
  cnpj: string
  competencia: string   // MM/AAAA
  valor_total_entradas: number
  valor_total_saidas: number
}

export interface LinhaMovimentacaoNCM {
  cnpj: string
  competencia: string   // MM/AAAA
  ncm: string
  valor_total_entradas: number
  valor_total_saidas: number
}

export interface LinhaSaidasGrupoEconomico {
  cnpj_remetente: string
  cnpj_destinatario: string
  competencia: string   // MM/AAAA
  ncm: string
  valor_saidas_tabela1: number
}

// ──────────────────────────────────────────
// Tipos do motor de regras
// ──────────────────────────────────────────

export type ResultadoRequisito = 'aprovado' | 'reprovado' | 'nao_aplicavel'

export interface DetalheReq4 {
  meses_com_saidas_menor_entradas: string[]
  sequencias_consecutivas: string[][]
  maior_sequencia: number
}

export interface DetalheReq5 {
  total_faturamento_12m: number
  media_mensal: number
  inicio_atividade: boolean
  minimo_exigido: number
  meses_analisados: string[]    // ex: ["05/2024", "06/2024", ..., "04/2025"]
  periodo_referencia: string    // ex: "05/2024 a 04/2025"
}

export interface DetalheReq6 {
  total_saidas_tabela1: number
  total_saidas_prioritarios: number
  percentual_apurado: number
  minimo_exigido: number
}

export interface DetalheReq7 {
  total_saidas_grupo: number
  cmv_estimado: number
  percentual_agregacao: number
  minimo_exigido: number
}

export interface DetalheReq8 {
  faixa_faturamento: string
  empregados_minimos_exigidos: number
}

export interface DadosMensais {
  competencia: string   // MM/AAAA
  entradas: number
  saidas: number
}

export interface ResultadoAnalise {
  cnpj: string
  data_analise: string
  data_pedido: string           // AAAA-MM — mês em que o pedido foi protocolado
  tipo: 'credenciamento' | 'renovacao'

  req4: { resultado: ResultadoRequisito; detalhe: DetalheReq4 }
  req5: { resultado: ResultadoRequisito; detalhe: DetalheReq5 }
  req6: { resultado: ResultadoRequisito; detalhe: DetalheReq6 }
  req7: { resultado: ResultadoRequisito; detalhe: DetalheReq7 | null }
  req8: { resultado: 'informativo'; detalhe: DetalheReq8 }

  conclusao: 'deferido' | 'indeferido'
  motivos_indeferimento: string[]

  // Início de atividade marcado manualmente pelo auditor (credenciamento por 6 meses)
  inicio_atividade_manual?: boolean

  // Dados mensais para geração de tabelas no PDF
  dados_mensais: DadosMensais[]
}

// ──────────────────────────────────────────
// Tipos de persistência (Supabase)
// ──────────────────────────────────────────

export interface Pedido {
  id: string
  cnpj: string
  razao_social: string | null
  tipo: 'credenciamento' | 'renovacao'
  status: 'pendente' | 'aprovado' | 'indeferido'
  resultado_json: ResultadoAnalise
  created_at: string
  updated_at: string
}

export interface Parecer {
  id: string
  pedido_id: string
  texto_gerado: string
  texto_final: string | null
  auditor: string | null
  aprovado_em: string | null
  created_at: string
}
