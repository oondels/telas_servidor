# Backend Routes

As rotas publicas permanecem em `/` e `/health`. Toda API de negocio usa `/v1`, exige JWT valido no cookie `JWT_COOKIE_NAME` e exige usuario ativo em `fabrica.telas_usuarios`.

## Publicas

- `GET /`: status basico da API.
- `GET /health`: valida API e PostgreSQL com `SELECT 1`.

## Autenticacao e Usuario

### `GET /v1/me`

Retorna o usuario interno ativo e o payload JWT recebido.

## Usuarios

Requer `ADMIN`.

- `GET /v1/users`: lista usuarios por `search`, `role`, `active`, `page`, `itemsPerPage`.
- `POST /v1/users`: cria usuario interno.
- `PATCH /v1/users/:id`: atualiza matricula, nome, usuario, setor, unidade, papel e ativo.
- `DELETE /v1/users/:id`: exclui o usuário interno. Não permite excluir o próprio usuário nem o último administrador ativo.

Body de criacao/edicao:

```json
{
  "matricula": 3020495,
  "nome": "Nome",
  "usuario": "USUARIO.SOBRENOME",
  "setor": "AUTOMACAO",
  "unidade": "SEST",
  "role": "ADMIN",
  "active": true
}
```

Papeis permitidos:

- `ADMIN`
- `OPERADOR_TELAS`
- `MOVIMENTADOR`
- `USUARIO_PRODUCAO`

## Telas

### `GET /v1/telas`

Lista telas com `letra`, `modelo`, `status`, `endereco`, `search`, `page`, `itemsPerPage`.

### `GET /v1/telas/sem-movimentacao`

Lista telas sem movimentacao pelo ultimo audit log de `TELA`, com fallback para `updatedate`/`createdate`.

Query:

- `days`: sobrescreve temporariamente o limite global.
- `page`
- `itemsPerPage`

### `POST /v1/telas`

Requer `ADMIN` ou `OPERADOR_TELAS`. Cadastra tela.

### `POST /v1/telas/lote`

Requer `ADMIN` ou `OPERADOR_TELAS`. Cadastra de 2 a 10 telas físicas independentes, com as especificações que forem enviadas para cada item. A operação é transacional: se qualquer item falhar, nenhuma tela é cadastrada.

Cada item deve possuir um `codbarrastela` distinto; marca, modelo, número, cor, fios, peças, data de fabricação, SKU e tamanho da etiqueta podem ser iguais entre as telas. O status não é aceito no payload e começa como `SEM_ENDERECO`.

Body:

```json
{
  "telas": [
    {
      "codbarrastela": "2800842",
      "marca": "FILA",
      "modelo": "ACD CLASSIC",
      "numerotela": "12",
      "cor": "124",
      "fios": 14,
      "datafabricacao": "2026-07-23",
      "pecas": ["fitaElastico"],
      "tamanhoEtiqueta": "70X40mm"
    },
    {
      "codbarrastela": "2800843",
      "marca": "FILA",
      "modelo": "ACD CLASSIC",
      "numerotela": "12",
      "cor": "124",
      "fios": 14,
      "datafabricacao": "2026-07-23",
      "pecas": ["fitaElastico"],
      "tamanhoEtiqueta": "70X40mm"
    }
  ]
}
```

### `PATCH /v1/telas/:codigo`

Requer `ADMIN` ou `OPERADOR_TELAS`. Edita tela pelo codigo de barras. Os campos `status` e `endereco` não são aceitos; localização e status são gerenciados pelo fluxo de endereçamento.

### `PATCH /v1/telas/:codigo/endereco`

Requer `ADMIN`, `OPERADOR_TELAS` ou `MOVIMENTADOR`. Atualiza endereco da tela.

Body:

```json
{
  "endereco": "A1"
}
```

Se a tela já estiver alocada em outro endereço, ela será transferida automaticamente para o novo destino, respeitando a capacidade disponível. O status passa para `PRODUCAO` no destino de produção ou `ARMAZENADA` no destino de inventário.

### `DELETE /v1/telas/:codigo/endereco`

Requer `ADMIN` ou `OPERADOR_TELAS`. Remove somente o endereço físico da tela, preserva seu cadastro e define o status `SEM_ENDERECO`.

### `POST /v1/telas/batch-remover-endereco`

