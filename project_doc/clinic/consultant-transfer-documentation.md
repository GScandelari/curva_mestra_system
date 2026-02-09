# Documentação Experimental - Vincular/Transferir Consultor

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Clínica
**Componente:** Vincular Consultor (`/clinic/consultant/transfer`)
**Versão:** 1.0
**Data:** 07/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Página para vincular um novo consultor à clínica via busca por código de 6 dígitos. Busca o consultor por API, exibe resultado e permite confirmar o vínculo. Após sucesso, redireciona automaticamente para `/clinic/consultant` após 2 segundos.

### 1.1 Localização
- **Arquivo:** `src/app/(clinic)/clinic/consultant/transfer/page.tsx`
- **Rota:** `/clinic/consultant/transfer`
- **Layout:** Clinic Layout

### 1.2 Dependências
- **API Routes:**
  - `GET /api/consultants/by-code/{code}` (buscar consultor)
  - `POST /api/tenants/{tenantId}/consultant` (vincular consultor)
- **Hooks:** `useAuth()`, `useToast()`

---

## 2. Fluxo da Página

```
1. Usuário digita código de 6 dígitos
2. Clica em buscar
3. API retorna dados do consultor → exibe card com resultado
4. Usuário clica "Confirmar Vínculo" (confirm() nativo)
5. POST vincula consultor ao tenant
6. Tela de sucesso + redirect automático (2000ms)
```

---

## 3. Seções

### 3.1 Formulário de Busca
- Input numérico (6 dígitos, font-mono, tracking-widest)
- Filtra não-dígitos via `replace(/\D/g, "").slice(0, 6)`
- Botão buscar (desabilitado se `searching` ou `searchCode.length !== 6`)

### 3.2 Resultado da Busca
- Card com borda primary (border-primary)
- Campos: Nome (font-semibold), Email, Código (font-mono)
- Botão "Confirmar Vínculo" (full-width)

### 3.3 Tela de Sucesso
- Ícone CheckCircle2 verde (bg-green-100)
- "Consultor Vinculado!"
- "{nome} agora tem acesso aos dados da sua clínica"
- "Redirecionando..."
- Auto-redirect após 2000ms → `/clinic/consultant`

### 3.4 Card Informativo
- "Como funciona?" com lista ordenada:
  1. Solicite o código de 6 dígitos ao consultor
  2. Busque o consultor pelo código
  3. Confirme o vínculo
  4. O consultor terá acesso imediato aos dados (read-only)

---

## 4. Regras de Negócio

### RN-001: Código de 6 Dígitos
Apenas números, exatamente 6 dígitos. Validação client-side antes de buscar.

### RN-002: Confirmação Obrigatória
`confirm()` nativo antes de vincular: "Tem certeza que deseja vincular o consultor {nome}?"

### RN-003: Auto-redirect
Após vínculo com sucesso, redireciona para `/clinic/consultant` em 2000ms.

---

## 5. API Calls

### 5.1 Buscar Consultor
```
GET /api/consultants/by-code/{code}
Headers: Authorization: Bearer {token}
Response 200: { data: { id, code, name, email } }
Response 404: "Consultor não encontrado"
```

### 5.2 Vincular Consultor
```
POST /api/tenants/{tenantId}/consultant
Headers: Authorization: Bearer {token}, Content-Type: application/json
Body: { new_consultant_id: string }
Response 200: success
```

---

## 6. Observações
- Interface local `ConsultantResult { id, code, name, email }` definida inline
- Estado `transferring` desabilita botão e mostra Loader2 spinner
- Header com botão "Voltar" → `/clinic/consultant`
- Página compacta (~263 linhas)
- Max-width: `max-w-lg` (container estreito)

---

## 7. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------
| 07/02/2026 | 1.0 | Engenharia Reversa | Documentação inicial |

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 07/02/2026
**Status:** Aprovado
