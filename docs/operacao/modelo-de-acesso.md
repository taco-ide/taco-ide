# Modelo operacional de acesso

Guia curto para a equipe interna e para a operação do MVP: como uma
instituição entra no TACO, quem pode fazer o quê e o que acontece
automaticamente. Os detalhes técnicos (endpoints, erros, limites) estão nos
documentos linkados ao final.

## 1. Papéis

Há dois eixos independentes:

- **Platform Admin** (equipe TACO): flag global `user.isPlatformAdmin`. É o
  único perfil que cria, edita, desativa e reativa organizações, vincula ou
  remove membros diretamente, move usuários entre organizações e promove
  outros Platform Admins. Acessa o painel `/admin`.
- **Papel na organização** (`member.role`), com hierarquia
  `student < teacher < coordinator < admin`. Um usuário pode ter papéis
  diferentes em organizações diferentes. `admin` e `coordinator` gerenciam
  as pessoas da própria organização; o ciclo de vida da organização (criar,
  editar, desativar) é do Platform Admin.

Ser `admin` de uma organização **não** dá poderes de Platform Admin.

## 2. Como uma instituição entra na plataforma

1. **Platform Admin inicial.** É criado pelo seed (`npm run db:seed`) a partir
   de `PLATFORM_ADMIN_EMAIL`, `PLATFORM_ADMIN_PASSWORD` e
   `PLATFORM_ADMIN_NAME`. Sem essas variáveis o passo é ignorado. Outros
   Platform Admins são promovidos depois em `/admin/users`.
2. **Organização.** O Platform Admin cria a organização em
   `/admin/organizations` e vira o primeiro `admin` dela.
3. **Coordenação.** O Platform Admin convida o coordenador da instituição
   (convite com papel `coordinator`) ou vincula uma conta já existente.
4. **Professores e alunos.** A partir daí, o coordenador (ou o Platform
   Admin) adiciona as pessoas por um dos três caminhos da seção 3.

## 3. Formas de adicionar pessoas

| Caminho | Quem configura | O que é automático | Papéis possíveis |
| --- | --- | --- | --- |
| **Convite por email** | Coordenador+ da org ou Platform Admin | Envio do email; a pessoa entra na org ao aceitar o link (`/auth/accept-invitation`) logada com o mesmo email | Qualquer papel |
| **Domínio de email** | Coordenador+ da org ou Platform Admin | Todo **novo cadastro** com email `@dominio` entra na org com o papel da regra | `student`, `teacher`, `coordinator` (nunca `admin`) |
| **Importação CSV** | Coordenador+ da org ou Platform Admin | Cria as contas que faltam e vincula todas de uma vez (até 100 linhas) | Qualquer papel |
| **Vínculo direto** | Somente Platform Admin | Adiciona uma conta já existente, sem convite | Qualquer papel |

Observações operacionais:

- **Convites** expiram e são cancelados se a organização for desativada. A
  pessoa precisa entrar com exatamente o email convidado.
- **Domínios** valem só no cadastro: não reprocessam usuários antigos, e
  remover a regra não remove membros. Qualquer pessoa com uma caixa de email
  naquele domínio recebe o papel da regra, então prefira domínios
  específicos (ex.: `@aluno.escola.edu.br` → `student`) e evite regras de
  `coordinator` em domínios amplos.
- **CSV** gera senhas temporárias quando a coluna de senha está vazia. Elas
  aparecem uma única vez no relatório e devem ser entregues por fora do
  sistema. A importação não envia email.

## 4. O que exige ação administrativa

Regras de produto pretendidas. As rotas do produto (`/v1/organizations/...`)
já as aplicam; veja a lacuna conhecida no fim da seção 5.

| Ação | Quem pode |
| --- | --- |
| Criar, editar, desativar ou reativar organização | Platform Admin |
| Excluir organização | Ninguém pelo app (não há exclusão; desative) |
| Vincular conta existente sem convite, remover membro | Platform Admin |
| Mover usuário entre organizações | Platform Admin |
| Promover ou despromover Platform Admin | Platform Admin (não pode despromover o último nem a si mesmo) |
| Alterar papel de um membro | Coordenador+ da própria org ou Platform Admin |
| Convidar, importar CSV, configurar domínios | Coordenador+ da própria org ou Platform Admin |

