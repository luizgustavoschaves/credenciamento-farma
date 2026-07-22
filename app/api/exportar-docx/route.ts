import { NextRequest, NextResponse } from 'next/server'
import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  PageBreak,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx'
import { supabase } from '@/lib/supabase'
import { ResultadoAnalise } from '@/lib/types'
import { ITENS_CHECKLIST } from '@/lib/checklist-items'
import fs from 'fs'
import path from 'path'

// ──────────────────────────────────────────────────────────────────────────────
// Constantes de layout (A4, margens de 25mm)
// ──────────────────────────────────────────────────────────────────────────────

const FONT        = 'Arial'
const MARGIN_DXA  = 1418          // ~25mm em DXA (1440 DXA = 1 polegada)
const CONTENT_W   = 9070          // 11906 - 2*1418
const PT11        = 22            // 11pt em half-points
const PT9         = 18
const PT10        = 20

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function fmtCnpj(cnpj: string): string {
  const d = cnpj.replace(/\D/g, '')
  if (d.length === 14)
    return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
  return cnpj
}

function fmtBRL(v: number): string {
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtPct(v: number): string {
  return v.toFixed(2).replace('.', ',') + '%'
}

function run(text: string, opts: {
  bold?: boolean; color?: string; size?: number; italic?: boolean
} = {}): TextRun {
  return new TextRun({
    text,
    font: FONT,
    size:    opts.size  ?? PT11,
    bold:    opts.bold,
    color:   opts.color,
    italics: opts.italic,
  })
}

// ── Bordas padrão de célula ───────────────────────────────────────────────────

const CB  = { style: BorderStyle.SINGLE, size: 1, color: 'AAAAAA' }
const CB2 = { style: BorderStyle.DOUBLE, size: 4, color: '1a3a6b' } // separador manual/CSV
const BORD = { top: CB, bottom: CB, left: CB, right: CB }
const NO_BORD = {
  top:    { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left:   { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right:  { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
}

// ── Células de tabela ─────────────────────────────────────────────────────────

function headerCell(text: string, width: number): TableCell {
  return new TableCell({
    width:         { size: width, type: WidthType.DXA },
    shading:       { fill: '1a3a6b', type: ShadingType.CLEAR },
    borders:       BORD,
    verticalAlign: VerticalAlign.CENTER,
    margins:       { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children:  [run(text, { bold: true, color: 'FFFFFF', size: PT9 })],
    })],
  })
}

function dataCell(
  text: string,
  width: number,
  opts: {
    align?: 'left' | 'center' | 'right'
    shading?: string
    color?: string
    bold?: boolean
    size?: number
    borders?: typeof BORD
  } = {}
): TableCell {
  const align =
    opts.align === 'right'  ? AlignmentType.RIGHT  :
    opts.align === 'center' ? AlignmentType.CENTER  :
                              AlignmentType.LEFT
  return new TableCell({
    width:         { size: width, type: WidthType.DXA },
    shading:       opts.shading ? { fill: opts.shading, type: ShadingType.CLEAR } : undefined,
    borders:       opts.borders ?? BORD,
    verticalAlign: VerticalAlign.CENTER,
    margins:       { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({
      alignment: align,
      children:  [run(text, { bold: opts.bold, color: opts.color, size: opts.size ?? PT9 })],
    })],
  })
}

// ──────────────────────────────────────────────────────────────────────────────
// Tabela 1 — Faturamento Mensal
// ──────────────────────────────────────────────────────────────────────────────

function buildTable1(resultado: ResultadoAnalise): Table {
  const dados   = resultado.dados_mensais ?? []
  const totalS  = dados.reduce((s, d) => s + d.saidas, 0)
  const mediaS  = dados.length > 0 ? totalS / dados.length : 0
  // Colunas: 2500 + 6570 = 9070
  const C = [2500, 6570]

  return new Table({
    width:        { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: C,
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          headerCell('Mês/Ano', C[0]),
          headerCell('Faturamento / Saídas (R$)', C[1]),
        ],
      }),
      ...dados.map(d => {
        const alerta  = d.saidas < d.entradas
        const shading = alerta ? 'FFF3CD' : undefined
        return new TableRow({ children: [
          dataCell(d.competencia,      C[0], { align: 'center', shading }),
          dataCell(fmtBRL(d.saidas),   C[1], { align: 'right',  shading }),
        ]})
      }),
      new TableRow({ children: [
        dataCell('TOTAL',        C[0], { bold: true, shading: 'E8ECF2', align: 'center' }),
        dataCell(fmtBRL(totalS), C[1], { bold: true, shading: 'E8ECF2', align: 'right'  }),
      ]}),
      new TableRow({ children: [
        dataCell('MÉDIA MENSAL', C[0], { bold: true, shading: 'E8ECF2', align: 'center' }),
        dataCell(fmtBRL(mediaS), C[1], { bold: true, shading: 'E8ECF2', align: 'right'  }),
      ]}),
    ],
  })
}

