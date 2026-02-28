# Documentação Experimental - Detalhes da Licença

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Administração do Sistema
**Componente:** Detalhes da Licença (`/admin/licenses/[id]`)
**Versão:** 1.1
**Data:** 10/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Página de detalhes e gerenciamento de uma licença específica. Exibe banner de status colorido com alertas visuais de expiração, informações completas da licença (tenant, plano, datas, funcionalidades) e ações de gerenciamento contextuais baseadas no status (renovar, suspender, reativar, deletar). Calcula e exibe dias restantes até expiração com alertas em cores (verde/laranja/vermelho). Utiliza `licenseService` para todas as operações CRUD.

### 1.1 Localização
- **Arquivo:** `src/app/(admin)/admin/licenses/[id]/page.tsx`
- **Rota:** `/admin/licenses/{id}`
- **Layout:** Admin Layout (grupo `(admin)`)
- **Tipo:** Client Component (`"use client"`)
- **Parâmetro dinâmico:** `[id]` — ID da licença no Firestore

### 1.2 Dependências Principais
- **licenseService:** `src/lib/services/licenseService.ts` — `getLicenseById()`, `getDaysUntilExpiration()`, `renewLicense()`, `suspendLicense()`, `reactivateLicense()`, `deleteLicense()`
- **PLANS constant:** `src/lib/constants/plans.ts` — informações dos planos
- **Utils:** `formatTimestamp()` de `src/lib/utils`
- **Types:** `License`, `LicenseStatus` de `src/types/index.ts`
- **UI:** Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Badge, Alert (shadcn/ui)
- **Ícones:** ArrowLeft, CreditCard, Calendar, Users, CheckCircle, XCircle, AlertTriangle, Clock, RefreshCw, Ban, Trash2 (lucide-react)

---

## 2. Tipos de Usuários / Atores

### 2.1 System Admin (`system_admin`)
- **Descrição:** Administrador global da plataforma Curva Mestra
- **Acesso:** Visualizar detalhes completos da licença, renovar, suspender, reativar, deletar
- **Comportamento:** Ações disponíveis variam conforme status da licença; todas requerem confirmação
- **Restrições:** Único tipo de usuário com acesso; controle feito pelo Admin Layout via custom claims `is_system_admin`

---

## 3. Estrutura de Dados

### 3.1 Interface License

```typescript
// Importado de src/types/index.ts
export interface License {
  id: string;                        // ID do documento no Firestore
  tenant_id: string;                 // ID do tenant proprietário
  plan_id: string;                   // "semestral" | "anual" | "early_access"
  max_users: number;                 // Máximo de usuários permitidos
  features: string[];                // Array de features habilitadas
  start_date: Timestamp;             // Data de início
  end_date: Timestamp;               // Data de término
  status: LicenseStatus;             // "ativa" | "suspensa" | "expirada" | "pendente"
  auto_renew: boolean;               // Renovação automática
  created_at: Timestamp;
  updated_at: Timestamp;
}

export type LicenseStatus = "ativa" | "suspensa" | "expirada" | "pendente";
```

**Campos Principais:**
- **status:** Determina banner de cor e ações disponíveis
- **end_date:** Usado para calcular dias restantes e alertas de expiração
- **features:** Array de strings com funcionalidades habilitadas (ex: "inventory_management", "batch_tracking")
- **auto_renew:** Indica se licença renova automaticamente ao expirar

---

## 4. Casos de Uso

### 4.1 UC-001: Visualizar Detalhes da Licença

**Ator:** System Admin
**Pré-condições:**
- Usuário autenticado como `system_admin`
- ID da licença válido na URL
- Licença existe no sistema

**Fluxo Principal:**
1. Página monta e extrai `id` dos parâmetros da rota
2. `getLicenseById(id)` busca licença no Firestore
3. `getDaysUntilExpiration(license)` calcula dias restantes
4. Renderiza banner de status com cor correspondente
5. Exibe 3 cards: Informações, Datas, Funcionalidades
6. Exibe ações disponíveis baseadas no status

