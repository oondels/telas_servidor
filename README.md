# servidor-telas

## Contexto do Projeto

O sistema é uma API REST para controle e gerenciamento de telas de serigrafia utilizadas no processo produtivo da DASS. Essas telas são cadastradas, armazenadas, movimentadas, solicitadas e reutilizadas por diferentes setores da fábrica durante a produção de calçados.

O projeto já possui uma base existente e foi refatorado para **TypeScript**, utilizando princípios de **Clean Architecture**, **TypeORM** para persistência de dados e autenticação externa baseada em **JWT armazenado em cookie**.

O objetivo da aplicação é centralizar e controlar todo o ciclo de vida das telas de serigrafia, desde o cadastro inicial até o endereçamento físico, movimentação, solicitação por setores produtivos, reposição e análise de telas sem uso.

---

## Autenticação

O backend assume autenticação externa. As rotas de negócio usam middleware que:

- lê o token JWT do cookie configurado em `JWT_COOKIE_NAME`
- valida a assinatura com `JWT_SECRET`
- injeta o payload em `req.user`
- payload do jwt:
  {
      id: dadosBanco.id,
      usuario: dadosBanco.usuario, -> exemplo: HENDRIUS.SANTANA
      codbarras: dadosBanco.codigo_barras, -> codigo de barras
      rfid: dadosBanco.rfid, -> codigo rfid
      matricula: dadosBanco.matricula, -> matricula do usuario, exemplo: 3020495
      setor: dadosBanco.setor, -> exemplo: AUTOMACAO
      nivel: dadosBanco.nivel, -> A|B|C
      unidade: dadosBanco.unidade, -> exemplo: SEST
      funcao: dadosBanco.funcao, -> exemplo: Analista de automacao
      haveemail: dadosBanco.email ? true : false,
      nome: dadosBanco.nome, -> nome do usuario
  }

## Objetivo Funcional da Aplicação

A aplicação deve permitir que o setor responsável pelas telas tenha controle operacional completo sobre:

- Cadastro de novas telas;
- Consulta e edição de telas existentes;
- Endereçamento físico das telas;
- Solicitações de retirada feitas por usuários da produção;
- Atendimento/liberação de solicitações de telas;
- Reposição de telas já cadastradas;
- Desabilitação de telas que não devem mais ser utilizadas;
- Monitoramento de telas sem movimentação por determinado período;
- Controle de permissões por perfil de usuário.

O sistema deve funcionar como uma camada confiável de rastreabilidade, evitando perda de telas, uso indevido, falta de controle físico e dificuldade de localização no setor.

---

## Perfis de Usuário e RBAC

A aplicação deve possuir controle de acesso baseado em papéis, utilizando RBAC. Cada usuário deve ter permissões de acordo com sua função operacional.

### 1. Admin

Perfil com acesso completo ao sistema.

Permissões esperadas:

- Gerenciar usuários;
- Criar, editar, ativar e desativar usuários;
- Atribuir perfis de acesso;
- Cadastrar, editar, desabilitar e consultar telas;
- Realizar endereçamento;
- Gerenciar solicitações;
- Realizar movimentações;
- Acessar relatórios e indicadores;
- Executar qualquer ação administrativa ou operacional da aplicação.

### 2. Operador Telas

Perfil responsável pela manutenção e gestão operacional das telas.

Permissões esperadas:

- Cadastrar novas telas;
- Editar informações de telas existentes;
- Desabilitar telas;
- Realizar reposição de telas;
- Endereçar telas;
- Consultar histórico e status das telas;
- Visualizar telas sem movimentação;
- Apoiar no controle físico do estoque de telas.

### 3. Movimentador

Perfil responsável pelo atendimento das solicitações feitas pelos setores produtivos.

Permissões esperadas:

- Visualizar solicitações pendentes;
- Atender solicitações de retirada de telas;
- Liberar telas solicitadas;
- Registrar movimentações de saída;
- Registrar devoluções, quando aplicável;
- Consultar status das solicitações;
- Atualizar o andamento das movimentações.

### 4. Usuário Produção

Perfil utilizado pelos setores produtivos que consomem as telas no processo de produção. Esse perfil pode requerer autenticação ou não. Mas sempre será informado algum identificador do usuário, como: Código de barras, RFID ou matrícula.

Permissões esperadas:

- Consultar telas disponíveis, quando permitido;
- Criar solicitações de retirada de telas;
- Acompanhar o status das próprias solicitações;
- Visualizar histórico básico das solicitações realizadas.

---

## Controle de Telas

O sistema deve permitir o gerenciamento completo das telas de serigrafia.

Cada tela deve possuir informações suficientes para identificação, rastreabilidade e localização, como por exemplo:

- Código ou identificação única da tela;
- Descrição;
- Modelo/produto relacionado;
- Situação atual;
- Localização/endereço físico;
- Status de disponibilidade;
- Data de cadastro;
- Data da última movimentação;
- Usuário responsável pela última ação;
- Histórico de movimentações;
- Indicador de tela ativa ou desabilitada.

