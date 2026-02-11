# TACO-IDE TODO List

## Autenticação e Usuários

- [x] Simplificar cadastro: Todos os usuários começam como 'student' por padrão (remover opção de escolha inicial).
  - _Nota: Considerar como/quando um usuário se torna 'professor'._
- [ ] Definir modelo de dados para Usuários (professores e alunos).
- [x] Implementar login sem autenticação de dois fatores (2FA).
- [x] Configurar duração da sessão do usuário para 7 dias.
- [x] Verificar implementação de hashing de senha:
  - [x] Confirmar uso de biblioteca segura (ex: bcrypt).
  - [x] Garantir que salts únicos por usuário são gerados e armazenados com o hash.

## Entidades Principais

- [ ] **Entidade: Turmas (Classes)**
  - [ ] Relacionamento N:N com Usuários (professores e alunos).
  - [ ] Mecanismo de convite/acesso por lista de e-mails (gerenciado pelo professor).
  - [ ] Campos: Nome, Descrição, `createdAt`, `updatedAt`.
  - [ ] Relacionamento 1:N com Problemas.
  - [ ] Controle de acesso: Apenas professores podem criar/gerenciar turmas.
- [ ] **Entidade: Problemas (Exercises)**
  - [ ] Relacionamento 1:N com Usuário (criador/professor).
  - [ ] Campos: Título, Descrição/Enunciado (Markdown?), `createdAt`, `updatedAt`, Data de Vencimento (opcional).
  - [ ] Relacionamento 1:N com ProblemSession.
  - [ ] Possibilidade de definir bibliotecas permitidas/restrições (conforme README).
  - [ ] Campo: `difficulty` (Enum: EASY, MEDIUM, HARD).
  - [ ] Relacionamento N:N com `Tag`.
- [ ] **Entidade: ProblemSession (Student Attempt)**
  - [ ] Relacionamento N:1 com Problema.
  - [ ] Relacionamento N:1 com Usuário (aluno).
  - [ ] Campos: Código atual, Status (iniciado, submetido, finalizado), `createdAt`, `updatedAt`, `finishedAt` (opcional).
  - [ ] Relacionamento 1:N com `ChatThread` (ver seção AI).
- [ ] **Entidade: Tag**
  - [ ] Campos: `name` (string, unique).
  - [ ] Relacionamento N:N com `Problemas`.

## Funcionalidades AI / Chat

- [ ] **Modelagem do Chat (Gerenciamento de Contexto):**
  - [ ] **Entidade: `ChatThread`** (Tópico/Conversa dentro de uma `ProblemSession`)
    - [ ] Relacionamento N:1 com `ProblemSession`.
    - [ ] Campos: Título (opcional, gerado ou pelo usuário?), `createdAt`.
    - [ ] Relacionamento 1:N com `MensagemChat`.
  - [ ] **Entidade: `MensagemChat`** (Antigo `HistoricoChat`)
    - [ ] Relacionamento N:1 com `ChatThread`.
    - [ ] Campos: `role` ('user' ou 'assistant'), `content` (texto da mensagem), `timestamp`.
  - _Nota:_ Isso permite que o usuário crie várias threads de conversa dentro da mesma sessão de problema, limitando o contexto enviado à IA a uma thread específica (ou resumo dela), abordando a preocupação com performance.
- [ ] Implementar lógica de interação com a IA (localmente ou serviço interno).
  - [ ] Definir como o contexto da `ChatThread` será enviado (últimas N mensagens, resumo, etc.).

## Requisitos Técnicos

- [ ] Configurar controle de acesso com CASL.
- [ ] Definir/Refinar schema do Drizzle (`packages/infra/src/db/schema/`) para todas as entidades (incluindo `ChatThread`, `MensagemChat`, `Tag`, e relacionamento N:N Problema-Tag).
- [ ] Implementar Migrations do Drizzle.
- [ ] Implementar Seed do banco de dados (se necessário).