// ──────────────────────────────────────────────────────────────────────────────
// Tabela 2 — Acumuladas
// ──────────────────────────────────────────────────────────────────────────────

function buildTable2(resultado: ResultadoAnalise): Table {
  const dados = resultado.dados_mensais ?? []
  // Colunas: 1200 + 1700 + 2057 + 2057 + 2056 = 9070
  const C = [1200, 1700, 2057, 2057, 2056]
  let acumE = 0, acumS = 0

  const dataRows = dados.map(d => {
    acumE += d.entradas
    acumS += d.saidas
    const pct     = acumE > 0 ? (acumS / acumE) * 100 : 0
    const alerta  = d.saidas < d.entradas
    const shading = alerta ? 'FFF3CD' : undefined
    return new TableRow({ children: [
      dataCell(d.competencia,    C[0], { align: 'center', shading }),
      dataCell(fmtBRL(d.entradas), C[1], { align: 'right', shading }),
      dataCell(fmtBRL(acumE),    C[2], { align: 'right',  shading }),
      dataCell(fmtBRL(acumS),    C[3], { align: 'right',  shading }),
      dataCell(fmtPct(pct),      C[4], { align: 'right',  shading }),
    ]})
  })

  const pctFinal = acumE > 0 ? (acumS / acumE) * 100 : 0

  return new Table({
    width:        { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: C,
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          headerCell('Mês/Ano',                 C[0]),
          headerCell('Entradas (R$)',            C[1]),
          headerCell('Entradas Acumuladas (R$)', C[2]),
          headerCell('Saídas Acumuladas (R$)',   C[3]),
          headerCell('Saídas / Entradas (%)',    C[4]),
        ],
      }),
      ...dataRows,
      new TableRow({ children: [
        dataCell('ACUMULADO TOTAL', C[0], { bold: true, shading: 'E8ECF2' }),
        dataCell('',                C[1], { shading: 'E8ECF2' }),
        dataCell(fmtBRL(acumE),     C[2], { bold: true, shading: 'E8ECF2', align: 'right' }),
        dataCell(fmtBRL(acumS),     C[3], { bold: true, shading: 'E8ECF2', align: 'right' }),
        dataCell(fmtPct(pctFinal),  C[4], { bold: true, shading: 'E8ECF2', align: 'right' }),
      ]}),
    ],
  })
}

// ──────────────────────────────────────────────────────────────────────────────
// Tabela 3 — Checklist (19 itens)
// ──────────────────────────────────────────────────────────────────────────────

