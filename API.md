# API — Telas Servidor

> Todas as rotas de negócio utilizam o prefixo `/v1`, exigem JWT válido no cookie `JWT_COOKIE_NAME` e usuário ativo em `fabrica.telas_usuarios`.

---

## Públicas

### Status da API
`GET /`

```
curl http://localhost:3000/
```

---

### Health Check
`GET /health`

Valida a API e a conexão com PostgreSQL via `SELECT 1`.

```
curl http://localhost:3000/health
```

---

## Autenticação e Usuário

### Meu perfil
`GET /v1/me`

Retorna o usuário interno ativo e o payload JWT recebido.

```
curl http://localhost:3000/v1/me \
  --cookie "jwt=<token>"
```

---

## Usuários

> Requer papel `ADMIN`.

### Listar usuários
`GET /v1/users`

Query params: `search`, `role`, `active`, `page`, `itemsPerPage`.

```
curl "http://localhost:3000/v1/users?search=joao&role=OPERADOR_TELAS&active=true&page=1&itemsPerPage=20" \
  --cookie "jwt=<token>"
```

---

### Criar usuário
`POST /v1/users`

```
curl -X POST http://localhost:3000/v1/users \
  --cookie "jwt=<token>" \
  -H "Content-Type: application/json" \
  -d '{
    "matricula": 3020495,
    "nome": "João Silva",
    "usuario": "JOAO.SILVA",
    "setor": "AUTOMACAO",
    "unidade": "SEST",
    "role": "OPERADOR_TELAS",
    "active": true
  }'
```

Papéis permitidos: `ADMIN`, `OPERADOR_TELAS`, `MOVIMENTADOR`, `USUARIO_PRODUCAO`.

---

### Editar usuário
`PATCH /v1/users/:id`

```
curl -X PATCH http://localhost:3000/v1/users/42 \
  --cookie "jwt=<token>" \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "João Atualizado",
    "role": "MOVIMENTADOR",
    "active": true
  }'
```

---

## Telas

### Listar telas
`GET /v1/telas`

Query params: `letra`, `modelo`, `status`, `endereco`, `search`, `page`, `itemsPerPage`.

```
curl "http://localhost:3000/v1/telas?modelo=ABC&status=DISPONIVEL&page=1&itemsPerPage=20" \
  --cookie "jwt=<token>"
```

---

### Telas sem movimentação
`GET /v1/telas/sem-movimentacao`

Lista telas sem movimentação com base no último audit log, com fallback para `updatedate`/`createdate`.

Query params: `days` (sobrescreve limite global), `page`, `itemsPerPage`.

```
curl "http://localhost:3000/v1/telas/sem-movimentacao?days=30&page=1&itemsPerPage=20" \
  --cookie "jwt=<token>"
```

---

### Cadastrar tela
`POST /v1/telas`

> Requer `ADMIN` ou `OPERADOR_TELAS`.

```
curl -X POST http://localhost:3000/v1/telas \
  --cookie "jwt=<token>" \
  -H "Content-Type: application/json" \
  -d '{
    "codigo": "TL-001",
    "modelo": "ABC",
    "letra": "A",
    "marca": "DASS",
    "cor": "1",
    "fios": "43",
    "tamanhoDoQuadro": "10"
  }'
```

---

### Editar tela
`PATCH /v1/telas/:codigo`

> Requer `ADMIN` ou `OPERADOR_TELAS`.

```
curl -X PATCH http://localhost:3000/v1/telas/TL-001 \
  --cookie "jwt=<token>" \
  -H "Content-Type: application/json" \
  -d '{
    "modelo": "XYZ",
    "marca": "DASS"
  }'
```

---

### Atualizar endereço da tela
`PATCH /v1/telas/:codigo/endereco`

> Requer `ADMIN`, `OPERADOR_TELAS` ou `MOVIMENTADOR`.

```
curl -X PATCH http://localhost:3000/v1/telas/TL-001/endereco \
  --cookie "jwt=<token>" \
  -H "Content-Type: application/json" \
  -d '{
    "endereco": "A1"
  }'
```

---

### Atualizar status da tela
`PATCH /v1/telas/:codigo/status`

> Requer `ADMIN` ou `OPERADOR_TELAS`.

