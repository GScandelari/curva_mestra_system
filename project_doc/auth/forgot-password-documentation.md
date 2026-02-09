# Documentação Experimental - Página Forgot Password

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização  
**Módulo:** Autenticação  
**Componente:** Página de Esqueci a Senha (`/forgot-password`)  
**Versão:** 1.0  
**Data:** 07/02/2026  
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

A página Forgot Password é o **ponto de entrada** do fluxo de recuperação de senha iniciado pelo próprio usuário. Esta página permite que usuários que esqueceram suas credenciais solicitem um link de redefinição de senha via email.

### 1.1 Propósito

- Permitir que usuários recuperem acesso à conta
- Enviar email com link de reset de senha
- Primeira etapa do fluxo de recuperação
- Interface simples e focada

### 1.2 Fluxo Completo de Recuperação

```
1. /forgot-password (esta página)
   ↓
2. Email enviado com link
   ↓
3. /reset-password/[token]
   ↓
4. Nova senha definida
   ↓
5. /login
```

### 1.3 Localização
- **Arquivo:** `src/app/(auth)/forgot-password/page.tsx`
- **Rota:** `/forgot-password`
- **Layout:** Auth Layout (sem navegação principal)

### 1.4 Dependências Principais
- **Firebase Auth:** `sendPasswordResetEmail`
- **Firebase Config:** Configuração de email templates
- **Next.js:** Roteamento e componentes

---

## 2. Método do Firebase: sendPasswordResetEmail

### 2.1 Como Funciona?

O Firebase Auth possui um método nativo para envio de emails de reset:

```typescript
sendPasswordResetEmail(auth, email, {
  url: `${window.location.origin}/login`,
  handleCodeInApp: false,
})
```

**Parâmetros:**
- `auth`: Instância do Firebase Auth
- `email`: Email do usuário
- `options`: Configurações adicionais
  - `url`: URL de retorno após reset
  - `handleCodeInApp`: Se deve processar código no app (false = usa link)

**O que o Firebase faz:**
1. Verifica se email existe no sistema
2. Gera link de reset com código único
3. Envia email usando template configurado
4. Link expira após tempo configurado (geralmente 1 hora)

### 2.2 Vantagens do Método Nativo

- ✅ Infraestrutura de email gerenciada pelo Firebase
- ✅ Templates de email customizáveis no console
- ✅ Rate limiting automático
- ✅ Links seguros com expiração
- ✅ Não requer servidor SMTP próprio
- ✅ Suporte a múltiplos idiomas

### 2.3 Limitações

- ⚠️ Customização limitada do email
- ⚠️ Depende de configuração no Firebase Console
- ⚠️ Não há controle sobre conteúdo do email via código
- ⚠️ Não há auditoria detalhada de envios

---

## 3. Casos de Uso

### 3.1 UC-001: Solicitação de Reset Bem-Sucedida

**Ator:** Usuário que Esqueceu a Senha  
**Pré-condições:**
- Usuário possui conta no sistema
- Email está cadastrado no Firebase Auth
- Usuário não está autenticado

**Fluxo Principal:**
1. Usuário acessa `/forgot-password`
2. Sistema exibe formulário com campo de email
3. Usuário digita email: "usuario@exemplo.com"
4. Usuário clica em "Enviar link de recuperação"
5. Sistema chama `sendPasswordResetEmail` do Firebase
6. Firebase valida que email existe
7. Firebase gera link de reset único
8. Firebase envia email para usuário
9. Sistema exibe mensagem de sucesso
10. Usuário recebe email na caixa de entrada

**Pós-condições:**
- Email enviado com link de reset
- Link válido por tempo limitado (configurado no Firebase)
- Usuário pode clicar no link para redefinir senha

**Mensagem de Sucesso:**
```
✓ Email enviado com sucesso!

Verifique sua caixa de entrada e siga as instruções 
para redefinir sua senha.

Não se esqueça de verificar a pasta de spam.
```

