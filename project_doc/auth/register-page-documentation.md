# Documentação Experimental - Página de Registro

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização  
**Módulo:** Autenticação  
**Componente:** Página de Registro (`/register`)  
**Versão:** 1.0  
**Data:** 07/02/2026  
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

A página de registro é o ponto de entrada para novos usuários solicitarem acesso ao sistema Curva Mestra. Diferente de um registro tradicional com acesso imediato, este sistema implementa um fluxo de **aprovação manual** onde as solicitações são analisadas por um System Admin antes de conceder acesso.

O sistema suporta dois tipos de contas:
- **Clínica/Empresa (CNPJ):** Para estabelecimentos com até 5 usuários
- **Profissional Autônomo (CPF):** Para profissionais individuais (1 usuário)

### 1.1 Localização
- **Arquivo:** `src/app/(auth)/register/page.tsx`
- **Rota:** `/register`
- **Layout:** Auth Layout (sem navegação principal)

### 1.2 Dependências Principais
- **Hook de Autenticação:** `src/hooks/useAuth.ts`
- **API de Solicitações:** `src/app/api/access-requests/route.ts`
- **Validação de Documentos:** `src/lib/utils/documentValidation.ts`
- **Validações Server-Side:** `src/lib/validations/serverValidations.ts`
- **bcryptjs:** Hash de senhas
- **Firestore:** Armazenamento de solicitações

---

## 2. Tipos de Conta

### 2.1 Clínica / Empresa (CNPJ)
- **Descrição:** Conta para estabelecimentos comerciais
- **Documento:** CNPJ (14 dígitos)
- **Limite de Usuários:** Até 5 usuários
- **Campo Business Name:** "Nome da Clínica"
- **Uso:** Clínicas, consultórios, spas, centros estéticos
- **Primeiro Usuário:** Torna-se `clinic_admin` após aprovação

### 2.2 Profissional Autônomo (CPF)
- **Descrição:** Conta para profissionais individuais
- **Documento:** CPF (11 dígitos)
- **Limite de Usuários:** Apenas 1 usuário (o próprio)
- **Campo Business Name:** "Nome Profissional"
- **Uso:** Profissionais autônomos, MEI
- **Primeiro Usuário:** Torna-se `clinic_admin` após aprovação

---

## 3. Estrutura de Dados

### 3.1 Formulário (Frontend)

```typescript
interface FormData {
  document: string;           // CPF ou CNPJ formatado
  fullName: string;           // Nome completo do solicitante
  email: string;              // Email de contato
  phone: string;              // Telefone formatado
  businessName: string;       // Nome da clínica ou profissional
  password: string;           // Senha escolhida
  confirmPassword: string;    // Confirmação de senha
}
```

### 3.2 Solicitação de Acesso (API)

```typescript
interface AccessRequest {
  type: "clinica" | "autonomo";        // Tipo de conta
  full_name: string;                   // Nome completo
  email: string;                       // Email (lowercase)
  phone: string;                       // Telefone
  business_name: string;               // Nome do negócio
  document_type: "cpf" | "cnpj";       // Tipo de documento
  document_number: string;             // Documento limpo (só números)
  password: string;                    // Senha hasheada (bcrypt)
  address?: string | null;             // Endereço (opcional)
  city?: string | null;                // Cidade (opcional)
  state?: string | null;               // Estado (opcional)
  cep?: string | null;                 // CEP (opcional)
  status: "pendente";                  // Status inicial
  created_at: Timestamp;               // Data de criação
  updated_at: Timestamp;               // Data de atualização
}
```

### 3.3 Tipos de Documento

```typescript
type DocumentType = "cpf" | "cnpj";
```

---

## 4. Casos de Uso

### 4.1 UC-001: Registro Bem-Sucedido - Clínica (CNPJ)

**Ator:** Novo Usuário (Administrador de Clínica)  
**Pré-condições:**
- Usuário não está autenticado
- Possui CNPJ válido da clínica
- Possui dados completos para preenchimento

**Fluxo Principal:**
1. Usuário acessa `/register`
2. Sistema exibe formulário de registro
3. Usuário seleciona "Clínica / Empresa"
4. Sistema ajusta formulário para CNPJ
5. Usuário preenche CNPJ (sistema aplica máscara automaticamente)
6. Usuário preenche nome completo
7. Usuário preenche email
8. Usuário preenche telefone (sistema aplica máscara automaticamente)
9. Usuário preenche "Nome da Clínica"
10. Usuário define senha (mínimo 6 caracteres)
11. Usuário confirma senha
12. Usuário clica em "Solicitar Acesso"
13. Sistema valida todos os campos
14. Sistema valida CNPJ (dígitos verificadores)
15. Sistema envia dados para API `/api/access-requests`
16. API valida dados novamente (server-side)
17. API faz hash da senha com bcrypt
18. API cria documento em `access_requests` no Firestore
19. API retorna sucesso
20. Sistema exibe mensagem de sucesso
21. Sistema aguarda 3 segundos
22. Sistema redireciona para `/login`

**Pós-condições:**
- Solicitação criada com status "pendente"
- Senha armazenada com hash bcrypt
- Usuário aguarda aprovação do System Admin
- Formulário limpo

