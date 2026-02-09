# Documentação Experimental - Nova Clínica (Tenant)

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Administração do Sistema
**Componente:** Criação de Clínica (`/admin/tenants/new`)
**Versão:** 1.0
**Data:** 07/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Wizard de 3 etapas para cadastro completo de nova clínica (tenant). Coleta dados da clínica, dados do administrador e permite personalizar o e-mail de boas-vindas antes de enviar. Usa `createTenant` do tenantServiceDirect.

### 1.1 Localização
- **Arquivo:** `src/app/(admin)/admin/tenants/new/page.tsx`
- **Rota:** `/admin/tenants/new`
- **Layout:** Admin Layout

### 1.2 Dependências
- **tenantServiceDirect:** `createTenant()`
- **Utils:** `validateDocument()`, `maskDocument()`
- **Types:** `DocumentType`
- **Shadcn:** Dialog (preview de e-mail)
- **Lucide Icons:** Building2, User, Mail, ArrowRight, Send, Eye

---

## 2. Wizard de 3 Etapas

### Step 1: Dados da Clínica

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| Nome da Clínica | text | Sim | — |
| Tipo de Conta | radio (CNPJ/CPF) | Sim | CNPJ = até 5 usuários, CPF = 1 usuário |
| CPF/CNPJ | text (mascarado) | Sim | Validação via `validateDocument()` |
| E-mail da Clínica | email | Sim | — |
| Telefone | text (formatado) | Não | Máscara (00) 00000-0000 |
| CEP | text | Não | Máscara 00000-000 |
| Endereço | text | Não | — |
| Cidade | text | Não | — |
| Estado | select (UF) | Não | 27 estados brasileiros |
| Plano | select | Sim | Semestral (R$ 59,90) ou Anual (R$ 49,90) |

### Step 2: Dados do Administrador

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| Nome Completo | text | Sim | — |
| E-mail | email | Sim | Login do administrador |
| Telefone | text (formatado) | Não | Máscara (00) 00000-0000 |
| Senha Temporária | text (visível) | Sim | Mínimo 6 caracteres |

### Step 3: E-mail de Boas-Vindas

| Campo | Tipo | Descrição |
|-------|------|-----------|
| Assunto do E-mail | text | Padrão: "Bem-vindo à Curva Mestra!" |
| Corpo do E-mail | textarea (15 rows) | Template com variáveis |
| Botão Preview | — | Abre Dialog com e-mail renderizado |

---

## 3. Regras de Negócio

### RN-001: Max Users por Tipo de Documento
- CPF → `max_users: 1`
- CNPJ → `max_users: 5`

### RN-002: Variáveis de Template do E-mail
- `{{admin_name}}` → Nome do administrador
- `{{clinic_name}}` → Nome da clínica
- `{{admin_email}}` → E-mail do administrador
- `{{temp_password}}` → Senha temporária

### RN-003: Formato de Telefone
- `formatPhoneInput()`: aceita até 11 dígitos
- ≤ 10 dígitos → (00) 0000-0000
- 11 dígitos → (00) 00000-0000

---

## 4. Validações

### Step 1
| Validação | Mensagem |
|-----------|----------|
| Nome vazio | "Nome da clínica é obrigatório" |
| Documento inválido | "CPF inválido" ou "CNPJ inválido" |
| E-mail inválido | "E-mail válido é obrigatório" |

### Step 2
| Validação | Mensagem |
|-----------|----------|
| Nome admin vazio | "Nome do administrador é obrigatório" |
| E-mail admin inválido | "E-mail válido do administrador é obrigatório" |
| Senha < 6 chars | "Senha deve ter no mínimo 6 caracteres" |

---

## 5. Payload de Criação

```typescript
{
  name, document_type, document_number, cnpj,
  max_users, email, phone, address, city, state, cep, plan_id,
  admin_name, admin_email, admin_phone, temp_password,
  welcome_email: { subject, body, send: true }
}
```

---

## 6. Preview de E-mail
- Dialog com Shadcn Dialog
- Mostra: Para (email), Assunto, Mensagem renderizada
- Variáveis substituídas por dados preenchidos ou placeholders como "[Nome do Administrador]"

---

## 7. Indicador de Progresso
- 3 círculos numerados com linhas conectoras
- Step atual e anteriores: `bg-primary` (azul)
- Steps futuros: `border-muted-foreground` (cinza)
- Labels: "Dados da Clínica", "Administrador", "E-mail Boas-Vindas"

---

## 8. Observações
- Senha temporária exibida em `type="text"` (visível)
- CEP armazena apenas dígitos (`replace(/\D/g, "")`)
- Estado usa `select` HTML nativo (não Shadcn)
- Plano usa `select` HTML nativo
- Após criação → redirect para `/admin/tenants`
- E-mail é enviado automaticamente (`send: true`)

---

## 9. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------|
| 07/02/2026 | 1.0 | Engenharia Reversa | Documentação inicial |

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 07/02/2026
**Status:** Aprovado
