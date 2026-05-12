// ──────────────────────────────────────────────────────────────────────────────
// Tipos — Análise Documental do Credenciamento de Atacadista de Medicamentos
// Segunda etapa da análise: verificação dos documentos formais
// ──────────────────────────────────────────────────────────────────────────────

export type ResultadoDoc = 'aprovado' | 'reprovado' | 'pendente_auditor'

// ── 1. Contrato Social ────────────────────────────────────────────────────────

export interface SocioIdentificado {
  nome:  string
  cpf?:  string
}

export interface ResultadoContratoSocial {
  resultado:                    ResultadoDoc
  objeto_inclui_atacado:        boolean
  objeto_social_extraido:       string
  data_constituicao:            string          // DD/MM/AAAA ou "não encontrada"
  socios:                       SocioIdentificado[]
  observacoes:                  string[]
}

// ── 2. Documentos Pessoais dos Sócios ─────────────────────────────────────────

export interface PessoaDocumento {
  nome:     string
  cpf?:     string
  tipo_doc: string  // RG, CPF, CNH, passaporte etc.
}

export interface ResultadoDocsSocios {
  resultado:               ResultadoDoc
  pessoas_encontradas:     PessoaDocumento[]
  socios_confirmados:      string[]
  socios_nao_encontrados:  string[]
  observacoes:             string[]
}

// ── 3. Registro de Imóvel ou Contrato de Locação ──────────────────────────────

export interface ResultadoImovel {
  resultado:         ResultadoDoc
  tipo_documento:    'registro_imovel' | 'contrato_locacao' | 'desconhecido'
  endereco_extraido: string
  observacoes:       string[]
}

// ── 4. Comprovante de Endereço ────────────────────────────────────────────────

export interface ResultadoComprovanteEndereco {
  resultado:                  ResultadoDoc
  endereco_extraido:          string
  enderecos_batem:            boolean
  endereco_imovel_referencia: string   // endereço que veio do doc de imóvel
  mes_emissao:                string   // MM/AAAA
  observacoes:                string[]
}

// ── 5. Imposto de Renda dos Sócios ────────────────────────────────────────────

export interface DeclaranteIR {
  nome: string
  cpf?: string
  anos: number[]
}

export interface ResultadoIRSocios {
  resultado:               ResultadoDoc
  declarantes:             DeclaranteIR[]
  socios_confirmados:      string[]
  socios_nao_encontrados:  string[]
  anos_encontrados:        number[]
  observacoes:             string[]
}

// ── 6. RAIS ou GFIP ───────────────────────────────────────────────────────────

export interface ResultadoRAISGFIP {
  resultado:                    ResultadoDoc
  tipo_documento:               'rais' | 'gfip' | 'desconhecido'
  periodo_referencia:           string
  funcionarios_declarados:      number
  funcionarios_minimos_exigidos: number
  observacoes:                  string[]
}

// ── 7. Contrato do Contador + DHP ─────────────────────────────────────────────

export interface ResultadoContratoContador {
  resultado:                  ResultadoDoc
  vigencia_inicio:            string    // DD/MM/AAAA ou ""
  vigencia_fim:               string    // DD/MM/AAAA ou ""
  vigencia_indeterminada:     boolean
  vigencia_cobre_data_atual:  boolean
  dhp_encontrada:             boolean
  dhp_vigente:                boolean
  observacoes:                string[]
}

// ── 8. Licença ANVISA ─────────────────────────────────────────────────────────

export interface ResultadoLicencaANVISA {
  resultado:                 ResultadoDoc
  numero_autorizacao:        string
  razao_social_licenca:      string
  atividade_autorizada:      string
  vigencia_fim:              string    // DD/MM/AAAA ou ""
  vigencia_cobre_data_atual: boolean
  observacoes:               string[]
}

// ── Resultado consolidado ─────────────────────────────────────────────────────

export interface ResultadoDocumentos {
  contrato_social:      ResultadoContratoSocial
  docs_socios:          ResultadoDocsSocios
  imovel:               ResultadoImovel
  comprovante_endereco: ResultadoComprovanteEndereco
  ir_socios:            ResultadoIRSocios
  rais_gfip:            ResultadoRAISGFIP
  contrato_contador:    ResultadoContratoContador
  licenca_anvisa:       ResultadoLicencaANVISA
  data_analise:         string
}