**Regra de Negócio:**
- CNPJ permite até 5 usuários na clínica
- Primeiro usuário aprovado torna-se `clinic_admin`
- Senha não é usada diretamente (admin gera senha temporária na aprovação)

---

### 4.2 UC-002: Registro Bem-Sucedido - Profissional Autônomo (CPF)

**Ator:** Novo Usuário (Profissional Autônomo)  
**Pré-condições:**
- Usuário não está autenticado
- Possui CPF válido
- Trabalha de forma autônoma

**Fluxo Principal:**
1. Usuário acessa `/register`
2. Sistema exibe formulário de registro
3. Usuário seleciona "Profissional Autônomo"
4. Sistema ajusta formulário para CPF
5. Usuário preenche CPF (sistema aplica máscara automaticamente)
6. Usuário preenche nome completo
7. Usuário preenche email
8. Usuário preenche telefone (sistema aplica máscara automaticamente)
9. Usuário preenche "Nome Profissional"
10. Usuário define senha (mínimo 6 caracteres)
11. Usuário confirma senha
12. Usuário clica em "Solicitar Acesso"
13. Sistema valida todos os campos
14. Sistema valida CPF (dígitos verificadores)
15. Sistema envia dados para API
16. API processa e cria solicitação
17. Sistema exibe mensagem de sucesso
18. Sistema redireciona para `/login` após 3 segundos

**Pós-condições:**
- Solicitação criada com status "pendente"
- Tipo definido como "autonomo"
- Limite de 1 usuário será aplicado após aprovação

**Regra de Negócio:**
- CPF permite apenas 1 usuário (o próprio)
- Usuário aprovado torna-se `clinic_admin` da sua própria "clínica"
- Funciona como tenant individual

---
### 4.3 UC-003: Validação de CNPJ Inválido

**Ator:** Novo Usuário  
**Pré-condições:**
- Usuário selecionou tipo "Clínica / Empresa"
- Usuário preencheu CNPJ incorreto

**Fluxo Principal:**
1. Usuário preenche CNPJ com dígitos verificadores incorretos
2. Usuário preenche demais campos
3. Usuário clica em "Solicitar Acesso"
4. Sistema valida CNPJ no frontend
5. Sistema detecta CNPJ inválido
6. Sistema exibe erro: "CNPJ inválido. Verifique os dígitos verificadores."
7. Usuário corrige CNPJ
8. Usuário tenta novamente

**Pós-condições:**
- Solicitação NÃO criada
- Usuário permanece na página
- Campos mantêm valores preenchidos (exceto senhas por segurança)

**Validação:**
- Algoritmo de validação de CNPJ com dígitos verificadores
- Rejeita CNPJs com todos os dígitos iguais (ex: 11.111.111/1111-11)

---

### 4.4 UC-004: Validação de CPF Inválido

**Ator:** Novo Usuário  
**Pré-condições:**
- Usuário selecionou tipo "Profissional Autônomo"
- Usuário preencheu CPF incorreto

**Fluxo Principal:**
1. Usuário preenche CPF com dígitos verificadores incorretos
2. Usuário preenche demais campos
3. Usuário clica em "Solicitar Acesso"
4. Sistema valida CPF no frontend
5. Sistema detecta CPF inválido
6. Sistema exibe erro: "CPF inválido. Verifique os dígitos verificadores."
7. Usuário corrige CPF
8. Usuário tenta novamente

**Pós-condições:**
- Solicitação NÃO criada
- Usuário permanece na página

**Validação:**
- Algoritmo de validação de CPF com dígitos verificadores
- Rejeita CPFs com todos os dígitos iguais (ex: 111.111.111-11)

---

### 4.5 UC-005: Senhas Não Coincidem

**Ator:** Novo Usuário  
**Pré-condições:**
- Usuário preencheu formulário
- Senha e confirmação de senha são diferentes

**Fluxo Principal:**
1. Usuário preenche senha: "senha123"
2. Usuário preenche confirmação: "senha124"
3. Usuário clica em "Solicitar Acesso"
4. Sistema compara senha e confirmação
5. Sistema detecta diferença
6. Sistema exibe erro: "As senhas não coincidem"
7. Usuário corrige senhas
8. Usuário tenta novamente

**Pós-condições:**
- Solicitação NÃO criada
- Campos de senha limpos por segurança

---

### 4.6 UC-006: Senha Muito Curta

**Ator:** Novo Usuário  
**Pré-condições:**
- Usuário preencheu formulário
- Senha tem menos de 6 caracteres

**Fluxo Principal:**
1. Usuário preenche senha: "12345"
2. Usuário preenche confirmação: "12345"
3. Usuário clica em "Solicitar Acesso"
4. Sistema valida tamanho da senha
5. Sistema detecta senha curta
6. Sistema exibe erro: "A senha deve ter pelo menos 6 caracteres"
7. Usuário define senha mais longa
8. Usuário tenta novamente

**Pós-condições:**
- Solicitação NÃO criada

**Regra de Negócio:**
- Senha mínima: 6 caracteres
- Não requer caracteres especiais ou números (simplificado)

---

### 4.7 UC-007: Email Inválido