**Fluxo Alternativo - Licença não encontrada:**
1. Service retorna null
2. Exibe mensagem "Licença não encontrada"
3. Botão "Voltar para Licenças"

**Pós-condições:**
- Detalhes da licença exibidos
- Ações contextuais disponíveis

**Regra de Negócio:** RN-001, RN-002

---

### 4.2 UC-002: Renovar Licença

**Ator:** System Admin
**Pré-condições:**
- Licença com status "ativa"
- Licença carregada com sucesso

**Fluxo Principal:**
1. Admin clica botão "Renovar Licença"
2. `confirm()` nativo: "Quantos meses deseja renovar? (6 para Semestral, 12 para Anual)"
3. Admin digita número de meses
4. Sistema calcula nova `end_date` = `current_end_date + N meses`
5. `renewLicense(id, newEndDate)` atualiza licença
6. `alert()` nativo: "Licença renovada com sucesso!"
7. Recarrega dados da licença

**Fluxo Alternativo - Cancelar:**
1. Admin cancela o confirm
2. Nenhuma ação executada

**Fluxo Alternativo - Valor inválido:**
1. Admin digita valor não numérico ou vazio
2. Sistema ignora (não renova)

**Pós-condições:**
- `end_date` atualizado
- Dias restantes recalculados
- Status pode mudar de "expirada" para "ativa"

**Regra de Negócio:** RN-003

---

### 4.3 UC-003: Suspender Licença

**Ator:** System Admin
**Pré-condições:**
- Licença com status "ativa"

**Fluxo Principal:**
1. Admin clica botão "Suspender Licença"
2. `confirm()` nativo: "Tem certeza que deseja suspender esta licença?"
3. Se confirmado, `suspendLicense(id)` atualiza status para "suspensa"
4. `alert()` nativo: "Licença suspensa com sucesso!"
5. Recarrega dados da licença

**Pós-condições:**
- Status atualizado para "suspensa"
- Banner muda para cor laranja
- Ações disponíveis mudam (Reativar, Deletar)

**Regra de Negócio:** RN-004

---

### 4.4 UC-004: Reativar Licença

**Ator:** System Admin
**Pré-condições:**
- Licença com status "suspensa"

**Fluxo Principal:**
1. Admin clica botão "Reativar Licença"
2. `confirm()` nativo: "Tem certeza que deseja reativar esta licença?"
3. Se confirmado, `reactivateLicense(id)` atualiza status para "ativa"
4. `alert()` nativo: "Licença reativada com sucesso!"
5. Recarrega dados da licença

**Pós-condições:**
- Status atualizado para "ativa"
- Banner muda para cor verde
- Ações disponíveis mudam (Renovar, Suspender, Deletar)

**Regra de Negócio:** RN-004

---

### 4.5 UC-005: Deletar Licença

**Ator:** System Admin
**Pré-condições:**
- Licença carregada

**Fluxo Principal:**
1. Admin clica botão "Deletar Licença"
2. `confirm()` nativo: "ATENÇÃO: Tem certeza que deseja deletar esta licença? Esta ação não pode ser desfeita."
3. Se confirmado, `deleteLicense(id)` remove licença do Firestore
4. `alert()` nativo: "Licença deletada com sucesso!"
5. `router.push("/admin/licenses")` redireciona para lista

**Fluxo Alternativo - Cancelar:**
1. Admin cancela o confirm
2. Nenhuma ação executada

**Pós-condições:**
- Licença removida do Firestore
- Navegação para lista de licenças

**Regra de Negócio:** RN-005

---

### 4.6 UC-006: Voltar para Lista

**Ator:** System Admin
**Pré-condições:**
- Página carregada

**Fluxo Principal:**
1. Admin clica botão "Voltar" no topo
2. `router.push("/admin/licenses")` navega para lista

**Pós-condições:**
- Navegação para lista de licenças

**Regra de Negócio:** N/A

