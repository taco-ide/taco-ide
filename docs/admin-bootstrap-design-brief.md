# Brief de Design — Área Administrativa

> **Issues:** #61, #62, #63, #64, #65
> **Plano técnico:** [`admin-bootstrap-plan.md`](./admin-bootstrap-plan.md)

Lista do que preciso de design para implementar a nova área `/admin` (gerenciar organizações, usuários, papéis, importar CSV, configurar domínios automáticos).

---

## Telas

### 1. Shell `/admin`
Layout raiz com navegação para **Organizações** e **Usuários**. Inclui também a tela de **Acesso negado** (quando o usuário não é platform admin).

### 2. `/admin/organizations` — Lista de organizações
Listagem com busca, filtro de ativas/inativas, paginação e ação para criar nova org. Cada linha tem ações: ver detalhes, editar, desativar/reativar.

### 3. Modal "Nova organização" / "Editar organização"
Form com nome, slug e logo (URL).

### 4. `/admin/organizations/[id]` — Detalhe da organização
Header com nome + status. Três tabs: **Membros**, **Domínios**, **Configurações**.

### 5. Tab Membros
Lista de membros com busca e filtro de role. Cada linha permite alterar role inline, mover para outra org, remover. Botão para adicionar membro com 2 caminhos: **vincular existente** ou **importar CSV**.

### 6. Modal "Vincular usuário existente"
Busca por email/nome + select de role.

### 7. Modal "Importar CSV" — fluxo crítico
Modal com 3 estados:
- **Upload:** seleção do arquivo (.csv, ≤1 MB) + link para template
- **Prévia:** resumo de validação (válidas/inválidas) + tabela das primeiras 50 linhas com status por linha (criar/vincular/ignorar/erro)
- **Resultado:** resumo final + tabela completa com filtro por status + download do relatório

### 8. Modal "Mover usuário para outra org"
Select de org destino + select de role na nova org + aviso sobre perda de acesso.

### 9. Tab Domínios
Form inline para adicionar (domínio + role) + tabela com domínios configurados e ação remover.

### 10. Tab Configurações
Form de edição da org (mesmos campos da criação) + ação de desativar/reativar.

### 11. `/admin/users` — Busca global de usuários
Input de busca + tabela com nome, email, organizações (com role), toggle de **Platform Admin** por linha.

### 12. AlertDialog "Toggle platform admin"
Confirmação para promover OU rebaixar. Variante especial: tentar se rebaixar sendo o **único** platform admin (bloqueio).

---

## Estados que cada tela com dados precisa

- Loading
- Empty (sem registros)
- Empty pós-busca (sem resultados)
- Erro de carregamento
- Erro de ação (validação, conflito, permissão)

---

## Edge cases que afetam o visual

- **Último admin da org:** linha não pode ser removida — precisa de indicação visual
- **Único platform admin:** toggle de auto-rebaixamento bloqueado — precisa de estado específico
- **Org desativada:** decidir se tabs/ações ficam read-only ou bloqueadas
- **Conflito de domínio (UNIQUE):** mensagem precisa indicar qual org já usa
- **Usuário em muitas orgs:** como mostrar quando passa de N na tabela de `/admin/users`
- **CSV grande (até 500 linhas):** tabela de prévia precisa de paginação ou scroll virtualizado

---

## Decisões que dependem do design

1. Sidebar fixa ou colapsável?
2. CSV: modal único com 3 estados ou 3 telas separadas?
3. `/admin/users`: lista por padrão ou só após buscar?
4. Mobile: responsivo no MVP ou só desktop/tablet?

---

## Fora de escopo

- Tela de primeiro acesso (#66)
- Dashboard pós-login (#74)
- Tutoriais (#67–#72)
- Upload de logo (só URL no MVP)
- Logs/auditoria
- Impersonate, banir usuário
