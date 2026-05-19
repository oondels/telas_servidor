# Backend Business Rules

## Autenticacao e Usuario

- Rotas de negocio exigem JWT valido no cookie `JWT_COOKIE_NAME`.
- O middleware `verifyToken` injeta o payload em `req.user`.
- Operacoes que precisam de usuario textual usam `usuario` do JWT e, se ausente, `matricula`.
- Operacoes que precisam de matricula usam `getAuthenticatedMatricula`.

## RBAC por Matricula

- Criacao de solicitacao exige matricula presente em `MATRICULAS_SOLICITANTES`.
- Gestao de solicitacoes exige matricula presente em `MATRICULAS_GESTORES`.
- As listas ficam em `src/modules/shared/domain/constants/access.ts`.
- Novas regras de acesso devem ser centralizadas nesse ponto ou em helper compartilhado equivalente.

## Telas

- Cadastro exige usuario autenticado identificado.
- Edicao exige usuario autenticado e `codbarrastela` valido.
- Busca aceita filtros por letra, modelo, status, endereco e texto livre.
- Atualizacao de posicao exige ao menos uma tela e ao menos um endereco.
- Quando apenas um endereco e informado, ele pode ser aplicado a todas as telas do lote.
- Quando varios enderecos sao informados, a quantidade deve bater com a quantidade de telas.
- Atualizacao de status exige ao menos uma tela.
- Status de tela e normalizado por `normalizeTelaStatus`.

## Status de Tela

Status permitidos atualmente:

- `ESTRAGADA`
- `PRODUCAO`
- `TERMINADA`
- `ARMAZENADA`

Quando um status invalido e recebido, a normalizacao atual cai para `PRODUCAO`. Qualquer mudanca nessa politica deve ser refletida nesta spec e nos testes aplicaveis.

## Criacao de Solicitacao

- A matricula do solicitante vem do JWT.
- O solicitante deve estar autorizado.
- A solicitacao deve conter ao menos um item valido.
- Itens podem vir em `items` ou `dados_pedido.items`.
- Cada item valido deve conter:
  - `modelo`
  - `marca`
  - `cor`
  - `fios`
  - `tamanhoDoQuadro` ou `tamanho_quadro`
  - `numero` ou `numerotela`
  - `pecas`, `peca` ou `peça(s)`
- Dados textuais sao normalizados para uppercase quando aplicavel.
- `pecas` e normalizado por utilitario compartilhado.

## Status e Transicoes de Solicitacao

Status permitidos:

- `pedido`
- `aceito`
- `reprovado`
- `gravacao`
- `setor_em_manutencao`
- `concluido`
- `entregue`
- `devolvido`

Transicoes permitidas:

- `pedido` -> `aceito`, `reprovado`
- `aceito` -> `gravacao`, `setor_em_manutencao`
- `setor_em_manutencao` -> `gravacao`, `reprovado`
- `gravacao` -> `concluido`
- `concluido` -> `entregue`
- `entregue` -> `devolvido`
- `reprovado` e `devolvido` nao possuem transicoes de saida documentadas.

## Atendimento

- Apenas gestor autorizado pode atender solicitacao.
- Reprovacao exige `observacao_conferente`.
- A decisao pode vir como `decision` ou `status`.

## Inicio do Fluxo Operacional

- Apenas gestor autorizado pode iniciar etapa operacional.
- `status` ou `targetStatus` define a etapa alvo.
- Quando a etapa alvo e `gravacao`, os itens da solicitacao sao convertidos em dados de telas para cadastro.
- Para `gravacao`, itens incompletos geram erro `DADOS_PEDIDO_INCOMPLETOS`.

## Conclusao, Entrega e Devolucao

- Apenas gestor autorizado pode concluir, entregar ou devolver.
- Entrega exige `user_recebimento` e `user_conferente` validos.
- Devolucao exige `user_recebimento`, `user_conferente` e `observacao_conferente`.
- `user_conferente` deve ser igual a matricula do usuario autenticado.

## Rastreabilidade

Operacoes criticas devem preservar, quando aplicavel:

- usuario que criou ou alterou;
- matricula responsavel;
- datas de criacao, atualizacao, pedido e entrega;
- status anterior/novo quando o repository suportar;
- observacoes de pedido, conferencia, recusa ou devolucao.

Novas funcionalidades que alterem estado operacional devem considerar historico ou campos de auditoria antes de concluir a implementacao.
