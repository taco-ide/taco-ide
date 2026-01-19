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
# or
yarn install
```

3. Choose your development mode:

#### Quick Start (All-in-one)

```bash
npm run dev
# or
yarn dev
```

This command will automatically set up everything, but might take longer and could make debugging harder. It will:

- Start the required Docker services
- Run database migrations
- Generate Prisma client
- Seed the database
- Start the Next.js development server

#### Step-by-Step Start (Recommended for first run)

```bash
# First time setup
npm run services:up        # or: yarn services:up
npm run prisma:migrate:deploy:dev # or: yarn prisma:migrate:dev
npm run prisma:seed:dev   # or: yarn prisma:seed:dev

# For subsequent development
npm run dev:next          # or: yarn dev:next
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Development Flow with Prisma

When you need to make changes to the database schema, follow these steps:

1. Modify the schema in `infra/prisma/schema.prisma`
2. Generate a new migration and update the client:

```bash
npm run prisma:migrate:dev
# or
yarn prisma:migrate:dev
```

3. To view and manage data using Prisma Studio:

```bash
npm run prisma:studio
# or
yarn prisma:studio
```

4. When you're done developing, you can stop the services:

```bash
npm run services:stop  # Stops containers but preserves data
# or
yarn services:stop    # Stops containers but preserves data

# To remove containers and delete data:
npm run services:down  # Stops and removes containers (will delete database data)
# or
yarn services:down    # Stops and removes containers (will delete database data)
```

### Technologies

- Next.js 14
- TypeScript
- Tailwind CSS
- Prisma
- PostgreSQL
- Docker
- Python (Backend Services)

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
# ou
yarn install
```

3. Escolha seu modo de desenvolvimento:

#### Início Rápido (Tudo-em-um)

```bash
npm run dev
# ou
yarn dev
```

Este comando configurará tudo automaticamente, mas pode demorar mais e dificultar a depuração. Ele irá:

- Iniciar os serviços Docker necessários
- Executar as migrações do banco de dados
- Gerar o cliente Prisma
- Popular o banco de dados
- Iniciar o servidor de desenvolvimento Next.js

#### Início Passo a Passo (Recomendado para primeira execução)

```bash
# Configuração inicial
npm run services:up        # ou: yarn services:up
npm run prisma:migrate:deploy:dev # ou: yarn prisma:migrate:dev
npm run prisma:seed:dev   # ou: yarn prisma:seed:dev

# Para desenvolvimento subsequente
npm run dev:next          # ou: yarn dev:next
```

4. Abra [http://localhost:3000](http://localhost:3000) no seu navegador.

### Fluxo de Desenvolvimento com Prisma

Quando precisar fazer alterações no schema do banco de dados, siga estes passos:

1. Modifique o schema em `infra/prisma/schema.prisma`
2. Gere uma nova migração e atualize o cliente:

```bash
npm run prisma:migrate:dev
# ou
yarn prisma:migrate:dev
```

3. Para visualizar e gerenciar os dados usando o Prisma Studio:

```bash
npm run prisma:studio
# ou
yarn prisma:studio
```

4. Quando terminar o desenvolvimento, você pode parar os serviços:

```bash
npm run services:stop  # Para os containers mas preserva os dados
# ou
yarn services:stop    # Para os containers mas preserva os dados

# Para remover containers e deletar dados:
npm run services:down  # Para e remove os containers (irá deletar os dados do banco)
# ou
yarn services:down    # Para e remove os containers (irá deletar os dados do banco)
```

### Tecnologias

- Next.js 14
- TypeScript
- Tailwind CSS
- Prisma
- PostgreSQL
- Docker
- Python (Serviços Backend)

---

## Contributing | Contribuindo

Please read our [Contributing Guidelines](CONTRIBUTING.md) for details on how to submit pull requests, report issues, and contribute to the project.

Por favor, leia nosso [Guia de Contribuição](CONTRIBUTING.md) para detalhes sobre como enviar pull requests, reportar problemas e contribuir com o projeto.

## License | Licença

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

Este projeto está licenciado sob a Licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.