As telas devem poder assumir diferentes estados operacionais, como:

- Disponível;
- Solicitada;
- Em movimentação;
- Retirada;
- Em reposição;
- Desabilitada;
- Sem movimentação.

---

## Endereçamento de Telas

O sistema deve permitir o endereçamento físico das telas dentro do setor responsável.

O endereçamento representa o local onde a tela está armazenada fisicamente. Esse controle é necessário para facilitar a localização, reduzir tempo de busca e melhorar a rastreabilidade operacional.

A regra detalhada de endereçamento será descrita em seção específica, mas a arquitetura deve considerar que uma tela pode estar associada a um endereço físico e que esse endereço pode ser alterado ao longo do tempo.

O sistema também deve manter histórico das alterações de endereço, quando necessário, para fins de auditoria e rastreabilidade.

---

## Solicitação e Retirada de Telas

Usuários da produção devem conseguir solicitar a retirada de telas por meio da aplicação.

Fluxo esperado:

1. Usuário produção cria uma solicitação de retirada;
2. A solicitação fica pendente de atendimento;
3. Um usuário com perfil Movimentador, Operador Telas ou Admin analisa a solicitação;
4. A tela é liberada ou a solicitação é recusada;
5. Ao liberar, o sistema registra a movimentação da tela;
6. O status da tela e da solicitação é atualizado;
7. O histórico da operação é armazenado.

O sistema deve evitar inconsistências, como:

- Solicitar uma tela desabilitada;
- Solicitar uma tela indisponível;
- Liberar a mesma tela para mais de uma solicitação ativa;
- Alterar manualmente estados sem registrar histórico;
- Perder rastreabilidade sobre quem solicitou, quem liberou e quando a movimentação ocorreu.

---

## Reposição de Telas

O sistema deve permitir a reposição de uma tela já cadastrada.

Reposição significa atualizar ou substituir uma tela existente mantendo sua rastreabilidade dentro do sistema. Essa funcionalidade deve permitir registrar que uma tela passou por reposição, preservando o vínculo com seu histórico anterior.

A reposição pode envolver alterações como:

- Atualização de dados da tela;
- Substituição física da tela;
- Alteração de status;
- Registro do motivo da reposição;
- Registro do usuário responsável;
- Data e hora da operação.

O sistema deve diferenciar uma simples edição cadastral de uma operação de reposição, pois a reposição representa um evento operacional relevante no ciclo de vida da tela.

---

## Telas Sem Movimentação

A aplicação deve identificar telas que estão sem movimentação há um determinado número de dias.

Exemplo:

- Telas cadastradas que não tiveram retirada, solicitação, movimentação ou uso nos últimos X dias.

Essa funcionalidade deve apoiar decisões como:

- Revisar telas paradas;
- Identificar telas obsoletas;
- Detectar excesso de estoque;
- Avaliar necessidade de desabilitação;
- Melhorar a organização física do setor;
- Reduzir acúmulo de telas sem uso.

O número de dias considerado para classificar uma tela como “sem movimentação” deve ser configurável ou, no mínimo, parametrizável na consulta.

### Notificação de Telas Sem Movimentação
O sistema deve permitir a configuração de notificações para telas que estão sem movimentação há um determinado número de dias.

---

## Requisitos Arquiteturais

A aplicação deve respeitar a estrutura já existente baseada em:

- TypeScript;
- Clean Architecture;
- TypeORM;
- API REST;
- Autenticação externa via JWT em cookie;
- Separação clara entre domínio, aplicação, infraestrutura e interfaces HTTP;
- Validação de entrada;
- Controle de autorização por RBAC;
- Persistência de histórico das operações críticas.

A implementação deve evitar regras de negócio espalhadas em controllers ou diretamente em entidades ORM. As regras principais devem estar concentradas na camada de domínio ou nos casos de uso da aplicação.

---

## Requisitos de Rastreabilidade

Operações críticas devem registrar histórico, especialmente:

- Cadastro de tela;
- Edição de tela;
- Desabilitação;
- Endereçamento;
- Alteração de endereço;
- Solicitação de retirada;
- Liberação de solicitação;
- Recusa de solicitação;
- Movimentação de saída;
- Devolução, caso aplicável;
- Reposição;
- Alteração de status.

Sempre que possível, o histórico deve conter:

- Tela afetada;
- Tipo da operação;
- Usuário responsável;
- Data e hora;
- Estado anterior;
- Novo estado;
- Observação ou motivo, quando aplicável.

---

## Resultado Esperado

Ao final da implementação/refatoração, o sistema deve funcionar como uma API robusta para controle de telas de serigrafia, oferecendo:

- Controle confiável de usuários e permissões;
- Gestão completa do cadastro de telas;
- Rastreabilidade de movimentações;
- Endereçamento físico das telas;
- Solicitação e liberação de retirada;
- Controle de reposição;
- Identificação de telas sem movimentação;
- Base arquitetural limpa, testável e sustentável.