**Ator:** Novo Usuário  
**Pré-condições:**
- Usuário preencheu email sem formato válido

**Fluxo Principal:**
1. Usuário preenche email: "emailinvalido"
2. Usuário preenche demais campos
3. Usuário clica em "Solicitar Acesso"
4. Sistema valida formato de email
5. Sistema detecta email inválido
6. Sistema exibe erro: "Email inválido"
7. Usuário corrige email
8. Usuário tenta novamente

**Pós-condições:**
- Solicitação NÃO criada

**Validação:**
- Deve conter "@"
- Validação adicional no backend com regex completo

---

### 4.8 UC-008: Telefone Inválido

**Ator:** Novo Usuário  
**Pré-condições:**
- Usuário preencheu telefone com menos de 10 dígitos

**Fluxo Principal:**
1. Usuário preenche telefone: "(11) 1234"
2. Usuário preenche demais campos
3. Usuário clica em "Solicitar Acesso"
4. Sistema remove formatação do telefone
5. Sistema conta dígitos (menos de 10)
6. Sistema exibe erro: "Telefone inválido"
7. Usuário corrige telefone
8. Usuário tenta novamente

**Pós-condições:**
- Solicitação NÃO criada

**Validação:**
- Mínimo 10 dígitos (telefone fixo)
- Máximo 11 dígitos (celular com 9)
- Formato: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX

---

### 4.9 UC-009: Nome Completo Inválido

**Ator:** Novo Usuário  
**Pré-condições:**
- Usuário preencheu nome com menos de 3 caracteres

**Fluxo Principal:**
1. Usuário preenche nome: "Jo"
2. Usuário preenche demais campos
3. Usuário clica em "Solicitar Acesso"
4. Sistema valida tamanho do nome
5. Sistema detecta nome muito curto
6. Sistema exibe erro: "Nome completo inválido"
7. Usuário preenche nome completo
8. Usuário tenta novamente

**Pós-condições:**
- Solicitação NÃO criada

**Validação:**
- Mínimo 3 caracteres
- Deve ser nome completo (validação adicional no backend)

---

### 4.10 UC-010: Nome da Clínica/Profissional Inválido

**Ator:** Novo Usuário  
**Pré-condições:**
- Usuário preencheu business_name com menos de 3 caracteres

**Fluxo Principal:**
1. Usuário preenche nome da clínica: "AB"
2. Usuário preenche demais campos
3. Usuário clica em "Solicitar Acesso"
4. Sistema valida tamanho
5. Sistema detecta nome muito curto
6. Sistema exibe erro: "Nome da clínica é obrigatório" (ou "Nome profissional é obrigatório")
7. Usuário preenche nome adequado
8. Usuário tenta novamente

**Pós-condições:**
- Solicitação NÃO criada

---
### 4.11 UC-011: Usuário Já Autenticado Acessa Registro

**Ator:** Usuário Autenticado  
**Pré-condições:**
- Usuário já possui sessão ativa
- Usuário tenta acessar `/register`

**Fluxo Principal:**
1. Usuário autenticado acessa `/register`
2. Sistema detecta sessão ativa via `useAuth`
3. Sistema redireciona automaticamente para `/dashboard`

**Pós-condições:**
- Usuário não vê formulário de registro
- Redirecionado para dashboard

**Regra de Negócio:**
- Usuários autenticados não podem criar novas solicitações
- Evita duplicação de contas

---

### 4.12 UC-012: Troca de Tipo de Conta Durante Preenchimento

**Ator:** Novo Usuário  
**Pré-condições:**
- Usuário está preenchendo formulário

**Fluxo Principal:**
1. Usuário seleciona "Clínica / Empresa"
2. Usuário começa a preencher CNPJ: "12.345.678"
3. Usuário percebe que deveria ser CPF
4. Usuário seleciona "Profissional Autônomo"
5. Sistema limpa campo de documento
6. Sistema ajusta placeholder para CPF
7. Sistema ajusta label "Nome da Clínica" para "Nome Profissional"
8. Usuário preenche CPF do zero
9. Usuário continua preenchimento

**Pós-condições:**
- Campo de documento resetado
- Máscara ajustada para novo tipo
- Demais campos mantidos

**Regra de Negócio:**
- Ao trocar tipo, apenas o campo de documento é limpo
- Evita perda de dados já preenchidos

---

### 4.13 UC-013: Erro na API (Server-Side)

**Ator:** Novo Usuário  
**Pré-condições:**
- Usuário preencheu formulário corretamente
- Ocorre erro no servidor (ex: Firestore indisponível)

**Fluxo Principal:**
1. Usuário preenche formulário corretamente
2. Usuário clica em "Solicitar Acesso"
3. Sistema valida no frontend (OK)
4. Sistema envia para API
5. API tenta criar documento no Firestore
6. Firestore retorna erro
7. API retorna erro 500
8. Sistema exibe erro: "Erro ao enviar solicitação"
9. Usuário pode tentar novamente

**Pós-condições:**
- Solicitação NÃO criada
- Usuário permanece na página
- Dados do formulário mantidos

---

## 5. Fluxo de Processo Detalhado