function buildTable3(
  resultado: ResultadoAnalise,
  checklist: Record<string, { checked: boolean }> | null
): Table {
  // Colunas: 500 + 5070 + 1600 + 1900 = 9070
  const C = [500, 5070, 1600, 1900]

  const dataRows = ITENS_CHECKLIST.map(item => {
    let situacao: string
    let color: string

    if (item.reqCsv) {
      const req = (resultado as any)[item.reqCsv] as { resultado: string } | undefined
      const r = req?.resultado ?? 'nao_aplicavel'
      if (r === 'aprovado' || r === 'informativo') { situacao = 'DE ACORDO';    color = '155724' }
      else if (r === 'nao_aplicavel')               { situacao = 'N/A';          color = '6C757D' }
      else                                          { situacao = 'EM DESACORDO'; color = '721C24' }
    } else if (item.chaveManual && checklist) {
      const checked = (checklist[item.chaveManual] as { checked?: boolean } | undefined)?.checked ?? false
      situacao = checked ? 'DE ACORDO' : 'PENDENTE'
      color    = checked ? '155724'    : '856404'
    } else {
      situacao = 'PENDENTE'; color = '856404'
    }

    // Borda dupla abaixo do último item manual (item 14)
    const bottomB = item.num === 14 ? CB2 : CB
    const bords   = { top: CB, bottom: bottomB, left: CB, right: CB }

    return new TableRow({ children: [
      new TableCell({
        width: { size: C[0], type: WidthType.DXA }, borders: bords,
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 60, bottom: 60, left: 80, right: 80 },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children:  [run(String(item.num), { size: PT9 })],
        })],
      }),
      new TableCell({
        width: { size: C[1], type: WidthType.DXA }, borders: bords,
        margins: { top: 60, bottom: 60, left: 120, right: 120 },
        children: [new Paragraph({ children: [run(item.descricao, { size: PT9 })] })],
      }),
      new TableCell({
        width: { size: C[2], type: WidthType.DXA }, borders: bords,
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 60, bottom: 60, left: 80, right: 80 },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children:  [run(item.base, { size: 17 })],
        })],
      }),
      new TableCell({
        width: { size: C[3], type: WidthType.DXA }, borders: bords,
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 60, bottom: 60, left: 80, right: 80 },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children:  [run(situacao, { bold: true, color, size: PT9 })],
        })],
      }),
    ]})
  })

  return new Table({
    width:        { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: C,
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          headerCell('Nº',                     C[0]),
          headerCell('Requisito / Documento',  C[1]),
          headerCell('Base Legal',             C[2]),
          headerCell('Situação',               C[3]),
        ],
      }),
      ...dataRows,
    ],
  })
}

// ──────────────────────────────────────────────────────────────────────────────
// Texto do parecer → elementos docx (Paragraph | Table)
// Substitui marcadores [[TABELA1]] e [[TABELA2]] pelas tabelas Word
// ──────────────────────────────────────────────────────────────────────────────

type DocxElement = Paragraph | Table

const RE_SECAO = /^(I{1,3}V?|VI{0,3}|IX|X)\s*[—–-]\s*.+$/
const RE_REQ   = /:\s*(ATENDIDO|NÃO ATENDIDO|NÃO APLICÁVEL|INFORMATIVO)$/

function tabelaTitulo(texto: string): Paragraph {
  return new Paragraph({
    spacing: { before: 200, after: 80 },
    border:  { bottom: { style: BorderStyle.SINGLE, size: 4, color: '000000', space: 2 } },
    children: [run(texto, { bold: true, size: PT10 })],
  })
}

function tabelaLegenda(texto: string): Paragraph {
  return new Paragraph({
    spacing: { before: 60, after: 200 },
    children: [run(texto, { size: 17, italic: true, color: '555555' })],
  })
}

function parecerToElements(
  texto: string,
  table1: Table | null,
  table2: Table | null
): DocxElement[] {
  const elements: DocxElement[] = []

  for (const line of texto.trim().split('\n')) {
    const t = line.trim()

    if (!t) {
      elements.push(new Paragraph({ spacing: { after: 60 } }))

    } else if (t === '[[TABELA1]]' && table1) {
      elements.push(
        tabelaTitulo('Tabela 1 — Faturamento nos Últimos 12 Meses'),
        table1,
        tabelaLegenda('⚠ Meses em que o faturamento (saídas) foi inferior às entradas — Art. 3º, III da Portaria GABIN 410/2025'),
      )

    } else if (t === '[[TABELA2]]' && table2) {
      elements.push(
        tabelaTitulo('Tabela 2 — Entradas Acumuladas Versus Saídas Acumuladas'),
        table2,
        tabelaLegenda('Percentual apurado mensalmente: saídas / entradas acumuladas. Impedimento quando 3 ou mais meses consecutivos apresentam percentual inferior a 100%.'),
      )

    } else if (RE_SECAO.test(t)) {
      elements.push(new Paragraph({
        spacing: { before: 240, after: 100 },
        children: [run(t, { bold: true, size: PT11 })],
      }))

    } else if (RE_REQ.test(t)) {
      // "Faturamento mínimo (Art. 3º, IV): ATENDIDO" — sub-cabeçalho em negrito
      // "NÃO ATENDIDO" renderizado em vermelho
      const match = t.match(/^(.+:\s*)(ATENDIDO|NÃO ATENDIDO|NÃO APLICÁVEL|INFORMATIVO)$/)
      if (match) {
        const corStatus = match[2] === 'NÃO ATENDIDO' ? 'CC0000' : undefined
        elements.push(new Paragraph({
          spacing: { before: 120, after: 60 },
          children: [
            run(match[1], { bold: true, size: PT11 }),
            run(match[2], { bold: true, size: PT11, color: corStatus }),
          ],
        }))
      } else {
        elements.push(new Paragraph({
          spacing: { before: 120, after: 60 },
          children: [run(t, { bold: true, size: PT11 })],
        }))
      }

    } else if (t.startsWith('⚠️')) {
      // Avisos offline — ignorados (já removidos do parecer)

    } else {
      elements.push(new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        indent:    { firstLine: 851 },  // ~1,5 cm
        spacing:   { after: 120 },
        children:  [run(t, { size: PT11 })],
      }))
    }
  }

  return elements
}