**Conteúdo do Email (Firebase):**
- Assunto: "Redefinir senha - Curva Mestra"
- Corpo: Template configurado no Firebase Console
- Link: `https://app.com/__/auth/action?mode=resetPassword&oobCode=[code]`
- Expiração: Configurável (padrão 1 hora)

---

### 3.2 UC-002: Email Não Encontrado

**Ator:** Usuário  
**Pré-condições:**
- Email não está cadastrado no sistema

**Fluxo Principal:**
1. Usuário acessa `/forgot-password`
2. Usuário digita email não cadastrado: "naoexiste@exemplo.com"
3. Usuário clica em "Enviar link de recuperação"
4. Sistema chama `sendPasswordResetEmail`
5. Firebase retorna erro `auth/user-not-found`
6. Sistema captura erro
7. Sistema exibe mensagem: "Usuário não encontrado"

**Pós-condições:**
- Email NÃO enviado
- Usuário permanece na página
- Pode tentar com outro email

**Consideração de Segurança:**
- Alguns sistemas não revelam se email existe (previne enumeração)
- Este sistema opta por informar claramente (melhor UX)
- Trade-off entre segurança e usabilidade

---

### 3.3 UC-003: Email com Formato Inválido

**Ator:** Usuário  
**Pré-condições:**
- Usuário digita email com formato incorreto

**Fluxo Principal:**
1. Usuário acessa `/forgot-password`
2. Usuário digita: "emailinvalido" (sem @)
3. Usuário clica em "Enviar link de recuperação"
4. Sistema chama `sendPasswordResetEmail`
5. Firebase retorna erro `auth/invalid-email`
6. Sistema captura erro
7. Sistema exibe mensagem: "Email inválido"

**Pós-condições:**
- Email NÃO enviado
- Usuário corrige formato

**Validação:**
- HTML5 validation (type="email") previne alguns casos
- Firebase valida formato completo
- Mensagem clara para correção

---

### 3.4 UC-004: Muitas Tentativas (Rate Limiting)

**Ator:** Usuário ou Bot  
**Pré-condições:**
- Múltiplas tentativas em curto período
- Firebase detecta abuso

**Fluxo Principal:**
1. Usuário tenta enviar email múltiplas vezes
2. Firebase detecta rate limiting
3. Firebase retorna erro `auth/too-many-requests`
4. Sistema captura erro
5. Sistema exibe mensagem: "Muitas tentativas. Tente novamente mais tarde"

**Pós-condições:**
- Email NÃO enviado
- Usuário deve aguardar antes de tentar novamente
- Proteção contra spam e abuso

**Rate Limiting:**
- Gerenciado automaticamente pelo Firebase
- Baseado em IP e email
- Tempo de bloqueio varia (geralmente minutos)
- Não há configuração manual

---

### 3.5 UC-005: Erro de Conexão

**Ator:** Usuário  
**Pré-condições:**
- Problema de conectividade
- Rede instável ou offline

**Fluxo Principal:**
1. Usuário tenta enviar email
2. Requisição falha por problema de rede
3. Firebase retorna erro `auth/network-request-failed`
4. Sistema captura erro
5. Sistema exibe mensagem: "Erro de conexão. Verifique sua internet"

**Pós-condições:**
- Email NÃO enviado
- Usuário pode tentar novamente quando conexão estabilizar

---

### 3.6 UC-006: Usuário Já Recebeu Email e Tenta Novamente

**Ator:** Usuário Impaciente  
**Pré-condições:**
- Usuário já solicitou reset
- Email ainda não chegou (pode estar em trânsito)

**Fluxo Principal:**
1. Usuário solicita reset pela primeira vez
2. Email é enviado (mas ainda não chegou)
3. Usuário aguarda 30 segundos
4. Usuário solicita novamente
5. Firebase envia novo email
6. Usuário recebe dois emails

**Pós-condições:**
- Dois emails enviados
- Ambos os links funcionam
- Último link usado invalida os anteriores (comportamento do Firebase)