```
┌─────────────────────────────────────────────────────────────────┐
│                  PÁGINA DE REGISTRO (/register)                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Usuário já       │
                    │ autenticado?     │
                    └──────────────────┘
                         │         │
                    SIM  │         │  NÃO
                         │         │
                         ▼         ▼
              ┌──────────────┐  ┌──────────────────┐
              │ Redirecionar │  │ Exibir formulário│
              │ /dashboard   │  │ de registro      │
              └──────────────┘  └──────────────────┘
                                         │
                                         ▼
                              ┌──────────────────────┐
                              │ Usuário seleciona    │
                              │ tipo de conta        │
                              └──────────────────────┘
                                    │         │
                              CNPJ  │         │  CPF
                                    │         │
                                    ▼         ▼
                         ┌──────────────┐  ┌──────────────┐
                         │ Formulário   │  │ Formulário   │
                         │ para Clínica │  │ para Autônomo│
                         │ (até 5 users)│  │ (1 user)     │
                         └──────────────┘  └──────────────┘
                                    │         │
                                    └────┬────┘
                                         │
                                         ▼
                              ┌──────────────────────┐
                              │ Usuário preenche:    │
                              │ - Documento          │
                              │ - Nome completo      │
                              │ - Email              │
                              │ - Telefone           │
                              │ - Business name      │
                              │ - Senha              │
                              │ - Confirmar senha    │
                              └──────────────────────┘
                                         │
                                         ▼
                              ┌──────────────────────┐
                              │ Usuário submete      │
                              │ formulário           │
                              └──────────────────────┘
                                         │
                                         ▼
                              ┌──────────────────────┐
                              │ Validações Frontend  │
                              └──────────────────────┘
                                    │         │
                              VÁLIDO│         │INVÁLIDO
                                    │         │
                                    ▼         ▼
                         ┌──────────────┐  ┌──────────────┐
                         │ Enviar para  │  │ Exibir erro  │
                         │ API          │  │ específico   │
                         └──────────────┘  └──────────────┘
                                │
                                ▼
                    ┌──────────────────────┐
                    │ API: Validações      │
                    │ Server-Side          │
                    └──────────────────────┘
                         │              │
                    VÁLIDO│              │INVÁLIDO
                         │              │
                         ▼              ▼
              ┌──────────────────┐  ┌──────────────────┐
              │ Hash senha       │  │ Retornar erro    │
              │ (bcrypt)         │  │ 400              │
              └──────────────────┘  └──────────────────┘
                      │
                      ▼
           ┌──────────────────────┐
           │ Criar documento em   │
           │ access_requests      │
           │ (Firestore)          │
           └──────────────────────┘
                      │
                      ▼
           ┌──────────────────────┐
           │ Retornar sucesso     │
           │ com ID               │
           └──────────────────────┘
                      │
                      ▼
           ┌──────────────────────┐
           │ Exibir mensagem      │
           │ de sucesso           │
           └──────────────────────┘
                      │
                      ▼
           ┌──────────────────────┐
           │ Aguardar 3 segundos  │
           └──────────────────────┘
                      │
                      ▼
           ┌──────────────────────┐
           │ Redirecionar para    │
           │ /login               │
           └──────────────────────┘
```

---

## 6. Regras de Negócio

### RN-001: Aprovação Manual Obrigatória
**Descrição:** Todas as solicitações de acesso devem ser aprovadas manualmente por um System Admin antes de conceder acesso ao sistema.  
**Aplicação:** Após criação da solicitação, status é "pendente"  
**Exceções:** Nenhuma - não há auto-aprovação  
**Justificativa:** Controle de qualidade, prevenção de fraudes, validação de clientes reais

### RN-002: Limite de Usuários por Tipo de Documento
**Descrição:** 
- CNPJ: até 5 usuários
- CPF: apenas 1 usuário (o próprio)

**Aplicação:** Definido no momento da aprovação da solicitação  
**Exceções:** System Admin pode ajustar limites manualmente  
**Justificativa:** Modelo de negócio baseado em tamanho da operação

### RN-003: Validação de Documento com Dígitos Verificadores
**Descrição:** CPF e CNPJ devem ser validados usando algoritmo de dígitos verificadores  
**Aplicação:** Frontend e Backend (dupla validação)  
**Exceções:** Nenhuma  
**Justificativa:** Garantir documentos reais e válidos, evitar erros de digitação

### RN-004: Senha Hasheada com bcrypt
**Descrição:** Senha fornecida no registro é hasheada com bcrypt antes de armazenar  
**Aplicação:** API antes de salvar no Firestore  
**Exceções:** Nenhuma  
**Justificativa:** Segurança - senha nunca armazenada em texto plano

### RN-005: Senha Não Utilizada Diretamente
**Descrição:** A senha fornecida no registro não é usada para login. Na aprovação, o System Admin gera uma senha temporária.  
**Aplicação:** Processo de aprovação  
**Exceções:** Nenhuma  
**Justificativa:** Controle adicional de segurança, força troca de senha no primeiro acesso

### RN-006: Email em Lowercase
**Descrição:** Email é convertido para lowercase antes de armazenar  
**Aplicação:** API antes de salvar  
**Exceções:** Nenhuma  
**Justificativa:** Evitar duplicação por diferença de case (user@email.com vs User@Email.com)

