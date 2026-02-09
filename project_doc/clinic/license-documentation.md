# Documentação Experimental - Minha Licença

- **Última atualização**: 09/02/2026
- **Status**: Em desenvolvimento
- **Responsável**: Engenharia Reversa (Claude)
- **Versão**: 2.0

---

## 1. Visão Geral

Página dedicada à exibição detalhada da licença ativa da clínica. Mostra status da licença, informações do plano, número máximo de usuários, período de vigência, tempo restante, funcionalidades incluídas e alertas de expiração.

- **Arquivo**: `src/app/(clinic)/clinic/license/page.tsx`
- **Rota**: `/clinic/license`
- **Tipo**: Client Component (`"use client"`)
- **Componente principal**: `LicensePage`
- **Dependências principais**:
  - `useAuth` (hook — `user` e `tenantId`)
  - `getActiveLicenseByTenant`, `getDaysUntilExpiration`, `isLicenseExpiringSoon` de `@/lib/services/licenseService`
  - `doc`, `getDoc` do Firebase Firestore (acesso direto ao tenant)
  - Tipos: `License`, `Tenant` de `@/types`
  - Componentes Shadcn/ui: `Button`
  - Ícones Lucide: `CheckCircle`, `XCircle`, `Clock`, `AlertTriangle`, `Calendar`, `Users`, `Package`

---

## 2. Tipos de Usuários

| Tipo | Acesso | Permissões |
|------|--------|------------|
| `clinic_admin` | Total | Visualiza todas as informações de licença |
| `clinic_user` | Total | Visualiza todas as informações de licença (sem restrição de role) |
| `clinic_consultant` | Total | Visualiza todas as informações de licença |
| `system_admin` | N/A | Não acessa rotas do módulo clínica |

**Nota**: A página não possui restrição de role — todos os usuários autenticados do tenant podem visualizar.

---

## 3. Estrutura de Dados

### 3.1 Documento — `tenants/{tenantId}` (Tenant)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | `string` | ID do tenant |
| `document_type` | `string` | `"cpf"` (autônomo) ou `"cnpj"` (clínica) |
| `max_users` | `number` | Máximo de usuários (default 5 para CNPJ) |

### 3.2 License (via `licenseService`)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `status` | `string` | `"ativa"`, `"expirada"`, `"suspensa"`, `"pendente"` |
| `start_date` | `Timestamp` | Data de início da licença |
| `end_date` | `Timestamp` | Data de término da licença |
| `auto_renew` | `boolean` | Se renovação é automática |

### 3.3 Estado do Componente (useState)

```typescript
const [license, setLicense] = useState<License | null>(null);
const [tenant, setTenant] = useState<Tenant | null>(null);
const [loading, setLoading] = useState(true);
```

### 3.4 Valores Derivados

```typescript
const daysRemaining = getDaysUntilExpiration(license);  // número de dias
const expiringSoon = isLicenseExpiringSoon(license);      // boolean
```

---

## 4. Casos de Uso

### UC-001: Visualizar status atual da licença

- **Ator**: clinic_admin, clinic_user
- **Pré-condição**: Usuário autenticado com `tenantId`
- **Fluxo**:
  1. Usuário acessa `/clinic/license`
  2. `loadData()` carrega licença e tenant em paralelo (`Promise.all`)
  3. Banner de status exibido com cor e ícone conforme status da licença
- **Pós-condição**: Status da licença visível

### UC-002: Verificar plano e limites

- **Ator**: clinic_admin, clinic_user
- **Fluxo**:
  1. Cards de info exibem: Plano (Autônomo/Clínica), Máx. Usuários, Renovação (Automática/Manual)
  2. Plano determinado por `document_type`: CPF = "Autônomo", CNPJ = "Clínica"
  3. Máx. usuários: CPF = 1, CNPJ = `tenant.max_users` ou 5
- **Pós-condição**: Informações do plano visíveis

### UC-003: Visualizar período e tempo restante

- **Ator**: clinic_admin, clinic_user
- **Fluxo**:
  1. Card "Período" exibe data início, data término e tempo restante
  2. Tempo restante com cores: verde (normal), laranja (expirando), vermelho (expirada)
- **Pós-condição**: Período visível com indicação visual

### UC-004: Verificar funcionalidades do plano

- **Ator**: clinic_admin, clinic_user
- **Fluxo**:
  1. Card "Funcionalidades Incluídas" lista features com checkmarks verdes
  2. Lista dinâmica baseada em `document_type`:
     - Base (8 features para todos)
     - CNPJ adiciona 4 features (multi-usuário, permissões, relatórios avançados, dashboard)
     - CPF adiciona 1 feature (gestão individual)