// ──────────────────────────────────────────────────────────────────────────────
// Handler
// ──────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const pedidoId  = req.nextUrl.searchParams.get('id')
  const matricula = req.nextUrl.searchParams.get('matricula') ?? ''
  const nome      = req.nextUrl.searchParams.get('nome') ?? ''
  if (!pedidoId)
    return NextResponse.json({ erro: 'id obrigatório' }, { status: 400 })

  // Busca pedido
  let pedido: any = null
  {
    const { data, error } = await supabase
      .from('pedidos')
      .select('cnpj, razao_social, tipo, numero_if, numero_processo, inscricao_estadual, resultado_json')
      .eq('id', pedidoId)
      .single()
    if (!error) {
      pedido = data
    } else {
      const { data: d2 } = await supabase
        .from('pedidos')
        .select('cnpj, razao_social, tipo, resultado_json')
        .eq('id', pedidoId)
        .single()
      pedido = d2
    }
  }
  if (!pedido)
    return NextResponse.json({ erro: 'Pedido não encontrado' }, { status: 404 })

  const { data: parecer } = await supabase
    .from('pareceres')
    .select('texto_final, texto_gerado')
    .eq('pedido_id', pedidoId)
    .single()

  const { data: docAnalise } = await supabase
    .from('documentos_analise')
    .select('resultado_json')
    .eq('pedido_id', pedidoId)
    .single()

  const textoParecer = parecer?.texto_final || parecer?.texto_gerado || ''
  const resultado    = pedido.resultado_json as ResultadoAnalise | null
  const checklist    = docAnalise?.resultado_json as Record<string, { checked: boolean }> | null

  // Se nem todos os documentos manuais foram marcados, atualizar status da documentação no texto
  const chavesManual = ITENS_CHECKLIST.filter(i => i.chaveManual).map(i => i.chaveManual as string)
  const docsCompletos = checklist !== null && chavesManual.every(c => checklist[c]?.checked === true)
  const textoFinal = docsCompletos
    ? textoParecer
    : textoParecer.replace(/(Documentação exigida[^:]*:\s*)ATENDIDO/, '$1NÃO ATENDIDO')

  // ── Logo ──────────────────────────────────────────────────────────────────
  let logoBuffer: Buffer | null = null
  for (const nome of ['logo_sefaz.png', 'logo_ma.png']) {
    try {
      logoBuffer = fs.readFileSync(path.join(process.cwd(), 'public', nome))
      break
    } catch { /* próximo */ }
  }

  // ── Assunto ───────────────────────────────────────────────────────────────
  const assunto = pedido.tipo === 'credenciamento'
    ? 'Credenciamento de Atacadista de Medicamentos'
    : 'Renovação de Credenciamento de Atacadista de Medicamentos'

  // ── Construção do documento ───────────────────────────────────────────────
  const children: DocxElement[] = []

  // Logo
  if (logoBuffer) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing:   { after: 80 },
      children: [new ImageRun({
        type:           'png',
        data:           logoBuffer,
        transformation: { width: 261, height: 42 },  // ~69mm x 11mm
        altText:        { title: 'Logo SEFAZ-MA', description: 'Logo SEFAZ-MA', name: 'logo' },
      })],
    }))
  }

  // Cabeçalho
  children.push(
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 },
      children: [run('SECRETARIA DE ESTADO DA FAZENDA DO MARANHÃO', { bold: true, size: PT11 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 },
      children: [run('CÉLULA DE GESTÃO DA AÇÃO FISCAL', { size: PT9 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 },
      children: [run('SUBSTITUIÇÃO TRIBUTÁRIA', { size: PT9 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 },
      children: [run('CEGAF-COTAF-ST – SÃO LUÍS', { size: PT9 })] }),
  )

  // Linha horizontal (borda inferior de parágrafo vazio)
  children.push(new Paragraph({
    border:  { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 4 } },
    spacing: { after: 100 },
    children: [],
  }))

  // Título da IF
  children.push(new Paragraph({
    spacing: { before: 60, after: 60 },
    children: [run(`INFORMAÇÃO FISCAL N° ${pedido.numero_if ?? ''} – CEGAF-COTAF-ST`, { bold: true, size: 28 })],
  }))

  children.push(new Paragraph({
    border:  { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 4 } },
    spacing: { after: 180 },
    children: [],
  }))

  // Campos (tabela sem bordas visíveis)
  const LABEL_W = 1800
  const VALUE_W = CONTENT_W - LABEL_W
  const fieldRows = [
    ['PROCESSO:',     pedido.numero_processo   ?? ''],
    ['CONTRIBUINTE:', pedido.razao_social       ?? ''],
    ['CNPJ:',         fmtCnpj(pedido.cnpj      ?? '')],
    ['INSC. ESTAD.:', pedido.inscricao_estadual ?? ''],
    ['ASSUNTO:',      assunto],
  ]

  children.push(new Table({
    width:        { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [LABEL_W, VALUE_W],
    borders: {
      top:     { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      bottom:  { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      left:    { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      right:   { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideVertical:   { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    },
    rows: fieldRows.map(([label, value]) =>
      new TableRow({ children: [
        new TableCell({
          width: { size: LABEL_W, type: WidthType.DXA }, borders: NO_BORD,
          margins: { top: 40, bottom: 40, left: 0, right: 120 },
          children: [new Paragraph({ children: [run(label, { bold: true, size: PT11 })] })],
        }),
        new TableCell({
          width: { size: VALUE_W, type: WidthType.DXA }, borders: NO_BORD,
          margins: { top: 40, bottom: 40, left: 0, right: 0 },
          children: [new Paragraph({ children: [run(value, { size: PT11 })] })],
        }),
      ]})
    ),
  }))

  children.push(new Paragraph({ spacing: { after: 160 } }))

  // Parecer (com Tabela 1 e 2 embutidas nos marcadores)
  const t1 = resultado ? buildTable1(resultado) : null
  const t2 = resultado ? buildTable2(resultado) : null
  children.push(...parecerToElements(textoFinal, t1, t2))

  // Tabela 3 (checklist) — início em nova página
  if (resultado) {
    children.push(
      new Paragraph({ children: [new PageBreak()] }),
      tabelaTitulo('Tabela 3 — Checklist de Requisitos — Portaria GABIN 410/2025'),
      buildTable3(resultado, checklist),
      tabelaLegenda('Itens 1–14: verificação documental pelo auditor fiscal. Itens 15–19: apuração automática com base nas planilhas de EFD/NF-e.'),
    )
  }

  // Assinatura
  children.push(
    new Paragraph({ spacing: { before: 800 } }),
    // A borda `top` cria a linha horizontal de assinatura
    new Paragraph({
      alignment: AlignmentType.CENTER,
      indent:    { left: 2400, right: 2400 },
      border:    { top: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 6 } },
      spacing:   { before: 0, after: 60 },
      children:  [run(nome || 'Auditor Fiscal da Receita Estadual', { bold: true, size: PT10 })],
    }),
    ...(nome
      ? [new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing:   { before: 0, after: 60 },
          children:  [run('Auditor Fiscal da Receita Estadual', { bold: true, size: PT10 })],
        })]
      : []),
    ...(matricula
      ? [new Paragraph({
          alignment: AlignmentType.CENTER,
          children:  [run(`Matrícula: ${matricula}`, { size: PT10 })],
        })]
      : []),
  )

  // ── Gerar arquivo ─────────────────────────────────────────────────────────
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size:   { width: 11906, height: 16838 },  // A4
          margin: { top: MARGIN_DXA, right: MARGIN_DXA, bottom: MARGIN_DXA, left: MARGIN_DXA },
        },
      },
      children,
    }],
  })

  const buffer   = await Packer.toBuffer(doc)
  const fileName = `IF_${(pedido.numero_if ?? 'SEFAZ').replace(/[^a-zA-Z0-9]/g, '_')}.docx`

  return new NextResponse(buffer as unknown as BodyInit, {
    status:  200,
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}
