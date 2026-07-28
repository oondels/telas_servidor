# AGENTS.md — servidor-telas

## Objetivo

Você é um agente de desenvolvimento do projeto `servidor-telas`, uma API REST em TypeScript para gerenciamento do ciclo de vida de telas de serigrafia.

Mantenha o trabalho focado, seguro, consistente com a arquitetura existente e limitado ao escopo solicitado.

## Antes de alterar

1. Identifique o módulo afetado.
2. Leia apenas as specs relacionadas:

   * visão geral: `spec/DESIGN_SPEC.md`
   * arquitetura: `spec/backend/ARCHITECTURE.md`
   * rotas e contratos: `spec/backend/ROUTES.md`
   * regras de negócio: `spec/backend/BUSINESS_RULES.md`
   * integrações e ambiente: `spec/backend/INTEGRATIONS.md`
3. Inspecione a implementação e os testes existentes.
4. Verifique o estado do Git e preserve alterações não relacionadas.

## Regras obrigatórias

* Preserve a separação entre domínio, aplicação, infraestrutura, persistência e HTTP.
* Não coloque regras de negócio em controllers ou entidades TypeORM.
* Controllers apenas adaptam HTTP e chamam casos de uso.
* Casos de uso concentram regras, permissões e orquestração.
* Repositories encapsulam persistência, consultas e transações.
* Use `AppError`, `sendSuccess` e `sendError`.
* Mantenha rotas de negócio protegidas por `verifyToken`.
* Autorizações devem usar usuário ativo e papel carregados do banco.
* Não altere rotas, payloads, status HTTP ou transições sem atualizar a spec correspondente.
* Não exponha nem versione segredos, JWT, cookies, credenciais ou dados sensíveis.
* Não adicione dependências sem necessidade concreta.
* Não altere arquivos fora do escopo nem faça refactors oportunistas.

## Padrões do projeto

* TypeScript estrito.
* ESM com imports usando extensão `.js`.
* Preferir `async/await`.
* Validar dados e permissões no backend.
* Seguir os padrões já existentes antes de criar novas abstrações.

## Estrutura principal

* `src/modules/telas`
* `src/modules/solicitacoes`
* `src/modules/users`
* `src/modules/audit`
* `src/modules/config`
* `src/infrastructure/http`
* `src/infrastructure/database`
* `src/shared`
* `src/config`
* `spec`

## Conclusão da tarefa

Antes de finalizar:

1. Revise o diff.
2. Execute os scripts aplicáveis do `package.json`, como lint, testes, typecheck e build.
3. Atualize testes e specs quando houver mudança de comportamento.
4. Confirme que não há segredos, artefatos gerados ou mudanças não relacionadas.
5. Informe o que foi alterado, as validações executadas e qualquer limitação real.

Não declare que uma validação passou sem executá-la.

## Git

* Use Conventional Commits.
* Não faça force push.
* Não faça commit direto em `main` ou `master`.
* Só crie commits quando solicitado.
* Para commits, siga `.codex/skills/commit-changes/SKILL.md`.
