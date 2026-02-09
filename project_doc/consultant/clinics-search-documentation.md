# Documentação Experimental - Buscar Clínicas (Consultor)

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Consultor
**Componente:** Buscar Clínicas (`/consultant/clinics/search`)
**Versão:** 1.0
**Data:** 07/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Página para buscar clínicas por CNPJ/CPF e solicitar vínculo. O consultor informa o documento, a API retorna clínicas correspondentes, e o consultor pode solicitar vínculo via `ClaimClinicDialog`. Clínicas que já possuem consultor mostram status "Já possui consultor vinculado".

### 1.1 Localização
- **Arquivo:** `src/app/(consultant)/consultant/clinics/search/page.tsx`
- **Rota:** `/consultant/clinics/search`
- **Layout:** Consultant Layout

### 1.2 Dependências
- **API Routes:** `GET /api/tenants/search?document={cleanDoc}`
- **Componentes:** `ClaimClinicDialog`
- **Hooks:** `useAuth()`, `useToast()`

---

## 2. Seções

### 2.1 Formulário de Busca
- Input com máscara automática CPF/CNPJ (font-mono)
- Formatação: CPF `XXX.XXX.XXX-XX`, CNPJ `XX.XXX.XXX/XXXX-XX`
- Botão buscar (sky-600, desabilitado durante busca)
- Validação: mínimo 11 dígitos (CPF)

### 2.2 Resultados
- Card com contagem: "{N} clínica(s) encontrada(s)"
- Cada resultado mostra: nome, tipo_documento, documento, email
- **Sem consultor:** Botão "Solicitar Vínculo" → abre `ClaimClinicDialog`
- **Com consultor:** Box verde "Já possui consultor vinculado" + nome do consultor

### 2.3 Card Informativo
- "Como funciona?" com lista ordenada:
  1. Busque a clínica pelo CNPJ ou CPF
  2. Solicite o vínculo com a clínica
  3. Aguarde a aprovação do administrador da clínica
  4. Após aprovado, você terá acesso aos dados da clínica

---

## 3. Regras de Negócio

- **RN-001:** Mínimo 11 dígitos para busca (CPF)
- **RN-002:** Clínicas que já possuem consultor não permitem solicitar vínculo
- **RN-003:** Após sucesso no claim, refaz busca para atualizar status
- **RN-004:** `ClaimClinicDialog` gerencia o processo de solicitação

---

## 4. Observações
- Interface local `Tenant`: id, name, document_type, document_number, email, consultant_id, consultant_name
- Max-width: `max-w-2xl`
- Card informativo com fundo sky-50 (diferente do padrão muted)
- Página ~266 linhas

---

## 5. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------
| 07/02/2026 | 1.0 | Engenharia Reversa | Documentação inicial |

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 07/02/2026
**Status:** Aprovado