---

## 5. Fluxo de Processo Detalhado

```
┌─────────────────────────────────────────────────────────────────┐
│           DETALHES DA LICENÇA (/admin/licenses/[id])             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ useEffect mount  │
                    │ loadLicense()    │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ getLicenseById() │
                    └──────────────────┘
                         │         │
                    Existe     Não existe
                         │         │
                         ▼         ▼
              ┌──────────────┐  ┌──────────────┐
              │ setLicense   │  │ "Licença não │
              │ getDaysUntil │  │ encontrada"  │
              │ Expiration() │  └──────────────┘
              └──────────────┘
                      │
                      ▼
         ┌────────────────────────────────┐
         │ RENDER: Banner + 3 Cards       │
         │ ┌─────────────────────────┐    │
         │ │ Banner Status (colorido)│    │
         │ │ Dias restantes + alerta │    │
         │ └─────────────────────────┘    │
         │ ┌─────────────────────────┐    │
         │ │ Card: Informações       │    │
         │ │ Tenant/Plano/Users/Auto │    │
         │ └─────────────────────────┘    │
         │ ┌─────────────────────────┐    │
         │ │ Card: Datas             │    │
         │ │ Início/Fim/Criação/Upd. │    │
         │ └─────────────────────────┘    │
         │ ┌─────────────────────────┐    │
         │ │ Card: Funcionalidades   │    │
         │ │ Lista de features       │    │
         │ └─────────────────────────┘    │
         │ Ações baseadas no status       │
         └────────────────────────────────┘
                      │
         ┌────────────┼────────────┬────────────┐
         │            │            │            │
    [Renovar]  [Suspender]  [Reativar]  [Deletar]
         │            │            │            │
         ▼            ▼            ▼            ▼
  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
  │ confirm()│ │ confirm()│ │ confirm()│ │ confirm()│
  │ meses    │ │ suspender│ │ reativar │ │ ATENÇÃO  │
  └──────────┘ └──────────┘ └──────────┘ └──────────┘
         │            │            │            │
         ▼            ▼            ▼            ▼
  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
  │ renew    │ │ suspend  │ │ reactivate│ │ delete   │
  │ License()│ │ License()│ │ License() │ │ License()│
  └──────────┘ └──────────┘ └──────────┘ └──────────┘
         │            │            │            │
         ▼            ▼            ▼            ▼
  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
  │ alert OK │ │ alert OK │ │ alert OK │ │ alert OK │
  │ Reload   │ │ Reload   │ │ Reload   │ │ Redirect │
  └──────────┘ └──────────┘ └──────────┘ └──────────┘
```

---

## 6. Regras de Negócio

### RN-001: Ações Contextuais por Status
**Descrição:** As ações disponíveis variam conforme o status da licença.
**Aplicação:**
- **ativa:** Renovar, Suspender, Deletar
- **suspensa:** Reativar, Deletar
- **expirada:** Deletar
- **pendente:** Deletar
**Exceções:** Nenhuma
**Justificativa:** Prevenir ações inválidas (ex: suspender licença já suspensa)

### RN-002: Alertas Visuais de Expiração
**Descrição:** Dias restantes são exibidos com cores baseadas em thresholds.
**Aplicação:**
- **≤ 15 dias:** Alerta laranja "⚠️ Expira em X dias"
- **< 0 dias:** Alerta vermelho "Expirou há X dias"
- **> 15 dias:** Texto neutro "Válida por mais X dias"
**Exceções:** Licenças suspendas não exibem alerta de expiração
**Justificativa:** Alertar admin sobre licenças próximas de expirar

### RN-003: Renovação Estende Data de Término
**Descrição:** Renovar adiciona meses à data de término atual (não à data atual).
**Aplicação:** `new_end_date = current_end_date + N meses`
**Exceções:** Se licença expirada, pode resultar em data futura a partir da data expirada
**Justificativa:** Preserva período já pago, não perde dias