**Comportamento:**
- Firebase não bloqueia múltiplos envios
- Cada solicitação gera novo link
- Links anteriores podem ser invalidados após uso do mais recente

---

### 3.7 UC-007: Usuário Clica em "Voltar para Login"

**Ator:** Usuário  
**Pré-condições:**
- Usuário está em `/forgot-password`
- Lembrou a senha ou desistiu

**Fluxo Principal:**
1. Usuário visualiza página
2. Usuário clica em "Voltar para login"
3. Sistema redireciona para `/login`

**Pós-condições:**
- Usuário na página de login
- Pode fazer login normalmente

---

## 4. Fluxo de Processo Detalhado

```
┌─────────────────────────────────────────────────────────────────┐
│              FLUXO DE FORGOT PASSWORD                            │
└─────────────────────────────────────────────────────────────────┘

    Usuário esqueceu senha
              │
              ▼
    ┌──────────────────────────────┐
    │ Acessa /forgot-password      │
    └──────────────────────────────┘
              │
              ▼
    ┌──────────────────────────────┐
    │ Formulário exibido:          │
    │ - Campo: Email               │
    │ - Botão: Enviar link         │
    │ - Link: Voltar ao login      │
    └──────────────────────────────┘
              │
              ▼
    Usuário digita email
              │
              ▼
    Usuário clica em "Enviar"
              │
              ▼
    ┌──────────────────────────────┐
    │ Sistema chama Firebase:      │
    │ sendPasswordResetEmail()     │
    └──────────────────────────────┘
              │
              ▼
    ┌──────────────────────────────┐
    │ Firebase valida email        │
    └──────────────────────────────┘
         │              │
    VÁLIDO│              │INVÁLIDO
         │              │
         ▼              ▼
┌──────────────┐  ┌──────────────────┐
│ Firebase:    │  │ Firebase retorna │
│ 1. Gera link │  │ erro:            │
│ 2. Envia     │  │ - user-not-found │
│    email     │  │ - invalid-email  │
└──────────────┘  │ - too-many-req   │
         │        │ - network-failed │
         │        └──────────────────┘
         │                 │
         ▼                 ▼
┌──────────────┐  ┌──────────────────┐
│ Sistema      │  │ Sistema exibe    │
│ exibe tela   │  │ mensagem de erro │
│ de sucesso   │  │ traduzida        │
└──────────────┘  └──────────────────┘
         │                 │
         │                 │
         └────────┬────────┘
                  │
                  ▼
         Usuário pode:
         1. Aguardar email
         2. Tentar novamente
         3. Voltar ao login
                  │
                  ▼
    ┌──────────────────────────────┐
    │ Email chega na caixa de      │
    │ entrada (ou spam)            │
    └──────────────────────────────┘
                  │
                  ▼
    ┌──────────────────────────────┐
    │ Usuário clica no link        │
    └──────────────────────────────┘
                  │
                  ▼
    ┌──────────────────────────────┐
    │ Firebase processa link       │
    │ Redireciona para página      │
    │ de reset do Firebase         │
    └──────────────────────────────┘
                  │
                  ▼
    Usuário define nova senha
    (fora do escopo desta página)
```

---

## 5. Regras de Negócio

### RN-001: Email Obrigatório
**Descrição:** Campo de email é obrigatório para solicitar reset  
**Aplicação:** Validação HTML5 (required) e Firebase  
**Exceções:** Nenhuma  
**Justificativa:** Não há como enviar email sem endereço

### RN-002: Validação de Formato
**Descrição:** Email deve ter formato válido (contém @, domínio, etc)  
**Aplicação:** HTML5 type="email" e Firebase  
**Exceções:** Nenhuma  
**Justificativa:** Previne erros de digitação

### RN-003: Verificação de Existência
**Descrição:** Email deve existir no sistema para enviar reset  
**Aplicação:** Firebase verifica antes de enviar  
**Exceções:** Nenhuma  
**Justificativa:** Não faz sentido enviar email para conta inexistente

