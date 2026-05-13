import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { ResultadoAnalise } from '@/lib/types'
import { ITENS_CHECKLIST } from '@/lib/checklist-items'
import fs from 'fs'
import path from 'path'

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function fmtCnpj(cnpj: string): string {
  const d = cnpj.replace(/\D/g, '')
  if (d.length === 14)
    return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
  return cnpj
}

function esc(s: string): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fmtBRL(v: number): string {
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Logo em base64 para embutir no HTML (sem dependência de arquivo estático) */
function logoBase64(): string {
  for (const nome of ['logo_sefaz.png', 'logo_ma.png']) {
    try {
      const buf = fs.readFileSync(path.join(process.cwd(), 'public', nome))
      return 'data:image/png;base64,' + buf.toString('base64')
    } catch {
      // tenta o próximo
    }
  }
  return ''
}

// ──────────────────────────────────────────────────────────────────────────────
// Converte texto do parecer em HTML, substituindo marcadores pelas tabelas
// ──────────────────────────────────────────────────────────────────────────────

const RE_SECAO = /^(I{1,3}V?|VI{0,3}|IX|X)\s*[—–-]\s*.+$/

function parecerParaHtml(
  texto: string,
  tabela1Html: string = '',
  tabela2Html: string = ''
): string {
  if (!texto) return '<p class="corpo">(parecer não disponível)</p>'

  return texto.trim().split('\n').map(l => {
    const t = l.trim()
    if (!t) return '<div class="espaco"></div>'
    // Substituição das tabelas no lugar dos marcadores
    if (t === '[[TABELA1]]') return tabela1Html
    if (t === '[[TABELA2]]') return tabela2Html
    const e = esc(t)
    if (RE_SECAO.test(t))   return `<h4 class="secao">${e}</h4>`
    if (/^REQ-\d/.test(t))  return `<p class="req">${e}</p>`
    if (t.startsWith('⚠️')) return `<p class="aviso">${e}</p>`
    return `<p class="corpo">${e}</p>`
  }).join('\n')
}

// ──────────────────────────────────────────────────────────────────────────────
// Tabela 1 — Faturamento Mensal (Entradas e Saídas)
// ──────────────────────────────────────────────────────────────────────────────

function gerarTabela1(resultado: ResultadoAnalise): string {
  const dados = resultado.dados_mensais ?? []
  if (dados.length === 0) return ''

  const totalSaidas = dados.reduce((s, d) => s + d.saidas, 0)
  const mediaSaidas = dados.length > 0 ? totalSaidas / dados.length : 0

  const linhas = dados.map(d => {
    const problema = d.saidas < d.entradas
    const cls = problema ? ' class="linha-alerta"' : ''
    return `
      <tr${cls}>
        <td>${esc(d.competencia)}</td>
        <td class="num">${fmtBRL(d.saidas)}</td>
      </tr>`
  }).join('')

  return `
    <div class="tabela-bloco">
      <p class="tabela-titulo">Tabela 1 — Faturamento nos Últimos 12 Meses</p>
      <table class="tabela-dados">
        <thead>
          <tr>
            <th>Mês/Ano</th>
            <th class="num">Faturamento / Saídas (R$)</th>
          </tr>
        </thead>
        <tbody>
          ${linhas}
        </tbody>
        <tfoot>
          <tr class="total">
            <td><strong>TOTAL</strong></td>
            <td class="num"><strong>${fmtBRL(totalSaidas)}</strong></td>
          </tr>
          <tr class="total">
            <td><strong>MÉDIA MENSAL</strong></td>
            <td class="num"><strong>${fmtBRL(mediaSaidas)}</strong></td>
          </tr>
        </tfoot>
      </table>
      <p class="tabela-legenda">⚠ Meses destacados: faturamento inferior às entradas — Art. 3º, III da Portaria GABIN 410/2025</p>
    </div>`
}

// ──────────────────────────────────────────────────────────────────────────────
// Tabela 2 — Entradas Acumuladas vs. Saídas Acumuladas (REQ-4)
// ──────────────────────────────────────────────────────────────────────────────

function gerarTabela2(resultado: ResultadoAnalise): string {
  const dados = resultado.dados_mensais ?? []
  if (dados.length === 0) return ''

  let acumEntradas = 0
  let acumSaidas   = 0

  const linhas = dados.map(d => {
    acumEntradas += d.entradas
    acumSaidas   += d.saidas
    const pct = acumEntradas > 0 ? (acumSaidas / acumEntradas) * 100 : 0
    const problema = d.saidas < d.entradas
    const cls = problema ? ' class="linha-alerta"' : ''
    return `
      <tr${cls}>
        <td>${esc(d.competencia)}</td>
        <td class="num">${fmtBRL(d.entradas)}</td>
        <td class="num">${fmtBRL(acumEntradas)}</td>
        <td class="num">${fmtBRL(acumSaidas)}</td>
        <td class="num">${pct.toFixed(2).replace('.', ',')}%</td>
      </tr>`
  }).join('')

  const pctFinal = acumEntradas > 0 ? (acumSaidas / acumEntradas) * 100 : 0

  return `
    <div class="tabela-bloco">
      <p class="tabela-titulo">Tabela 2 — Entradas Versus Saídas Acumuladas</p>
      <table class="tabela-dados">
        <thead>
          <tr>
            <th>Mês/Ano</th>
            <th class="num">Entradas (R$)</th>
            <th class="num">Entradas Acumuladas (R$)</th>
            <th class="num">Saídas Acumuladas (R$)</th>
            <th class="num">Saídas / Entradas (%)</th>
          </tr>
        </thead>
        <tbody>
          ${linhas}
        </tbody>
        <tfoot>
          <tr class="total">
            <td><strong>ACUMULADO TOTAL</strong></td>
            <td></td>
            <td class="num"><strong>${fmtBRL(acumEntradas)}</strong></td>
            <td class="num"><strong>${fmtBRL(acumSaidas)}</strong></td>
            <td class="num"><strong>${pctFinal.toFixed(2).replace('.', ',')}%</strong></td>
          </tr>
        </tfoot>
      </table>
      <p class="tabela-legenda">Percentual apurado mensalmente: saídas acumuladas / entradas acumuladas. Impedimento quando 3 ou mais meses consecutivos apresentam percentual inferior a 100%.</p>
    </div>`
}

// ──────────────────────────────────────────────────────────────────────────────
// Tabela 3 — Checklist de Requisitos (19 itens)
// ──────────────────────────────────────────────────────────────────────────────

function gerarTabela3(resultado: ResultadoAnalise, checklist: Record<string, { checked: boolean }> | null): string {
  const linhas = ITENS_CHECKLIST.map(item => {
    let situacao: string
    let cls: string

    if (item.reqCsv) {
      // Resultado automático do CSV
      const req = resultado[item.reqCsv] as { resultado: string } | undefined
      const r = req?.resultado ?? 'nao_aplicavel'
      if (r === 'aprovado' || r === 'informativo') {
        situacao = 'DE ACORDO'
        cls = 'de-acordo'
      } else if (r === 'nao_aplicavel') {
        situacao = 'N/A'
        cls = 'na'
      } else {
        situacao = 'EM DESACORDO'
        cls = 'em-desacordo'
      }
    } else if (item.chaveManual && checklist) {
      const checked = (checklist[item.chaveManual] as { checked?: boolean } | undefined)?.checked ?? false
      situacao = checked ? 'DE ACORDO' : 'PENDENTE'
      cls = checked ? 'de-acordo' : 'pendente'
    } else {
      situacao = 'PENDENTE'
      cls = 'pendente'
    }

    return `
      <tr>
        <td class="centro">${item.num}</td>
        <td>${esc(item.descricao)}</td>
        <td class="centro base-legal">${esc(item.base)}</td>
        <td class="centro situacao ${cls}">${esc(situacao)}</td>
      </tr>`
  }).join('')

  return `
    <div class="tabela-bloco">
      <p class="tabela-titulo">Tabela 3 — Checklist de Requisitos — Portaria GABIN 410/2025</p>
      <table class="tabela-dados tabela-checklist">
        <thead>
          <tr>
            <th class="centro" style="width:40px">Nº</th>
            <th>Requisito / Documento</th>
            <th class="centro" style="width:100px">Base Legal</th>
            <th class="centro" style="width:110px">Situação</th>
          </tr>
        </thead>
        <tbody>
          ${linhas}
        </tbody>
      </table>
      <p class="tabela-legenda">
        Itens 1–14: verificação documental pelo auditor fiscal. Itens 15–19: apuração automática com base nas planilhas de EFD/NF-e.
      </p>
    </div>`
}

// ──────────────────────────────────────────────────────────────────────────────
// HTML da Informação Fiscal
// ──────────────────────────────────────────────────────────────────────────────

function montarHtml(p: {
  logoSrc: string
  numeroIF: string
  processo: string
  contribuinte: string
  cnpj: string
  ie: string
  assunto: string
  parecerHtml: string
  tabelasHtml: string
  matricula: string
}): string {
  const logoTag = p.logoSrc
    ? `<img src="${p.logoSrc}" class="logo" alt="Brasão MA">`
    : '<div class="logo-placeholder"></div>'

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Informação Fiscal ${esc(p.numeroIF)} – SEFAZ-MA</title>
  <style>
    /* ── Base ── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11pt;
      color: #000;
      background: #fff;
    }

    /* ── Página ── */
    .pagina {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      padding: 20mm 25mm 25mm;
      position: relative;
    }

    /* ── Cabeçalho ── */
    .cabecalho {
      text-align: center;
      margin-bottom: 8px;
    }
    .logo {
      height: 70px;
      width: auto;
      display: block;
      margin: 0 auto 6px;
      background: #fff;
    }
    .logo-placeholder {
      height: 70px;
      margin-bottom: 6px;
    }
    .cab-secretaria {
      font-size: 11pt;
      font-weight: bold;
      line-height: 1.4;
    }
    .cab-sub {
      font-size: 9.5pt;
      font-weight: normal;
      line-height: 1.5;
    }

    /* ── Linhas separadoras ── */
    hr.linha {
      border: none;
      border-top: 1px solid #000;
      margin: 8px 0;
    }

    /* ── Título da IF ── */
    .titulo-if {
      font-size: 14pt;
      font-weight: bold;
      line-height: 1.3;
      padding: 6px 0 5px;
    }

    /* ── Campos ── */
    .campos {
      width: 100%;
      border-collapse: collapse;
      margin-top: 2px;
    }
    .campos tr td {
      padding: 2.5px 0;
      vertical-align: top;
      font-size: 11pt;
      line-height: 1.4;
    }
    .campos .label {
      font-weight: bold;
      white-space: nowrap;
      padding-right: 6px;
      width: 115px;
    }

    /* ── Corpo do parecer ── */
    .parecer { margin-top: 16px; }

    p.corpo {
      text-align: justify;
      text-indent: 1.5cm;
      margin-bottom: 10px;
      font-size: 11pt;
      line-height: 1.6;
    }
    p.corpo:first-child { text-indent: 0; }

    h4.secao {
      font-size: 11pt;
      font-weight: bold;
      margin-top: 16px;
      margin-bottom: 6px;
    }
    p.req {
      font-weight: bold;
      margin-bottom: 4px;
      font-size: 11pt;
    }
    p.aviso {
      font-size: 9pt;
      color: #5a4000;
      background: #fffbe6;
      border-left: 3px solid #e6a800;
      padding: 4px 8px;
      margin-top: 12px;
    }
    .espaco { height: 8px; }

    /* ── Tabelas de dados ── */
    .tabela-bloco {
      margin-top: 20px;
    }
    .tabela-titulo {
      font-size: 10.5pt;
      font-weight: bold;
      margin-bottom: 6px;
      border-bottom: 1px solid #000;
      padding-bottom: 3px;
    }
    .tabela-dados {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5pt;
    }
    .tabela-dados th {
      background: #1a3a6b;
      color: #fff;
      padding: 5px 6px;
      font-size: 9pt;
      font-weight: bold;
      border: 1px solid #1a3a6b;
    }
    .tabela-dados td {
      padding: 4px 6px;
      border: 1px solid #ccc;
      vertical-align: middle;
    }
    .tabela-dados tr:nth-child(even) td { background: #f5f7fa; }
    .tabela-dados tr.linha-alerta td { background: #fff3cd; }
    .tabela-dados tfoot td {
      background: #e8ecf2;
      font-size: 9.5pt;
      border: 1px solid #aaa;
    }
    .num { text-align: right; }
    .centro { text-align: center; }
    .base-legal { font-size: 8.5pt; }
    .tabela-legenda {
      font-size: 8.5pt;
      color: #555;
      margin-top: 4px;
      font-style: italic;
    }

    /* Situação no checklist */
    .situacao { font-weight: bold; font-size: 9pt; }
    .de-acordo  { color: #155724; }
    .em-desacordo { color: #721c24; }
    .pendente   { color: #856404; }
    .na         { color: #6c757d; }

    /* Tabela checklist — linha separadora entre manual e CSV */
    .tabela-checklist tbody tr:nth-child(14) td {
      border-bottom: 2px solid #1a3a6b;
    }

    /* ── Quebra de página antes das tabelas ── */
    .quebra-pagina { page-break-before: always; }

    /* ── Assinatura ── */
    .assinatura {
      margin-top: 48px;
      text-align: center;
    }
    .assinatura-linha {
      display: inline-block;
      width: 280px;
      border-top: 1px solid #000;
      margin-bottom: 4px;
    }
    .assinatura-cargo {
      font-size: 10pt;
      font-weight: bold;
      line-height: 1.5;
    }
    .assinatura-matricula {
      font-size: 10pt;
      line-height: 1.5;
    }

    /* ── Botão imprimir (só na tela) ── */
    @media screen {
      .rodape { display: none; }
      .btn-print {
        display: block;
        margin: 24px auto 0;
        padding: 10px 30px;
        background: #003087;
        color: #fff;
        border: none;
        border-radius: 6px;
        font-size: 13px;
        font-family: Arial, sans-serif;
        cursor: pointer;
      }
      .btn-print:hover { background: #001a5e; }
    }

    /* ── Impressão ── */
    @media print {
      body { margin: 0; background: #fff; }
      .pagina { margin: 0; padding: 15mm 20mm 22mm; width: 100%; min-height: 0; }
      .btn-print { display: none !important; }
      .quebra-pagina { page-break-before: always; }

      @page {
        size: A4;
        margin: 0;
      }

      @page {
        @bottom-right {
          content: "Página " counter(page) " de " counter(pages);
          font-family: Arial, sans-serif;
          font-size: 9pt;
        }
      }
    }
  </style>
</head>
<body>
<div class="pagina">

  <!-- Cabeçalho -->
  <div class="cabecalho">
    ${logoTag}
    <div class="cab-secretaria">SECRETARIA DE ESTADO DA FAZENDA DO MARANHÃO</div>
    <div class="cab-sub">CÉLULA DE GESTÃO DA AÇÃO FISCAL</div>
    <div class="cab-sub">SUBSTITUIÇÃO TRIBUTÁRIA</div>
    <div class="cab-sub">CEGAF-COTAF-ST – SÃO LUÍS</div>
  </div>

  <hr class="linha">

  <!-- Título -->
  <div class="titulo-if">INFORMAÇÃO FISCAL N° ${esc(p.numeroIF)} – CEGAF-COTAF-ST</div>

  <hr class="linha">

  <!-- Campos -->
  <table class="campos">
    <tr>
      <td class="label">PROCESSO:</td>
      <td>${esc(p.processo)}</td>
    </tr>
    <tr>
      <td class="label">CONTRIBUINTE:</td>
      <td>${esc(p.contribuinte)}</td>
    </tr>
    <tr>
      <td class="label">CNPJ:</td>
      <td>${esc(p.cnpj)}</td>
    </tr>
    <tr>
      <td class="label">INSC. ESTAD.:</td>
      <td>${esc(p.ie)}</td>
    </tr>
    <tr>
      <td class="label">ASSUNTO:</td>
      <td>${esc(p.assunto)}</td>
    </tr>
  </table>

  <!-- Parecer -->
  <div class="parecer">
    ${p.parecerHtml}
  </div>

  <!-- Tabelas analíticas (páginas 4 e 5) -->
  ${p.tabelasHtml}

  <!-- Assinatura -->
  <div class="assinatura">
    <div class="assinatura-linha"></div>
    <div class="assinatura-cargo">Auditor Fiscal da Receita Estadual</div>
    ${p.matricula ? `<div class="assinatura-matricula">Matrícula: ${esc(p.matricula)}</div>` : ''}
  </div>

</div>

<button class="btn-print" onclick="window.print()">🖨️ Imprimir / Salvar como PDF</button>

<script>
  window.addEventListener('load', () => setTimeout(() => window.print(), 600))
</script>
</body>
</html>`
}

// ──────────────────────────────────────────────────────────────────────────────
// Handler
// ──────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const pedidoId  = req.nextUrl.searchParams.get('id')
  const matricula = req.nextUrl.searchParams.get('matricula') ?? ''
  if (!pedidoId)
    return NextResponse.json({ erro: 'id obrigatório' }, { status: 400 })

  // Busca pedido com resultado_json para montar as tabelas
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
      // Fallback sem campos novos (migration não rodada)
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

  // Busca parecer
  const { data: parecer } = await supabase
    .from('pareceres')
    .select('texto_final, texto_gerado')
    .eq('pedido_id', pedidoId)
    .single()

  // Busca checklist documental (documentos_analise)
  const { data: docAnalise } = await supabase
    .from('documentos_analise')
    .select('resultado_json')
    .eq('pedido_id', pedidoId)
    .single()

  const textoParecer = parecer?.texto_final || parecer?.texto_gerado || ''
  const resultado    = pedido.resultado_json as ResultadoAnalise | null
  const checklist    = docAnalise?.resultado_json as Record<string, { checked: boolean }> | null

  // Gerar tabelas
  // Tabela 1 e 2 são injetadas dentro do texto do parecer (via marcadores [[TABELA1]] e [[TABELA2]])
  // Tabela 3 (checklist) vai após o parecer, antes da assinatura
  let tabela1Html = ''
  let tabela2Html = ''
  let tabelasHtml = ''
  if (resultado) {
    tabela1Html = gerarTabela1(resultado)
    tabela2Html = gerarTabela2(resultado)
    tabelasHtml = gerarTabela3(resultado, checklist)
  }

  const assunto = pedido.tipo === 'credenciamento'
    ? 'Credenciamento de Atacadista de Medicamentos'
    : 'Renovação de Credenciamento de Atacadista de Medicamentos'

  const html = montarHtml({
    logoSrc:      logoBase64(),
    numeroIF:     pedido.numero_if         ?? '',
    processo:     pedido.numero_processo   ?? '',
    contribuinte: pedido.razao_social      ?? '',
    cnpj:         fmtCnpj(pedido.cnpj     ?? ''),
    ie:           pedido.inscricao_estadual ?? '',
    assunto,
    parecerHtml:  parecerParaHtml(textoParecer, tabela1Html, tabela2Html),
    tabelasHtml,
    matricula,
  })

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
