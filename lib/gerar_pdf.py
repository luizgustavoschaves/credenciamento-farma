#!/usr/bin/env python3
"""
Gerador de Informação Fiscal – SEFAZ-MA
Lê JSON do stdin, gera PDF no stdout.

JSON esperado:
{
  "numero_if": "49/2026",
  "numero_processo": "0001234/2026",
  "cnpj": "12.345.678/0001-90",
  "razao_social": "DISTRIBUIDORA FARMACÊUTICA LTDA",
  "inscricao_estadual": "12.345.678-9",
  "assunto": "Pedido de credenciamento ...",
  "parecer": "Texto completo do parecer...",
  "logo_path": "/caminho/absoluto/para/logo_ma.png"
}
"""

import sys
import json
import io
from textwrap import wrap

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm, mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, Image
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY

# ──────────────────────────────────────────────────────────────────────────────
# Configuração de estilos
# ──────────────────────────────────────────────────────────────────────────────

def build_styles():
    return {
        'gov': ParagraphStyle(
            'gov', fontSize=8, leading=11, textColor=colors.HexColor('#1a1a1a'),
            alignment=TA_LEFT,
        ),
        'dept_bold': ParagraphStyle(
            'dept_bold', fontSize=9, leading=13, fontName='Helvetica-Bold',
            textColor=colors.HexColor('#1a1a1a'), alignment=TA_CENTER, spaceAfter=2,
        ),
        'dept_normal': ParagraphStyle(
            'dept_normal', fontSize=8.5, leading=12,
            textColor=colors.HexColor('#1a1a1a'), alignment=TA_CENTER, spaceAfter=1,
        ),
        'titulo_if': ParagraphStyle(
            'titulo_if', fontSize=11, leading=14, fontName='Helvetica-Bold',
            textColor=colors.HexColor('#000000'), alignment=TA_CENTER, spaceAfter=4,
        ),
        'campo_label': ParagraphStyle(
            'campo_label', fontSize=8.5, leading=12, fontName='Helvetica-Bold',
            textColor=colors.HexColor('#1a1a1a'),
        ),
        'campo_valor': ParagraphStyle(
            'campo_valor', fontSize=8.5, leading=12,
            textColor=colors.HexColor('#1a1a1a'),
        ),
        'body': ParagraphStyle(
            'body', fontSize=9, leading=14,
            textColor=colors.HexColor('#1a1a1a'), alignment=TA_JUSTIFY,
            spaceAfter=8,
        ),
        'mono': ParagraphStyle(
            'mono', fontSize=7.5, leading=11, fontName='Courier',
            textColor=colors.HexColor('#1a1a1a'), alignment=TA_LEFT,
            spaceAfter=4,
        ),
    }


def formatar_cnpj(cnpj: str) -> str:
    d = ''.join(c for c in cnpj if c.isdigit())
    if len(d) == 14:
        return f"{d[:2]}.{d[2:5]}.{d[5:8]}/{d[8:12]}-{d[12:]}"
    return cnpj


