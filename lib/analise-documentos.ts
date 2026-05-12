// ──────────────────────────────────────────────────────────────────────────────
// Análise Documental — usa Claude com suporte nativo a PDF
// Executa em 2 rodadas para respeitar dependências entre documentos
// ──────────────────────────────────────────────────────────────────────────────

import Anthropic from '@anthropic-ai/sdk'
import {
  ResultadoContratoSocial,
  ResultadoDocsSocios,
  ResultadoImovel,
  ResultadoComprovanteEndereco,
  ResultadoIRSocios,
  ResultadoRAISGFIP,
  ResultadoContratoContador,
  ResultadoLicencaANVISA,
  ResultadoDocumentos,
  SocioIdentificado,
} from './tipos-documentos'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ──────────────────────────────────────────────────────────────────────────────
// Helper: envia PDF para Claude e obtém JSON estruturado
// ──────────────────────────────────────────────────────────────────────────────

async function analisarPDF(base64: string, prompt: string): Promise<unknown> {
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64 },
          } as any,
          { type: 'text', text: prompt },
        ],
      },
    ],
  })

  const texto = msg.content.find(c => c.type === 'text')?.text ?? ''
  // Extrai primeiro bloco JSON da resposta
  const match = texto.match(/\{[\s\S]*\}/)
  if (!match) throw new Error(`JSON não encontrado na resposta:\n${texto.slice(0, 300)}`)
  return JSON.parse(match[0])
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}
function bool(v: unknown, fallback = false): boolean {
  return typeof v === 'boolean' ? v : fallback
}
function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' ? v : Number(v ?? fallback) || fallback
}
function arr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : []
}

// ──────────────────────────────────────────────────────────────────────────────
// 1. Contrato Social
// ──────────────────────────────────────────────────────────────────────────────

