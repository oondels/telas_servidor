# Design Spec - servidor-telas

## Visao Geral

O `servidor-telas` e uma API REST backend-only para controle de telas de serigrafia usadas no processo produtivo da DASS. A aplicacao centraliza cadastro, localizacao, status, solicitacoes de retirada, atendimento operacional, entrega, devolucao e rastreabilidade basica das telas.

O objetivo e manter uma camada confiavel de controle operacional, reduzindo perda de telas, inconsistencias de disponibilidade, dificuldade de localizacao fisica e ausencia de historico sobre quem solicitou, conferiu ou alterou uma tela.

## Dominio Funcional

- **Telas**: registros fisicos de telas de serigrafia, com codigo de barras, marca, modelo, numero, cor, fios, pecas, tamanho de etiqueta, status e endereco.
- **Solicitacoes**: pedidos de telas feitos por usuarios autorizados da producao, com dados do pedido em JSON, status operacional, observacoes e usuarios envolvidos.
- **Enderecamento**: atualizacao do local fisico onde uma ou mais telas estao armazenadas.
- **Status de tela**: classificacao operacional da tela, normalizada pelo dominio.
- **Fluxo de solicitacao**: pipeline de pedido, avaliacao, gravacao/manutencao, conclusao, entrega e devolucao.
- **RBAC por matricula**: autorizacao operacional baseada em listas de matriculas solicitantes e gestoras.

## Arquitetura

O projeto usa TypeScript com Express, TypeORM e PostgreSQL, seguindo Clean Architecture de forma pragmatica:

- `src/server.ts`: bootstrap da API.
- `src/config`: validacao de ambiente e configuracao do DataSource.
- `src/infrastructure/http`: app Express, middlewares e composicao das rotas.
- `src/infrastructure/database`: entidades ORM e migrations.
- `src/modules/*/domain`: modelos e regras puras de dominio.
- `src/modules/*/application`: DTOs, contratos e use cases.
- `src/modules/*/infrastructure`: repositories TypeORM.
- `src/modules/*/presentation/http`: controllers HTTP.
- `src/shared`: erros, auth-context, respostas HTTP, logs, parsers e utilitarios.

Controllers nao devem conter regra de negocio. Use cases coordenam regras e repositories encapsulam persistencia.

## Fluxos Principais

1. **Cadastro de tela**
   - Usuario autenticado envia dados da tela.
   - Controller identifica o usuario pelo JWT.
   - Use case valida usuario.
   - Repository persiste a tela e dados de rastreabilidade.

2. **Busca de telas**
   - Usuario autenticado consulta telas por filtros e paginacao.
   - Repository executa a busca e retorna resposta paginada.

3. **Enderecamento de telas**
   - Usuario autenticado envia uma lista de telas e um ou mais enderecos.
   - Use case valida matriz tela/endereco.
   - Repository atualiza lote e usuario responsavel.

4. **Solicitacao de telas**
   - Solicitante autenticado e autorizado cria pedido com itens validos.
   - Use case normaliza dados e valida permissao.
   - Repository cria solicitacao com status inicial.

5. **Gestao de solicitacao**
   - Gestor autorizado atende, inicia, conclui, entrega ou devolve a solicitacao.
   - Use cases validam matricula, observacoes obrigatorias, conferente e dados de entrega/devolucao.
   - Repository aplica transicoes e persiste estado atualizado.

## Fontes de Verdade

- Specs em `spec/` sao a fonte primaria para manutencao tecnica durante a evolucao do projeto.
- `README.md` sera atualizado futuramente como documentacao central de uso, configuracao e onboarding quando o projeto estiver finalizado.
- O codigo existente continua sendo referencia para detalhes de implementacao ainda nao especificados.
