import Anthropic from '@anthropic-ai/sdk'
import { ResultadoAnalise } from './types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function fmtBRL(v: number) {
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtPct(v: number) {
  return v.toFixed(2).replace('.', ',') + '%'
}

// ──────────────────────────────────────────────────────────────────────────────
// Quadro resumo dos requisitos (tabela ASCII para exibição em fonte mono)
// ──────────────────────────────────────────────────────────────────────────────

function pad(s: string, n: number) {
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length)
}

function resultadoLabel(r: string) {
  return r === 'aprovado' ? 'ATENDIDO' : r === 'reprovado' ? 'NÃO ATENDIDO' : r === 'nao_aplicavel' ? 'N/APLICÁVEL' : 'INFORMATIVO'
}

export function gerarQuadroResumo(resultado: ResultadoAnalise): string {
  const { req4, req5, req6, req7, req8 } = resultado

  // Colunas: REQUISITO(9) | BASE LEGAL(15) | VALOR APURADO(38) | MÍN. EXIGIDO(22) | RESULTADO(14)
  const C = [9, 15, 38, 22, 14]
  const sep = '╠' + C.map(n => '═'.repeat(n + 2)).join('╬') + '╣'
  const top = '╔' + C.map(n => '═'.repeat(n + 2)).join('╦') + '╗'
  const bot = '╚' + C.map(n => '═'.repeat(n + 2)).join('╩') + '╝'

  const row = (cols: string[]) =>
    '║ ' + cols.map((c, i) => pad(c, C[i])).join(' ║ ') + ' ║'

  const header = row(['REQUISITO', 'BASE LEGAL', 'VALOR APURADO', 'MÍN. EXIGIDO', 'RESULTADO'])

  // REQ-4
  const seq = req4.detalhe.maior_sequencia
  const r4valor = `Maior seq. consec.: ${seq} ${seq === 1 ? 'mês' : 'meses'}`
  const r4min   = '< 3 consecutivos'

  // REQ-5
  const r5valor = req5.detalhe.inicio_atividade
    ? `Méd. mensal: ${fmtBRL(req5.detalhe.media_mensal)}`
    : `Total 12m: ${fmtBRL(req5.detalhe.total_faturamento_12m)}`
  const r5min   = fmtBRL(req5.detalhe.minimo_exigido)

  // REQ-6
  const r6valor = `${fmtPct(req6.detalhe.percentual_apurado)} (itens prior.)`
  const r6min   = '70,00%'

  // REQ-7
  const r7valor = req7.resultado === 'nao_aplicavel'
    ? 'Sem grupo econômico'
    : `Agregação: ${fmtPct(req7.detalhe!.percentual_agregacao)}`
  const r7min   = req7.resultado === 'nao_aplicavel' ? '—' : '30,00%'

  // REQ-8
  const r8valor = `${req8.detalhe.faixa_faturamento}`
  const r8min   = `${req8.detalhe.empregados_minimos_exigidos} func. CLT`

  const linhas = [
    '',
    'QUADRO RESUMO DOS REQUISITOS',
    top,
    header,
    sep,
    row(['REQ-4', 'Art. 3º, III', r4valor, r4min, resultadoLabel(req4.resultado)]),
    sep,
    row(['REQ-5', 'Art. 3º, IV',  r5valor, r5min, resultadoLabel(req5.resultado)]),
    sep,
    row(['REQ-6', 'Art. 3º, VI',  r6valor, r6min, resultadoLabel(req6.resultado)]),
    sep,
    row(['REQ-7', 'Art. 3º, VII', r7valor, r7min, resultadoLabel(req7.resultado)]),
    sep,
    row(['REQ-8', 'Art. 4º',      r8valor, r8min, 'INFORMATIVO']),
    bot,
    '',
  ]

  return linhas.join('\n')
}