```
curl -X PATCH http://localhost:3000/v1/telas/TL-001/status \
  --cookie "jwt=<token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "DESABILITADA"
  }'
```

---

### Registrar reposição de tela
`POST /v1/telas/:codigo/reposicoes`

> Requer `ADMIN` ou `OPERADOR_TELAS`. Mantém o mesmo código de barras.

```
curl -X POST http://localhost:3000/v1/telas/TL-001/reposicoes \
  --cookie "jwt=<token>" \
  -H "Content-Type: application/json" \
  -d '{
    "motivo": "Substituição física",
    "status": "EM_REPOSICAO"
  }'
```

---

## Solicitações

### Listar solicitações
`GET /v1/solicitacoes`

Query params: `status`, `solicitante`, `search`, `dateFrom`/`dataInicial`, `dateTo`/`dataFinal`, `page`, `itemsPerPage`.

```
curl "http://localhost:3000/v1/solicitacoes?status=pendente&page=1&itemsPerPage=20" \
  --cookie "jwt=<token>"
```

---

### Detalhar solicitação
`GET /v1/solicitacoes/:id`

```
curl http://localhost:3000/v1/solicitacoes/99 \
  --cookie "jwt=<token>"
```

---

### Criar solicitação — Tela EXISTENTE
`POST /v1/solicitacoes`

Qualquer usuário ativo pode criar. O sistema buscará uma tela compatível com as características exatas ou fará um auto-cadastro (se configurado). Pula a etapa de gravação e vai direto para separação caso não seja feito o auto-cadastro.

```
curl -X POST http://localhost:3000/v1/solicitacoes \
  --cookie "jwt=<token>" \
  -H "Content-Type: application/json" \
  -d '{
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
  }'
```

*Nota: Os campos `fios` e `cor` só são obrigatórios se o auto-cadastro estiver ativado e a tela não for encontrada.*

---



---

### Criar solicitação — REPOSIÇÃO
`POST /v1/solicitacoes`

Solicita a gravação de uma nova tela para repor uma estragada.

```
curl -X POST http://localhost:3000/v1/solicitacoes \
  --cookie "jwt=<token>" \
  -H "Content-Type: application/json" \
  -d '{
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
    ],
    "motivo": "Tela furada na produção",
    "observacao_pedido": "",
    "turno_pedido": "A"
  }'
```

*Nota: `tamanhoDoQuadro` é exigido apenas se o auto-cadastro estiver ativado e a tela não for encontrada (precisar ser recriada).*

---

### Atendimento (aceitar/reprovar)
`PATCH /v1/solicitacoes/:id/atendimento`

> Requer `ADMIN`, `OPERADOR_TELAS` ou `MOVIMENTADOR`.

```
curl -X PATCH http://localhost:3000/v1/solicitacoes/99/atendimento \
  --cookie "jwt=<token>" \
  -H "Content-Type: application/json" \
  -d '{
    "decision": "aceito",
    "observacao_conferente": "Obrigatória apenas para reprovado"
  }'
```

---

### Iniciar solicitação
`PATCH /v1/solicitacoes/:id/inicio`

> Requer `ADMIN`, `OPERADOR_TELAS` ou `MOVIMENTADOR`. Move para `gravacao` ou `setor_em_manutencao`.

```
curl -X PATCH http://localhost:3000/v1/solicitacoes/99/inicio \
  --cookie "jwt=<token>"
```

---

### Concluir solicitação
`PATCH /v1/solicitacoes/:id/conclusao`

> Requer `ADMIN`, `OPERADOR_TELAS` ou `MOVIMENTADOR`. Move de `gravacao` para `concluido`.

```
curl -X PATCH http://localhost:3000/v1/solicitacoes/99/conclusao \
  --cookie "jwt=<token>"
```

---

### Entregar solicitação
`PATCH /v1/solicitacoes/:id/entrega`

> Requer `ADMIN`, `OPERADOR_TELAS` ou `MOVIMENTADOR`. Move de `concluido` para `entregue`.

`user_conferente` deve ser a matrícula do usuário autenticado.