### RN-004: Suspensão Não Altera Datas
**Descrição:** Suspender/reativar apenas muda status, não afeta `start_date` ou `end_date`.
**Aplicação:** `updateDoc({ status: "suspensa" })` ou `updateDoc({ status: "ativa" })`
**Exceções:** Nenhuma
**Justificativa:** Suspensão é temporária, não altera período contratado

### RN-005: Deleção Permanente
**Descrição:** Deletar licença é permanente e irreversível.
**Aplicação:** `deleteDoc` remove documento do Firestore
**Exceções:** Nenhuma verificação de dependências (tenant continua existindo)
**Justificativa:** Simplificação para MVP; em produção deveria verificar impactos

### RN-006: Cálculo de Dias Restantes
**Descrição:** Dias restantes calculados como diferença entre `end_date` e data atual.
**Aplicação:** `Math.ceil((end_date.toDate() - new Date()) / (1000 * 60 * 60 * 24))`
**Exceções:** Valor negativo indica licença expirada
**Justificativa:** Informação crítica para gestão de licenças

---

## 7. Estados da Interface

### 7.1 Estado: Carregando
**Quando:** `loading === true` (durante `loadLicense`)
**Exibição:** "Carregando licença..." centralizado

### 7.2 Estado: Licença Não Encontrada
**Quando:** `loading === false`, `license === null`
**Exibição:** "Licença não encontrada" + botão "Voltar para Licenças"

### 7.3 Estado: Licença Carregada
**Quando:** `license !== null`
**Layout:**
```
[← Voltar]

┌─ Banner Status (colorido, border, p-4) ───────────┐
│ [Ícone Status] Status: [Badge]                    │
│ Dias restantes: X dias (com alerta se aplicável)  │
└────────────────────────────────────────────────────┘

┌─ Card: Informações ────────────────────────────────┐
│ Tenant ID: {tenant_id}                             │
│ Plano: {plan_id}                                   │
│ Máximo de Usuários: {max_users}                   │
│ Renovação Automática: Sim/Não                     │
└────────────────────────────────────────────────────┘

┌─ Card: Datas ──────────────────────────────────────┐
│ Data de Início: DD de mês de AAAA                 │
│ Data de Término: DD de mês de AAAA                │
│ Criada em: DD de mês de AAAA                      │
│ Última Atualização: DD de mês de AAAA             │
└────────────────────────────────────────────────────┘

┌─ Card: Funcionalidades ────────────────────────────┐
│ ✓ Feature 1                                        │
│ ✓ Feature 2                                        │
│ ✓ Feature 3                                        │
└────────────────────────────────────────────────────┘

[Ações baseadas no status]
```

### 7.4 Cores do Banner por Status
| Status | Background | Border | Ícone |
|--------|------------|--------|-------|
| `ativa` | `bg-green-50` | `border-green-200` | CheckCircle (verde) |
| `expirada` | `bg-red-50` | `border-red-200` | XCircle (vermelho) |
| `suspensa` | `bg-orange-50` | `border-orange-200` | AlertTriangle (laranja) |
| `pendente` | `bg-yellow-50` | `border-yellow-200` | Clock (amarelo) |

### 7.5 Badges de Status
| Status | Variante | Texto |
|--------|----------|-------|
| `ativa` | `default` | Ativa |
| `expirada` | `destructive` | Expirada |
| `suspensa` | `secondary` | Suspensa |
| `pendente` | `outline` | Pendente |

### 7.6 Botões de Ação por Status
| Status | Botões Disponíveis |
|--------|-------------------|
| `ativa` | Renovar (default), Suspender (secondary), Deletar (destructive) |
| `suspensa` | Reativar (default), Deletar (destructive) |
| `expirada` | Deletar (destructive) |
| `pendente` | Deletar (destructive) |

---

## 8. Validações

### 8.1 Validações Frontend
- **Renovação:** Valor de meses deve ser numérico e > 0 (validação implícita via `parseInt`)
- **Confirmações:** Todas as ações requerem `confirm()` antes de executar

