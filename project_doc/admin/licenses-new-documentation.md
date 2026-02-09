# Documentação Experimental - Nova Licença

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Administração do Sistema
**Componente:** Criação de Licença (`/admin/licenses/new`)
**Versão:** 1.0
**Data:** 07/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Formulário para criação de novas licenças. O admin seleciona um tenant, escolhe um plano (Semestral/Anual), define datas e renovação automática. A data de término é calculada automaticamente com base no plano selecionado.

### 1.1 Localização
- **Arquivo:** `src/app/(admin)/admin/licenses/new/page.tsx`
- **Rota:** `/admin/licenses/new`
- **Layout:** Admin Layout

### 1.2 Dependências
- **licenseService:** `createLicense()`
- **PLANS constant:** `src/lib/constants/plans.ts` — `PLANS`, `getPlanConfig()`
- **Firestore:** `getDocs(collection(db, "tenants"))` para listar tenants

---

## 2. Campos do Formulário

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| Tenant | select (nativo) | Sim | Lista de todos os tenants (nome + id) |
| Plano | cards clicáveis | Sim | Semestral (R$ 59,90) ou Anual (R$ 49,90) |
| Data de Início | date | Sim | Padrão: hoje |
| Data de Término | date | Sim | Calculada automaticamente pelo plano |
| Renovação Automática | checkbox | Não | Padrão: false |

---

## 3. Regras de Negócio

### RN-001: Cálculo de Data de Término
- Semestral: `start_date + 6 meses`
- Anual: `start_date + 1 ano`
- Recalculada ao trocar plano ou data de início

### RN-002: Dados do Plano
`getPlanConfig()` fornece `maxUsers` e `features` para a licença criada.

---

## 4. Integrações

### 4.1 licenseService.createLicense()
**Payload:**
```typescript
{
  tenant_id: string,
  plan_id: string,
  max_users: number,      // Do plano
  features: string[],     // Do plano
  start_date: Date,
  end_date: Date,
  auto_renew: boolean,
}
```

---

## 5. Observações
- Usa `select` HTML nativo em vez de Shadcn Select para tenants
- Usa `alert()` nativo para feedback em vez de Toast
- Cards de plano com borda azul quando selecionado

---

## 6. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------|
| 07/02/2026 | 1.0 | Engenharia Reversa | Documentação inicial |

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 07/02/2026
**Status:** Aprovado