export async function gerarParecer(resultado: ResultadoAnalise): Promise<string> {
  const { cnpj, tipo, req4, req5, req6, req7, req8, conclusao, motivos_indeferimento } = resultado

  const tipoStr = tipo === 'credenciamento' ? 'credenciamento' : 'renovação de credenciamento'

  // Montar contexto compacto para a IA
  const contexto = `
PEDIDO DE ${tipoStr.toUpperCase()} — CNPJ: ${cnpj}
DATA DA ANÁLISE: ${new Date(resultado.data_analise).toLocaleDateString('pt-BR')}
CONCLUSÃO: ${conclusao.toUpperCase()}

--- RESULTADOS DOS REQUISITOS ---

REQ-4 (Art. 3º, III — Faturamento x Entradas): ${req4.resultado.toUpperCase()}
- Maior sequência consecutiva de meses com saídas < entradas: ${req4.detalhe.maior_sequencia} mês(es)
- Meses com problema: ${req4.detalhe.meses_com_saidas_menor_entradas.join(', ') || 'Nenhum'}

REQ-5 (Art. 3º, IV — Faturamento mínimo): ${req5.resultado.toUpperCase()}
- Total 12 meses: ${fmtBRL(req5.detalhe.total_faturamento_12m)}
- Média mensal: ${fmtBRL(req5.detalhe.media_mensal)}
- Mínimo exigido: ${fmtBRL(req5.detalhe.minimo_exigido)}
- Início de atividade: ${req5.detalhe.inicio_atividade ? 'Sim' : 'Não'}

REQ-6 (Art. 3º, VI — Itens prioritários ≥ 70%): ${req6.resultado.toUpperCase()}
- Total saídas Tabela I: ${fmtBRL(req6.detalhe.total_saidas_tabela1)}
- Total saídas itens prioritários: ${fmtBRL(req6.detalhe.total_saidas_prioritarios)}
- Percentual apurado: ${fmtPct(req6.detalhe.percentual_apurado)}
- Mínimo exigido: ${fmtPct(req6.detalhe.minimo_exigido)}

REQ-7 (Art. 3º, VII — Agregação ≥ 30% para grupo econômico): ${req7.resultado.toUpperCase()}
${req7.detalhe ? `- Total saídas para grupo: ${fmtBRL(req7.detalhe.total_saidas_grupo)}
- CMV estimado: ${fmtBRL(req7.detalhe.cmv_estimado)}
- Percentual de agregação: ${fmtPct(req7.detalhe.percentual_agregacao)}
- Mínimo exigido: ${fmtPct(req7.detalhe.minimo_exigido)}` : '- Não aplicável (sem operações com grupo econômico)'}

REQ-8 (Art. 4º — Empregados mínimos): INFORMATIVO
- Faixa de faturamento: ${req8.detalhe.faixa_faturamento}
- Empregados mínimos exigidos pela legislação: ${req8.detalhe.empregados_minimos_exigidos}

${motivos_indeferimento.length > 0 ? `MOTIVOS DO INDEFERIMENTO:\n${motivos_indeferimento.map((m, i) => `${i + 1}. ${m}`).join('\n')}` : ''}
`.trim()

  const prompt = `Você é um Auditor Fiscal da Secretaria de Estado da Fazenda do Maranhão (SEFAZ-MA), especializado em Substituição Tributária. Redija uma Informação Fiscal técnica e formal para o pedido de ${tipoStr} de estabelecimento atacadista de produtos farmacêuticos, com base nos dados de análise abaixo.

O texto deve seguir OBRIGATORIAMENTE a estrutura abaixo, com exatamente estas quatro seções em negrito:

I — DO OBJETO
Descreva de forma sucinta o pedido: tipo (credenciamento ou renovação), CNPJ do contribuinte e o enquadramento legal. Uma a dois parágrafos.

II — DO EMBASAMENTO LEGAL
Cite a Portaria GABIN nº 410/2025 e o Anexo 4.24 do RICMS/MA (Decreto nº 19.714/2003) como bases normativas do credenciamento. Um parágrafo.

III — DA ANÁLISE
Apresente cada requisito verificado (REQ-4 ao REQ-8) em sub-itens, informando o resultado apurado e se foi atendido ou não. Use linguagem técnica. Mencione o REQ-8 como informativo (não é critério de aprovação). Seja objetivo e preciso com os valores numéricos.

IV — DO DISPOSITIVO
Conclua com "Diante do exposto, manifesto-me pelo DEFERIMENTO do pedido de ${tipoStr}." ou, em caso de indeferimento, liste os motivos e conclua com "manifesto-me pelo INDEFERIMENTO do pedido de ${tipoStr}."

Regras de formatação:
- Escreva os títulos das seções exatamente como: "I — DO OBJETO", "II — DO EMBASAMENTO LEGAL", "III — DA ANÁLISE", "IV — DO DISPOSITIVO"
- Não use markdown, asteriscos, hífens decorativos ou bullet points — use texto corrido
- Cada seção deve ser separada por uma linha em branco antes do título
- Use linguagem técnica, formal e impessoal, em português brasileiro

Dados da análise:
${contexto}

Escreva apenas o texto da Informação Fiscal, começando diretamente por "I — DO OBJETO".`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Resposta inesperada da API')
  return content.text
}

