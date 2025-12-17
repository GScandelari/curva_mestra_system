# Análise: Sessão do Usuário Fica Aberta Mais Tempo que o Esperado

## 🔍 Causa Raiz Identificada

A sessão do usuário permanece aberta por mais tempo do que o esperado devido a **múltiplos fatores combinados**:

### 1. **Implementação Duplicada de Timeout de Sessão**

Existem **DOIS sistemas independentes** gerenciando o timeout de sessão simultaneamente:

#### Sistema 1: `useAuth.ts` (linhas 47-88)
```typescript
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutos

// Monitora atividade e reseta timeout
const events = ["mousedown", "keydown", "scroll", "touchstart", "click"];
```

#### Sistema 2: `useSessionTimeout.ts` (linhas 10-73)
```typescript
sessionTimeoutMinutes.current = 15; // 15 minutos (ou valor do Firestore)

// Monitora EXATAMENTE os mesmos eventos
const events = ["mousedown", "keydown", "scroll", "touchstart", "click"];
```

**Problema**: Ambos os sistemas:
- Escutam os mesmos eventos de atividade
- Resetam o timer toda vez que o usuário faz QUALQUER ação (até scroll)
- Têm timeouts diferentes (30min vs 15min)
- Competem entre si

### 2. **Timeout Baseado em Atividade (Não Absoluto)**

O timeout atual é baseado em **inatividade**, não em duração total da sessão:

```
┌─────────────────────────────────────────────────────────────┐
│  Login    →    Atividade    →    Atividade    →   Logout   │
│  00:00         00:15              00:30             01:00   │
│            ↑ Timer reseta    ↑ Timer reseta                 │
└─────────────────────────────────────────────────────────────┘
```

**Comportamento Atual**:
- Usuário faz login às 9h00
- Usuário clica/digita/rola a página às 9h29 (1 minuto antes do timeout)
- ⏰ Timer reseta completamente para mais 30 minutos
- Sessão agora expira às 9h59 (não às 9h30)
- Se o usuário continuar ativo, a sessão NUNCA expira

**Resultado**: Um usuário ativo permanece logado **indefinidamente**.

### 3. **Eventos de Atividade Muito Sensíveis**

Os seguintes eventos resetam o timeout:
- `mousedown` - Qualquer clique
- `keydown` - Qualquer tecla
- `scroll` - Rolar a página (muito comum em navegação)
- `touchstart` - Toque na tela (mobile)
- `click` - Clique em qualquer lugar

**Problema**: Até ações passivas como **rolar a página para ler** resetam o timer.

### 4. **Firebase Auth Token Auto-Refresh**

O Firebase Auth tem seu próprio ciclo de vida de tokens:

```
Firebase ID Token:
- Expira em: 1 hora (padrão)
- Auto-refresh: Automático antes de expirar
- Listener: onAuthStateChanged dispara ao renovar token
```

**Impacto**:
- Mesmo se os timers de inatividade não resetarem, o Firebase mantém o usuário autenticado por até 1 hora
- O `onAuthStateChanged` pode interferir com a lógica de timeout

### 5. **Persistência de Sessão Configurada**

Em `firebase.ts` (linha 59):
```typescript
setPersistence(auth, browserSessionPersistence)
```

Isso significa:
- ✅ Sessão limpa ao fechar o navegador (correto)
- ❌ Mas não limita a duração da sessão enquanto o navegador está aberto

## 📊 Fluxo Atual vs Esperado

### Cenário 1: Usuário Ativo
```
ATUAL (Problemático):
09:00 - Login
09:29 - Scroll na página → Timer reseta
09:59 - Clique em botão → Timer reseta
10:29 - Digite texto → Timer reseta
... Usuário permanece logado indefinidamente

ESPERADO:
09:00 - Login
09:30 - Logout automático (30min de inatividade)
OU
11:00 - Logout automático (2h de sessão máxima, independente de atividade)
```

### Cenário 2: Usuário Inativo
```
ATUAL (Confuso):
09:00 - Login
09:15-09:30 - Inativo
09:30 - ??? (qual timeout vence? 15min ou 30min?)

ESPERADO:
09:00 - Login
09:15-09:30 - Inativo
09:30 - Logout automático (30min de inatividade)
```