### RN-007: Documento Armazenado Sem Formatação
**Descrição:** CPF/CNPJ são armazenados apenas com números (sem pontos, traços, barras)  
**Aplicação:** API antes de salvar  
**Exceções:** Nenhuma  
**Justificativa:** Facilita buscas e comparações no banco de dados

### RN-008: Primeiro Usuário é Admin
**Descrição:** O primeiro usuário aprovado de uma solicitação torna-se `clinic_admin`  
**Aplicação:** Processo de aprovação  
**Exceções:** Nenhuma  
**Justificativa:** Alguém precisa gerenciar a clínica e adicionar outros usuários

---
## 7. Estados da Interface

### 7.1 Estado: Carregando Autenticação
**Quando:** Sistema está verificando se usuário já está autenticado  
**Exibição:** "Carregando..." centralizado na tela  
**Duração:** Breve (< 1 segundo)

### 7.2 Estado: Formulário Inicial
**Quando:** Usuário não autenticado acessa a página  
**Exibição:** Formulário completo de registro  
**Campos:**
- **Tipo de Conta** (radio buttons, obrigatório):
  - Clínica / Empresa (CNPJ - até 5 usuários)
  - Profissional Autônomo (CPF - apenas 1 usuário)
- **Documento** (text, obrigatório, máscara automática):
  - Placeholder: "000.000.000-00" (CPF) ou "00.000.000/0000-00" (CNPJ)
  - MaxLength: 18 caracteres
- **Nome Completo** (text, obrigatório)
- **Email** (email, obrigatório)
- **Telefone** (tel, obrigatório, máscara automática):
  - Placeholder: "(00) 00000-0000"
  - MaxLength: 15 caracteres
- **Nome da Clínica / Nome Profissional** (text, obrigatório):
  - Label dinâmico baseado no tipo
- **Senha** (password, obrigatório):
  - Placeholder: "Mínimo 6 caracteres"
- **Confirmar Senha** (password, obrigatório)
- **Botão:** "Solicitar Acesso"

**Links:**
- "Já tem uma conta? Fazer login" → `/login`

**Texto Informativo:**
- "Após enviar, aguarde a aprovação do administrador."
- "Você receberá as credenciais de acesso por email."

### 7.3 Estado: Processando Solicitação
**Quando:** Usuário submeteu formulário e está aguardando resposta  
**Exibição:**
- Botão desabilitado
- Texto do botão: "Enviando..."
- Todos os campos desabilitados
- Cursor de loading

### 7.4 Estado: Erro de Validação
**Quando:** Validação falhou (frontend ou backend)  
**Exibição:**
- Alert vermelho no topo do formulário
- Ícone de erro (AlertCircle)
- Mensagem de erro específica
- Formulário habilitado para correção
- Campos mantêm valores (exceto senhas)

**Exemplos de Mensagens:**
- "CPF inválido. Verifique os dígitos verificadores."
- "CNPJ inválido. Verifique os dígitos verificadores."
- "Email inválido"
- "Telefone inválido"
- "Nome completo inválido"
- "A senha deve ter pelo menos 6 caracteres"
- "As senhas não coincidem"

### 7.5 Estado: Sucesso
**Quando:** Solicitação criada com sucesso  
**Exibição:**
- Alert verde no topo do formulário
- Ícone de sucesso (CheckCircle2)
- Mensagem: "Solicitação enviada com sucesso! Nossa equipe irá analisar em breve."
- Formulário desabilitado
- Campos limpos
- Após 3 segundos: redirecionamento automático para `/login`

### 7.6 Estado: Tipo CNPJ Selecionado
**Quando:** Usuário seleciona "Clínica / Empresa"  
**Comportamento:**
- Campo documento aceita até 14 dígitos
- Máscara: XX.XXX.XXX/XXXX-XX
- Label: "CNPJ *"
- Placeholder: "00.000.000/0000-00"
- Label business_name: "Nome da Clínica *"
- Texto auxiliar: "Digite o CNPJ da clínica à qual deseja se vincular ou criar"

### 7.7 Estado: Tipo CPF Selecionado
**Quando:** Usuário seleciona "Profissional Autônomo"  
**Comportamento:**
- Campo documento aceita até 11 dígitos
- Máscara: XXX.XXX.XXX-XX
- Label: "CPF *"
- Placeholder: "000.000.000-00"
- Label business_name: "Nome Profissional *"
- Texto auxiliar: "Digite seu CPF para criar uma conta individual"

---

## 8. Validações

### 8.1 Validações de Frontend

**Documento (CPF/CNPJ):**
- Obrigatório
- Formato correto (máscara aplicada)
- Validação de dígitos verificadores
- Rejeita documentos com todos os dígitos iguais
- Mensagem: "[CPF/CNPJ] inválido. Verifique os dígitos verificadores."

**Nome Completo:**
- Obrigatório
- Mínimo 3 caracteres
- Mensagem: "Nome completo inválido"

**Email:**
- Obrigatório
- Deve conter "@"
- Mensagem: "Email inválido"

**Telefone:**
- Obrigatório
- Mínimo 10 dígitos (após remover formatação)
- Máximo 11 dígitos
- Mensagem: "Telefone inválido"