### 8.2 Validações Backend (licenseService)
- **Existência:** Verifica que licença existe antes de atualizar/deletar
- **Status válido:** Valida que novo status é um dos valores permitidos

### 8.3 Validações de Permissão
- Layout admin verifica role `system_admin` antes de renderizar
- Service não tem validação adicional de permissões (confia no layout)

---

## 9. Integrações

### 9.1 licenseService
- **`getLicenseById(id)`:** Busca licença por ID no Firestore
- **`getDaysUntilExpiration(license)`:** Calcula dias restantes
- **`renewLicense(id, newEndDate)`:** Atualiza `end_date`
- **`suspendLicense(id)`:** Atualiza `status` para "suspensa"
- **`reactivateLicense(id)`:** Atualiza `status` para "ativa"
- **`deleteLicense(id)`:** Remove documento do Firestore

### 9.2 PLANS Constant
- **Uso:** Exibir informações do plano (nome, preço, features)
- **Acesso:** `PLANS[license.plan_id]`

### 9.3 Next.js Router
- **`router.push("/admin/licenses")`:** Navegação para lista

---

## 10. Segurança

### 10.1 Proteções Implementadas
- ✅ Confirmação antes de todas as ações
- ✅ Layout admin restringe acesso por role
- ✅ Deleção com aviso "ATENÇÃO"

### 10.2 Vulnerabilidades Conhecidas
- ⚠️ `confirm()` e `alert()` nativos (UX inconsistente)
- ⚠️ Renovação aceita qualquer número de meses (sem limite)
- ⚠️ Deleção não verifica impactos no tenant
- ⚠️ Service não valida permissões (confia no layout)
- **Mitigação:** Layout admin garante acesso restrito

### 10.3 Dados Sensíveis
- **Tenant ID:** Exibido em texto plano
- **Features:** Lista de funcionalidades habilitadas

---

## 11. Performance

### 11.1 Métricas
- **Carregamento:** 1 read Firestore (getLicenseById)
- **Ações:** 1 write Firestore + 1 reload

### 11.2 Otimizações Implementadas
- ✅ Cálculo de dias restantes client-side (sem query)

### 11.3 Gargalos Identificados
- ⚠️ Reload completo após cada ação (poderia atualizar estado local)

---

## 12. Acessibilidade

### 12.1 Conformidade WCAG
- **Nível:** Parcial (não auditado formalmente)

### 12.2 Recursos Implementados
- ✅ Cards com títulos e descrições semânticas
- ✅ Badges com texto legível
- ✅ Botões com texto descritivo

### 12.3 Melhorias Necessárias
- [ ] Substituir `confirm()` e `alert()` por dialogs acessíveis
- [ ] `aria-label` nos botões de ação
- [ ] Anúncio de mudanças via `aria-live`

---

## 13. Testes

### 13.1 Cenários de Teste Recomendados

| # | Cenário | Tipo | Status |
|---|---------|------|--------|
| T-001 | Carregar licença existente | E2E | Pendente |
| T-002 | Licença não encontrada | E2E | Pendente |
| T-003 | Renovar licença (6 meses) | E2E | Pendente |
| T-004 | Suspender licença ativa | E2E | Pendente |
| T-005 | Reativar licença suspensa | E2E | Pendente |
| T-006 | Deletar licença | E2E | Pendente |
| T-007 | Cálculo de dias restantes | Unitário | Pendente |
| T-008 | Alertas de expiração (cores) | Unitário | Pendente |

### 13.2 Cenários de Erro
- Licença deletada entre carregamento e ação
- Firestore indisponível
- Valor inválido na renovação

---

## 14. Melhorias Futuras

### 14.1 Funcionalidades
- [ ] Histórico de renovações
- [ ] Notificações automáticas de expiração
- [ ] Edição de features inline
- [ ] Upgrade/downgrade de plano

