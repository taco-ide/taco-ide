# TACO-IDE

[English](#english) | [Português](#português)

## English

### Overview

TACO-IDE is an intelligent platform designed to help teachers create and manage Python programming exercises with AI support. It provides a seamless environment for both educators and students, focusing on effective learning through personalized feedback and adaptive content.

### Key Features

#### For Teachers

- Create and manage custom exercises
- Define allowed libraries and constraints
- Share exercises publicly or privately
- Automated grading with AI support
- Student progress tracking and analytics

#### For Students

- Intelligent IDE with real-time feedback
- Personalized AI support
- Contextual hints and guidance
- Safe learning environment
- Community-driven exercise repository

### Getting Started

#### Prerequisites

- Node.js 18.18 or higher
- Docker and Docker Compose
- Git

1. Clone the repository:

```bash
git clone https://github.com/taco-ide/taco.git
cd taco
```

2. Install dependencies:

```bash
npm install
```

3. Start the infrastructure (database):

```bash
cd packages/infra
npm run docker:up
```

4. Run database migrations:

```bash
cd packages/infra
npm run db:push
# or for production migrations
npm run db:migrate
```

5. (Optional) Seed the database:

```bash
cd packages/infra
npm run db:seed
```

6. Start the API backend:

```bash
cd apps/api
npm run dev
```

7. Start the frontend (in another terminal):

```bash
cd apps/web
npm run dev
```

8. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Development Flow with Drizzle

When you need to make changes to the database schema:

1. Modify the schema in `packages/infra/src/db/schema/`
2. Generate and apply migrations:

```bash
cd packages/infra
npm run db:generate  # Generate migration
npm run db:migrate   # Apply migration
# or for development
npm run db:push      # Push schema directly (no migration)
```

3. To view and manage data using Drizzle Studio:

```bash
cd packages/infra
npm run db:studio
```

4. After updating API routes, regenerate code for the frontend:

```bash
cd apps/api
npm run kubb
```

### Architecture

This is a **monorepo** with the following structure:

- `apps/api` - Fastify backend with typed routes
- `apps/web` - Next.js frontend
- `packages/infra` - Shared infrastructure (Database, Auth, Docker)
- `packages/types` - Shared TypeScript types

### Technologies

**Frontend:**
- Next.js 16
- TypeScript
- Tailwind CSS
- React Query
- Better Auth

**Backend:**
- Fastify
- Drizzle ORM
- PostgreSQL
- Zod validation
- Better Auth

**Infrastructure:**
- Docker
- Turbo (Monorepo)
- Resend (Emails)

---

## Português

### Visão Geral

O TACO-IDE é uma plataforma inteligente projetada para ajudar professores a criar e gerenciar exercícios de programação em Python com suporte de IA. Oferece um ambiente integrado para educadores e estudantes, focando no aprendizado efetivo através de feedback personalizado e conteúdo adaptativo.

### Principais Recursos

#### Para Professores

- Crie e gerencie exercícios personalizados
- Defina bibliotecas permitidas e restrições
- Compartilhe exercícios pública ou privadamente
- Correção automatizada com suporte de IA
- Acompanhamento de progresso e análise de dados

#### Para Alunos

- IDE inteligente com feedback em tempo real
- Suporte de IA personalizado
- Dicas e orientações contextualizadas
- Ambiente seguro de aprendizado
- Repositório de exercícios da comunidade

### Como Começar

#### Pré-requisitos

- Node.js 18.18 ou superior
- Docker e Docker Compose
- Git

1. Clone o repositório:

```bash
git clone https://github.com/taco-ide/taco.git
cd taco
```

2. Instale as dependências:

```bash
npm install
```

3. Inicie a infraestrutura (banco de dados):

```bash
cd packages/infra
npm run docker:up
```

4. Execute as migrações do banco:

```bash
cd packages/infra
npm run db:push
# ou para migrações de produção
npm run db:migrate
```

5. (Opcional) Popule o banco de dados:

```bash
cd packages/infra
npm run db:seed
```

6. Inicie o backend da API:

```bash
cd apps/api
npm run dev
```

7. Inicie o frontend (em outro terminal):

```bash
cd apps/web
npm run dev
```

8. Abra [http://localhost:3000](http://localhost:3000) no seu navegador.

### Fluxo de Desenvolvimento com Drizzle

Quando precisar fazer alterações no schema do banco de dados:

1. Modifique o schema em `packages/infra/src/db/schema/`
2. Gere e aplique as migrações:

```bash
cd packages/infra
npm run db:generate  # Gerar migração
npm run db:migrate   # Aplicar migração
# ou para desenvolvimento
npm run db:push      # Push direto do schema (sem migração)
```

3. Para visualizar e gerenciar os dados usando Drizzle Studio:

```bash
cd packages/infra
npm run db:studio
```

4. Após atualizar rotas da API, regenere o código para o frontend:

```bash
cd apps/api
npm run kubb
```

### Arquitetura

Este é um **monorepo** com a seguinte estrutura:

- `apps/api` - Backend Fastify com rotas tipadas
- `apps/web` - Frontend Next.js
- `packages/infra` - Infraestrutura compartilhada (Database, Auth, Docker)
- `packages/types` - Tipos TypeScript compartilhados

### Tecnologias

**Frontend:**
- Next.js 16
- TypeScript
- Tailwind CSS
- React Query
- Better Auth

**Backend:**
- Fastify
- Drizzle ORM
- PostgreSQL
- Validação Zod
- Better Auth

**Infraestrutura:**
- Docker
- Turbo (Monorepo)
- Resend (Emails)

---

## Contributing | Contribuindo

Please read our [Contributing Guidelines](CONTRIBUTING.md) for details on how to submit pull requests, report issues, and contribute to the project.

Por favor, leia nosso [Guia de Contribuição](CONTRIBUTING.md) para detalhes sobre como enviar pull requests, reportar problemas e contribuir com o projeto.

## License | Licença

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

Este projeto está licenciado sob a Licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.