**Nome da Clínica/Profissional:**
- Obrigatório
- Mínimo 3 caracteres
- Mensagem: "Nome da clínica é obrigatório" ou "Nome profissional é obrigatório"

**Senha:**
- Obrigatório
- Mínimo 6 caracteres
- Mensagem: "A senha deve ter pelo menos 6 caracteres"

**Confirmar Senha:**
- Obrigatório
- Deve ser igual à senha
- Mensagem: "As senhas não coincidem"

### 8.2 Validações de Backend (API)

**Campos Obrigatórios:**
- type, full_name, email, phone, business_name, document_type, document_number, password
- Mensagem: "[Nome do campo] é obrigatório"

**Nome Completo:**
- Validação com `validateFullName()`
- Regras específicas de nome (sobrenome, caracteres válidos)

**Email:**
- Validação com `validateEmail()`
- Regex completo para formato de email
- Conversão para lowercase

**Telefone:**
- Validação com `validatePhone()`
- Formato brasileiro
- Limpeza de caracteres especiais

**Senha:**
- Validação com `validatePassword()`
- Mínimo 6 caracteres
- Não requer número (configurável)

**Tipo:**
- Deve ser "clinica" ou "autonomo"
- Mensagem: "Tipo deve ser 'clinica' ou 'autonomo'"

**Tipo de Documento:**
- Deve ser "cpf" ou "cnpj"
- Mensagem: "Tipo de documento deve ser 'cpf' ou 'cnpj'"

**Documento:**
- Validação com `validateDocument()`
- Algoritmo de dígitos verificadores
- Limpeza de formatação antes de salvar

**CEP (opcional):**
- Se fornecido, validação com `validateCEP()`
- Formato: XXXXX-XXX

### 8.3 Máscaras Automáticas

**CPF:**
- Input: "12345678900"
- Output: "123.456.789-00"
- Aplicada em tempo real durante digitação

**CNPJ:**
- Input: "12345678000190"
- Output: "12.345.678/0001-90"
- Aplicada em tempo real durante digitação

**Telefone:**
- Input: "11987654321"
- Output: "(11) 98765-4321"
- Aplicada em tempo real durante digitação
- Suporta fixo: "(11) 3456-7890"

---

## 9. Integrações

### 9.1 Firebase Authentication (Verificação)
- **Uso:** Verificar se usuário já está autenticado
- **Hook:** `useAuth()`
- **Quando:** Ao carregar a página
- **Ação:** Se autenticado, redireciona para `/dashboard`

### 9.2 API de Solicitações de Acesso
- **Endpoint:** `POST /api/access-requests`
- **Método:** POST
- **Headers:** `Content-Type: application/json`
- **Payload:**
```json
{
  "type": "clinica" | "autonomo",
  "full_name": "string",
  "email": "string",
  "phone": "string",
  "business_name": "string",
  "document_type": "cpf" | "cnpj",
  "document_number": "string",
  "password": "string"
}
```
- **Resposta Sucesso (200):**
```json
{
  "success": true,
  "message": "Solicitação enviada com sucesso!",
  "id": "document_id"
}
```
- **Resposta Erro (400/500):**
```json
{
  "error": "Mensagem de erro"
}
```

### 9.3 Firestore - Coleção access_requests
- **Coleção:** `access_requests`
- **Operação:** Create (addDoc)
- **Campos salvos:**
  - type: string
  - full_name: string
  - email: string (lowercase)
  - phone: string
  - business_name: string
  - document_type: string
  - document_number: string (apenas números)
  - password: string (hash bcrypt)
  - address: string | null
  - city: string | null
  - state: string | null
  - cep: string | null
  - status: "pendente"
  - created_at: Timestamp
  - updated_at: Timestamp

### 9.4 bcryptjs
- **Uso:** Hash de senha
- **Método:** `bcrypt.hash(password, 10)`
- **Salt Rounds:** 10
- **Quando:** Antes de salvar no Firestore
- **Resultado:** String hasheada armazenada

---

## 10. Segurança

### 10.1 Proteções Implementadas
- ✅ Validação dupla (frontend + backend)
- ✅ Senha hasheada com bcrypt (nunca em texto plano)
- ✅ Email convertido para lowercase (evita duplicação)
- ✅ Documento limpo antes de salvar (apenas números)
- ✅ Validação de dígitos verificadores (CPF/CNPJ reais)
- ✅ Rejeição de documentos com dígitos repetidos
- ✅ Campos desabilitados durante processamento
- ✅ Sanitização de inputs no backend
- ✅ Aprovação manual obrigatória (não há auto-registro)

### 10.2 Dados Sensíveis
- **Senha:** Hasheada com bcrypt (salt rounds: 10)
- **Documento:** Armazenado limpo, mas validado
- **Email:** Armazenado em lowercase
- **Telefone:** Armazenado com formatação

### 10.3 Prevenção de Fraudes
- Validação de documentos reais (dígitos verificadores)
- Aprovação manual por System Admin
- Senha não utilizada diretamente (admin gera nova)
- Histórico de solicitações (created_at, updated_at)

---
## 11. Performance