### RN-004: Rate Limiting Automático
**Descrição:** Firebase limita número de tentativas por período  
**Aplicação:** Automático, baseado em IP e email  
**Exceções:** Nenhuma  
**Justificativa:** Previne spam e abuso

### RN-005: Link com Expiração
**Descrição:** Link de reset expira após tempo configurado (padrão 1 hora)  
**Aplicação:** Gerenciado pelo Firebase  
**Exceções:** Nenhuma  
**Justificativa:** Segurança - limita janela de vulnerabilidade

### RN-006: Tradução de Erros
**Descrição:** Erros do Firebase são traduzidos para português  
**Aplicação:** Função `translateFirebaseError`  
**Exceções:** Nenhuma  
**Justificativa:** Melhor experiência do usuário

### RN-007: Feedback Claro
**Descrição:** Usuário sempre recebe feedback sobre ação (sucesso ou erro)  
**Aplicação:** Mensagens visuais após submissão  
**Exceções:** Nenhuma  
**Justificativa:** Usuário precisa saber o que aconteceu

---
## 6. Estados da Interface

### 6.1 Estado: Formulário Inicial

**Quando:** Usuário acessa `/forgot-password`  
**Exibição:**

**Card Header:**
- Título: "Recuperar Senha"
- Descrição: "Digite seu email para receber o link de recuperação"

**Card Content:**
- **Campo Email:**
  - Type: email
  - Placeholder: "seu@email.com"
  - Required: Sim
  - Autofocus: Sim
  - Autocomplete: email
  - Disabled: Não

- **Botão:** "Enviar link de recuperação"
  - Disabled: Não
  - Full width

**Card Footer:**
- Link: "Voltar para login" (com ícone de seta)
  - Destino: `/login`
  - Estilo: Texto com hover

### 6.2 Estado: Processando Envio

**Quando:** Usuário submeteu formulário  
**Exibição:**
- Campo de email desabilitado
- Botão desabilitado
- Texto do botão: "Enviando..."
- Cursor de loading (implícito)

**Duração:** 1-3 segundos (depende do Firebase)

### 6.3 Estado: Sucesso

**Quando:** Email enviado com sucesso  
**Exibição:**

**Ícone:**
- Email (Mail) em círculo verde
- Tamanho: 6x6
- Cor: Verde (green-600)

**Mensagem Principal:**
- "Email enviado com sucesso!"
- Fonte: Semibold

**Mensagem Secundária:**
- "Verifique sua caixa de entrada e siga as instruções para redefinir sua senha."
- Cor: Muted foreground

**Aviso:**
- "Não se esqueça de verificar a pasta de spam."
- Tamanho: Extra small
- Cor: Muted foreground
- Margem superior

**Comportamento:**
- Formulário não é mais exibido
- Apenas mensagem de sucesso
- Link "Voltar para login" permanece

### 6.4 Estado: Erro

**Quando:** Falha ao enviar email  
**Exibição:**
- Formulário permanece visível
- Alert vermelho acima do botão
- Mensagem de erro traduzida
- Campo de email habilitado
- Botão habilitado
- Usuário pode tentar novamente

**Mensagens de Erro:**
- "Usuário não encontrado"
- "Email inválido"
- "Muitas tentativas. Tente novamente mais tarde"
- "Erro de conexão. Verifique sua internet"
- "Erro ao enviar email. Tente novamente"

---

## 7. Componentes da Interface

### 7.1 Estrutura Visual

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│              Recuperar Senha                        │
│    Digite seu email para receber o link            │
│           de recuperação                            │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│    Email                                            │
│    ┌─────────────────────────────────────────┐     │
│    │ seu@email.com                           │     │
│    └─────────────────────────────────────────┘     │
│                                                     │
│    ┌─────────────────────────────────────────┐     │
│    │   Enviar link de recuperação            │     │
│    └─────────────────────────────────────────┘     │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│         ← Voltar para login                         │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 7.2 Estrutura Visual - Sucesso

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│              Recuperar Senha                        │
│    Digite seu email para receber o link            │
│           de recuperação                            │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│                    ✉️                               │
│           (ícone verde de email)                    │
│                                                     │
│         Email enviado com sucesso!                  │
│                                                     │
│    Verifique sua caixa de entrada e siga as        │
│    instruções para redefinir sua senha.            │
│                                                     │
│    Não se esqueça de verificar a pasta de spam.    │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│         ← Voltar para login                         │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 7.3 Elementos de UI