Requer `ADMIN` ou `OPERADOR_TELAS`. Remove os endereços das telas informadas, preserva seus cadastros e define o status `SEM_ENDERECO`.

### `POST /v1/enderecos/:id/limpar`

Requer `ADMIN` ou `OPERADOR_TELAS`. Libera todas as telas ocupando o endereço, sem excluir o endereço nem os cadastros das telas, e define `SEM_ENDERECO`. Retorna o endereço e a quantidade de `telasLiberadas`.

### `DELETE /v1/telas/:codigo`

Requer `ADMIN` ou `OPERADOR_TELAS`. Exclui permanentemente a tela pelo código de barras.

A operação é bloqueada com `409 TELA_COM_SOLICITACAO_ATIVA` quando a tela estiver vinculada a solicitação com status ativo (`pedido`, `aceito`, `gravacao`, `setor_em_manutencao`, `concluido` ou `entregue`).

### `POST /v1/telas/batch-excluir`

Requer `ADMIN` ou `OPERADOR_TELAS`. Exclui permanentemente as telas informadas e aplica a mesma validação de solicitações ativas.

### `POST /v1/telas/:codigo/reposicoes`

Requer `ADMIN` ou `OPERADOR_TELAS`. Registra reposicao mantendo a mesma tela/codigo.

Body minimo:

```json
{
  "motivo": "Substituicao fisica"
}
```

## Solicitacoes

### `GET /v1/solicitacoes`

Lista solicitacoes com `status`, `solicitante`, `search`, `dateFrom`/`dataInicial`, `dateTo`/`dataFinal`, `page`, `itemsPerPage`.

### `GET /v1/solicitacoes/:id`

Detalha uma solicitacao.

### `POST /v1/solicitacoes`

Cria solicitacao para a matricula autenticada. Qualquer usuario ativo pode criar.
Aceita dois `tipo` de solicitações: `EXISTENTE` (padrão) ou `REPOSICAO`.

A resolução da tela solicitada é feita por busca estrita de características (marca, modelo, número, peças, fios).

Body para tela `EXISTENTE` (pula a gravação e vai para separação):

```json
{
  "tipo": "EXISTENTE",
  "items": [
    {
      "marca": "DASS",
      "modelo": "ABC",
      "numero": "1",
      "pecas": ["LATERAL"],
      "fios": "43",
      "cor": "1"
    }
  ],
  "motivo": "Producao",
  "observacao_pedido": "Opcional",
  "turno_pedido": "A"
}
```

*Nota: Os campos `fios` e `cor` só são obrigatórios se o auto-cadastro estiver ativado e a tela não for encontrada.*

Body para `REPOSICAO`:

```json
{
  "tipo": "REPOSICAO",
  "items": [
    {
      "marca": "DASS",
      "modelo": "ABC",
      "numero": "1",
      "pecas": ["LATERAL"],
      "fios": "43",
      "cor": "1",
      "tamanhoDoQuadro": "10"
    }
  ]
}
```

*Nota: `tamanhoDoQuadro` é exigido apenas se o auto-cadastro estiver ativado e a tela não for encontrada (precisar ser recriada).*

**Respostas Possíveis**:
- `201 Created`: Sucesso, solicitação criada.
- `400 Bad Request`: Payload inválido, ou `DADOS_INCOMPLETOS_AUTO_CADASTRO` se auto-cadastro ativado e faltar campos, ou config desativada e tela não encontrada.
- `404 Not Found`: `TELA_NAO_ENCONTRADA` (se auto-cadastro estiver inativo).
- `409 Conflict`: `MULTIPLAS_TELAS_ENCONTRADAS` - Mais de uma tela compatível. Retorna lista em `details.matches` para resolução.

Tambem aceita itens em `dados_pedido.items`.

### `PATCH /v1/solicitacoes/:id/atendimento`

Requer `ADMIN`, `OPERADOR_TELAS` ou `MOVIMENTADOR`. Aceita ou reprova.

Body:

```json
{
  "decision": "aceito",
  "observacao_conferente": "Obrigatoria para reprovado"
}
```

### `PATCH /v1/solicitacoes/:id/inicio`

Requer `ADMIN`, `OPERADOR_TELAS` ou `MOVIMENTADOR`. Move para `gravacao` ou `setor_em_manutencao`.

### `PATCH /v1/solicitacoes/:id/conclusao`

Requer `ADMIN`, `OPERADOR_TELAS` ou `MOVIMENTADOR`. Move de `gravacao` para `concluido`.