- **Pós-condição**: Lista de funcionalidades visível

### UC-005: Receber alerta de expiração

- **Ator**: clinic_admin, clinic_user
- **Fluxo**:
  1. Se `isLicenseExpiringSoon(license)` retorna true:
  2. Banner muda para cor laranja
  3. Alerta lateral com AlertTriangle exibido
  4. Orientação para contatar administrador
- **Pós-condição**: Alerta visual de expiração próxima

---

## 5. Fluxo de Processo

```
┌─────────────────────────┐
│ Usuário acessa           │
│ /clinic/license          │
└───────────┬─────────────┘
            │
            ▼
    ┌───────────────┐     Não
    │ tenantId existe?├─────────► loading = false
    └───────┬───────┘
            │ Sim
            ▼
┌─────────────────────────┐
│ Promise.all:             │
│  1. getActiveLicense()   │
│  2. loadTenant()         │
└───────────┬─────────────┘
            │
      ┌─────┴─────┐
      │           │
  Com licença   Sem licença
      │           │
      │           ▼
      │     Tela "Nenhuma Licença Ativa"
      │     (XCircle vermelho)
      ▼
┌─────────────────────────┐
│ Calcula:                 │
│  - daysRemaining         │
│  - expiringSoon          │
│  - planName              │
│  - maxUsers              │
│  - features              │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Exibe:                   │
│  - Banner de status      │
│  - Alerta (se expirando) │
│  - Cards de info (3)     │
│  - Período + Features    │
│  - Suporte               │
└─────────────────────────┘
```

---

## 6. Regras de Negócio

### RN-001: Nome do plano por document_type

- **Descrição**: CPF = "Autônomo", CNPJ = "Clínica"
- **Aplicação**: `getPlanName()` verifica `tenant.document_type`
- **Exceções**: Se tenant não carregou, usa "Standard"
- **Justificativa**: Diferenciação visual entre planos

### RN-002: Máximo de usuários por plano

- **Descrição**: CPF = 1 usuário, CNPJ = `tenant.max_users` ou 5 (default)
- **Aplicação**: `getMaxUsers()` com fallbacks
- **Exceções**: Se tenant não carregou, usa 5
- **Justificativa**: Plano CPF é individual; CNPJ é multi-usuário

### RN-003: Licença expirando em breve

- **Descrição**: `isLicenseExpiringSoon` determina se a licença está próxima do vencimento
- **Aplicação**: Altera cor do banner (verde → laranja) e exibe alerta lateral
- **Exceções**: Nenhuma
- **Justificativa**: Notificação proativa para renovação

### RN-004: Funcionalidades por tipo de plano

- **Descrição**: 8 features base para todos; +4 para CNPJ; +1 para CPF
- **Aplicação**: `getFeatures()` monta lista dinamicamente
- **Exceções**: Se tenant não carregou, retorna apenas 6 features básicas
- **Justificativa**: Diferenciar valor entre planos

### RN-005: Carregamento paralelo

- **Descrição**: Licença e tenant são carregados em paralelo via `Promise.all`
- **Aplicação**: `Promise.all([getActiveLicenseByTenant, loadTenant])`
- **Exceções**: Se qualquer um falhar, silencia com try/catch
- **Justificativa**: Performance — dados independentes

### RN-006: Renovação automática vs manual

- **Descrição**: Exibe "Automática" se `license.auto_renew === true`, "Manual" caso contrário
- **Aplicação**: Ternário no JSX
- **Exceções**: Nenhuma
- **Justificativa**: Informação importante para o administrador

### RN-007: Sem licença ativa

- **Descrição**: Se não existe licença ativa, exibe tela de erro dedicada
- **Aplicação**: `if (!license)` renderiza card vermelho com XCircle
- **Exceções**: Nenhuma
- **Justificativa**: Orientar usuário a contatar administrador

---

## 7. Estados da Interface

| Estado | Comportamento | Visual |
|--------|---------------|--------|
| Carregando | Spinner centralizado | `animate-spin` |
| Sem licença | Card vermelho com XCircle e orientação para contato | `bg-red-50 border-2 border-red-200` |
| Licença ativa | Banner verde + cards info + período + features | `bg-green-50 border-green-200` |
| Licença ativa (expirando) | Banner laranja + alerta lateral | `bg-orange-50 border-orange-200` + `border-l-4 border-orange-500` |
| Licença expirada | Banner vermelho | `bg-red-50 border-red-200` |
| Licença suspensa | Banner laranja com AlertTriangle | `bg-orange-50 border-orange-200` |
| Licença pendente | Ícone Clock amarelo | `text-yellow-600` |