```
curl -X PATCH http://localhost:3000/v1/solicitacoes/99/entrega \
  --cookie "jwt=<token>" \
  -H "Content-Type: application/json" \
  -d '{
    "user_recebimento": 3012345,
    "user_conferente": 3020495
  }'
```

---

### Devolver solicitação
`PATCH /v1/solicitacoes/:id/devolucao`

> Requer `ADMIN`, `OPERADOR_TELAS` ou `MOVIMENTADOR`. Move de `entregue` para `devolvido`.

```
curl -X PATCH http://localhost:3000/v1/solicitacoes/99/devolucao \
  --cookie "jwt=<token>" \
  -H "Content-Type: application/json" \
  -d '{
    "user_recebimento": 3012345,
    "user_conferente": 3020495,
    "observacao_conferente": "Motivo da devolução"
  }'
```

---

## Configuração

### Consultar limite de telas sem movimentação
`GET /v1/config/telas-sem-movimentacao`

```
curl http://localhost:3000/v1/config/telas-sem-movimentacao \
  --cookie "jwt=<token>"
```

---

### Atualizar limite de telas sem movimentação
`PATCH /v1/config/telas-sem-movimentacao`

> Requer `ADMIN`.

```
curl -X PATCH http://localhost:3000/v1/config/telas-sem-movimentacao \
  --cookie "jwt=<token>" \
  -H "Content-Type: application/json" \
  -d '{
    "days": 60
  }'
```

---

### Consultar flag de auto-cadastro em solicitações
`GET /v1/config/auto-cadastro-telas`

```
curl http://localhost:3000/v1/config/auto-cadastro-telas \
  --cookie "jwt=<token>"
```

---

### Atualizar flag de auto-cadastro em solicitações
`PATCH /v1/config/auto-cadastro-telas`

> Requer `ADMIN`.

```
curl -X PATCH http://localhost:3000/v1/config/auto-cadastro-telas \
  --cookie "jwt=<token>" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": false
  }'
```

---

## Testes e Debug

### Testar amarração de telas (findStrictMatch)
`POST /v1/telas/match`

> Requer papel `ADMIN`. Não cria nem edita nada, apenas retorna as telas ativas que batem com os critérios exatos fornecidos (mesma lógica de amarração automática usada no fluxo de solicitações de telas existentes).

**Payload de Requisição:**

- `marca` (string, obrigatório): Marca da tela (ex: "DASS")
- `modelo` (string, obrigatório): Modelo do calçado (ex: "ABC")
- `numero` (string, obrigatório): Número da tela/tamanho (ex: "42")
- `pecas` (array de strings, obrigatório): Lista de peças (ex: `["LATERAL"]`)
- `fios` (string, opcional): Contagem de fios (ex: "43")

**Exemplo de Requisição (cURL):**
```bash
curl -X POST http://localhost:3000/v1/telas/match \
  --cookie "jwt=<token>" \
  -H "Content-Type: application/json" \
  -d '{
    "marca": "DASS",
    "modelo": "ABC",
    "numero": "42",
    "pecas": ["LATERAL"],
    "fios": "43"
  }'
```

**Exemplo de Resposta (200 OK):**
```json
{
  "erro": false,
  "requestId": "d80b6214-3860-449e-ba23-be1209b110bc",
  "matches": [
    {
      "id": 15,
      "codbarrastela": "TL-ABC-123",
      "marca": "DASS",
      "modelo": "ABC",
      "numerotela": "42",
      "cor": 1,
      "fios": 43,
      "datafabricacao": "2026-05-27T00:00:00.000Z",
      "pecas": "[\"LATERAL\"]",
      "tamanho_etiqueta": null,
      "status": "DISPONIVEL",
      "endereco": "A-12",
      "createdate": "2026-05-27T08:00:00.000Z",
      "updatedate": "2026-05-27T08:30:00.000Z"
    }
  ],
  "total": 1
}
```

---

## Auditoria

### Consultar histórico de eventos
`GET /v1/audit-events`

> Requer `ADMIN`.

Query params: `entityType`, `entityId`, `action`, `actorMatricula`, `page`, `itemsPerPage`.

```
curl "http://localhost:3000/v1/audit-events?entityType=TELA&actorMatricula=3020495&page=1&itemsPerPage=20" \
  --cookie "jwt=<token>"
```
