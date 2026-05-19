# Backend Specs - servidor-telas

Este diretorio documenta o backend do `servidor-telas`. Use estes arquivos como fonte primaria antes de alterar codigo, rotas, regras de negocio, integracoes ou persistencia.

## Mapa de Navegacao

- `../DESIGN_SPEC.md`: visao geral do sistema, dominio, arquitetura e fluxos principais.
- `ARCHITECTURE.md`: camadas, responsabilidades, dependencias permitidas e organizacao dos modulos.
- `ROUTES.md`: endpoints HTTP, autenticacao, parametros, payloads e respostas.
- `BUSINESS_RULES.md`: regras funcionais de telas, solicitacoes, status, RBAC e rastreabilidade.
- `INTEGRATIONS.md`: PostgreSQL, TypeORM, variaveis de ambiente, JWT em cookie, CORS, migrations e execucao.

## Stack

- Node.js com TypeScript.
- Express 5 para HTTP.
- TypeORM 0.3 para PostgreSQL.
- Zod para validacao das variaveis de ambiente.
- JWT em cookie para autenticacao externa.

## Modulos Atuais

- `telas`: busca, cadastro, edicao, enderecamento e status de telas.
- `solicitacoes`: criacao, consulta e fluxo operacional de solicitacoes.
- `shared`: auth-context, erros, respostas HTTP, parsers, logger e constantes de acesso.

## Politica de Atualizacao

Atualize a spec correspondente no mesmo trabalho sempre que mudar:

- rota, payload, query param, status HTTP ou formato de resposta;
- regra de negocio, status permitido, transicao ou validacao;
- autorizacao, JWT, cookie, CORS ou variavel de ambiente;
- entidade, migration, repository ou contrato de persistencia;
- organizacao de camadas ou responsabilidade de modulo.

O `README.md` nao deve ser atualizado agora como guia central. Ele sera revisado ao final do projeto.
