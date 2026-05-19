# Backend Routes

Todas as rotas de negocio sao protegidas por `verifyToken`, que le o JWT do cookie configurado em `JWT_COOKIE_NAME`, valida com `JWT_SECRET` e injeta o payload em `req.user`.

## Publicas

### `GET /`

Retorna status basico da API.

Resposta `200`:

```json
{
  "message": "Servidor de Telas ativo"
}
```

### `GET /health`

Executa `SELECT 1` no PostgreSQL e retorna saude da API e banco.

Resposta `200`:

```json
{
  "message": "healthy",
  "db": true
}
```

## Telas

### `GET /buscar-telas`

Busca telas com filtros e paginacao.

Query params:

- `letra`
- `modelo`
- `status`
- `endereco`
- `search`
- `page` (padrao `1`)
- `itemsPerPage` (padrao `10`, maximo `200`)

Resposta `200`: resultado paginado retornado pelo repository de telas.

### `POST /cadastrar-tela`

Cadastra uma tela. O usuario responsavel vem do JWT (`usuario` ou `matricula`).

Body: dados de tela aceitos por `CreateTelaInput`.

Resposta `201`:

```json
{
  "message": "success",
  "id": 1,
  "tela": {}
}
```

### `PUT /atualizar-posicao`

Atualiza endereco de uma ou mais telas.

Body:

```json
{
  "telas": "TELA1/TELA2",
  "endereco": "A1/B2"
}
```

Regras:

- `telas` aceita valores separados por `/`.
- `endereco` aceita um unico endereco para todas as telas ou uma lista com a mesma quantidade de telas.

Resposta `200`:

```json
{
  "message": "success",
  "atualizadas": 2
}
```

### `PUT /atualizar-status`

Atualiza status de uma ou mais telas.

Body:

```json
{
  "telas": "TELA1/TELA2",
  "status": "ARMAZENADA"
}
```

Resposta `200`:

```json
{
  "message": "success",
  "atualizadas": 2,
  "status": "ARMAZENADA"
}
```

### `PUT /editar-tela`

Edita uma tela pelo codigo de barras.

Body:

```json
{
  "codbarrastela": "ABC123"
}
```

Tambem aceita `codBarrasTela` como alias do codigo.

Resposta `200`:

```json
{
  "message": "success",
  "tela": {}
}
```

## Solicitacoes

### `GET /solicitacoes-telas`

Busca solicitacoes com filtros e paginacao.

Query params:

- `status`
- `solicitante`
- `search`
- `dateFrom` ou `dataInicial`
- `dateTo` ou `dataFinal`
- `page` (padrao `1`)
- `itemsPerPage` (padrao `10`, maximo `200`)

Resposta `200`: resultado paginado de solicitacoes.

### `GET /solicitacoes-telas/:id`

Busca uma solicitacao por id.

Resposta `200`:

```json
{
  "solicitacao": {}
}
```

### `POST /solicitacoes-telas`

Cria uma solicitacao. A matricula do solicitante vem do JWT.

Body:

```json
{
  "items": [],
  "motivo": "texto opcional",
  "observacao_pedido": "texto opcional",
  "turno_pedido": "A"
}
```

Tambem aceita itens em `dados_pedido.items`.

Resposta `201`:

```json
{
  "message": "success",
  "solicitacao": {}
}
```

### `PUT /solicitacoes-telas/:id/attend`

Atende uma solicitacao com decisao de aceite ou reprovacao.

Body:

```json
{
  "decision": "aceito",
  "observacao_conferente": "texto obrigatorio para reprovado"
}
```

Tambem aceita `status` como alias de `decision`.

Resposta `200`:

```json
{
  "message": "success",
  "solicitacao": {}
}
```

### `PUT /solicitacoes-telas/:id/start`

Inicia a etapa operacional seguinte da solicitacao.

Body:

```json
{
  "status": "gravacao"
}
```

Tambem aceita `targetStatus`.

Resposta `200`:

```json
{
  "message": "success",
  "solicitacao": {}
}
```

### `PUT /solicitacoes-telas/:id/complete`

Conclui uma solicitacao em andamento.

Resposta `200`:

```json
{
  "message": "success",
  "solicitacao": {}
}
```

### `PUT /solicitacoes-telas/:id/deliver`

Registra entrega.

Body:

```json
{
  "user_recebimento": 3012345,
  "user_conferente": 3020495
}
```

`user_conferente` deve ser a matricula do usuario autenticado.

Resposta `200`:

```json
{
  "message": "success",
  "solicitacao": {}
}
```

### `PUT /solicitacoes-telas/:id/return`

Registra devolucao.

Body:

```json
{
  "user_recebimento": 3012345,
  "user_conferente": 3020495,
  "observacao_conferente": "motivo da devolucao"
}
```

`user_conferente` deve ser a matricula do usuario autenticado.

Resposta `200`:

```json
{
  "message": "success",
  "solicitacao": {}
}
```
