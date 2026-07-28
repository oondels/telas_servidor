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
- Somente `ADMIN` gerencia usuários internos. A exclusão remove o acesso à aplicação Telas, mas não permite autoexclusão nem a remoção do último administrador ativo.

## Telas

- Cadastro exige codigo de barras, marca, modelo, numero da tela e data de fabricacao. Como ainda não possui endereço, a nova tela recebe `SEM_ENDERECO`.
- O cadastro em lote cria de 2 a 10 telas físicas independentes na mesma transação. As telas podem compartilhar todas as especificações, mas cada uma deve ter código de barras próprio, recebe `SEM_ENDERECO` e possui auditoria individual de criação.
- Edicao e reposicao usam o codigo de barras como identificador publico.
- Reposicao mantem a mesma tela/codigo, exige `motivo` e registra evento `TELA_REPOSTA`.
- Enderecos de `INVENTARIO` usam o formato `Rua-Bloco-Nivel` (por exemplo `01-01-01`).
- Enderecos de `PRODUCAO` usam nome e numero, inicialmente com nome fixo `PROD` (por exemplo `PROD-01`).
- Ambos os tipos possuem capacidade configurada e não podem receber telas além das vagas disponíveis.
- Enderecamento registra usuario e evento de auditoria e respeita a capacidade do endereço de forma atômica. Destino de produção define `PRODUCAO`; destino de inventário define `ARMAZENADA`.
- Uma tela já alocada pode ser transferida diretamente para outro endereço. A transferência libera o endereço anterior automaticamente, ocupa uma vaga no destino e registra endereço e status anteriores e novos na auditoria.
- A limpeza ou remoção de endereço preserva o cadastro, remove o endereço físico, define `SEM_ENDERECO` e registra auditoria individual.
- O código de barras identifica uma única tela física e não pode ser duplicado.
- `ADMIN` e `OPERADOR_TELAS` podem remover o endereço de uma tela sem excluir seu cadastro; a tela pode ser endereçada novamente depois.
- `ADMIN` e `OPERADOR_TELAS` podem excluir permanentemente uma tela. A exclusão é bloqueada quando houver solicitação ativa vinculada à tela.
- Telas sem movimentacao sao calculadas pelo ultimo audit log de `TELA`, com fallback para `updatedate`/`createdate`.

O status de localização não pode ser alterado manualmente por rota de criação, edição ou ação em lote. Status de localização:

- `PRODUCAO`
- `ARMAZENADA`
- `SEM_ENDERECO`

Status operacionais internos preservados:

- `SOLICITADA`
- `EM_MOVIMENTACAO`
- `RETIRADA`
- `EM_REPOSICAO`
- `DESABILITADA`

`TERMINADA` e `ESTRAGADA` são valores legados: não podem ser atribuídos manualmente e são substituídos pelo status correspondente na próxima movimentação da tela.

## Solicitacoes

## Solicitacoes

Existem 2 tipos de solicitação:
- `EXISTENTE`: Pedido de separação de telas que já existem fisicamente na fábrica. O sistema tenta encontrar uma tela compatível. Pula a etapa de gravação a menos que seja feito um auto-cadastro (ver regras abaixo).
- `REPOSICAO`: Pedido de substituição de tela fisicamente estragada ou perdida. O sistema tenta encontrar uma tela compatível e grava uma nova no lugar.

### Amarração de Telas (findStrictMatch)
As solicitações NÃO exigem mais o `id` direto da tela. A vinculação é feita por **busca estrita de características**:
- A API busca uma tela onde `marca`, `modelo`, e `numero` batem de forma exata.
- A lista de `pecas` também deve ser exatamente igual (independente da ordem).
- Se `fios` for enviado na busca, também deve bater de forma exata.

**Resolução da Busca:**
1. **1 Match Exato:** A tela é vinculada à solicitação automaticamente.
2. **Mais de 1 Match:** Retorna erro HTTP 409 (`MULTIPLAS_TELAS_ENCONTRADAS`) com a lista de telas. O usuário deve escolher qual ID exato deseja no frontend.
3. **0 Matches (Auto-cadastro):** O sistema checa a configuração `auto_cadastro_telas`.
   - Se `false`: Retorna HTTP 400 avisando que a tela não foi encontrada.
   - Se `true`: Retorna HTTP 400 (`DADOS_INCOMPLETOS_AUTO_CADASTRO`) se faltar `fios`, `cor` ou `tamanhoDoQuadro` (para reposição). Se todos os dados estiverem presentes, a tela é **cadastrada automaticamente** no sistema com `SEM_ENDERECO` e vinculada à solicitação.

- Qualquer usuario ativo pode criar solicitacao para sua propria matricula autenticada.
- Atender, iniciar, concluir, entregar e devolver exigem `ADMIN`, `OPERADOR_TELAS` ou `MOVIMENTADOR`.
- Reprovacao exige observacao.
- Entrega e devolucao exigem `user_recebimento` e `user_conferente`.
- `user_conferente` deve ser igual a matricula autenticada.
- Devolucao exige `observacao_conferente`.

Transicoes:

- `pedido` -> `aceito`, `reprovado`
- `aceito` -> `gravacao`, `setor_em_manutencao` (REPOSICAO ou auto-cadastro)
- `aceito` -> `concluido` (EXISTENTE quando a tela já existe fisicamente)
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
- `ENDERECO_REMOVIDO`
- `STATUS_ATUALIZADO`
- `TELA_DESABILITADA`
- `TELA_REPOSTA`
- `TELA_EXCLUIDA`
- `SOLICITACAO_CRIADA`
- `SOLICITACAO_ACEITA`
- `SOLICITACAO_REPROVADA`
- `SOLICITACAO_INICIADA_GRAVACAO`
- `SOLICITACAO_ENVIADA_MANUTENCAO`
- `SOLICITACAO_CONCLUIDA`
- `SOLICITACAO_ENTREGUE`
- `SOLICITACAO_DEVOLVIDA`

## Configuracoes do Sistema

### Telas Sem Movimentacao
- Configuracao global fica em `fabrica.telas_configuracoes` com chave `telas_sem_movimentacao`.
- Valor padrao: `{"days": 30}`.
- Consulta pode receber `days` para sobrescrever o limite apenas naquela chamada.

### Auto-cadastro em Solicitações
- Configuracao global em `fabrica.telas_configuracoes` com chave `auto_cadastro_telas`.
- Valor padrao: `{"enabled": true}`.
- Determina se o sistema permite ou não cadastrar uma tela "on the fly" quando a busca por características não encontra resultados durante a criação de uma solicitação.
