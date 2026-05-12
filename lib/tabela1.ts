// ──────────────────────────────────────────────────────────────────────────────
// Tabela I do Anexo 4.24 do RICMS/MA
// Fonte: Decreto nº 33.117/2017 e alterações
// ──────────────────────────────────────────────────────────────────────────────

export interface ItemTabela1 {
  item: string          // Algarismo romano (I, II, ...)
  descricao: string
  ncms: string[]        // Lista de NCMs associados (sem pontos para comparação)
  prioritario: boolean  // Itens do Art. 3º, VI: I, II, III, VII, IX, XII, XIII, XVII, XVIII, XIX
}

export const TABELA1: ItemTabela1[] = [
  {
    item: 'I',
    descricao: 'Soros e vacinas, exceto para uso veterinário',
    ncms: ['3002'],
    prioritario: true,
  },
  {
    item: 'II',
    descricao: 'Medicamentos, exceto para uso veterinário',
    ncms: ['3003', '3004'],
    prioritario: true,
  },
  {
    item: 'III',
    descricao: 'Algodão, atadura, esparadrapo, gazes, pensos e similares farmacêuticos',
    ncms: ['3005', '5601'],
    prioritario: true,
  },
  {
    item: 'IV',
    descricao: 'Mamadeiras de borracha vulcanizada, vidro e plástico',
    ncms: ['40149090', '70133', '39241000'],
    prioritario: false,
  },
  {
    item: 'V',
    descricao: 'Chupetas e bicos para mamadeiras e chupetas',
    ncms: ['40149090'],
    prioritario: false,
  },
  {
    item: 'VI',
    descricao: 'Absorventes higiênicos, de uso interno ou externo',
    ncms: ['56011000', '48184000'],
    prioritario: false,
  },
  {
    item: 'VII',
    descricao: 'Preservativos',
    ncms: ['40141000'],
    prioritario: true,
  },
  {
    item: 'VIII',
    descricao: 'Seringas',
    ncms: ['90183100'],
    prioritario: false,
  },
  {
    item: 'IX',
    descricao: 'Agulhas para seringas',
    ncms: ['90183210', '9018321'],
    prioritario: true,
  },
  {
    item: 'X',
    descricao: 'Pastas dentifrícias',
    ncms: ['33061000'],
    prioritario: false,
  },
  {
    item: 'XI',
    descricao: 'Escovas dentifrícias',
    ncms: ['96032100'],
    prioritario: false,
  },
  {
    item: 'XII',
    descricao: 'Provitaminas e vitaminas',
    ncms: ['2936'],
    prioritario: true,
  },
  {
    item: 'XIII',
    descricao: 'Contraceptivos (dispositivos intra-uterinos - DIU)',
    ncms: ['39269090', '90189099'],
    prioritario: true,
  },
  {
    item: 'XIV',
    descricao: 'Fio dental / fita dental',
    ncms: ['33062000'],
    prioritario: false,
  },
  {
    item: 'XV',
    descricao: 'Preparação para higiene bucal e dentária',
    ncms: ['33069000'],
    prioritario: false,
  },
  {
    item: 'XVI',
    descricao: 'Fraldas descartáveis ou não',
    ncms: ['48184010', '56011000', '6111', '6209'],
    prioritario: false,
  },
  {
    item: 'XVII',
    descricao: 'Preparações químicas contraceptivas à base de hormônios ou de espermicidas',
    ncms: ['30066000'],
    prioritario: true,
  },
  {
    item: 'XVIII',
    descricao: 'Preparações opacificantes (contrastantes) para exames radiográficos',
    ncms: ['30063000'],
    prioritario: true,
  },
  {
    item: 'XIX',
    descricao: 'Luvas cirúrgicas e luvas de procedimento',
    ncms: ['40151100', '40151900'],
    prioritario: true,
  },
]

// ──────────────────────────────────────────────────────────────────────────────
// Funções utilitárias de NCM
// ──────────────────────────────────────────────────────────────────────────────

/** Normaliza um NCM removendo pontos, traços e espaços, e convertendo para minúsculas */
export function normalizarNCM(ncm: string): string {
  return ncm.replace(/[.\-\s]/g, '').toLowerCase()
}

/** Busca o item da Tabela I correspondente a um NCM. Retorna null se não encontrar. */
export function buscarItemPorNCM(ncm: string): ItemTabela1 | null {
  const norm = normalizarNCM(ncm)
  for (const item of TABELA1) {
    for (const ncmItem of item.ncms) {
      const normItem = normalizarNCM(ncmItem)
      // Aceita prefixo: NCM "3002" cobre "30021000", "30029000" etc.
      if (norm.startsWith(normItem) || normItem.startsWith(norm)) {
        return item
      }
    }
  }
  return null
}

/** Verifica se um NCM pertence a algum item prioritário da Tabela I */
export function isPrioritario(ncm: string): boolean {
  const item = buscarItemPorNCM(ncm)
  return item?.prioritario ?? false
}

/** Verifica se um NCM pertence à Tabela I */
export function isTabela1(ncm: string): boolean {
  return buscarItemPorNCM(ncm) !== null
}

// ──────────────────────────────────────────────────────────────────────────────
// Tabela de empregados mínimos — Art. 4º da Portaria 410/2025
// ──────────────────────────────────────────────────────────────────────────────

export interface FaixaEmpregados {
  min: number   // faturamento médio mensal mínimo (inclusive)
  max: number   // faturamento médio mensal máximo (exclusive; Infinity para último)
  empregados: number
}

export const TABELA_EMPREGADOS: FaixaEmpregados[] = [
  { min: 333333.33,   max: 500000.01,    empregados: 8  },
  { min: 500000.01,   max: 1000000.01,   empregados: 12 },
  { min: 1000000.01,  max: 2000000.01,   empregados: 16 },
  { min: 2000000.01,  max: 3000000.01,   empregados: 20 },
  { min: 3000000.01,  max: 4000000.01,   empregados: 24 },
  { min: 4000000.01,  max: 5000000.01,   empregados: 28 },
  { min: 5000000.01,  max: 6000000.01,   empregados: 32 },
  { min: 6000000.01,  max: 7000000.01,   empregados: 36 },
  { min: 7000000.01,  max: Infinity,     empregados: 40 },
]

export function calcularEmpregadosMinimos(mediaFaturamentoMensal: number): number {
  const faixa = TABELA_EMPREGADOS.find(
    f => mediaFaturamentoMensal >= f.min && mediaFaturamentoMensal < f.max
  )
  return faixa?.empregados ?? 0
}

export function descricaoFaixa(mediaFaturamentoMensal: number): string {
  const faixa = TABELA_EMPREGADOS.find(
    f => mediaFaturamentoMensal >= f.min && mediaFaturamentoMensal < f.max
  )
  if (!faixa) return 'Faturamento abaixo do mínimo exigido'
  if (faixa.max === Infinity) return `Acima de R$ 7.000.000,00/mês`
  return `Entre R$ ${fmtBRL(faixa.min)} e R$ ${fmtBRL(faixa.max - 0.01)}/mês`
}

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}
