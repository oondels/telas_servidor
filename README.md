# servidor-telas

API REST para controle de telas de serigrafia da DASS. O projeto foi refatorado para TypeScript com Clean Architecture, TypeORM e autenticação externa via JWT em cookie.

## Stack

- Node.js
- TypeScript
- Express 5
- TypeORM
- PostgreSQL
- Zod
- JWT via cookie

## Arquitetura

```text
src/
  config/           # configuração centralizada e validada
  shared/           # utilitários, erros, auth context e tipos
  infrastructure/   # TypeORM, bootstrap HTTP, middlewares e composição
  modules/
    telas/
      domain/
      application/
      infrastructure/
      presentation/
    solicitacoes/
      domain/
      application/
      infrastructure/
      presentation/
  server.ts         # bootstrap da aplicação
```

## Variáveis de ambiente

As variáveis são carregadas e validadas em `src/config/env.ts`.

```env
NODE_ENV=development
API_PORT=3041
USERS=
PASS=
IP=
PORT=5432
DBASE=
JWT_SECRET=
JWT_COOKIE_NAME=token
CORS_ORIGIN=*
```

## Instalação e execução

```bash
npm install

# desenvolvimento
npm run dev

# validação de tipos
npm run check

# build
npm run build

# produção
npm run start
```

## Autenticação

O backend assume autenticação externa. As rotas de negócio usam middleware que:

- lê o token JWT do cookie configurado em `JWT_COOKIE_NAME`
- valida a assinatura com `JWT_SECRET`
- injeta o payload em `req.user`

Rotas públicas:

- `GET /`
- `GET /health`

As demais rotas exigem token válido.

## Endpoints

### Telas

| Método | Rota | Descrição |
|---|---|---|
| GET | `/buscar-telas` | Lista telas com filtros e paginação |
| POST | `/cadastrar-tela` | Cadastra uma nova tela |
| PUT | `/editar-tela` | Edita dados de uma tela |
| PUT | `/atualizar-posicao` | Atualiza endereço de telas |
| PUT | `/atualizar-status` | Atualiza status de telas |

### Solicitações de Telas

| Método | Rota | Descrição |
|---|---|---|
| GET | `/solicitacoes-telas` | Lista solicitações com filtros |
| GET | `/solicitacoes-telas/:id` | Busca uma solicitação pelo ID |
| POST | `/solicitacoes-telas` | Cria nova solicitação |
| PUT | `/solicitacoes-telas/:id/attend` | Aceita ou recusa o pedido |
| PUT | `/solicitacoes-telas/:id/start` | Inicia gravação ou move para manutenção |
| PUT | `/solicitacoes-telas/:id/complete` | Conclui a gravação |
| PUT | `/solicitacoes-telas/:id/deliver` | Registra retirada da tela |
| PUT | `/solicitacoes-telas/:id/return` | Registra devolução da tela |

## Banco de dados

Tabelas utilizadas:

- `fabrica.controle_telas_prateleiras`
- `fabrica.solicitacao_tela`

O bootstrap verifica e ajusta o schema legado de `fabrica.controle_telas_prateleiras` no startup. O schema de `fabrica.solicitacao_tela` é validado e reportado no health check.
