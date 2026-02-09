# Documentação Experimental - Novo Consultor

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Administração do Sistema
**Componente:** Criação de Consultor (`/admin/consultants/new`)
**Versão:** 1.0
**Data:** 07/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Formulário de cadastro de novo consultor Rennova. Após criação, exibe tela de sucesso com código de 6 dígitos gerado automaticamente. O consultor recebe credenciais por email. Usa API Route com autenticação Bearer token.

### 1.1 Localização
- **Arquivo:** `src/app/(admin)/admin/consultants/new/page.tsx`
- **Rota:** `/admin/consultants/new`
- **Layout:** Admin Layout

### 1.2 Dependências
- **Hooks:** `useAuth()`, `useToast()`
- **API Route:** `POST /api/consultants`
- **Lucide Icons:** ArrowLeft, Users, Loader2, CheckCircle2

---

## 2. Campos do Formulário

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| Nome Completo | text (uppercase) | Sim | Convertido para MAIÚSCULAS automaticamente |
| Email | email | Sim | Convertido para minúsculas no envio |
| Telefone | text (formatado) | Sim | Máscara (00) 00000-0000, mínimo 10 dígitos |

---

## 3. Validações

| Campo | Regra | Mensagem |
|-------|-------|----------|
| Nome | Não vazio | "Nome é obrigatório" |
| Email | Não vazio | "Email é obrigatório" |
| Email | Regex `^[^\s@]+@[^\s@]+\.[^\s@]+$` | "Email inválido" |
| Telefone | Não vazio | "Telefone é obrigatório" |
| Telefone | ≥ 10 dígitos | "Telefone inválido" |

Erros são exibidos inline abaixo de cada campo.

---

## 4. Fluxo de Criação

1. Preenche formulário e valida campos
2. Obtém `idToken` via `user.getIdToken()`
3. POST `/api/consultants` com `{ name, email (lowercase), phone }`
4. API gera código de 6 dígitos e senha temporária
5. Retorna dados do consultor criado
6. Exibe tela de sucesso

---

## 5. Tela de Sucesso

Após criação bem-sucedida, substitui o formulário por:
- Ícone CheckCircle2 verde em círculo
- Título "Consultor Criado com Sucesso!"
- Mensagem "Um email foi enviado com as credenciais de acesso."
- **Card de Código:** `consultant.code` em texto 4xl, font-mono, sky-700, tracking-widest
- **Dados:** Nome, Email, Status (Ativo)
- **Aviso:** "O consultor receberá um email com uma senha temporária..."
- **Botões:** "Cadastrar Outro" (limpa form) | "Ver Lista de Consultores" (redirect)

---

## 6. Informações Pós-Cadastro

Painel informativo exibido antes do submit:
- Um código único de 6 dígitos será gerado
- Uma senha temporária será enviada por email
- O consultor poderá fazer login e vincular-se a clínicas

---

## 7. Observações
- Nome é forçado para uppercase via `value.toUpperCase()` no handleChange
- Email é enviado em lowercase: `formData.email.toLowerCase()`
- Botão "Voltar" no topo da página (ArrowLeft)
- Estilo sky-600/sky-700 para elementos do consultor
- Usa `useToast()` para feedback de sucesso/erro

---

## 8. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------|
| 07/02/2026 | 1.0 | Engenharia Reversa | Documentação inicial |

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 07/02/2026
**Status:** Aprovado