**Card:**
- Componente: Shadcn/ui Card
- Largura: Responsiva
- Centralizado na tela

**Input Email:**
- Componente: Shadcn/ui Input
- Type: email (validação HTML5)
- Required: true
- Autofocus: true
- Disabled durante processamento

**Botão:**
- Componente: Shadcn/ui Button
- Variant: Default (primary)
- Full width: true
- Disabled durante processamento

**Link Voltar:**
- Componente: Next.js Link
- Ícone: ArrowLeft (Lucide)
- Estilo: Texto com hover
- Cor: Muted foreground → Primary

**Ícone de Sucesso:**
- Componente: Mail (Lucide)
- Tamanho: h-6 w-6
- Cor: green-600
- Background: Círculo verde claro

---

## 8. Validações

### 8.1 Validações de Frontend

**Email:**
- Obrigatório (HTML5 required)
- Formato de email (HTML5 type="email")
- Validação básica do navegador

**Limitações:**
- Não valida se email existe (feito pelo Firebase)
- Não valida domínio (ex: @gmail.com vs @gmial.com)

### 8.2 Validações do Firebase

**Email:**
- Formato completo (regex avançado)
- Existência no sistema
- Rate limiting (automático)

**Erros Retornados:**
- `auth/user-not-found`: Email não cadastrado
- `auth/invalid-email`: Formato inválido
- `auth/too-many-requests`: Muitas tentativas
- `auth/network-request-failed`: Problema de conexão

### 8.3 Tradução de Erros

```typescript
const translateFirebaseError = (errorCode: string): string => {
  switch (errorCode) {
    case "auth/user-not-found":
      return "Usuário não encontrado";
    case "auth/invalid-email":
      return "Email inválido";
    case "auth/too-many-requests":
      return "Muitas tentativas. Tente novamente mais tarde";
    case "auth/network-request-failed":
      return "Erro de conexão. Verifique sua internet";
    default:
      return "Erro ao enviar email. Tente novamente";
  }
};
```

---

## 9. Integrações

### 9.1 Firebase Auth - sendPasswordResetEmail

**Método:**
```typescript
sendPasswordResetEmail(auth, email, {
  url: `${window.location.origin}/login`,
  handleCodeInApp: false,
})
```

**Parâmetros:**
- `auth`: Instância do Firebase Auth
- `email`: Email do usuário
- `options.url`: URL de retorno após reset
- `options.handleCodeInApp`: false (usa link externo)

**Retorno:**
- Promise<void>
- Resolve se email enviado
- Reject com erro se falha

**Configuração Necessária:**
- Template de email no Firebase Console
- Domínio autorizado
- SMTP configurado (gerenciado pelo Firebase)

### 9.2 Firebase Console - Email Templates

**Localização:**
- Firebase Console → Authentication → Templates

**Configurações:**
- Assunto do email
- Corpo do email (HTML)
- Remetente (nome e email)
- URL de ação
- Idioma

**Variáveis Disponíveis:**
- `%LINK%`: Link de reset
- `%EMAIL%`: Email do usuário
- `%APP_NAME%`: Nome do app

### 9.3 Next.js Router

**Uso:** Redirecionamento para login  
**Método:** `<Link href="/login">`  
**Quando:** Usuário clica em "Voltar para login"

---

## 10. Segurança

### 10.1 Proteções Implementadas
- ✅ Rate limiting automático (Firebase)
- ✅ Validação de formato de email
- ✅ Links com expiração (1 hora padrão)
- ✅ HTTPS obrigatório
- ✅ Não expõe informações sensíveis
- ✅ Tradução de erros (não expõe códigos internos)

### 10.2 Considerações de Segurança

