# Backend Integrations

## PostgreSQL e TypeORM

A conexao e centralizada em `src/config/database.ts`; variaveis sao validadas em `src/config/env.ts`.

Entidades atuais:

- `fabrica.controle_telas_prateleiras`
- `fabrica.solicitacao_tela`
- `fabrica.telas_usuarios`
- `fabrica.telas_audit_events`
- `fabrica.telas_configuracoes`

`synchronize` permanece `false`; mudancas de schema devem usar migrations.

## Migration de Conclusao

`1714060002000-AddRbacAuditAndConfig.ts` cria:

- enum `fabrica.telas_usuario_role`;
- tabela de usuarios internos;
- tabela de audit log;
- tabela de configuracoes;
- configuracao padrao de telas sem movimentacao;
- indices de RBAC e auditoria.

## Bootstrap Manual do Primeiro Admin

Depois de rodar migrations, inserir o primeiro Admin manualmente:

```sql
INSERT INTO fabrica.telas_usuarios (
  matricula, nome, usuario, setor, unidade, role, active, created_at, updated_at
)
VALUES (
  3020495,
  'NOME DO ADMIN',
  'USUARIO.ADMIN',
  'AUTOMACAO',
  'SEST',
  'ADMIN',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (matricula) DO UPDATE
SET role = 'ADMIN',
    active = true,
    updated_at = NOW();
```

## JWT

O backend assume autenticacao externa:

- le cookie `JWT_COOKIE_NAME`;
- valida com `JWT_SECRET`;
- injeta payload em `req.user`;
- carrega usuario ativo interno por matricula;
- bloqueia usuario inexistente/inativo com `403`.

## Variaveis de Ambiente

- `NODE_ENV`
- `API_PORT`
- `USERS`
- `PASS`
- `IP`
- `PORT`
- `DBASE`
- `JWT_SECRET`
- `JWT_COOKIE_NAME`
- `CORS_ORIGIN`

## Execucao

- `npm run dev`
- `npm run build`
- `npm start`
- `npm run check`
- `npm run migration:run`
- `npm run migration:revert`
