# Backend Business Rules

## Autenticacao e RBAC

- A identidade vem de JWT externo em cookie.
- O acesso real depende de usuario ativo em `fabrica.telas_usuarios`.
- O primeiro Admin e criado por SQL manual antes do uso administrativo.
- Cada usuario possui um papel unico:
  - `ADMIN`
  - `OPERADOR_TELAS`
  - `MOVIMENTADOR`
  - `USUARIO_PRODUCAO`

Permissoes:

- `ADMIN`: gerencia usuarios, configuracoes, auditoria e todas as operacoes.
- `OPERADOR_TELAS`: gerencia telas, reposicoes, enderecamento e solicitacoes.
- `MOVIMENTADOR`: endereca telas e executa fluxo de solicitacoes.
- `USUARIO_PRODUCAO`: consulta telas e cria solicitacoes.

## Telas

- Cadastro exige codigo de barras, marca, modelo, numero da tela e data de fabricacao.
- Edicao e reposicao usam o codigo de barras como identificador publico.
- Reposicao mantem a mesma tela/codigo, exige `motivo` e registra evento `TELA_REPOSTA`.
- Desabilitacao e uma alteracao de status para `DESABILITADA`.
- Enderecamento registra usuario e evento de auditoria.
- Telas sem movimentacao sao calculadas pelo ultimo audit log de `TELA`, com fallback para `updatedate`/`createdate`.

Status permitidos:

- `PRODUCAO`
- `TERMINADA`
- `ARMAZENADA`
- `ESTRAGADA`
- `SOLICITADA`
- `EM_MOVIMENTACAO`
- `RETIRADA`
- `EM_REPOSICAO`
- `DESABILITADA`

## Solicitacoes

- Qualquer usuario ativo pode criar solicitacao para sua propria matricula autenticada.
- Itens podem vir em `items` ou `dados_pedido.items`.
- Cada item precisa de modelo, marca, cor, fios, tamanho do quadro/numero e pecas.
- Atender, iniciar, concluir, entregar e devolver exigem `ADMIN`, `OPERADOR_TELAS` ou `MOVIMENTADOR`.
- Reprovacao exige observacao.
- Entrega e devolucao exigem `user_recebimento` e `user_conferente`.
- `user_conferente` deve ser igual a matricula autenticada.
- Devolucao exige `observacao_conferente`.

Transicoes:

- `pedido` -> `aceito`, `reprovado`
- `aceito` -> `gravacao`, `setor_em_manutencao`
- `setor_em_manutencao` -> `gravacao`, `reprovado`
- `gravacao` -> `concluido`
- `concluido` -> `entregue`
- `entregue` -> `devolvido`

## Auditoria

Eventos append-only sao registrados em `fabrica.telas_audit_events`.

Eventos principais:

- `USUARIO_CRIADO`
- `USUARIO_ATUALIZADO`
- `TELA_CRIADA`
- `TELA_EDITADA`
- `ENDERECO_ATUALIZADO`
- `STATUS_ATUALIZADO`
- `TELA_DESABILITADA`
- `TELA_REPOSTA`
- `SOLICITACAO_CRIADA`
- `SOLICITACAO_ACEITA`
- `SOLICITACAO_REPROVADA`
- `SOLICITACAO_INICIADA_GRAVACAO`
- `SOLICITACAO_ENVIADA_MANUTENCAO`
- `SOLICITACAO_CONCLUIDA`
- `SOLICITACAO_ENTREGUE`
- `SOLICITACAO_DEVOLVIDA`

## Telas Sem Movimentacao

- Configuracao global fica em `fabrica.telas_configuracoes` com chave `telas_sem_movimentacao`.
- Valor padrao: `{"days": 30}`.
- Consulta pode receber `days` para sobrescrever o limite apenas naquela chamada.
- A funcionalidade atual e consulta/configuracao; nao ha scheduler nem envio externo.
