# Correção: Sistema de Timeout de Sessão

## ✅ Mudanças Implementadas

### 1. Removida Lógica Duplicada de `useAuth.ts`

**Antes:**
```typescript
// useAuth.ts tinha seu próprio sistema de timeout
const SESSION_TIMEOUT = 30 * 60 * 1000;
const sessionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
// ... código de monitoramento de eventos
```

**Depois:**
```typescript
// useAuth.ts agora foca APENAS em autenticação
// Timeout de sessão gerenciado apenas por useSessionTimeout.ts
```

**Arquivos Modificados:**
- `src/hooks/useAuth.ts`
  - Removido: `SESSION_TIMEOUT` constante
  - Removido: `sessionTimeoutRef` e `lastActivityRef`
  - Removido: função `resetSessionTimeout()`
  - Removido: `useEffect` de monitoramento de atividade
  - Removido: chamadas a `resetSessionTimeout()` no listener de auth

### 2. Otimizado `useSessionTimeout.ts`

**Mudanças:**

#### a) Timeout Padrão Alterado
```typescript
// ANTES: 15 minutos
sessionTimeoutMinutes.current = 15;

// DEPOIS: 30 minutos
sessionTimeoutMinutes.current = 30;
```

#### b) Eventos Monitorados Otimizados
```typescript
// ANTES: eventos incluindo ações passivas
const events = ["mousedown", "keydown", "scroll", "touchstart", "click"];

// DEPOIS: apenas ações ativas do usuário
const events = ["mousedown", "keydown", "click"];
// Removidos: "scroll" e "touchstart"
```

**Justificativa:**
- `scroll`: Usuário apenas lendo a página não deve resetar o timeout
- `touchstart`: Similar ao scroll em dispositivos móveis

#### c) Documentação Adicionada
```typescript
/**
 * Hook para gerenciar timeout de sessão por inatividade
 *
 * Sistema único de timeout - não duplicar em outros lugares!
 *
 * Comportamento:
 * - Timeout padrão: 30 minutos de inatividade
 * - Configurável via Firestore (system_settings/global)
 * - Eventos monitorados: mousedown, keydown, click
 * - Timer reseta a cada ação ativa do usuário
 * - Sem limite absoluto de sessão
 */
```

#### d) Logging Melhorado
```typescript
// Timeout configurado
console.log(`⏰ Timeout de sessão configurado: ${sessionTimeoutMinutes.current} minutos`);

// Sessão expirada
console.log(`⏰ Sessão expirada após ${sessionTimeoutMinutes.current} minutos de inatividade`);
```

## 📊 Comportamento Atual

### Sistema Único de Timeout
```
┌─────────────────────────────────────────────────────────┐
│  SessionTimeoutManager (único ponto de controle)        │
│  ↓                                                       │
│  useSessionTimeout.ts                                   │
│  - Default: 30 minutos                                  │
│  - Configurável via Firestore                           │
│  - Monitora: click, mousedown, keydown                  │
│  - Ignora: scroll, touchstart                           │
└─────────────────────────────────────────────────────────┘
```

### Eventos que Resetam o Timer
✅ **SIM - Resetam o timeout:**
- Clicar em botões/links
- Digitar em campos de texto
- Pressionar qualquer tecla

❌ **NÃO - Não resetam o timeout:**
- Rolar a página (scroll)
- Tocar na tela sem clicar (touchstart)
- Mover o mouse sem clicar

### Exemplo de Fluxo
```
09:00:00 - Login → Timer inicia (30 min)
09:15:00 - Usuário rola a página para ler → Timer NÃO reseta
09:20:00 - Usuário clica em botão → Timer reseta (mais 30 min)
09:50:00 - Logout automático (30 min de inatividade desde o último clique)
```

## 🧪 Como Testar