### 11.1 Métricas Estimadas
- **Tempo de carregamento:** ~500ms
- **Tempo de validação frontend:** < 100ms
- **Tempo de resposta API:** ~500-1000ms
- **Tamanho do bundle:** ~50KB (componente + dependências)

### 11.2 Otimizações Implementadas
- ✅ Validação no frontend antes de chamar API (reduz requisições desnecessárias)
- ✅ Máscaras aplicadas em tempo real (melhor UX)
- ✅ Debounce implícito (validação apenas no submit)
- ✅ Redirecionamento com delay (usuário lê mensagem de sucesso)

### 11.3 Pontos de Atenção
- Hash bcrypt pode levar ~100-200ms (aceitável para registro)
- Validação de documento com algoritmo matemático é rápida (< 10ms)
- Firestore addDoc geralmente < 500ms

---

## 12. Acessibilidade

### 12.1 Recursos Implementados
- ✅ Labels associados a todos os inputs
- ✅ Placeholders descritivos
- ✅ Mensagens de erro claras e específicas
- ✅ Campos obrigatórios marcados com "*"
- ✅ Autocomplete adequado (name, email, tel, new-password)
- ✅ Type correto nos inputs (email, tel, password)
- ✅ Botão desabilitado durante processamento (evita duplo submit)

### 12.2 Melhorias Necessárias
- [ ] ARIA labels para radio buttons
- [ ] Anúncio de erros para screen readers
- [ ] Foco automático no primeiro erro
- [ ] Indicador visual de campo com erro
- [ ] Navegação por teclado otimizada

---

## 13. Fluxo Pós-Registro

### 13.1 O Que Acontece Após o Registro?

1. **Solicitação Criada:**
   - Documento salvo em `access_requests` com status "pendente"
   - ID único gerado pelo Firestore

2. **Aguardando Aprovação:**
   - System Admin visualiza solicitação em `/admin/access-requests`
   - Admin pode aprovar ou rejeitar

3. **Se Aprovado:**
   - Admin cria tenant (clínica) no sistema
   - Admin cria usuário no Firebase Auth
   - Admin define senha temporária
   - Admin configura custom claims (role, tenant_id, etc.)
   - Admin envia credenciais por email
   - Status da solicitação muda para "aprovado"

4. **Se Rejeitado:**
   - Admin pode adicionar motivo da rejeição
   - Status muda para "rejeitado"
   - Usuário pode ser notificado (futuro)

5. **Primeiro Acesso:**
   - Usuário recebe email com credenciais
   - Usuário faz login em `/login`
   - Sistema detecta `requirePasswordChange: true`
   - Usuário é forçado a trocar senha em `/change-password`
   - Após trocar senha, acesso liberado

6. **Onboarding:**
   - Usuário `clinic_admin` é direcionado para setup inicial
   - Configuração de plano, pagamento, termos
   - Após completar, acesso total ao sistema

---

## 14. Diferenças Entre Tipos de Conta

| Aspecto | Clínica (CNPJ) | Autônomo (CPF) |
|---------|----------------|----------------|
| **Documento** | CNPJ (14 dígitos) | CPF (11 dígitos) |
| **Limite de Usuários** | Até 5 usuários | Apenas 1 usuário |
| **Label Business Name** | "Nome da Clínica" | "Nome Profissional" |
| **Tipo na API** | "clinica" | "autonomo" |
| **Uso Típico** | Clínicas, consultórios, spas | Profissionais autônomos, MEI |
| **Estrutura** | Multi-usuário | Single-user |
| **Primeiro Usuário** | clinic_admin | clinic_admin (de si mesmo) |

---

## 15. Melhorias Futuras

### 15.1 Funcionalidades
- [ ] Upload de documentos (CNPJ, alvará, etc.)
- [ ] Verificação de email (enviar código)
- [ ] Verificação de telefone (SMS)
- [ ] Integração com API de consulta de CNPJ (Receita Federal)
- [ ] Auto-preenchimento de endereço via CEP
- [ ] Seleção de plano durante registro
- [ ] Indicação de força de senha
- [ ] Gerador de senha segura
- [ ] Termos de uso e política de privacidade (checkbox)
- [ ] Captcha para prevenir bots

### 15.2 UX/UI
- [ ] Indicador de progresso (steps)
- [ ] Mostrar/ocultar senha
- [ ] Validação em tempo real (enquanto digita)
- [ ] Feedback visual de campo válido (checkmark verde)
- [ ] Animações de transição
- [ ] Preview de como ficará o perfil
- [ ] Estimativa de tempo de aprovação
- [ ] FAQ inline

### 15.3 Notificações
- [ ] Email de confirmação de solicitação recebida
- [ ] Email quando solicitação for aprovada
- [ ] Email quando solicitação for rejeitada
- [ ] Notificação push (futuro)
- [ ] SMS de confirmação

### 15.4 Segurança
- [ ] Captcha após múltiplas tentativas
- [ ] Verificação de email duplicado antes de submeter
- [ ] Verificação de documento duplicado
- [ ] Rate limiting na API
- [ ] Auditoria de tentativas de registro
- [ ] Blacklist de domínios de email temporários

---

## 16. Observações Técnicas

### 16.1 Decisões de Arquitetura