/**
 * Gera um parecer padrão sem uso de IA, como fallback quando a API não está disponível.
 */
export function gerarParecerFallback(resultado: ResultadoAnalise): string {
  const { cnpj, tipo, req4, req5, req6, req7, req8, conclusao, motivos_indeferimento } = resultado
  const tipoStr = tipo === 'credenciamento' ? 'credenciamento' : 'renovação de credenciamento'
  const dataStr = new Date(resultado.data_analise).toLocaleDateString('pt-BR')
  const deferido = conclusao === 'deferido'

  const linhas: string[] = []

  // ── I — DO OBJETO ────────────────────────────────────────────────────────
  linhas.push('I — DO OBJETO')
  linhas.push('')
  linhas.push(
    `Trata-se de pedido de ${tipoStr} formulado por estabelecimento atacadista de produtos farmacêuticos, ` +
    `inscrito no CNPJ ${cnpj}, para fins de habilitação como substituto tributário do ICMS, nos termos da ` +
    `Portaria GABIN nº 410/2025 e do Anexo 4.24 do Regulamento do ICMS do Estado do Maranhão (RICMS/MA).`
  )
  linhas.push('')

  // ── II — DO EMBASAMENTO LEGAL ─────────────────────────────────────────────
  linhas.push('II — DO EMBASAMENTO LEGAL')
  linhas.push('')
  linhas.push(
    `O credenciamento de estabelecimentos atacadistas de produtos farmacêuticos como substitutos tributários ` +
    `é regulado pela Portaria GABIN nº 410/2025 e pelo Anexo 4.24 do RICMS/MA, aprovado pelo Decreto nº 19.714/2003, ` +
    `os quais estabelecem os requisitos mínimos a serem cumpridos pelo contribuinte para fins de habilitação e manutenção do credenciamento.`
  )
  linhas.push('')

  // ── III — DA ANÁLISE ──────────────────────────────────────────────────────
  linhas.push('III — DA ANÁLISE')
  linhas.push('')
  linhas.push(
    `Procedeu-se à análise dos dados fiscais do contribuinte referentes ao período de ` +
    `${req5.detalhe.periodo_referencia}, verificando-se os requisitos previstos nos artigos 3º e 4º da Portaria GABIN nº 410/2025:`
  )
  linhas.push('')

  // REQ-4
  const r4ok = req4.resultado === 'aprovado'
  linhas.push(`REQ-4 — Regularidade do faturamento (Art. 3º, III): ${r4ok ? 'ATENDIDO' : 'NÃO ATENDIDO'}`)
  if (r4ok) {
    linhas.push(
      `Não foram identificadas sequências de três ou mais meses consecutivos em que as saídas tenham sido ` +
      `inferiores às entradas. A maior sequência consecutiva registrada foi de ${req4.detalhe.maior_sequencia} mês(es).`
    )
  } else {
    linhas.push(
      `Constatou-se sequência de ${req4.detalhe.maior_sequencia} meses consecutivos com saídas inferiores às entradas, ` +
      `o que contraria o disposto no art. 3º, III, da Portaria GABIN nº 410/2025. ` +
      `Meses com irregularidade: ${req4.detalhe.meses_com_saidas_menor_entradas.join(', ')}.`
    )
  }
  linhas.push('')

  // REQ-5
  const r5ok = req5.resultado === 'aprovado'
  linhas.push(`REQ-5 — Faturamento mínimo (Art. 3º, IV): ${r5ok ? 'ATENDIDO' : 'NÃO ATENDIDO'}`)
  if (req5.detalhe.inicio_atividade) {
    linhas.push(
      `Por tratar-se de empresa em início de atividade, o critério foi apurado pela média mensal de faturamento, ` +
      `resultando em ${fmtBRL(req5.detalhe.media_mensal)} (mínimo exigido: ${fmtBRL(req5.detalhe.minimo_exigido)}).`
    )
  } else {
    linhas.push(
      `O faturamento total no período de doze meses foi de ${fmtBRL(req5.detalhe.total_faturamento_12m)}, ` +
      `correspondendo à média mensal de ${fmtBRL(req5.detalhe.media_mensal)} ` +
      `(mínimo exigido: ${fmtBRL(req5.detalhe.minimo_exigido)}).`
    )
  }
  linhas.push('')

  // REQ-6
  const r6ok = req6.resultado === 'aprovado'
  linhas.push(`REQ-6 — Comercialização de itens prioritários (Art. 3º, VI): ${r6ok ? 'ATENDIDO' : 'NÃO ATENDIDO'}`)
  linhas.push(
    `O percentual de saídas de itens prioritários em relação ao total de saídas da Tabela I foi de ` +
    `${fmtPct(req6.detalhe.percentual_apurado)}, sobre um total de ${fmtBRL(req6.detalhe.total_saidas_tabela1)} em saídas da Tabela I ` +
    `(mínimo exigido: 70,00%).`
  )
  linhas.push('')

  // REQ-7
  const r7na = req7.resultado === 'nao_aplicavel'
  const r7ok = req7.resultado === 'aprovado'
  linhas.push(`REQ-7 — Percentual de agregação ao grupo econômico (Art. 3º, VII): ${r7na ? 'NÃO APLICÁVEL' : r7ok ? 'ATENDIDO' : 'NÃO ATENDIDO'}`)
  if (r7na) {
    linhas.push(
      `O contribuinte não realiza operações com estabelecimentos varejistas pertencentes ao mesmo grupo econômico, ` +
      `razão pela qual este requisito não se aplica ao presente caso.`
    )
  } else if (req7.detalhe) {
    linhas.push(
      `O percentual de agregação apurado nas vendas ao grupo econômico foi de ` +
      `${fmtPct(req7.detalhe.percentual_agregacao)}, calculado sobre o CMV estimado de ${fmtBRL(req7.detalhe.cmv_estimado)} ` +
      `(mínimo exigido: 30,00%).`
    )
  }
  linhas.push('')

  // REQ-8
  linhas.push(`REQ-8 — Quadro mínimo de empregados (Art. 4º): INFORMATIVO`)
  linhas.push(
    `Com base na faixa de faturamento apurada (${req8.detalhe.faixa_faturamento}), a legislação estabelece o quadro mínimo de ` +
    `${req8.detalhe.empregados_minimos_exigidos} funcionário(s) CLT. Este requisito tem caráter informativo e não ` +
    `é critério de aprovação ou reprovação para o credenciamento.`
  )
  linhas.push('')

  // ── IV — DO DISPOSITIVO ───────────────────────────────────────────────────
  linhas.push('IV — DO DISPOSITIVO')
  linhas.push('')
  if (deferido) {
    linhas.push(
      `Diante do exposto, tendo sido verificado o atendimento de todos os requisitos obrigatórios previstos na ` +
      `Portaria GABIN nº 410/2025, manifesto-me pelo DEFERIMENTO do pedido de ${tipoStr} formulado pelo ` +
      `contribuinte inscrito no CNPJ ${cnpj}.`
    )
  } else {
    linhas.push(
      `Diante do exposto, tendo sido constatado o descumprimento dos requisitos obrigatórios abaixo indicados, ` +
      `manifesto-me pelo INDEFERIMENTO do pedido de ${tipoStr} formulado pelo contribuinte inscrito no CNPJ ${cnpj}:`
    )
    linhas.push('')
    motivos_indeferimento.forEach((m, i) => linhas.push(`${i + 1}. ${m}`))
  }
  linhas.push('')
  linhas.push('⚠️ Parecer gerado automaticamente (modo offline). Revise e complemente antes de aprovar.')

  return linhas.join('\n')
}
