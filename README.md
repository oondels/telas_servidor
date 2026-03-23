# servidor-telas

API REST para controle de telas de serigrafia da DASS. Gerencia o cadastro, movimentação e o fluxo de solicitações de telas entre os setores.

## Tecnologias

- Node.js (ESM)
- Express 5
- PostgreSQL (`pg`)
- dotenv
- nodemon (desenvolvimento)

## Variáveis de ambiente

Crie um arquivo `.env` na raiz com as seguintes variáveis:

```env
USERS=        # usuário do banco
PASS=         # senha do banco
IP=           # host do banco
PORT=         # porta do banco (padrão: 5432)
DBASE=        # nome do banco
API_PORT=     # porta da API (padrão: 3041)
```

## Instalação e execução

```bash
npm install

# desenvolvimento (com hot reload)
npm run dev

# produção
node index.js
```

## Estrutura

```
index.js                          # entrada, rotas de telas e setup
database.js                       # pool de conexão PostgreSQL
solicitacoes-telas.controller.js  # rotas do fluxo de solicitações
solicitacoes-telas.service.js     # lógica de negócio e transições de status
telas-cadastro.service.js         # serviço de cadastro de telas
```

## Endpoints

### Telas

| Método | Rota                | Descrição                          |
|--------|---------------------|------------------------------------|
| GET    | `/buscar-telas`     | Lista telas com filtros e paginação |
| POST   | `/cadastrar-tela`   | Cadastra uma nova tela              |
| PUT    | `/editar-tela`      | Edita dados de uma tela             |
| PUT    | `/atualizar-posicao`| Atualiza endereço de telas          |
| PUT    | `/atualizar-status` | Atualiza status de telas            |

### Solicitações de Telas

| Método | Rota                            | Descrição                              |
|--------|---------------------------------|----------------------------------------|
| GET    | `/solicitacoes-telas`           | Lista solicitações com filtros         |
| GET    | `/solicitacoes-telas/:id`       | Busca uma solicitação pelo ID          |
| POST   | `/solicitacoes-telas`           | Cria nova solicitação                  |
| PUT    | `/solicitacoes-telas/:id/attend`| Aceita ou recusa o pedido              |
| PUT    | `/solicitacoes-telas/:id/start` | Inicia gravação ou move p/ manutenção  |
| PUT    | `/solicitacoes-telas/:id/complete` | Conclui a gravação                  |
| PUT    | `/solicitacoes-telas/:id/deliver`  | Registra retirada da tela           |
| PUT    | `/solicitacoes-telas/:id/return`   | Registra devolução da tela          |

### Utilitários

| Método | Rota      | Descrição                        |
|--------|-----------|----------------------------------|
| GET    | `/`       | Verifica se o servidor está ativo |
| GET    | `/health` | Health check com status do banco e schema |

## Fluxo de status das solicitações

```
pedido → aceito → gravacao → concluido → entregue → devolvido
           ↓         ↑
        reprovado  setor_em_manutencao → reprovado
```

## Controle de acesso

### Criar solicitações (`POST /solicitacoes-telas`)
Restrito às seguintes matrículas:

| Matrícula |
|-----------|
| 3018729   |
| 3012909   |
| 3022878   |
| 3005465   |
| 3013869   |

### Gerenciar solicitações (attend / start / complete / deliver / return)
Restrito às seguintes matrículas:

| Matrícula |
|-----------|
| 3015489   |
| 3014385   |
| 3016764   |
| 3014530   |
| 3026004   |
| 3015451   |
| 3020013   |
| 3012557   |
| 3019908   |
| 3020744   |
| 3021787   |

## Banco de dados

O servidor executa migrações automáticas no startup para a tabela `fabrica.controle_telas_prateleiras` (adiciona colunas, índices e corrige dados legados). O schema da tabela `fabrica.solicitacao_tela` é verificado e logado, mas não é criado automaticamente.