**Por que aprovação manual?**
- Controle de qualidade dos clientes
- Prevenção de fraudes e contas falsas
- Validação de documentos e informações
- Modelo de negócio B2B (não é self-service)

**Por que não usar a senha fornecida?**
- Segurança adicional: admin gera senha temporária
- Força troca de senha no primeiro acesso
- Evita senhas fracas escolhidas pelo usuário
- Permite controle total do processo de onboarding

**Por que hash com bcrypt se não será usada?**
- Boa prática de segurança (nunca armazenar senha em texto plano)
- Pode ser útil no futuro (ex: recuperação de senha)
- Demonstra compromisso com segurança
- Proteção caso haja mudança no fluxo

### 16.2 Padrões Utilizados
- **Controlled Components:** Todos os inputs são controlled
- **Single Source of Truth:** Estado centralizado em `formData`
- **Validação em Camadas:** Frontend → API → Firestore
- **Feedback Imediato:** Máscaras aplicadas em tempo real
- **Progressive Enhancement:** Funciona sem JavaScript (HTML5 validation)

### 16.3 Limitações Conhecidas
- ⚠️ Não verifica duplicação de documento antes de submeter (apenas na aprovação)
- ⚠️ Não verifica duplicação de email antes de submeter
- ⚠️ Não há limite de tentativas de registro
- ⚠️ Não há captcha (vulnerável a bots)
- ⚠️ Validação de nome é básica (aceita nomes inválidos)

### 16.4 Dependências de Bibliotecas
- **bcryptjs:** Hash de senhas (10 salt rounds)
- **Firebase/Firestore:** Armazenamento de solicitações
- **Next.js:** Framework e roteamento
- **React:** UI e gerenciamento de estado
- **Shadcn/ui:** Componentes de UI (Card, Input, Button, Alert)
- **Lucide React:** Ícones (CheckCircle2, AlertCircle)

---

## 17. Mensagens do Sistema

### 17.1 Mensagens de Sucesso
- "Solicitação enviada com sucesso! Nossa equipe irá analisar em breve."

### 17.2 Mensagens de Erro - Validação
- "CPF inválido. Verifique os dígitos verificadores."
- "CNPJ inválido. Verifique os dígitos verificadores."
- "Nome completo inválido"
- "Email inválido"
- "Telefone inválido"
- "Nome da clínica é obrigatório"
- "Nome profissional é obrigatório"
- "A senha deve ter pelo menos 6 caracteres"
- "As senhas não coincidem"

### 17.3 Mensagens de Erro - API
- "[Campo] é obrigatório"
- "Tipo deve ser 'clinica' ou 'autonomo'"
- "Tipo de documento deve ser 'cpf' ou 'cnpj'"
- "Erro ao enviar solicitação" (erro genérico)
- "Erro ao processar solicitação" (erro do servidor)

### 17.4 Textos Informativos
- "Preencha os dados abaixo para solicitar acesso ao sistema"
- "Digite o CNPJ da clínica à qual deseja se vincular ou criar"
- "Digite seu CPF para criar uma conta individual"
- "Após enviar, aguarde a aprovação do administrador."
- "Você receberá as credenciais de acesso por email."

---

## 18. Glossário

- **Access Request:** Solicitação de acesso ao sistema, criada no registro
- **Tenant:** Clínica ou entidade no sistema multi-tenant
- **clinic_admin:** Role de administrador de clínica
- **clinic_user:** Role de usuário operacional de clínica
- **system_admin:** Role de administrador do sistema Curva Mestra
- **Aprovação Manual:** Processo onde System Admin analisa e aprova/rejeita solicitações
- **Hash bcrypt:** Algoritmo de criptografia unidirecional para senhas
- **Dígitos Verificadores:** Últimos dígitos de CPF/CNPJ calculados por algoritmo
- **Máscara:** Formatação automática de input (ex: XXX.XXX.XXX-XX)
- **Custom Claims:** Metadados de permissão no token JWT do Firebase
- **Onboarding:** Processo de configuração inicial após aprovação

---

## 19. Referências

### 19.1 Documentação Relacionada
- Login Page Documentation - `project_doc/login-page-documentation.md`
- Template de Documentação - `project_doc/TEMPLATE-page-documentation.md`

### 19.2 Código Fonte
- **Componente Principal:** `src/app/(auth)/register/page.tsx`
- **API:** `src/app/api/access-requests/route.ts`
- **Validação de Documentos:** `src/lib/utils/documentValidation.ts`
- **Validações Server:** `src/lib/validations/serverValidations.ts`
- **Hook de Auth:** `src/hooks/useAuth.ts`
- **Types:** `src/types/index.ts`

### 19.3 Links Externos
- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Firestore](https://firebase.google.com/docs/firestore)
- [bcryptjs](https://www.npmjs.com/package/bcryptjs)
- [Algoritmo de Validação CPF](https://www.geradorcpf.com/algoritmo_do_cpf.htm)
- [Algoritmo de Validação CNPJ](https://www.geradorcnpj.com/algoritmo_do_cnpj.htm)

---

**Documento gerado por:** Engenharia Reversa  
**Última atualização:** 07/02/2026  
**Responsável:** Equipe de Desenvolvimento  
**Status:** Aprovado
