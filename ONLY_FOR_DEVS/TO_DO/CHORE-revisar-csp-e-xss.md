# CHORE — Revisar Content Security Policy (CSP) e proteção contra XSS

**Tipo:** `chore/`  
**Data de criação:** 2026-05-04  
**Prioridade:** Média  

---

## Contexto

Durante testes, foi observado que o valor do campo de senha (`<input type="password">`) fica visível na inspeção de HTML via DevTools do navegador. Isso é comportamento padrão do React (valor mantido no state, refletido no DOM) e **não é uma vulnerabilidade de segurança direta**.

A proteção real contra leitura maliciosa de campos de formulário (incluindo senha) é feita em duas camadas:

1. **HTTPS** — garante que a senha nunca trafegue em texto claro na rede.
2. **Content Security Policy (CSP)** — impede que scripts injetados via XSS leiam `input.value`.

Esta task cobre a revisão e implementação adequada de ambas as camadas.

---

## O que NÃO fazer

- `autocomplete="off"` — afeta apenas autofill, não DevTools
- Usar `useRef` em vez de `useState` — valor ainda fica no DOM
- Input masking customizado — péssima UX, sem ganho real de segurança

---

## Escopo da Task

### 1. Verificar HTTPS
- Confirmar que o Firebase Hosting está servindo tudo via HTTPS (deve estar por padrão)
- Verificar se há algum redirect de HTTP → HTTPS configurado
- Confirmar que cookies de sessão do Firebase Auth têm flag `Secure`

### 2. Implementar / revisar Content Security Policy (CSP)
- Verificar se já existe CSP configurada nos headers do Next.js (`next.config.js` ou middleware)
- Implementar CSP com diretivas mínimas:
  ```
  default-src 'self';
  script-src 'self' 'nonce-{nonce}' https://apis.google.com https://*.firebaseapp.com;
  style-src 'self' 'unsafe-inline';
  connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com;
  frame-src https://*.firebaseapp.com;
  ```
- Atenção: Next.js com App Router pode exigir `'unsafe-inline'` ou uso de nonce para scripts inline gerados pelo framework — avaliar impacto
- Testar com a ferramenta [CSP Evaluator](https://csp-evaluator.withgoogle.com/)

### 3. Revisar sanitização de inputs renderizados como HTML
- Verificar todos os locais onde conteúdo do usuário é exibido no DOM
- Garantir que nenhum campo de texto livre seja renderizado com `dangerouslySetInnerHTML` sem sanitização
- Verificar campos: descrição de procedimentos, observações, nome de produtos, etc.

### 4. Revisar headers de segurança HTTP
Além do CSP, verificar presença dos seguintes headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY` (ou `SAMEORIGIN`)
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`

Esses podem ser adicionados via `next.config.js`:
```js
headers: async () => [
  {
    source: '/(.*)',
    headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    ],
  },
],
```

---

## Checklist de Validação

- [ ] HTTPS ativo e redirect HTTP → HTTPS confirmado
- [ ] CSP implementada e testada sem bloquear funcionalidades do Firebase
- [ ] Nenhum `dangerouslySetInnerHTML` sem sanitização no codebase
- [ ] Headers de segurança HTTP presentes e verificados com [securityheaders.com](https://securityheaders.com)
- [ ] `npm run build` sem erros após alterações no `next.config.js`