### Teste 1: Timeout por Inatividade (30 minutos)
```bash
1. Fazer login no sistema
2. Não interagir com o sistema (sem clicar/digitar)
3. Aguardar 30 minutos
4. Verificar: Sistema deve deslogar automaticamente
5. Verificar console: Deve aparecer "⏰ Sessão expirada após 30 minutos de inatividade"
6. Verificar URL: Deve redirecionar para /login?timeout=true
```

### Teste 2: Scroll Não Reseta Timer
```bash
1. Fazer login no sistema
2. Aguardar 29 minutos
3. Rolar a página (scroll) para ler conteúdo
4. Aguardar mais 1 minuto
5. Verificar: Sistema deve deslogar (scroll não resetou timer)
```

### Teste 3: Clique Reseta Timer
```bash
1. Fazer login no sistema
2. Aguardar 29 minutos
3. Clicar em qualquer botão
4. Aguardar mais 29 minutos
5. Verificar: Sistema NÃO deve deslogar (clique resetou timer)
6. Aguardar mais 1 minuto (total 30 min desde último clique)
7. Verificar: Sistema deve deslogar
```

### Teste 4: Digitação Reseta Timer
```bash
1. Fazer login no sistema
2. Aguardar 29 minutos
3. Digitar em qualquer campo de texto
4. Aguardar mais 29 minutos
5. Verificar: Sistema NÃO deve deslogar (digitação resetou timer)
```

### Teste 5: Sessão Persiste Entre Abas (Mesmo Browser)
```bash
1. Fazer login na aba 1
2. Abrir aba 2 no mesmo browser
3. Interagir apenas na aba 2 (clicar)
4. Verificar aba 1: Deve permanecer logada (eventos globais do document)
```

### Teste 6: Timeout Configurável via Firestore (Opcional)
```bash
1. Criar documento no Firestore: system_settings/global
2. Adicionar campo: { "session_timeout_minutes": 5 }
3. Recarregar aplicação
4. Verificar console: "⏰ Timeout de sessão configurado: 5 minutos"
5. Aguardar 5 minutos de inatividade
6. Verificar: Logout automático após 5 minutos
```

## 🔧 Teste Rápido (Para Desenvolvimento)

Para testar rapidamente sem esperar 30 minutos, você pode temporariamente alterar o timeout:

```typescript
// src/hooks/useSessionTimeout.ts (linha 23)
// TEMPORÁRIO - apenas para testes
const sessionTimeoutMinutes = useRef<number>(1); // 1 minuto ao invés de 30
```

**⚠️ IMPORTANTE:** Reverter para 30 após os testes!

## 📝 Configuração via Firestore (Opcional)

Para configurar o timeout dinamicamente:

```javascript
// Firestore Console ou script
db.collection("system_settings").doc("global").set({
  session_timeout_minutes: 30, // Minutos
  // Outros settings...
}, { merge: true });
```

## 🎯 Resultados Esperados

### Antes da Correção
- ❌ Dois sistemas de timeout conflitantes (15 min e 30 min)
- ❌ Scroll resetava o timer (usuário lendo = sessão infinita)
- ❌ Comportamento inconsistente
- ❌ Código duplicado
- ❌ Difícil de manter

### Depois da Correção
- ✅ Sistema único de timeout (30 minutos)
- ✅ Scroll NÃO reseta timer (leitura passiva OK)
- ✅ Comportamento consistente e previsível
- ✅ Código limpo e bem documentado
- ✅ Fácil de configurar e manter
- ✅ Logging claro para debugging

## 🚀 Deploy

Após validação dos testes:

```bash
# Build e deploy
npm run build
firebase deploy --only hosting,functions

# Ou deploy completo
npm run type-check
firebase deploy
```

## 📚 Documentação Relacionada

- `ANALISE-SESSAO-USUARIO.md` - Análise detalhada do problema original
- `src/hooks/useSessionTimeout.ts` - Implementação do timeout
- `src/components/auth/SessionTimeoutManager.tsx` - Componente que ativa o timeout

---

**Data da Implementação**: 2025-12-13
**Implementado por**: Claude AI
**Aprovado por**: Usuário
**Status**: ✅ Concluído - Pronto para testes