export async function analisarContratoSocial(base64: string): Promise<ResultadoContratoSocial> {
  const prompt = `Você é um auditor fiscal brasileiro analisando documentos de credenciamento.
Analise este contrato social e retorne SOMENTE JSON válido, sem texto adicional, sem markdown:

{
  "objeto_inclui_atacado": true,
  "objeto_social_extraido": "texto completo do objeto social encontrado",
  "data_constituicao": "DD/MM/AAAA",
  "socios": [{"nome": "Nome Completo", "cpf": "000.000.000-00 ou null"}],
  "observacoes": []
}

Regras:
- "objeto_inclui_atacado" = true se mencionar atacado, distribuição, comércio atacadista de medicamentos, produtos farmacêuticos, insumos farmacêuticos ou equivalentes
- CPF pode ser null se não aparecer no documento
- "data_constituicao" = "não encontrada" se não constar`

  try {
    const d = analisarPDF(base64, prompt) as any
    const dados = await d
    const inclui = bool(dados?.objeto_inclui_atacado)
    return {
      resultado:              inclui ? 'aprovado' : 'reprovado',
      objeto_inclui_atacado:  inclui,
      objeto_social_extraido: str(dados?.objeto_social_extraido, '(não extraído)'),
      data_constituicao:      str(dados?.data_constituicao, 'não encontrada'),
      socios:                 arr<SocioIdentificado>(dados?.socios),
      observacoes:            arr<string>(dados?.observacoes),
    }
  } catch (e) {
    console.error('[analise-docs] contrato_social:', e)
    return {
      resultado: 'pendente_auditor', objeto_inclui_atacado: false,
      objeto_social_extraido: '', data_constituicao: 'não encontrada',
      socios: [], observacoes: ['Erro ao processar documento. Verifique manualmente.'],
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 2. Documentos Pessoais dos Sócios
// ──────────────────────────────────────────────────────────────────────────────

export async function analisarDocsSocios(
  base64: string,
  sociosEsperados: SocioIdentificado[],
): Promise<ResultadoDocsSocios> {
  const listaSocios = sociosEsperados.map(s => s.nome).join(', ') || '(lista não disponível)'

  const prompt = `Analise estes documentos de identidade (RG, CPF, CNH ou passaporte).
Sócios/diretores esperados conforme contrato social: ${listaSocios}

Retorne SOMENTE JSON válido:
{
  "pessoas_encontradas": [{"nome": "Nome Completo", "cpf": "000.000.000-00 ou null", "tipo_doc": "RG"}],
  "socios_confirmados": ["Nome que foi encontrado nos documentos"],
  "socios_nao_encontrados": ["Nome que não foi encontrado"],
  "observacoes": []
}

Compare os nomes com flexibilidade (pode haver variação de acentuação ou ordem dos nomes).`

  try {
    const dados = await analisarPDF(base64, prompt) as any
    const confirmados: string[] = arr(dados?.socios_confirmados)
    const naoEncontrados: string[] = arr(dados?.socios_nao_encontrados)
    return {
      resultado:              naoEncontrados.length === 0 ? 'aprovado' : 'reprovado',
      pessoas_encontradas:    arr(dados?.pessoas_encontradas),
      socios_confirmados:     confirmados,
      socios_nao_encontrados: naoEncontrados,
      observacoes:            arr(dados?.observacoes),
    }
  } catch (e) {
    console.error('[analise-docs] docs_socios:', e)
    return {
      resultado: 'pendente_auditor', pessoas_encontradas: [],
      socios_confirmados: [], socios_nao_encontrados: [],
      observacoes: ['Erro ao processar documento. Verifique manualmente.'],
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 3. Registro de Imóvel / Contrato de Locação
// ──────────────────────────────────────────────────────────────────────────────

export async function analisarImovel(base64: string): Promise<ResultadoImovel> {
  const prompt = `Analise este documento imobiliário (registro de imóvel ou contrato de locação).

Retorne SOMENTE JSON válido:
{
  "tipo_documento": "registro_imovel",
  "endereco_completo": "endereço completo do imóvel, incluindo logradouro, número, complemento, bairro, cidade e estado",
  "observacoes": []
}

"tipo_documento" deve ser: "registro_imovel", "contrato_locacao" ou "desconhecido"`

  try {
    const dados = await analisarPDF(base64, prompt) as any
    const tipo = str(dados?.tipo_documento, 'desconhecido') as ResultadoImovel['tipo_documento']
    const endereco = str(dados?.endereco_completo, '')
    return {
      resultado:         endereco ? 'aprovado' : 'pendente_auditor',
      tipo_documento:    tipo,
      endereco_extraido: endereco,
      observacoes:       arr(dados?.observacoes),
    }
  } catch (e) {
    console.error('[analise-docs] imovel:', e)
    return {
      resultado: 'pendente_auditor', tipo_documento: 'desconhecido',
      endereco_extraido: '', observacoes: ['Erro ao processar documento. Verifique manualmente.'],
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 4. Comprovante de Endereço (conta de energia ou similar)
// ──────────────────────────────────────────────────────────────────────────────

export async function analisarComprovanteEndereco(
  base64: string,
  enderecoImovel: string,
): Promise<ResultadoComprovanteEndereco> {
  const prompt = `Analise este comprovante de endereço (conta de energia, água, telefone ou similar).
Endereço de referência para comparação (do registro/contrato de locação): "${enderecoImovel}"

Retorne SOMENTE JSON válido:
{
  "endereco_extraido": "endereço exato conforme consta no comprovante",
  "enderecos_batem": true,
  "mes_emissao": "MM/AAAA",
  "observacoes": []
}

Considere que os endereços batem se referirem ao mesmo local, mesmo com pequenas variações de escrita.
Se não batem, explique nas observações as diferenças encontradas.`

  try {
    const dados = await analisarPDF(base64, prompt) as any
    const batem = bool(dados?.enderecos_batem)
    return {
      resultado:                  batem ? 'aprovado' : 'reprovado',
      endereco_extraido:          str(dados?.endereco_extraido),
      enderecos_batem:            batem,
      endereco_imovel_referencia: enderecoImovel,
      mes_emissao:                str(dados?.mes_emissao),
      observacoes:                arr(dados?.observacoes),
    }
  } catch (e) {
    console.error('[analise-docs] comprovante_endereco:', e)
    return {
      resultado: 'pendente_auditor', endereco_extraido: '', enderecos_batem: false,
      endereco_imovel_referencia: enderecoImovel, mes_emissao: '',
      observacoes: ['Erro ao processar documento. Verifique manualmente.'],
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 5. Imposto de Renda dos Sócios (3 últimos anos, pode ser um PDF com todos)
// ──────────────────────────────────────────────────────────────────────────────

export async function analisarIRSocios(
  base64: string,
  sociosEsperados: SocioIdentificado[],
): Promise<ResultadoIRSocios> {
  const listaSocios = sociosEsperados.map(s => s.nome).join(', ') || '(lista não disponível)'

  const prompt = `Analise estas declarações de Imposto de Renda (IRPF) — podem ser de múltiplos anos e múltiplos declarantes no mesmo arquivo.
Sócios esperados conforme contrato social: ${listaSocios}

Retorne SOMENTE JSON válido:
{
  "declarantes": [
    {"nome": "Nome Completo", "cpf": "000.000.000-00 ou null", "anos": [2022, 2023, 2024]}
  ],
  "socios_confirmados": ["Nome do sócio confirmado"],
  "socios_nao_encontrados": ["Nome não encontrado nas declarações"],
  "anos_encontrados": [2022, 2023, 2024],
  "observacoes": []
}

Verifique se cada sócio possui declarações para os 3 anos mais recentes encontrados no arquivo.`

  try {
    const dados = await analisarPDF(base64, prompt) as any
    const confirmados: string[] = arr(dados?.socios_confirmados)
    const naoEncontrados: string[] = arr(dados?.socios_nao_encontrados)
    return {
      resultado:               naoEncontrados.length === 0 ? 'aprovado' : 'reprovado',
      declarantes:             arr(dados?.declarantes),
      socios_confirmados:      confirmados,
      socios_nao_encontrados:  naoEncontrados,
      anos_encontrados:        arr(dados?.anos_encontrados),
      observacoes:             arr(dados?.observacoes),
    }
  } catch (e) {
    console.error('[analise-docs] ir_socios:', e)
    return {
      resultado: 'pendente_auditor', declarantes: [],
      socios_confirmados: [], socios_nao_encontrados: [],
      anos_encontrados: [], observacoes: ['Erro ao processar documento. Verifique manualmente.'],
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 6. RAIS / GFIP
// ──────────────────────────────────────────────────────────────────────────────

export async function analisarRAISGFIP(
  base64: string,
  funcionariosMinimos: number,
): Promise<ResultadoRAISGFIP> {
  const prompt = `Analise este relatório RAIS (Relação Anual de Informações Sociais) ou GFIP (Guia de Recolhimento do FGTS e Informações à Previdência Social).
Quantidade mínima de funcionários CLT exigida: ${funcionariosMinimos}

Retorne SOMENTE JSON válido:
{
  "tipo_documento": "rais",
  "periodo_referencia": "2024 ou 01/2025",
  "total_funcionarios": 10,
  "atende_minimo": true,
  "observacoes": []
}

"tipo_documento": "rais", "gfip" ou "desconhecido"
"atende_minimo" = true se total_funcionarios >= ${funcionariosMinimos}`

  try {
    const dados = await analisarPDF(base64, prompt) as any
    const total = num(dados?.total_funcionarios)
    const atende = bool(dados?.atende_minimo, total >= funcionariosMinimos)
    return {
      resultado:                     atende ? 'aprovado' : 'reprovado',
      tipo_documento:                str(dados?.tipo_documento, 'desconhecido') as ResultadoRAISGFIP['tipo_documento'],
      periodo_referencia:            str(dados?.periodo_referencia),
      funcionarios_declarados:       total,
      funcionarios_minimos_exigidos: funcionariosMinimos,
      observacoes:                   arr(dados?.observacoes),
    }
  } catch (e) {
    console.error('[analise-docs] rais_gfip:', e)
    return {
      resultado: 'pendente_auditor', tipo_documento: 'desconhecido',
      periodo_referencia: '', funcionarios_declarados: 0,
      funcionarios_minimos_exigidos: funcionariosMinimos,
      observacoes: ['Erro ao processar documento. Verifique manualmente.'],
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 7. Contrato do Contador + DHP
// ──────────────────────────────────────────────────────────────────────────────

export async function analisarContratoContador(
  base64: string,
  mesPedido: string,   // MM/AAAA — mês de apresentação do pedido
): Promise<ResultadoContratoContador> {
  const prompt = `Analise este contrato de prestação de serviços contábeis e/ou DHP (Declaração de Habilitação Profissional do Conselho de Contabilidade).
Mês de apresentação do pedido de credenciamento: ${mesPedido}

Retorne SOMENTE JSON válido:
{
  "vigencia_inicio": "DD/MM/AAAA ou vazio",
  "vigencia_fim": "DD/MM/AAAA ou vazio",
  "vigencia_indeterminada": false,
  "vigencia_cobre_data_atual": true,
  "dhp_encontrada": true,
  "dhp_validade": "DD/MM/AAAA ou vazio",
  "dhp_vigente": true,
  "observacoes": []
}

Considere "vigencia_cobre_data_atual" = true se: o contrato está em vigor durante o mês ${mesPedido}, ou é por prazo indeterminado sem rescisão, ou a data de término é posterior ao mês ${mesPedido}.
"dhp_vigente" = true se a validade da DHP abrange o mês ${mesPedido}.`

  try {
    const dados = await analisarPDF(base64, prompt) as any
    const coberta = bool(dados?.vigencia_cobre_data_atual)
    const dhpOk   = bool(dados?.dhp_vigente)
    return {
      resultado:                 coberta && dhpOk ? 'aprovado' : 'reprovado',
      vigencia_inicio:           str(dados?.vigencia_inicio),
      vigencia_fim:              str(dados?.vigencia_fim),
      vigencia_indeterminada:    bool(dados?.vigencia_indeterminada),
      vigencia_cobre_data_atual: coberta,
      dhp_encontrada:            bool(dados?.dhp_encontrada),
      dhp_vigente:               dhpOk,
      observacoes:               arr(dados?.observacoes),
    }
  } catch (e) {
    console.error('[analise-docs] contrato_contador:', e)
    return {
      resultado: 'pendente_auditor', vigencia_inicio: '', vigencia_fim: '',
      vigencia_indeterminada: false, vigencia_cobre_data_atual: false,
      dhp_encontrada: false, dhp_vigente: false,
      observacoes: ['Erro ao processar documento. Verifique manualmente.'],
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 8. Licença ANVISA
// ──────────────────────────────────────────────────────────────────────────────

export async function analisarLicencaANVISA(
  base64: string,
  dataAtual: string,  // DD/MM/AAAA
): Promise<ResultadoLicencaANVISA> {
  const prompt = `Analise esta licença/autorização de funcionamento emitida pela ANVISA (Agência Nacional de Vigilância Sanitária).
Data atual: ${dataAtual}

Retorne SOMENTE JSON válido:
{
  "numero_autorizacao": "número da licença/autorização",
  "razao_social": "nome da empresa conforme consta na licença",
  "atividade_autorizada": "descrição da atividade autorizada",
  "vigencia_fim": "DD/MM/AAAA ou vazio",
  "vigencia_cobre_data_atual": true,
  "observacoes": []
}

"vigencia_cobre_data_atual" = true se a data de vencimento é posterior a ${dataAtual}.`

  try {
    const dados = await analisarPDF(base64, prompt) as any
    const vigente = bool(dados?.vigencia_cobre_data_atual)
    return {
      resultado:                 vigente ? 'aprovado' : 'reprovado',
      numero_autorizacao:        str(dados?.numero_autorizacao),
      razao_social_licenca:      str(dados?.razao_social),
      atividade_autorizada:      str(dados?.atividade_autorizada),
      vigencia_fim:              str(dados?.vigencia_fim),
      vigencia_cobre_data_atual: vigente,
      observacoes:               arr(dados?.observacoes),
    }
  } catch (e) {
    console.error('[analise-docs] licenca_anvisa:', e)
    return {
      resultado: 'pendente_auditor', numero_autorizacao: '', razao_social_licenca: '',
      atividade_autorizada: '', vigencia_fim: '', vigencia_cobre_data_atual: false,
      observacoes: ['Erro ao processar documento. Verifique manualmente.'],
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Orquestrador principal — 2 rodadas paralelas
// ──────────────────────────────────────────────────────────────────────────────

export async function executarAnaliseDocumental(params: {
  pdfs: {
    contratoSocial:       string   // base64
    docsSocios:           string
    imovel:               string
    comprovanteEndereco:  string
    irSocios:             string
    raisGfip:             string
    contratoContador:     string
    licencaAnvisa:        string
  }
  funcionariosMinimos: number
  dataAtual:  string   // DD/MM/AAAA — usada para Licença ANVISA
  mesPedido:  string   // MM/AAAA  — mês de protocolo, usado para Contrato do Contador
}): Promise<ResultadoDocumentos> {
  const { pdfs, funcionariosMinimos, dataAtual, mesPedido } = params

  // ── Rodada 1: documentos independentes ──
  const [contratoSocial, imovel, raisGfip, contratoContador, licencaAnvisa] = await Promise.all([
    analisarContratoSocial(pdfs.contratoSocial),
    analisarImovel(pdfs.imovel),
    analisarRAISGFIP(pdfs.raisGfip, funcionariosMinimos),
    analisarContratoContador(pdfs.contratoContador, mesPedido),  // mês do pedido, não data atual
    analisarLicencaANVISA(pdfs.licencaAnvisa, dataAtual),
  ])

  // ── Rodada 2: documentos que dependem dos resultados da rodada 1 ──
  const socios = contratoSocial.socios
  const enderecoImovel = imovel.endereco_extraido

  const [docsSocios, comprovanteEndereco, irSocios] = await Promise.all([
    analisarDocsSocios(pdfs.docsSocios, socios),
    analisarComprovanteEndereco(pdfs.comprovanteEndereco, enderecoImovel),
    analisarIRSocios(pdfs.irSocios, socios),
  ])

  return {
    contrato_social:      contratoSocial,
    docs_socios:          docsSocios,
    imovel,
    comprovante_endereco: comprovanteEndereco,
    ir_socios:            irSocios,
    rais_gfip:            raisGfip,
    contrato_contador:    contratoContador,
    licenca_anvisa:       licencaAnvisa,
    data_analise:         new Date().toISOString(),
  }
}
