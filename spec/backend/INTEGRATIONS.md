# Backend Integrations

## PostgreSQL

A aplicacao usa PostgreSQL via TypeORM. A conexao e configurada em `src/config/database.ts` com variaveis validadas em `src/config/env.ts`.

Variaveis de banco:

- `IP`: host do PostgreSQL.
- `PORT`: porta do PostgreSQL, padrao `5432`.
- `USERS`: usuario do banco.
- `PASS`: senha do banco.
- `DBASE`: nome do banco.

## TypeORM

Configuracao atual:

- `synchronize: false`
- `logging: false`
- entities:
  - `TelaOrmEntity`
  - `SolicitacaoOrmEntity`
- migrations:
  - `src/infrastructure/database/migrations/*.ts`
  - `dist/infrastructure/database/migrations/*.js`
- tabela de migrations: `typeorm_migrations`

Entidades principais:

- `fabrica.controle_telas_prateleiras`
- `fabrica.solicitacao_tela`

## Migrations

Scripts disponiveis:

- `npm run migration:generate`
- `npm run migration:run`
- `npm run migration:revert`

Nao habilite `synchronize` em ambientes compartilhados. Alteracoes de schema devem ser feitas por migration.

## Ambiente

Variaveis validadas por Zod:

- `NODE_ENV`: `development`, `test` ou `production`.
- `API_PORT`: porta HTTP, padrao `3041`.
- `USERS`
- `PASS`
- `IP`
- `PORT`
- `DBASE`
- `JWT_SECRET`
- `JWT_COOKIE_NAME`: padrao `token`.
- `CORS_ORIGIN`: padrao `*`.

O arquivo `.env` nao deve ser versionado.

## Autenticacao

A API assume autenticacao externa. O backend:

- le o JWT do cookie configurado por `JWT_COOKIE_NAME`;
- valida a assinatura com `JWT_SECRET`;
- injeta o payload em `req.user`;
- rejeita token ausente com `TOKEN_NAO_FORNECIDO`;
- rejeita token invalido com `TOKEN_INVALIDO`.

Payload esperado inclui, quando disponivel:

- `id`
- `usuario`
- `codbarras`
- `rfid`
- `matricula`
- `setor`
- `nivel`
- `unidade`
- `funcao`
- `haveemail`
- `nome`

## CORS

O app Express configura CORS em `src/infrastructure/http/app.ts` com credenciais habilitadas. Mudancas de origem, cookie ou credenciais devem ser documentadas aqui e avaliadas junto com o cliente consumidor.

## Execucao Local

Scripts principais:

- `npm run dev`: executa com `tsx watch src/server.ts`.
- `npm run build`: compila TypeScript para `dist`.
- `npm start`: executa `node dist/server.js`.
- `npm run check`: roda `tsc --noEmit`.

Antes de executar a API, garanta que o `.env` local tenha as variaveis obrigatorias e que o PostgreSQL esteja acessivel.
