// ──────────────────────────────────────────────────────────────────────────────
// Definição dos 19 itens do checklist — Portaria GABIN 410/2025
// Itens 1-14: verificação documental (manual pelo auditor)
// Itens 15-19: apuração automática com base nas planilhas CSV
// ──────────────────────────────────────────────────────────────────────────────

export type ReqCsv = 'req4' | 'req5' | 'req6' | 'req7' | 'req8'

export interface ItemChecklist {
  num: number
  descricao: string
  base: string
  chaveManual?: string
  reqCsv?: ReqCsv
  link?: string   // URL de consulta externa (ex: ANVISA, CRC-MA)
}

export const ITENS_CHECKLIST: ItemChecklist[] = [
  { num: 1,  descricao: 'CNAE 4644-3/01 ou 4645-1/00 enquadrado',                          base: 'Art. 3º, V',       chaveManual: 'cnae'                },
  { num: 2,  descricao: 'Requerimento do pedido (SEFAZ)',                                   base: 'Art. 2º, I',       chaveManual: 'requerimento'        },
  { num: 3,  descricao: 'Instrumento constitutivo (Contrato Social)',                       base: 'Art. 2º, II, a',   chaveManual: 'contrato_social'     },
  { num: 4,  descricao: 'Cédulas de identidade e CPF dos sócios',                          base: 'Art. 2º, II, b',   chaveManual: 'docs_socios'         },
  { num: 5,  descricao: 'Registro de imóvel ou contrato de locação',                       base: 'Art. 2º, II, c',   chaveManual: 'imovel'              },
  { num: 6,  descricao: 'Última conta de energia ou comprovante de endereço',              base: 'Art. 2º, II, d',   chaveManual: 'comprovante_endereco' },
  { num: 7,  descricao: 'Três últimos IR dos sócios ou diretores',                         base: 'Art. 2º, II, e',   chaveManual: 'ir_socios'           },
  { num: 8,  descricao: 'RAIS (Relação Anual de Informações Sociais)',                      base: 'Art. 2º, II, f',   chaveManual: 'rais'                },
  { num: 9,  descricao: 'GFIP dos últimos 12 meses',                                       base: 'Art. 2º, II, g',   chaveManual: 'gfip'                },
  { num: 10, descricao: 'Contrato do contador + DHP',                                      base: 'Art. 2º, II, h',   chaveManual: 'contrato_contador',  link: 'https://servicos.crcma.org.br:444/spwMA/consultacadastral/Externa.aspx' },
  { num: 11, descricao: 'Licença da ANVISA (autorização de funcionamento)',                 base: 'Art. 2º, II, i',   chaveManual: 'licenca_anvisa',     link: 'https://consultas.anvisa.gov.br/#/empresas/empresas/' },
  { num: 12, descricao: 'Regularidade fiscal e cadastral',                                 base: 'Art. 2º, I',       chaveManual: 'regularidade_fiscal' },
  { num: 13, descricao: 'Regularidade DIEF/GIA-ST',                                        base: 'Art. 3º, II',      chaveManual: 'regularidade_dief'   },
  { num: 14, descricao: 'Declaração de grupo econômico',                                   base: 'Art. 3º, §1º',     chaveManual: 'grupo_economico'     },
  { num: 15, descricao: 'Faturamento acumulado ≥ 100% das entradas (sem 3 meses consec.)', base: 'Art. 3º, III',     reqCsv: 'req4'                     },
  { num: 16, descricao: 'Faturamento anual ≥ R$ 4.000.000,00',                             base: 'Art. 3º, IV',      reqCsv: 'req5'                     },
  { num: 17, descricao: 'Saídas de itens prioritários ≥ 70% das saídas da Tabela I',       base: 'Art. 3º, VI',      reqCsv: 'req6'                     },
  { num: 18, descricao: 'Agregação ≥ 30% nas vendas ao grupo econômico',                   base: 'Art. 3º, VII',     reqCsv: 'req7'                     },
  { num: 19, descricao: 'Número mínimo de funcionários com carteira assinada',             base: 'Art. 4º',          reqCsv: 'req8'                     },
]
