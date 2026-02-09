# Documentação Experimental - Perfil da Clínica

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Clínica
**Componente:** Meu Perfil (`/clinic/profile`)
**Versão:** 1.0
**Data:** 07/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Página de perfil do usuário da clínica com 4 seções: informações da clínica (read-only), informações pessoais (editável), termos aceitos e alteração de senha. Usa Firebase Auth client SDK e Firestore direto.

### 1.1 Localização
- **Arquivo:** `src/app/(clinic)/clinic/profile/page.tsx`
- **Rota:** `/clinic/profile`
- **Layout:** Clinic Layout (com header próprio + link "Voltar ao Dashboard")

### 1.2 Dependências
- **Firebase Auth:** `updateProfile()`, `updatePassword()`, `reauthenticateWithCredential()`
- **Firestore:** `tenants/{tenantId}`, `user_document_acceptances`, `legal_documents`
- **Hooks:** `useAuth()`
- **Types:** `Tenant`

---

## 2. Seções

### 2.1 Informações da Clínica (read-only)
- Nome, CPF/CNPJ, Email, Telefone
- Localização: Endereço, Cidade-Estado, CEP, Fuso horário

### 2.2 Informações Pessoais
| Campo | Tipo | Editável |
|-------|------|----------|
| Email | email | Não (disabled) |
| Nome | text | Sim |

### 2.3 Termos de Uso e Privacidade
- Lista documentos aceitos da coleção `user_document_acceptances`
- Busca título de cada documento em `legal_documents`
- Exibe: título, versão, data/hora de aceitação

### 2.4 Alterar Senha
| Campo | Tipo |
|-------|------|
| Senha Atual | password |
| Nova Senha | password (min 6) |
| Confirmar Nova Senha | password |

---

## 3. Validações de Senha

| Validação | Mensagem |
|-----------|----------|
| Nova senha < 6 chars | "A nova senha deve ter pelo menos 6 caracteres" |
| Senhas não coincidem | "As senhas não coincidem" |
| Senha atual errada | "Senha atual incorreta" |
| Muitas tentativas | "Muitas tentativas. Tente novamente mais tarde" |

---

## 4. Observações
- Reautenticação obrigatória antes de trocar senha (`reauthenticateWithCredential`)
- Limpa campos de senha após sucesso
- Email não pode ser alterado (exibido como disabled)
- Skeleton para loading de tenant e termos

---

## 5. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------|
| 07/02/2026 | 1.0 | Engenharia Reversa | Documentação inicial |

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 07/02/2026
**Status:** Aprovado