### `PATCH /v1/solicitacoes/:id/entrega`

Requer `ADMIN`, `OPERADOR_TELAS` ou `MOVIMENTADOR`. Move de `concluido` para `entregue`.

Body:

```json
{
  "user_recebimento": 3012345,
  "user_conferente": 3020495
}
```

`user_conferente` deve ser a matricula autenticada.

### `PATCH /v1/solicitacoes/:id/devolucao`

Requer `ADMIN`, `OPERADOR_TELAS` ou `MOVIMENTADOR`. Move de `entregue` para `devolvido`.

Body:

```json
{
  "user_recebimento": 3012345,
  "user_conferente": 3020495,
  "observacao_conferente": "Motivo"
}
```

## Configuracao

- `GET /v1/config/telas-sem-movimentacao`: consulta limite global de dias.
- `PATCH /v1/config/telas-sem-movimentacao`: requer `ADMIN`, atualiza `days`.
- `GET /v1/config/auto-cadastro-telas`: consulta status do auto-cadastro (booleano).
- `PATCH /v1/config/auto-cadastro-telas`: requer `ADMIN`, atualiza `enabled` (booleano).

## Teste e Debug

### `POST /v1/telas/match`

Requer `ADMIN`. Testa a lógica de busca estrita de telas (`findStrictMatch`) retornando as correspondências sem criar nenhuma solicitação.

Body:

```json
{
  "marca": "DASS",
  "modelo": "ABC",
  "numero": "1",
  "pecas": ["LATERAL"],
  "fios": "43"
}
```

## Endereços e Endereçamento em Lote

### `GET /v1/enderecos`
Requer `ADMIN`, `OPERADOR_TELAS` ou `MOVIMENTADOR`. Lista todos os endereços de telas cadastrados com estatísticas de ocupação e os campos `tipo`, `nome` e `numero`.

### `POST /v1/enderecos`
Requer `ADMIN` ou `OPERADOR_TELAS`. Cadastra um endereço de inventário ou produção, sempre com quantidade limite de vagas.

Body para inventário:

```json
{
  "tipo": "INVENTARIO",
  "address": "01-01-01",
  "vagas": 23
}
```

Body para produção:

```json
{
  "tipo": "PRODUCAO",
  "nome": "PROD",
  "numero": 1,
  "vagas": 10
}
```

O endereço de produção será normalizado para `PROD-01`; neste momento, `PROD` é o único nome permitido.

Respostas de erro relevantes:

- `400 ENDERECO_OBRIGATORIO`, `FORMATO_INVALIDO`, `VAGAS_INVALIDAS` ou `DADOS_ENDERECO_INCOMPLETOS` para dados inválidos;
- `409 ENDERECO_DUPLICADO` quando o endereço ou seu código de barras já estiver cadastrado;
- `500 SEQUENCIA_ENDERECO_INVALIDA` quando o banco não conseguir gerar o identificador do novo endereço.

### `GET /v1/enderecos/:barcode`
Requer `ADMIN`, `OPERADOR_TELAS` ou `MOVIMENTADOR`. Consulta detalhes de um endereço específico pelo seu código de barras.

### `PATCH /v1/enderecos/:id/vagas`
Requer `ADMIN` ou `OPERADOR_TELAS`. Atualiza a capacidade de vagas de um endereço.
Body:
```json
{
  "vagas": 30
}
```

### `DELETE /v1/enderecos/:id`
Requer `ADMIN`. Remove um endereço se não houver nenhuma tela associada a ele.

### `PATCH /v1/telas/batch-endereco`
Requer `ADMIN`, `OPERADOR_TELAS` ou `MOVIMENTADOR`. Realiza o endereçamento em lote de várias telas de uma vez para um endereço específico, transferindo automaticamente as telas alocadas em outros endereços, validando a capacidade disponível e atualizando o status conforme o tipo do destino.
Body:
```json
{
  "endereco": "01-01-01",
  "telas": ["TL-ABC-1", "TL-ABC-2"]
}
```

As antigas rotas `PATCH /v1/telas/:codigo/status` e `PATCH /v1/telas/batch-status` não fazem mais parte da API; o status de localização é automático.

## Auditoria

### `GET /v1/audit-events`

Requer `ADMIN`. Consulta historico por `entityType`, `entityId`, `action`, `actorMatricula`, `page`, `itemsPerPage`.
