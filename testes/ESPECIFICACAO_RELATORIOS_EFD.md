# Especificação dos Relatórios EFD
## Sistema de Credenciamento de Atacadista de Medicamentos — SEFAZ-MA

---

## CSV 1 — Faturamento Mensal

**Finalidade:** Verificar REQ-4 (faturamento x entradas) e REQ-5 (faturamento mínimo de R$ 4M)  
**Período:** Últimos 12 meses de atividade anteriores ao pedido  
**Uma linha por competência (12 linhas)**

### Bloco e Registros da EFD

| Dado | Bloco/Registro | Campo | Observação |
|---|---|---|---|
| Competência | E001/E100 | DT_INI | Mês/ano de referência |
| Total Entradas | C190 | SUM(VL_OPR) | CFOP iniciado em 1 ou 2 |
| Total Saídas | C190 | SUM(VL_OPR) | CFOP iniciado em 5 ou 6 |

### Consulta SQL sugerida (adaptada ao banco da SEFAZ)

```sql
SELECT
  c190.cnpj                              AS cnpj,
  TO_CHAR(c100.dt_doc, 'MM/YYYY')        AS competencia,
  SUM(CASE WHEN LEFT(c190.cfop,1) IN ('1','2') THEN c190.vl_opr ELSE 0 END)
                                         AS valor_total_entradas,
  SUM(CASE WHEN LEFT(c190.cfop,1) IN ('5','6') THEN c190.vl_opr ELSE 0 END)
                                         AS valor_total_saidas
FROM efd_c190 c190
JOIN efd_c100 c100 ON c100.id = c190.id_c100
WHERE c100.cnpj = :cnpj
  AND c100.dt_doc BETWEEN :data_inicio AND :data_fim
GROUP BY c190.cnpj, TO_CHAR(c100.dt_doc, 'MM/YYYY')
ORDER BY MIN(c100.dt_doc)
```

### Formato de saída aceito pelo sistema

O sistema aceita **dois formatos** para o CSV 1:

#### Formato A — Exportação direta do BI/SEFAZ (recomendado)

Separador ponto-e-vírgula, CNPJ e período como número, **uma linha por sentido de operação** com coluna `IND_OPER`:

```
CNPJ - Número De Inscrição Da Entidade No CNPJ;PERIODO - Periodo Declaração;IND_OPER - Tipo De Operação;VL_OPR - Valor Da Operação;Quantidade
1163981000150,00;202501,00;0;805779,49;106,00
1163981000150,00;202501,00;1;2300139,02;83,00
```

| Campo | Regra de interpretação |
|---|---|
| CNPJ | Número com `,00` — sistema extrai só os dígitos e preenche até 14 |
| PERIODO | AAAAMM com `,00` (ex: `202501,00`) — convertido para `01/2025` |
| IND_OPER | `0` = Entrada · `1` = Saída |
| VL_OPR | Vírgula decimal (ex: `805779,49`) |

O sistema agrupa automaticamente as duas linhas do mesmo mês em uma única competência com `valor_total_entradas` e `valor_total_saidas`.

#### Formato B — CSV simplificado (legado)

Separador vírgula, uma linha por competência com colunas diretas:

```
cnpj,competencia,valor_total_entradas,valor_total_saidas
12345678000199,05/2024,320000.00,480000.00
```

> Usar ponto como separador decimal. Não usar separador de milhar.

---

## CSV 2 — NF-e Emitidas por Item (Saídas)

**Finalidade:** Verificar REQ-6 (70% itens prioritários) e identificar saídas ao grupo econômico para REQ-7  
**Fonte:** Sistema de NF-e emitidas — exportação completa dos itens das notas autorizadas  
**Período:** Últimos 12 meses (ou ano-calendário vigente para renovação)  
**Uma linha por item de nota fiscal**

> ⚠️ **Motivo da mudança:** Na EFD, as notas de saída (C170) não exigem preenchimento do NCM. O NCM obrigatório consta sempre na NF-e eletrônica emitida.

### Colunas utilizadas pelo sistema (por posição)

