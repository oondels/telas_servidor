# AGENTS.md - servidor-telas

Voce e um agente de desenvolvimento para o projeto `servidor-telas`, responsavel por manter qualidade, seguranca, consistencia arquitetural e baixo acoplamento entre dominio, aplicacao, infraestrutura HTTP, persistencia e documentacao tecnica. Este documento define regras, padroes e protocolos que devem ser seguidos para preservar a integridade do repositorio.

O `servidor-telas` e uma API REST para controle de telas de serigrafia da DASS. O sistema centraliza o ciclo de vida das telas usadas no processo produtivo: cadastro, consulta, edicao, enderecamento fisico, atualizacao de status, solicitacoes de retirada, atendimento, gravacao, conclusao, entrega, devolucao e rastreabilidade operacional.

O projeto e backend-only neste repositorio e usa TypeScript, Express, TypeORM, PostgreSQL, Zod e autenticacao externa por JWT armazenado em cookie. A base segue principios de Clean Architecture, com separacao entre modulos de dominio, casos de uso, contratos, infraestrutura TypeORM, controllers HTTP e utilitarios compartilhados.

## Regras do Aplicativo servidor-telas

1. Usuarios autenticados acessam as rotas de negocio por JWT no cookie configurado em `JWT_COOKIE_NAME`.
2. Telas podem ser cadastradas, consultadas, editadas, enderecadas fisicamente e ter status atualizado.
3. Usuarios ativos no banco podem criar solicitacoes de telas com ao menos um item valido.
4. Usuarios ativos com papel interno adequado podem atender, iniciar, concluir, entregar e devolver solicitacoes.
5. Transicoes de solicitacao devem respeitar o fluxo documentado em `spec/backend/BUSINESS_RULES.md`.
6. Operacoes criticas devem registrar audit log append-only quando aplicavel.

## Regras de Operacao

1. Descubra em qual area do repositorio voce vai atuar antes de alterar qualquer arquivo. Se o escopo nao estiver claro, pergunte.
2. As areas principais deste repositorio sao:
   - `src/modules/telas` (dominio, aplicacao, infraestrutura e HTTP de telas)
   - `src/modules/solicitacoes` (dominio, aplicacao, infraestrutura e HTTP de solicitacoes)
   - `src/infrastructure` (HTTP, middlewares, rotas, entidades e migrations)
   - `src/modules/users` (usuarios internos, papeis e RBAC)
   - `src/modules/audit` (eventos append-only)
   - `src/modules/config` (configuracoes operacionais globais)
   - `src/shared` e `src/modules/shared` (erros, auth-context, respostas, parsers, constantes compartilhadas)
   - `src/config` (env e database)
   - `spec` (documentacao tecnica primaria)
3. Leia primeiro a documentacao tecnica da area afetada antes de implementar:
   - visao de alto nivel: `spec/DESIGN_SPEC.md`
   - backend: `spec/backend/README.md`
   - arquitetura: `spec/backend/ARCHITECTURE.md`
   - rotas e contratos HTTP: `spec/backend/ROUTES.md`
   - regras de negocio: `spec/backend/BUSINESS_RULES.md`
   - integracoes: `spec/backend/INTEGRATIONS.md`
4. Para qualquer funcionalidade, bugfix, refactor ou ajuste de contrato, use as specs como fonte primaria de navegacao e contexto antes de abrir muitos arquivos de codigo.

## 0) Ordem de Precedencia

1. Hard Rules (secao 1)
2. `spec/backend/README.md` e arquivos relacionados
3. `spec/DESIGN_SPEC.md`
4. `README.md`
5. Este `AGENTS.md`
6. Preferencias locais de implementacao presentes no codigo existente

## 1) Hard Rules (Inviolaveis)

- HR-001: Mantenha a separacao entre dominio, aplicacao, infraestrutura, HTTP e documentacao; nao mova regra de negocio para controller ou entidade ORM.
- HR-002: Consulte `spec/backend/*` antes de alterar rotas, payloads, status, auth, regras de tela, solicitacoes ou integracoes.
- HR-003: Nao hardcode segredos, tokens, credenciais, hosts sensiveis ou chaves em codigo versionado.
- HR-004: Nao altere contrato de rota, payload, status HTTP ou regra de transicao sem atualizar a spec correspondente.
- HR-005: Rotas de negocio devem continuar protegidas por `verifyToken`, salvo decisao explicita documentada.
- HR-006: Nao comite `.env`, `node_modules`, `dist`, dumps, credenciais ou dados sensiveis.
- HR-007: Use `AppError` para erros de dominio/fluxo e preserve respostas padronizadas por `sendSuccess`/`sendError`.
- HR-008: Nao exponha JWT, cookies, dados pessoais ou payloads sensiveis em logs.
- HR-009: Toda mudanca de comportamento deve atualizar a documentacao relevante em `spec/` no mesmo trabalho.
- HR-010: Preserve alteracoes locais nao relacionadas; nao reverta arquivos que voce nao alterou sem solicitacao explicita.

## 2) Arquitetura

- Backend TypeScript com Express 5, TypeORM 0.3, PostgreSQL, Zod e JWT em cookie.
- Entrada da aplicacao em `src/server.ts`, inicializando banco via `initializeDatabase` e app via `createApp`.
- Rotas registradas em `src/infrastructure/http/routes/index.ts`, com controllers instanciados manualmente e repositories TypeORM injetados nos use cases.
- Modulos principais:
  - `src/modules/telas`: cadastro, busca, edicao, enderecamento e status de telas.
  - `src/modules/solicitacoes`: criacao, consulta e fluxo operacional de solicitacoes.
  - `src/modules/users`: usuarios internos, papeis e RBAC.
  - `src/modules/audit`: eventos append-only.
  - `src/modules/config`: configuracoes operacionais globais.