## 🐛 Problemas Identificados

### Problema 1: Conflito de Timeouts
- `useAuth.ts`: 30 minutos
- `useSessionTimeout.ts`: 15 minutos (ou valor do Firestore)
- **Qual prevalece?** Depende de qual dispara primeiro

### Problema 2: Atividade Reseta Timer Indefinidamente
```typescript
// A cada clique, scroll, tecla → timer reinicia do zero
const handleActivity = () => {
  resetSessionTimeout(); // ← Problema aqui
};
```

### Problema 3: Sem Limite Absoluto de Sessão
- Não há tempo máximo de sessão
- Usuário ativo = sessão infinita
- Risco de segurança se o usuário deixar o browser aberto em local público

### Problema 4: Implementação Duplicada
- Dois hooks fazendo a mesma coisa
- Código duplicado e difícil de manter
- Pode causar comportamentos inesperados

## 🎯 Recomendações de Correção

### Opção 1: Timeout de Inatividade Puro (Recomendado para MVP)
```typescript
// Um único sistema de timeout
// Timer reseta SOMENTE em atividade real (não scroll)
// Timeout consistente (ex: 30 minutos)

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutos
const events = ["mousedown", "keydown", "click"]; // Remover "scroll"
```

**Prós**:
- Simples de implementar
- Bom para UX (usuário não é deslogado enquanto trabalha)
- Padrão de mercado

**Contras**:
- Sessão pode durar muito tempo se usuário estiver ativo

### Opção 2: Timeout Absoluto + Inatividade
```typescript
// Duas condições de logout:
// 1. Inatividade de 30 minutos
// 2. Sessão máxima de 8 horas (independente de atividade)

const INACTIVITY_TIMEOUT = 30 * 60 * 1000;    // 30 min inativo
const MAX_SESSION_DURATION = 8 * 60 * 60 * 1000; // 8h total
```

**Prós**:
- Mais seguro (sessão sempre expira eventualmente)
- Compliance com políticas de segurança
- Protege contra browser aberto em local público

**Contras**:
- Usuário pode ser deslogado no meio de trabalho importante
- Requer aviso prévio ao usuário

### Opção 3: Sistema Híbrido com Avisos
```typescript
// Avisar usuário antes de deslogar
// Oferecer botão "Continuar conectado"
// Logging de atividade para auditoria

// Avisos:
- 5 minutos antes: Modal "Sua sessão vai expirar"
- Botão "Continuar": Renova sessão
- Sem ação: Logout automático
```

**Prós**:
- Melhor UX (usuário não perde trabalho)
- Ainda oferece segurança
- Compliance com auditoria

**Contras**:
- Mais complexo de implementar
- Requer UI adicional

## 🔧 Ação Imediata Recomendada

1. **Remover duplicação**:
   - Escolher UM sistema de timeout (recomendo `useSessionTimeout.ts` por ser mais configurável)
   - Remover timeout de `useAuth.ts`

2. **Ajustar eventos monitorados**:
   ```typescript
   // Remover "scroll" da lista
   const events = ["mousedown", "keydown", "click"];
   ```

3. **Definir timeout consistente**:
   ```typescript
   // Usar valor fixo ou do Firestore, mas não ambos
   const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutos
   ```

4. **Considerar limite absoluto** (opcional):
   ```typescript
   const MAX_SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 horas
   ```

5. **Testar comportamento**:
   - Cenário 1: Usuário ativo por 2 horas
   - Cenário 2: Usuário inativo por 31 minutos
   - Cenário 3: Usuário sai e volta depois de 1 hora

## 📝 Notas Adicionais

- Firebase `browserSessionPersistence` só limpa ao fechar browser
- Firebase tokens expiram em 1h mas são auto-renovados
- `onAuthStateChanged` dispara ao renovar token
- Considerar implementar refresh token rotation para maior segurança
- Logging de sessões pode ajudar em auditorias de segurança

---

**Data da Análise**: 2025-12-13
**Severidade**: Média (funcional, mas comportamento inesperado)
**Impacto**: UX e Segurança
**Prioridade**: Alta (corrigir antes de produção)
