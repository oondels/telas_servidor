# Backend Architecture

## Objetivo Arquitetural

Manter uma API REST com separacao clara entre regra de negocio, orquestracao de casos de uso, transporte HTTP e persistencia. O projeto segue Clean Architecture de forma pragmatica, preservando baixo acoplamento e testabilidade.

## Camadas

- **Domain** (`src/modules/*/domain`): tipos centrais, status, normalizadores de dominio e regras puras.
- **Application** (`src/modules/*/application`): DTOs, contratos de repository e use cases.
- **Infrastructure** (`src/modules/*/infrastructure` e `src/infrastructure/database`): TypeORM, entidades, migrations e implementacoes de repository.
- **Presentation HTTP** (`src/modules/*/presentation/http`): controllers que adaptam Request/Response para use cases.
- **HTTP Composition** (`src/infrastructure/http`): app Express, middlewares, registro de rotas e injecao manual de dependencias.
- **Shared** (`src/shared` e `src/modules/shared`): erros, auth-context, respostas HTTP, logs, parsers, utilitarios e constantes compartilhadas.

## Regras de Dependencia

- Controllers podem depender de use cases e utilitarios de adaptacao HTTP.
- Use cases podem depender de contratos, dominio, utilitarios compartilhados e erros de dominio.
- Use cases nao devem depender de Express, TypeORM ou entidades ORM.
- Repositories implementam contratos da aplicacao e podem depender de TypeORM.
- Entidades ORM nao devem conter regra de negocio.
- `src/infrastructure/http/routes/index.ts` pode compor controllers, use cases e repositories.

## Modulo `telas`

Responsavel por:

- consulta paginada e filtrada de telas;
- cadastro de novas telas;
- edicao por codigo de barras;
- atualizacao em lote de endereco;
- atualizacao em lote de status.

Arquivos principais:

- dominio: `tela.ts`, `tela-status.ts`
- contratos e DTOs: `application/contracts`, `application/dtos`
- casos de uso: `application/use-cases`
- persistencia: `infrastructure/typeorm-telas.repository.ts`
- HTTP: `presentation/http/telas.controller.ts`

## Modulo `solicitacoes`

Responsavel por:

- consulta paginada e filtrada de solicitacoes;
- busca por id;
- criacao de solicitacao;
- atendimento com aceite/reprovacao;
- inicio do fluxo para gravacao ou manutencao;
- conclusao;
- entrega;
- devolucao.

Arquivos principais:

- dominio: `solicitacao.ts`, `solicitacao-status.ts`
- contratos e DTOs: `application/contracts`, `application/dtos`
- casos de uso: `application/use-cases`
- persistencia: `infrastructure/typeorm-solicitacoes.repository.ts`
- HTTP: `presentation/http/solicitacoes.controller.ts`

## Padroes de Implementacao

- Use `AppError` para erros esperados de dominio, permissao e validacao.
- Use `sendSuccess` para respostas bem-sucedidas.
- Use `asyncHandler` para rotas assincronas.
- Obtenha usuario autenticado via `getAuthenticatedUser` ou `getAuthenticatedMatricula`.
- Centralize listas de acesso em `src/modules/shared/domain/constants/access.ts`.
- Preserve imports ESM com extensao `.js`.