**Enumeração de Usuários:**
- Sistema informa se email existe
- Trade-off: Segurança vs UX
- Decisão: Priorizar UX (informar claramente)
- Alternativa: Sempre mostrar sucesso (mais seguro, pior UX)

**Rate Limiting:**
- Gerenciado pelo Firebase
- Baseado em IP e email
- Previne spam e brute force
- Não há configuração manual

**Links de Reset:**
- Gerados pelo Firebase (seguros)
- Expiração configurável
- Uso único (invalidados após uso)
- HTTPS obrigatório

### 10.3 Vetores de Ataque Mitigados

**Spam de Emails:**
- Rate limiting previne envio massivo
- Firebase bloqueia IPs suspeitos

**Enumeração de Contas:**
- Parcialmente mitigado (informa se existe)
- Rate limiting dificulta enumeração em massa

**Phishing:**
- Emails vêm de domínio Firebase oficial
- Links apontam para domínio autorizado
- Usuário pode verificar remetente

---

## 11. Performance

### 11.1 Métricas Estimadas

**Carregamento da Página:**
- Tempo: ~300-500ms
- Componentes: Leves (apenas um input)
- Bundle: Pequeno

**Envio de Email:**
- Tempo: ~1-3 segundos
- Depende: Firebase e servidor de email
- Feedback: Imediato (loading state)

**Total do Fluxo:**
- Acesso → Preenchimento → Envio: ~5-10 segundos
- Usuário recebe email: ~30 segundos a 2 minutos

### 11.2 Otimizações Implementadas
- ✅ Autofocus no campo de email (UX)
- ✅ Feedback imediato (loading state)
- ✅ Validação HTML5 (previne requisições inválidas)
- ✅ Componentes leves (Shadcn/ui)

### 11.3 Gargalos Potenciais
- Envio de email pelo Firebase (depende de serviço externo)
- Entrega de email (pode cair em spam)
- Processamento do servidor de email do destinatário

---

## 12. Melhorias Futuras

### 12.1 Funcionalidades
- [ ] Captcha para prevenir bots
- [ ] Verificação de email em tempo real (API)
- [ ] Sugestão de correção de email (ex: gmial → gmail)
- [ ] Histórico de tentativas de reset
- [ ] Notificação de tentativa de reset (email secundário)
- [ ] Opção de reset via SMS
- [ ] Verificação de identidade adicional
- [ ] Link para FAQ ou suporte

### 12.2 UX/UI
- [ ] Animação de envio de email
- [ ] Countdown para tentar novamente (rate limit)
- [ ] Indicador de força de conexão
- [ ] Modo escuro
- [ ] Internacionalização (i18n)
- [ ] Feedback visual de validação em tempo real
- [ ] Ilustração ou ícone mais visual

### 12.3 Segurança
- [ ] Captcha obrigatório após X tentativas
- [ ] Não revelar se email existe (mais seguro)
- [ ] Auditoria de tentativas de reset
- [ ] Alertas de múltiplas tentativas
- [ ] Verificação de dispositivo conhecido
- [ ] Geolocalização de tentativas

### 12.4 Comunicação
- [ ] Customização completa do email
- [ ] Múltiplos idiomas no email
- [ ] Email com design responsivo
- [ ] Instruções mais detalhadas no email
- [ ] Link de suporte no email

---

## 13. Observações Técnicas

### 13.1 Decisões de Arquitetura

**Por que usar sendPasswordResetEmail do Firebase?**
- Simplicidade de implementação
- Infraestrutura de email confiável
- Não requer servidor SMTP próprio
- Templates gerenciados no console
- Rate limiting automático
- Segurança gerenciada pelo Firebase

**Por que não implementar sistema próprio?**
- Complexidade adicional
- Requer servidor SMTP
- Requer gerenciamento de templates
- Requer implementação de rate limiting
- Requer gerenciamento de segurança
- Firebase já resolve tudo isso

