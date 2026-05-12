import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
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

/** Logo em base64 para embutir no HTML (sem dependência de arquivo estático) */
function logoBase64(): string {
  // Tenta primeiro o novo logo completo, depois o brasão simples
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
// Converte texto do parecer em HTML
// - Títulos de seção romana  → <h4>
// - Linhas "REQ-X —"         → parágrafo negrito
// - Aviso offline             → parágrafo amarelo
// - Resto                    → parágrafo justificado com recuo
// ──────────────────────────────────────────────────────────────────────────────

const RE_SECAO = /^(I{1,3}V?|VI{0,3}|IX|X)\s*[—–-]\s*.+$/

function parecerParaHtml(texto: string): string {
  if (!texto) return '<p class="corpo">(parecer não disponível)</p>'

  return texto.trim().split('\n').map(l => {
    const t = l.trim()
    if (!t) return '<div class="espaco"></div>'
    const e = esc(t)
    if (RE_SECAO.test(t))   return `<h4 class="secao">${e}</h4>`
    if (/^REQ-\d/.test(t))  return `<p class="req">${e}</p>`
    if (t.startsWith('⚠️')) return `<p class="aviso">${e}</p>`
    return `<p class="corpo">${e}</p>`
  }).join('\n')
}

// ──────────────────────────────────────────────────────────────────────────────
// HTML da Informação Fiscal — fiel ao modelo original
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
    /* Primeiro parágrafo sem recuo */
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

    /* ── Rodapé com número de página ── */
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

      @page {
        size: A4;
        margin: 0;
      }

      /* Contador de páginas no rodapé */
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

  // Busca pedido — resiliente a migration não rodada
  let pedido: any = null
  {
    const { data, error } = await supabase
      .from('pedidos')
      .select('cnpj, razao_social, tipo, numero_if, numero_processo, inscricao_estadual')
      .eq('id', pedidoId)
      .single()
    if (!error) {
      pedido = data
    } else {
      const { data: d2 } = await supabase
        .from('pedidos')
        .select('cnpj, razao_social, tipo')
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

  const textoParecer = parecer?.texto_final || parecer?.texto_gerado || ''

  const assunto = pedido.tipo === 'credenciamento'
    ? 'Credenciamento de Atacadista de Medicamentos'
    : 'Renovação de Credenciamento de Atacadista de Medicamentos'

  const html = montarHtml({
    logoSrc:      logoBase64(),
    numeroIF:     pedido.numero_if        ?? '',
    processo:     pedido.numero_processo  ?? '',
    contribuinte: pedido.razao_social     ?? '',
    cnpj:         fmtCnpj(pedido.cnpj    ?? ''),
    ie:           pedido.inscricao_estadual ?? '',
    assunto,
    parecerHtml:  parecerParaHtml(textoParecer),
    matricula,
  })

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
