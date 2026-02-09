# Documentação Experimental - Editar Procedimento (Redirect)

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Clínica
**Componente:** Editar Procedimento (`/clinic/requests/[id]/edit`)
**Versão:** 1.0
**Data:** 07/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Página de redirecionamento para edição de procedimentos. Carrega os dados da solicitação, verifica se o status permite edição, e redireciona para `/clinic/requests/new` com parâmetros de edição via query string. Apenas `clinic_admin` pode acessar.

### 1.1 Localização
- **Arquivo:** `src/app/(clinic)/clinic/requests/[id]/edit/page.tsx`
- **Rota:** `/clinic/requests/{id}/edit`
- **Layout:** Clinic Layout

### 1.2 Dependências
- **solicitacaoService:** `getSolicitacao()`
- **Hooks:** `useAuth()`
- **Restrição:** `clinic_admin`

---

## 2. Fluxo de Redirecionamento

```
1. Carrega solicitação via getSolicitacao(tenantId, solicitacaoId)
2. Verifica: data existe?
   - Não → erro "Procedimento não encontrado"
3. Verifica: status === "agendada"?
   - Não → erro "Apenas procedimentos no status 'Agendado' podem ser editados"
4. Monta URLSearchParams com dados do procedimento
5. Redireciona → /clinic/requests/new?{params}
```

---

## 3. Parâmetros de Redirecionamento

| Parâmetro | Valor |
|-----------|-------|
| `edit` | solicitacaoId |
| `pacienteCodigo` | data.paciente_codigo |
| `pacienteNome` | data.paciente_nome |
| `dtProcedimento` | data.dt_procedimento.toDate().toISOString().split('T')[0] |
| `createdAt` | data.created_at.toDate().toISOString().split('T')[0] |
| `observacoes` | data.observacoes \|\| "" |
| `produtos` | JSON.stringify(produtos_solicitados mapeados) |

### 3.1 Estrutura de cada produto no JSON
```ts
{
  inventory_item_id: string,
  quantidade: number,
  produto_codigo: string,
  produto_nome: string,
  lote: string,
  valor_unitario: number
}
```

---

## 4. Regras de Negócio

### RN-001: Apenas Agendados
Somente procedimentos com `status === "agendada"` podem ser editados.

### RN-002: Apenas Admin
Se `claims.role !== "clinic_admin"`, exibe alerta: "Apenas administradores podem editar procedimentos."

### RN-003: Página Transitória
A página não renderiza conteúdo próprio. Retorna `null` após o redirecionamento.

---

## 5. Estados da Interface

| Estado | Comportamento |
|--------|---------------|
| Loading | Skeleton (título + área de conteúdo) |
| Não admin | Alert destructive com mensagem |
| Erro | Alert destructive + botão "Voltar" (router.back()) |
| Sucesso | Redireciona (return null) |

---

## 6. Observações
- Página compacta (~117 linhas)
- Funciona como intermediário entre a lista/detalhes e o formulário de edição
- O formulário de edição real está em `/clinic/requests/new` (modo edição via query params)
- Import de `updateSolicitacaoAgendada` presente mas não utilizado (usado pela página new)

---

## 7. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------
| 07/02/2026 | 1.0 | Engenharia Reversa | Documentação inicial |

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 07/02/2026
**Status:** Aprovado