**Por que informar se email existe?**
- Melhor experiência do usuário
- Feedback claro e honesto
- Usuário sabe se digitou errado
- Trade-off aceitável para este sistema

### 13.2 Padrões Utilizados
- **Página Simples:** Foco em uma única ação
- **Feedback Claro:** Sempre informa resultado
- **Validação Progressiva:** HTML5 → Firebase
- **Estado de Loading:** Feedback durante processamento
- **Mensagens Traduzidas:** Português claro

### 13.3 Limitações Conhecidas
- ⚠️ Depende de configuração no Firebase Console
- ⚠️ Customização limitada do email
- ⚠️ Não há controle sobre entrega (pode cair em spam)
- ⚠️ Não há captcha (vulnerável a bots)
- ⚠️ Revela se email existe (enumeração possível)
- ⚠️ Não há verificação de identidade adicional

### 13.4 Dependências Críticas
- **Firebase Auth:** Envio de email
- **Firebase Console:** Configuração de templates
- **Servidor de Email:** Entrega de emails
- **Next.js:** Framework e roteamento
- **Shadcn/ui:** Componentes de UI

---

## 14. Mensagens do Sistema

### 14.1 Título e Descrição
- "Recuperar Senha"
- "Digite seu email para receber o link de recuperação"

### 14.2 Labels e Placeholders
- Label: "Email"
- Placeholder: "seu@email.com"

### 14.3 Botões
- "Enviar link de recuperação" (normal)
- "Enviando..." (processando)

### 14.4 Links
- "Voltar para login"

### 14.5 Mensagens de Sucesso
- "Email enviado com sucesso!"
- "Verifique sua caixa de entrada e siga as instruções para redefinir sua senha."
- "Não se esqueça de verificar a pasta de spam."

### 14.6 Mensagens de Erro
- "Usuário não encontrado"
- "Email inválido"
- "Muitas tentativas. Tente novamente mais tarde"
- "Erro de conexão. Verifique sua internet"
- "Erro ao enviar email. Tente novamente"

---

## 15. Comparação com Outras Páginas

| Aspecto | Forgot Password | Reset Password | Change Password |
|---------|-----------------|----------------|-----------------|
| **Iniciado por** | Usuário | Usuário | Admin (força) |
| **Autenticação** | Não logado | Não logado | Logado |
| **Requer senha** | Não | Não | Sim (atual) |
| **Usa token** | Sim (Firebase) | Sim (custom) | Não |
| **Envia email** | Sim | Não | Não |
| **Próxima etapa** | Email → Reset | Define senha | Dashboard |
| **Bloqueio** | Opcional | Opcional | Obrigatório |

---

## 16. Testes Recomendados

### 16.1 Testes Funcionais

**Envio Bem-Sucedido:**
1. Digitar email válido → Email enviado
2. Verificar mensagem de sucesso → Exibida
3. Verificar recebimento de email → Email na caixa
4. Clicar no link do email → Redireciona para reset

**Validações:**
1. Email vazio → Erro HTML5
2. Email inválido → Erro do Firebase
3. Email não cadastrado → Erro "Usuário não encontrado"
4. Múltiplas tentativas → Rate limiting

**Navegação:**
1. Clicar "Voltar para login" → Redireciona para /login
2. Acessar diretamente /forgot-password → Página carrega

### 16.2 Testes de Segurança
1. Tentar enviar múltiplos emails → Rate limiting ativo
2. Tentar com email malicioso → Validação bloqueia
3. Verificar HTTPS → Obrigatório
4. Verificar expiração de link → Expira após 1 hora

### 16.3 Testes de UI
1. Responsividade mobile → OK
2. Responsividade tablet → OK
3. Responsividade desktop → OK
4. Modo escuro (se implementado) → OK
5. Acessibilidade (screen readers) → OK

### 16.4 Testes de Email
1. Email chega na caixa de entrada → OK
2. Email não cai em spam → Verificar
3. Link do email funciona → OK
4. Template do email está correto → OK

---

## 17. Troubleshooting

### 17.1 Email Não Chega