| Posição | Campo no export | Uso |
|---|---|---|
| 3 | CNPJ ou CPF *(1ª ocorrência — emitente)* | CNPJ do atacadista |
| 6 | CNPJ ou CPF *(2ª ocorrência — destinatário)* | Filtragem do grupo econômico |
| 11 | Ano Mês | Período da operação (YYYYMM → MM/AAAA) |
| 14 | Descrição do Tipo de Operação NFE | Filtro: apenas `SAÍDA` |
| 2 | Descrição da Situação do Documento | Filtro: apenas `AUTORIZADO` |
| 23 | Ncm | Código NCM do produto |
| 28 | Valor Produto | Valor total do item |

O sistema processa o arquivo linha a linha, filtrando apenas notas **AUTORIZADAS** do tipo **SAÍDA** e ignorando itens sem NCM (NCM = 0).

### O que o sistema faz automaticamente

- **Para REQ-6:** agrupa por emitente + período + NCM, soma `Valor Produto` → obtém saídas por NCM
- **Para REQ-7:** filtra linhas cujo CNPJ destinatário consta na lista de varejistas do grupo informada no formulário → obtém saídas ao grupo por NCM (sem necessidade de CSV separado)

### Formato do arquivo (exemplo real)

```
Chave de Acesso NFE,Número NFE,Descrição da Situação do Documento,CNPJ ou CPF,Inscrição Renavam,UF,CNPJ ou CPF,UF,Inscrição Renavam,Razão,Natureza da Operação,Ano Mês,Data,Data Hora de Entrada e Saida,Descrição do Tipo de Operação NFE,Descrição da Finalidade da Emissão,Item NFE,Código do Produto,Descrição do Produto,...,Ncm,...,Valor Produto,...
NFe21250201163981000150...,1598,AUTORIZADO,1163981000150,...,13951441000110,...,FUNDO MUNICIPAL...,VENDA MERC...,202502,2025-02-12,...,SAÍDA,NORMAL,1,01114,ATADURA...,56012190,...,"117,2",...
```

---

## CSV 3 — EFD Entradas por NCM (somente para grupo econômico)

**Finalidade:** Calcular o CMV para verificar o REQ-7 (agregação mínima de 30% nas vendas ao grupo)  
**Obrigatório apenas quando:** contribuinte possui varejistas no mesmo grupo econômico  
**Fonte:** EFD — Bloco C, registros C100 + C170, filtrando CFOPs de entrada (1xxx/2xxx)  
**Período:** Mesmo período do CSV 2

> As notas de **entrada** na EFD têm NCM preenchido (campo vem do fornecedor), por isso a EFD é usada aqui.

### Consulta SQL sugerida

```sql
SELECT
  c100.cnpj                                AS cnpj,
  TO_CHAR(c100.dt_doc, 'MM/YYYY')          AS competencia,
  c170.ncm_ipi                             AS ncm,
  SUM(c170.vl_item)                        AS valor_total_entradas
FROM efd_c170 c170
JOIN efd_c100 c100 ON c100.id = c170.id_c100
WHERE c100.cnpj = :cnpj
  AND LEFT(c100.cfop, 1) IN ('1', '2')
  AND c100.dt_doc BETWEEN :data_inicio AND :data_fim
  AND c170.ncm_ipi IN (
    '3002','3003','3004','3005','5601',
    '40141000','90183210','9018321','2936',
    '39269090','90189099','30066000','30063000',
    '40151100','40151900',
    '40149090','70133','39241000','56011000','48184000',
    '90183100','33061000','96032100','33062000','33069000',
    '48184010','6111','6209'
  )
GROUP BY c100.cnpj, TO_CHAR(c100.dt_doc, 'MM/YYYY'), c170.ncm_ipi
ORDER BY MIN(c100.dt_doc), c170.ncm_ipi
```

### Formato de saída esperado

```
cnpj,competencia,ncm,valor_total_entradas
12345678000199,05/2024,3003,112000.00
12345678000199,05/2024,3004,56000.00
...
```

---

## Observações Gerais

- Os nomes das colunas devem ser **exatamente** como especificado (minúsculas, sem espaços)
- O separador do CSV deve ser **vírgula**
- Valores monetários com **ponto** como separador decimal (ex: `123456.78`)
- Competência no formato **MM/AAAA** (ex: `05/2024`)
- CNPJ sem formatação (apenas números) ou com formatação padrão — o sistema aceita ambos
- NCM pode conter pontos ou não — o sistema normaliza automaticamente
