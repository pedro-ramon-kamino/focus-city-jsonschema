---
description: Gerar documentação JSON para uma cidade específica
---

# Workflow: Gerar Documentação de Cidade

Este workflow gera um arquivo `doc.json` para uma cidade específica, comparando seu schema com os padrões municipal e nacional da Focus NFe.

## Como usar

Execute o workflow passando o nome da cidade no formato: `nome_cidade_uf`

Exemplo: `/generate-city-doc sao_paulo_sp`

## Passos do Workflow

### 1. Validar entrada e localizar arquivos da cidade

Verifique se o diretório `work/guides/{cidade}` existe e contém os arquivos necessários:
- `{cidade}-schema.json` - Schema JSON da cidade
- `{cidade}-json-docs.json` - Documentação dos campos (obrigatórios, opcionais, ignorados)

### 2. Ler os schemas de referência

Leia os seguintes arquivos para comparação:

**Padrão Municipal (NFSe)** - Campos principais:
- `data_emissao`, `natureza_operacao`, `regime_especial_tributacao`, `optante_simples_nacional`, `incentivador_cultural`
- `prestador`: `cnpj`, `inscricao_municipal`, `codigo_municipio`
- `tomador`: `cpf`, `cnpj`, `nif`, `motivo_ausencia_nif`, `inscricao_municipal`, `razao_social`, `telefone`, `email`, `endereco.*`
- `servico`: `valor_servicos`, `valor_deducoes`, `valor_pis`, `valor_cofins`, `valor_inss`, `valor_ir`, `valor_csll`, `iss_retido`, `valor_iss`, `valor_iss_retido`, `outras_retencoes`, `base_calculo`, `aliquota`, `desconto_incondicionado`, `desconto_condicionado`, `item_lista_servico`, `codigo_cnae`, `codigo_tributario_municipio`, `discriminacao`, `codigo_municipio`, `percentual_total_tributos`, `fonte_total_tributos`

**Padrão Nacional (NFSe Nacional)** - Campos principais:
- `data_emissao`, `serie_dps`, `numero_dps`, `data_competencia`, `emitente_dps`, `codigo_municipio_emissora`
- `cnpj_prestador`, `nif_prestador`, `codigo_opcao_simples_nacional`, `regime_especial_tributacao`
- `cnpj_tomador`, `cpf_tomador`, `nif_tomador`, `motivo_ausencia_nif_tomador`
- `codigo_municipio_prestacao`, `codigo_tributacao_nacional_iss`, `descricao_servico`, `valor_servico`, `tributacao_iss`

### 3. Processar schema da cidade

Para cada campo no schema da cidade (`{cidade}-schema.json`):

a) Extrair informações do campo:
   - Nome do campo (path completo, ex: `servico.codigo_indicador_operacao`)
   - Tipo de dado (`type`)
   - Descrição (`description`)
   - Valores possíveis (`enum`, se aplicável)

b) Verificar obrigatoriedade no arquivo `{cidade}-json-docs.json`:
   - `required: true` se o campo está em `obrigatorios`
   - `required: false` se o campo está em `opcionais`
   - `proibido: true` se o campo está em `ignorados`

c) Comparar com padrões:
   - `mapeadoNFSe: true` se o campo existe no padrão municipal
   - `mapeadoNacional: true` se o campo existe no padrão nacional
   - Se não está em nenhum dos dois, é um campo exclusivo da cidade

d) Identificar campos da Reforma Tributária:
   - `reformaTributaria: true` se a descrição contém `<sup>(RT)</sup>` ou menciona "Reforma Tributária"

### 4. Gerar estrutura do doc.json

Organize os campos em uma estrutura hierárquica seguindo o formato:

```json
{
  "campo_raiz": {
    "campo_aninhado": {
      "type": "string|number|boolean|enum|object|array",
      "values": [1, 2, 3],
      "description": "Descrição do campo",
      "mapeadoNFSe": true|false,
      "mapeadoNacional": true|false,
      "required": true|false,
      "proibido": true|false,
      "reformaTributaria": true|false
    }
  }
}
```

**Regras importantes:**
- Campos do tipo `enum` devem incluir o array `values`
- Campos proibidos têm `proibido: true`
- Campos obrigatórios têm `required: true`
- Omitir propriedades `false` para reduzir verbosidade (exceto `required` e `proibido` que devem sempre aparecer)
- Preservar a hierarquia de objetos aninhados (ex: `servico.valor_servicos`)

### 5. Salvar o arquivo

Salve o arquivo gerado em: `work/guides/{cidade}/doc.json`

### 6. Validar resultado

Verifique se:
- O arquivo foi criado com sucesso
- Todos os campos obrigatórios foram processados
- A estrutura JSON está válida
- Os mapeamentos estão corretos

## Exemplo de Output

Para o campo `servico.codigo_indicador_operacao` em São Paulo:

```json
{
  "servico": {
    "codigo_indicador_operacao": {
      "type": "enum",
      "values": [1, 2, 3, 4, 5, 6],
      "description": "Conforme tabela 'código indicador de operação'",
      "mapeadoNFSe": false,
      "mapeadoNacional": false,
      "required": true,
      "proibido": false,
      "reformaTributaria": true
    }
  }
}
```

## Notas

- Este workflow processa apenas campos específicos da cidade que diferem dos padrões
- Campos da Reforma Tributária são marcados automaticamente
- A comparação com padrões ajuda a identificar campos customizados por município