### Cores do Tempo Restante

| Condição | Cor |
|----------|-----|
| Normal (> threshold) | `text-green-600` |
| Expirando em breve | `text-orange-600` |
| Expirada (< 0 dias) | `text-red-600` |

---

## 8. Validações

### 8.1 Validações no Frontend

| Validação | Condição | Comportamento |
|-----------|----------|---------------|
| `tenantId` ausente | `!tenantId` | `loading = false`, nada exibido |
| Licença não encontrada | `!license` | Tela "Nenhuma Licença Ativa" |
| Tenant não encontrado | `!tenant` | Usa defaults: "Standard", 5 usuários, features básicas |

---

## 9. Integrações

| Integração | Tipo | Descrição |
|------------|------|-----------|
| Firebase Auth | Autenticação | `useAuth()` fornece `tenantId` |
| Firestore — tenants | Leitura direta | `getDoc(doc(db, "tenants", tenantId))` para dados do tenant |
| `licenseService` | Serviço | `getActiveLicenseByTenant`, `getDaysUntilExpiration`, `isLicenseExpiringSoon` |
| Email | Contato | Link `mailto:scandelari.guilherme@curvamestra.com.br` |

---

## 10. Segurança

| Aspecto | Implementação |
|---------|---------------|
| Autenticação | `useAuth()` verifica se há usuário logado |
| Multi-tenant | `tenantId` isola dados por tenant |
| Autorização | Sem restrição de role — todos os usuários do tenant podem ver |
| Firestore RLS | Regras garantem `request.auth.token.tenant_id == tenantId` |
| Dados sensíveis | Apenas dados de licença e plano são exibidos (sem dados financeiros) |

---

## 11. Performance

| Aspecto | Implementação |
|---------|---------------|
| Carregamento paralelo | `Promise.all` para licença e tenant |
| Funções computadas | `getPlanName`, `getMaxUsers`, `getFeatures` são funções simples (sem queries adicionais) |
| Dados locais | Após carregamento, todos os dados ficam no state |
| Sem re-fetch | Dados carregados uma vez no mount |

---

## 12. Acessibilidade

| Aspecto | Status | Detalhes |
|---------|--------|----------|
| Ícones de status | Sim | Ícones + texto descritivo do status |
| Cores semânticas | Parcial | Cores indicam status mas dependem de texto complementar |
| Link de email | Sim | `<a href="mailto:...">` com texto visível |
| Checkmarks de features | Sim | CheckCircle + texto da funcionalidade |
| Spinner de loading | Parcial | Sem `aria-label` ou `role="status"` |

---

## 13. Testes

### 13.1 Cenários de Teste Recomendados

| Cenário | Tipo | Descrição |
|---------|------|-----------|
| Licença ativa (normal) | E2E | Verificar banner verde e tempo restante |
| Licença ativa (expirando) | E2E | Verificar banner laranja e alerta lateral |
| Licença expirada | E2E | Verificar banner vermelho e texto "Expirada" |
| Sem licença | E2E | Verificar tela de erro com XCircle |
| Plano CPF (Autônomo) | E2E | Verificar nome, 1 usuário e features CPF |
| Plano CNPJ (Clínica) | E2E | Verificar nome, 5 usuários e features CNPJ |
| Renovação automática | E2E | Verificar texto "Automática" no card |
| Renovação manual | E2E | Verificar texto "Manual" no card |
| Data formatada | Unitário | Verificar formato "DD de mês de AAAA" |
| Tenant não encontrado | Integração | Verificar fallbacks (Standard, 5, features base) |
| Link de suporte | E2E | Verificar mailto link |

---

## 14. Melhorias Futuras

| Melhoria | Prioridade | Descrição |
|----------|------------|-----------|
| Renovação direta | Alta | Botão para renovar licença sem contatar admin |
| Histórico de licenças | Média | Exibir licenças anteriores |
| Upgrade de plano | Média | Permitir upgrade de CPF para CNPJ |
| Dados de uso | Baixa | Exibir uso atual vs limites (ex: 3/5 usuários) |
| Exportar informações | Baixa | Gerar PDF com dados da licença |

---

## 15. Dependências e Relacionamentos