**Possíveis Causas:**
- Email caiu em spam
- Email incorreto
- Problema no servidor de email
- Rate limiting ativo
- Configuração incorreta no Firebase

**Soluções:**
- Verificar pasta de spam
- Verificar email digitado
- Aguardar alguns minutos
- Tentar novamente mais tarde
- Verificar configuração no Firebase Console

### 17.2 Link do Email Não Funciona

**Possíveis Causas:**
- Link expirou (> 1 hora)
- Link já foi usado
- Domínio não autorizado no Firebase
- Problema de configuração

**Soluções:**
- Solicitar novo reset
- Verificar configuração de domínios autorizados
- Verificar template no Firebase Console
- Contatar suporte

### 17.3 Erro "Muitas Tentativas"

**Possíveis Causas:**
- Múltiplas tentativas em curto período
- Rate limiting do Firebase ativo

**Soluções:**
- Aguardar alguns minutos (5-15 min)
- Tentar de outro dispositivo/rede
- Contatar suporte se persistir

### 17.4 Erro "Usuário Não Encontrado"

**Possíveis Causas:**
- Email não cadastrado
- Erro de digitação
- Conta foi deletada

**Soluções:**
- Verificar email correto
- Tentar com outro email
- Registrar nova conta
- Contatar administrador

---

## 18. Configuração no Firebase Console

### 18.1 Passos para Configurar

1. **Acessar Firebase Console:**
   - https://console.firebase.google.com
   - Selecionar projeto

2. **Ir para Authentication:**
   - Menu lateral → Authentication
   - Aba "Templates"

3. **Configurar Template de Reset:**
   - Selecionar "Password reset"
   - Editar template
   - Customizar assunto e corpo
   - Salvar

4. **Configurar Domínios Autorizados:**
   - Aba "Settings"
   - "Authorized domains"
   - Adicionar domínio do app

5. **Testar:**
   - Usar página de forgot-password
   - Verificar recebimento de email
   - Testar link

### 18.2 Exemplo de Template

**Assunto:**
```
Redefinir senha - Curva Mestra
```

**Corpo (HTML):**
```html
<p>Olá,</p>
<p>Você solicitou a redefinição de senha para sua conta no Curva Mestra.</p>
<p>Clique no link abaixo para definir uma nova senha:</p>
<p><a href="%LINK%">Redefinir Senha</a></p>
<p>Este link expira em 1 hora.</p>
<p>Se você não solicitou esta redefinição, ignore este email.</p>
<p>Atenciosamente,<br>Equipe Curva Mestra</p>
```

---

## 19. Glossário

- **sendPasswordResetEmail:** Método do Firebase para enviar email de reset
- **Rate Limiting:** Limitação de número de requisições por período
- **Firebase Console:** Interface web para configurar Firebase
- **Email Template:** Modelo de email configurável
- **Authorized Domain:** Domínio autorizado para links de reset
- **oobCode:** Out-of-band code (código do link de reset)
- **Enumeração de Usuários:** Descobrir quais emails existem no sistema

---

## 20. Referências

### 20.1 Documentação Relacionada
- Reset Password Documentation - `project_doc/reset-password-documentation.md`
- Change Password Documentation - `project_doc/change-password-documentation.md`
- Login Page Documentation - `project_doc/login-page-documentation.md`
- Template de Documentação - `project_doc/TEMPLATE-page-documentation.md`

### 20.2 Código Fonte
- **Página:** `src/app/(auth)/forgot-password/page.tsx`
- **Firebase Config:** `src/lib/firebase.ts`

### 20.3 Links Externos
- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Firebase sendPasswordResetEmail](https://firebase.google.com/docs/auth/web/manage-users#send_a_password_reset_email)
- [Firebase Email Templates](https://firebase.google.com/docs/auth/custom-email-handler)
- [Firebase Console](https://console.firebase.google.com)

---

**Documento gerado por:** Engenharia Reversa  
**Última atualização:** 07/02/2026  
**Responsável:** Equipe de Desenvolvimento  
**Status:** Aprovado