Mudanças de papel não derrubam a sessão e valem a partir da próxima
requisição: a API lê o `member.role` do banco a cada chamada, sem cache.

## 5. Decisões de segurança

Como na seção 4, os itens abaixo descrevem as regras pretendidas; os desvios
atuais estão listados em "Lacuna conhecida".

- **O cadastro não escolhe papel.** O formulário público cria só a conta. O
  papel vem sempre de um convite, de uma regra de domínio, do CSV ou de uma
  ação administrativa. Campos administrativos (`isPlatformAdmin`,
  `isActive`, `deletedAt`) enviados no cadastro ou na edição de perfil são
  rejeitados com 400.
- **Ninguém vira `admin` por domínio.** A API recusa regras de domínio com
  `admin` e, por defesa em profundidade, o cadastro rebaixa qualquer regra
  legada de `admin` para `teacher`.
- **Só Platform Admin cria organização**, inclusive pelas rotas do Better
  Auth. Não existe autoatendimento para criar organização.
- **Mover pessoas entre organizações** e **remover membros** é exclusivo do
  Platform Admin; a API também impede remover o último `admin` de uma org.
- **Coordenadores agem só na organização ativa** da própria sessão; não
  enxergam nem alteram outras organizações.
- **Só quem já é `admin` concede `admin`.** Convites e mudanças de papel
  feitos por coordenadores passam pelo Better Auth, que recusa atribuir o
  papel `admin` a quem não o tem.

> **Lacuna conhecida ([#140](https://github.com/taco-ide/taco-ide/issues/140)).**
> Os endpoints de organização do Better Auth continuam acessíveis
> diretamente em `/v1/auth/organization/*` e aplicam só as permissões de
> `packages/infra/src/auth/permissions.ts`, não as regras acima. Até a
> correção do #140:
>
> - **Professores** conseguem convidar pessoas (inclusive como
>   `coordinator`) por `/v1/auth/organization/invite-member`.
> - **Coordenadores** conseguem remover membros
>   (`/v1/auth/organization/remove-member`) e editar a organização
>   (`/v1/auth/organization/update`).
> - **`admin` da organização** consegue excluí-la
>   (`/v1/auth/organization/delete`).
> - **Importação CSV** grava o papel direto no banco, sem a trava do Better
>   Auth: um coordenador consegue criar ou vincular contas como `admin`.
> - **Rebaixar um `admin`** pela rota de papel grava direto no banco: um
>   coordenador consegue rebaixar um `admin` quando a org tem mais de um.
>
> Quando o #140 for integrado, remova esta nota.

<!-- TODO(produto, #140): confirmar se o `admin` da organização deve poder
conceder `admin` pela importação CSV ou se isso fica restrito ao Platform
Admin. -->

## 6. Usuário sem organização

Quem entra sem convite, sem domínio mapeado ou depois de ser removido não
fica solto em `/explore`: o app mostra a tela de primeiro acesso, que

- explica que o acesso é liberado pela instituição e sugere os próximos
  passos (procurar o email de convite, pedir um convite ao coordenador ou ao
  administrador da instituição, cadastrar-se com o email institucional se
  houver domínio mapeado);
- lista os convites pendentes para o email da pessoa (só depois de o email ser
  verificado), com link para aceitá-los;
- diferencia o caso de organização desativada (enquanto a situação carrega,
  mostra só um aviso neutro de "verificando", e um erro se a consulta
  falhar);
- tem o botão **Verificar meu acesso**, que recarrega a sessão assim que a
  pessoa for adicionada (ou avisa se a verificação falhar), e o botão de
  sair.

Não há como criar uma organização a partir dessa tela. Platform Admins não
veem essa tela, porque o acesso deles é global.

## 7. Referências

- [Admin Panel: visão geral e matriz RBAC](../admin-panel/README.md)
- [Organizações](../admin-panel/organizations.md) ·
  [Membros e papéis](../admin-panel/members-and-roles.md) ·
  [Convites](../admin-panel/invitations.md) ·
  [Domínios de email](../admin-panel/email-domains.md) ·
  [Importação CSV](../admin-panel/csv-import.md) ·
  [Emails](../admin-panel/emails.md)
- [Limites de autoatendimento na autenticação](../security/auth-boundaries.md)
- [Política de acesso a recursos](../security/resource-access.md)