```
license (este doc)
├── useAuth (hook) — tenantId e user
├── licenseService
│   ├── getActiveLicenseByTenant — busca licença ativa
│   ├── getDaysUntilExpiration — calcula dias restantes
│   └── isLicenseExpiringSoon — verifica se está expirando
├── Firestore — tenants/{tenantId} (leitura direta)
└── types — License, Tenant
```

### Páginas relacionadas

| Página | Relação |
|--------|---------|
| `/clinic/my-clinic?tab=license` | Aba de licença na página "Minha Clínica" (LicenseTab) |
| Setup | Fluxo de configuração inicial da licença |

---

## 16. Observações Técnicas

- A página carrega dados diretamente do Firestore (via `getDoc`) para o tenant, e via service (`licenseService`) para a licença.
- A função `formatDate` formata timestamps do Firestore com mês por extenso em português (ex: "07 de fevereiro de 2026").
- O alerta de expiração aparece como um box com `border-l-4 border-orange-500` quando a licença está próxima do vencimento.
- A seção de suporte exibe o email `scandelari.guilherme@curvamestra.com.br` como contato para questões de licença.
- A lista de funcionalidades é montada dinamicamente, diferenciando entre planos CPF e CNPJ.
- A página não possui ações de edição ou renovação direta; orientações remetem ao administrador do sistema.
- Se `tenant` não é encontrado, funções usam valores default: "Standard" como plano, 5 usuários, e lista reduzida de 6 features.
- O `Button` é importado mas não utilizado no componente — possível resquício de implementação anterior.

---

## 17. Histórico de Mudanças

| Data | Versão | Descrição |
|------|--------|-----------|
| 07/02/2026 | 1.0 | Documentação inicial (formato antigo) |
| 09/02/2026 | 2.0 | Padronização para template de 20 seções |

---

## 18. Glossário

| Termo | Descrição |
|-------|-----------|
| `tenantId` | Identificador único da clínica no sistema multi-tenant |
| `License` | Tipo que representa a licença do tenant |
| `Tenant` | Tipo que representa os dados do tenant |
| `document_type` | Tipo de documento do tenant: `"cpf"` (autônomo) ou `"cnpj"` (clínica) |
| `auto_renew` | Flag booleana que indica se a renovação é automática |
| `daysRemaining` | Dias restantes até a expiração da licença |
| `expiringSoon` | Booleano que indica se a licença está próxima do vencimento |
| `FEFO` | First Expired, First Out — método de gestão de estoque por validade |

---

## 19. Referências

- Template: `project_doc/TEMPLATE-page-documentation.md`
- Código-fonte: `src/app/(clinic)/clinic/license/page.tsx`
- Serviço: `src/lib/services/licenseService.ts`
- Types: `src/types/index.ts` (License, Tenant)
- Minha Clínica: `project_doc/clinic/my-clinic-documentation.md`

---

## 20. Anexos

### Anexo A — Banner de Status

| Status | Cor de Fundo | Borda | Ícone | Cor do Ícone |
|--------|-------------|-------|-------|-------------|
| `ativa` | `green-50` | `green-200` | `CheckCircle` | `green-600` |
| `ativa` (expirando) | `orange-50` | `orange-200` | `CheckCircle` | `green-600` |
| `expirada` | `red-50` | `red-200` | `XCircle` | `red-600` |
| `suspensa` | `orange-50` | `orange-200` | `AlertTriangle` | `orange-600` |
| `pendente` | - | - | `Clock` | `yellow-600` |

### Anexo B — Funcionalidades por Plano

**Base (todos):** Gestão de Estoque com FEFO, Controle de Lotes e Validades, Cadastro de Pacientes, Histórico de Procedimentos, Solicitações de Produtos, Relatórios Básicos, Notificações de Vencimento, Alertas de Estoque Baixo

**Adicionais CNPJ:** Gestão Multi-Usuário (até 5), Controle de Permissões, Relatórios Avançados, Dashboard Executivo

**Adicionais CPF:** Gestão Individual

### Anexo C — Estrutura do Layout

```
container py-8
└── space-y-6
    ├── Header: "Minha Licença" + descrição
    ├── Banner de Status (cor por status)
    ├── Alerta lateral (condicional, se expirando)
    ├── Cards de Info (grid 3col): Plano | Usuários | Renovação
    ├── Detalhes (grid 2col):
    │   ├── Card Período: Início, Término, Tempo Restante
    │   └── Card Funcionalidades: Lista com checkmarks
    └── Suporte: Card azul com email de contato
```