def gerar(dados: dict) -> bytes:
    buf = io.BytesIO()
    marg = 2.0 * cm

    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=marg,
        rightMargin=marg,
        topMargin=1.5 * cm,
        bottomMargin=2.0 * cm,
        title=f"Informação Fiscal {dados.get('numero_if', '')} - SEFAZ-MA",
    )

    S = build_styles()
    W = A4[0] - 2 * marg   # largura útil
    story = []

    # ── Cabeçalho: Logo + texto do governo ─────────────────────────────────
    logo_path = dados.get('logo_path', '')
    try:
        logo_img = Image(logo_path, width=4.2 * cm, height=1.6 * cm, kind='proportional')
    except Exception:
        logo_img = Paragraph('', S['gov'])

    gov_text = Paragraph(
        '<b>GOVERNO DO MARANHÃO</b><br/>'
        'Secretaria de Estado da Fazenda',
        S['gov']
    )

    header_table = Table(
        [[logo_img, gov_text]],
        colWidths=[4.5 * cm, W - 4.5 * cm],
    )
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(header_table)

    story.append(HRFlowable(width='100%', thickness=1.5, color=colors.HexColor('#003087'), spaceAfter=6))

    # ── Bloco de identificação do órgão (centralizado, negrito) ────────────
    story.append(Paragraph(
        'SECRETARIA DE ESTADO DA FAZENDA DO MARANHÃO',
        S['dept_bold']
    ))
    story.append(Paragraph('CÉLULA DE GESTÃO DA AÇÃO FISCAL', S['dept_bold']))
    story.append(Paragraph('SUBSTITUIÇÃO TRIBUTÁRIA', S['dept_bold']))
    story.append(Paragraph('CEGAF-COTAF-ST – SÃO LUÍS', S['dept_normal']))

    story.append(Spacer(1, 8))
    story.append(HRFlowable(width='100%', thickness=0.5, color=colors.HexColor('#888888'), spaceAfter=6))

    # ── Título da Informação Fiscal ────────────────────────────────────────
    numero_if = dados.get('numero_if', '').strip()
    story.append(Paragraph(
        f'INFORMAÇÃO FISCAL N° {numero_if} – CEGAF-COTAF-ST',
        S['titulo_if']
    ))

    story.append(HRFlowable(width='100%', thickness=0.5, color=colors.HexColor('#888888'), spaceAfter=6))

    # ── Campos do processo ─────────────────────────────────────────────────
    cnpj_fmt = formatar_cnpj(dados.get('cnpj', ''))
    assunto = dados.get('assunto', 'Pedido de credenciamento de estabelecimento atacadista de produtos farmacêuticos como substituto tributário.')

    campos = [
        ('PROCESSO:', dados.get('numero_processo', '')),
        ('CONTRIBUINTE:', dados.get('razao_social', '')),
        ('CNPJ:', cnpj_fmt),
        ('INSC. ESTAD.:', dados.get('inscricao_estadual', '')),
        ('ASSUNTO:', assunto),
    ]

    campo_rows = []
    for label, valor in campos:
        campo_rows.append([
            Paragraph(label, S['campo_label']),
            Paragraph(valor, S['campo_valor']),
        ])

    campo_table = Table(campo_rows, colWidths=[2.8 * cm, W - 2.8 * cm])
    campo_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    story.append(campo_table)

    story.append(HRFlowable(width='100%', thickness=0.5, color=colors.HexColor('#888888'), spaceBefore=6, spaceAfter=10))

    # ── Corpo do parecer ───────────────────────────────────────────────────
    parecer_raw = dados.get('parecer', '')

    # Separar seções: texto normal vs. quadro resumo (bloco monospace com ╔)
    if '\nQUADRO RESUMO' in parecer_raw:
        idx = parecer_raw.index('\nQUADRO RESUMO')
        texto_normal = parecer_raw[:idx].strip()
        quadro_raw = parecer_raw[idx:].strip()
    else:
        texto_normal = parecer_raw.strip()
        quadro_raw = ''

    # Renderiza texto normal parágrafo a parágrafo
    for linha in texto_normal.split('\n'):
        linha = linha.strip()
        if not linha:
            story.append(Spacer(1, 4))
        else:
            # Escapa caracteres especiais do XML/ReportLab
            linha_esc = (linha
                .replace('&', '&amp;')
                .replace('<', '&lt;')
                .replace('>', '&gt;')
            )
            story.append(Paragraph(linha_esc, S['body']))

    # Quadro resumo em fonte mono
    if quadro_raw:
        story.append(Spacer(1, 6))
        for linha in quadro_raw.split('\n'):
            linha_esc = (linha
                .replace('&', '&amp;')
                .replace('<', '&lt;')
                .replace('>', '&gt;')
            )
            story.append(Paragraph(linha_esc, S['mono']))

    doc.build(story)
    return buf.getvalue()


if __name__ == '__main__':
    dados = json.loads(sys.stdin.read())
    pdf_bytes = gerar(dados)
    sys.stdout.buffer.write(pdf_bytes)