### 14.2 UX/UI
- [ ] Dialog de confirmação (em vez de `confirm()`)
- [ ] Toast de sucesso (em vez de `alert()`)
- [ ] Atualização otimista (sem reload)
- [ ] Input de meses na renovação (em vez de prompt)

### 14.3 Performance
- [ ] Atualização local após ações
- [ ] Cache de dados da licença

### 14.4 Segurança
- [ ] Validação de limite de meses na renovação
- [ ] Verificação de impactos antes de deletar
- [ ] Logs de auditoria de ações

---

## 15. Dependências e Relacionamentos

### 15.1 Páginas Relacionadas
| Página | Relação |
|--------|---------|
| `/admin/licenses` | Lista de licenças (página pai) |
| `/admin/licenses/new` | Criação de nova licença |
| `/admin/tenants/{id}` | Detalhes do tenant proprietário |

### 15.2 Fluxos Relacionados
- **Lista → Detalhe → Ações:** Fluxo principal de gerenciamento
- **Detalhe → Tenant:** Navegação para tenant proprietário

### 15.3 Impacto de Mudanças
- Alterar interface `License` impacta esta página
- Alterar lógica de status afeta ações disponíveis
- Deletar licença não afeta tenant (sem cascade)

---

## 16. Observações Técnicas

### 16.1 Decisões de Arquitetura
- **licenseService para CRUD:** Todas operações passam por service
- **Ações contextuais:** Botões renderizados condicionalmente por status
- **Reload após ações:** Garante sincronização, mas menos eficiente

### 16.2 Padrões Utilizados
- **Client Component:** `"use client"` para interatividade
- **Confirm/Alert nativos:** Confirmação e feedback via browser APIs
- **Banner colorido:** Visual feedback do status

### 16.3 Limitações Conhecidas
- `confirm()` e `alert()` nativos (UX inconsistente)
- Reload completo após ações
- Sem validação de limite de meses na renovação

### 16.4 Notas de Implementação
- Banner usa classes Tailwind condicionais por status
- Dias restantes calculados com `Math.ceil` (arredonda para cima)
- Features exibidas com ícone CheckCircle verde

---

## 17. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------|
| 07/02/2026 | 1.0 | Engenharia Reversa | Documentação inicial |
| 10/02/2026 | 1.1 | Engenharia Reversa | Reescrita completa seguindo template padrão (20 seções) |

---

## 18. Glossário

| Termo | Definição |
|-------|-----------|
| **Licença** | Autorização de uso da plataforma por um tenant |
| **Dias Restantes** | Diferença entre data de término e data atual |
| **Renovação** | Extensão do período de validade da licença |
| **Suspensão** | Desativação temporária da licença |
| **Auto-renew** | Renovação automática ao expirar |

---

## 19. Referências

### 19.1 Documentação Relacionada
- [Licenses List](./licenses-list-documentation.md) — Lista de licenças
- [Licenses New](./licenses-new-documentation.md) — Criação de licença
- [Tenants Detail](./tenants-detail-documentation.md) — Detalhes do tenant

### 19.2 Código Fonte
- `src/app/(admin)/admin/licenses/[id]/page.tsx` — Componente principal
- `src/lib/services/licenseService.ts` — Service de licenças
- `src/lib/constants/plans.ts` — Constantes de planos
- `src/types/index.ts` — Interface License

---

## 20. Anexos

### 20.1 Exemplo de Cálculo de Dias Restantes
```typescript
const daysRemaining = Math.ceil(
  (license.end_date.toDate().getTime() - new Date().getTime()) / 
  (1000 * 60 * 60 * 24)
);
// Resultado: 45 (dias)
```

### 20.2 Exemplo de Renovação
```typescript
// Licença expira em: 2026-03-01
// Admin renova por 6 meses
// Nova data: 2026-09-01 (não 2026-08-10)
const newEndDate = new Date(currentEndDate);
newEndDate.setMonth(newEndDate.getMonth() + 6);
```

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 10/02/2026
**Responsável:** Equipe de Desenvolvimento
**Status:** Aprovado