- Camadas esperadas por modulo:
  - `domain`: tipos, status e regras puras do dominio.
  - `application`: DTOs, contratos de repository e use cases.
  - `infrastructure`: implementacoes TypeORM e persistencia.
  - `presentation/http`: controllers Express.
- Persistencia em `src/infrastructure/database/entities` e migrations em `src/infrastructure/database/migrations`.

## 3) Coding Standards

### Backend

- Usar TypeScript estrito e imports ESM com extensao `.js`, seguindo `moduleResolution: NodeNext`.
- Preferir `async/await`; evitar encadeamento `.then()` em novos codigos.
- Controllers devem apenas normalizar entrada HTTP, obter usuario autenticado e chamar use cases.
- Use cases devem concentrar regras de negocio, autorizacao operacional, validacao de fluxo e orquestracao.
- Repositories devem encapsular consultas, writes, transacoes e detalhes TypeORM.
- Validacoes de status, matricula, payload, datas, endereco e permissao devem permanecer no backend.
- Normalizacoes reutilizaveis devem ficar em `src/shared/utils` ou no dominio do modulo quando forem especificas.
- Novos erros de fluxo devem usar `AppError` com status, codigo estavel e mensagem clara.
- Nao introduza dependencias novas sem necessidade concreta e alinhamento com a arquitetura existente.

### Documentacao (`spec`)

- `spec/DESIGN_SPEC.md` e o mapa de alto nivel do sistema.
- `spec/backend/README.md` e o ponto inicial de lookup tecnico.
- `spec/backend/ROUTES.md` deve refletir rotas, payloads, auth e respostas.
- `spec/backend/BUSINESS_RULES.md` deve refletir regras de telas, solicitacoes, status e RBAC.
- `spec/backend/INTEGRATIONS.md` deve refletir PostgreSQL, TypeORM, env, JWT, CORS, migrations e execucao local.
- Quando uma task mudar fluxo, contrato, integracao ou regra de negocio, atualize a spec correspondente no mesmo trabalho.
- O `README.md` nao e a fonte primaria durante a evolucao atual; ele sera atualizado depois como guia central de uso e configuracao.

## 4) Seguranca

- Nao versionar `.env`.
- Nao registrar credenciais, JWT, cookies, dados pessoais ou payloads sensiveis em logs.
- Manter validacao de ambiente centralizada em `src/config/env.ts`.
- Manter conexao PostgreSQL centralizada em `src/config/database.ts`.
- Mudancas em CORS, cookie, JWT ou auth devem ser documentadas em `spec/backend/INTEGRATIONS.md`.
- Autorizacao deve usar usuario ativo e papel interno carregado do banco; nao introduza novas listas hardcoded de matriculas.
- O backend e a fonte de verdade para permissao; nao assumir autorizacao por cliente externo.

## 5) Git Workflow

- Conventional commits: `feat(<scope>):`, `fix(<scope>):`, `refactor(<scope>):`, `docs(<scope>):`, `chore(<scope>):`, `test(<scope>):`, `perf(<scope>):`.
- Scopes recomendados: `api`, `auth`, `telas`, `solicitacoes`, `db`, `infra`, `spec`, `docs`.
- Antes de commitar, revise `git status`, mantenha o commit focado e evite misturar mudancas sem relacao.
- Sem force push.
- Sem commit direto em `main`/`master` sem solicitacao explicita.
- Nao comitar `.env`, `node_modules`, `dist`, `coverage`, dumps ou artefatos gerados.

## 6) Escopo de Arquivos

- Configuracao: `src/config/{env,database}.ts`
- HTTP: `src/infrastructure/http/{app,middlewares,routes}`
- Persistencia: `src/infrastructure/database/{entities,migrations}`
- Telas: `src/modules/telas/{domain,application,infrastructure,presentation}`
- Solicitacoes: `src/modules/solicitacoes/{domain,application,infrastructure,presentation}`
- Usuarios/RBAC: `src/modules/users`
- Auditoria: `src/modules/audit`
- Configuracoes: `src/modules/config`
- Compartilhado: `src/shared/{auth,domain,http,types,utils}` e `src/modules/shared`
- Documentacao:
  - `spec/DESIGN_SPEC.md`
  - `spec/backend/{README,ARCHITECTURE,ROUTES,BUSINESS_RULES,INTEGRATIONS}.md`

## 7) Skills Locais Codex

- Nenhuma skill local foi detectada neste repositorio no momento.

## 8) Protocolo de Uso das Specs

- Para qualquer task backend:
  - comecar em `spec/backend/README.md`
  - abrir `ROUTES.md` se envolver endpoint, payload, auth, query params ou resposta
  - abrir `BUSINESS_RULES.md` se envolver telas, solicitacoes, status, transicoes, RBAC, entrega, devolucao ou rastreabilidade
  - abrir `ARCHITECTURE.md` se envolver organizacao de camadas, dependencias, modulo ou refactor
  - abrir `INTEGRATIONS.md` se envolver PostgreSQL, TypeORM, migrations, env, JWT, CORS ou execucao
- Para mudancas transversais:
  - abrir `spec/DESIGN_SPEC.md` primeiro
  - depois navegar para as specs backend especificas impactadas
- Para documentacao de usuario final, instalacao, configuracao e guia de uso:
  - nao atualizar `README.md` ate a etapa final do projeto, salvo solicitacao explicita
