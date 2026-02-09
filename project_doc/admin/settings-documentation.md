# Documentação Experimental - Configurações do Sistema

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Administração do Sistema
**Componente:** Configurações do Sistema (`/admin/settings`)
**Versão:** 1.1
**Data:** 08/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Página de configurações globais da plataforma. O System Admin gerencia três parâmetros que afetam todos os usuários: timeout de sessão (minutos), modo de manutenção (bloqueia acesso ao sistema) e controle de registro de novos usuários. Dados armazenados em documento único `system_settings/global` no Firestore, sobrescrito integralmente a cada salvamento via `setDoc`.

### 1.1 Localização
- **Arquivo:** `src/app/(admin)/admin/settings/page.tsx`
- **Rota:** `/admin/settings`
- **Layout:** Admin Layout (restrito a `system_admin`)

### 1.2 Dependências Principais
- **Firestore SDK:** `doc`, `getDoc`, `setDoc`, `serverTimestamp` de `firebase/firestore`
- **Firebase Auth:** `auth.currentUser` para identificar quem salvou (`updated_by`)
- **useToast Hook:** `src/hooks/use-toast.ts` — notificações toast
- **useRouter:** `next/navigation` — navegação para cancelar
- **Types:** `SystemSettings` de `src/types/index.ts`
- **Shadcn/ui:** Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Input, Label, Switch
- **Lucide Icons:** Settings, Save, Loader2

---

## 2. Tipos de Usuários / Atores

### 2.1 System Admin (`system_admin`)
- **Descrição:** Administrador global da plataforma Curva Mestra
- **Acesso:** Visualizar e alterar todas as configurações globais do sistema
- **Comportamento:** Configurações carregadas automaticamente ao montar; salvamento manual via botão
- **Restrições:** Único tipo de usuário com acesso; alterações afetam TODOS os usuários da plataforma

---

## 3. Estrutura de Dados

### 3.1 Interface SystemSettings

```typescript
// Importado de src/types/index.ts
export interface SystemSettings {
  id: string;                        // Sempre "global"
  session_timeout_minutes: number;   // Timeout em minutos (padrão: 15)
  maintenance_mode: boolean;         // Modo de manutenção ativo/inativo
  maintenance_message?: string;      // Mensagem exibida durante manutenção
  registration_enabled: boolean;     // Permitir novos registros
  updated_by: string;                // UID do admin que salvou
  updated_at: Timestamp;             // serverTimestamp()
}
```

**Documento Firestore:** `system_settings/global` (documento único)

**Campos Principais:**
- **session_timeout_minutes:** Valor numérico entre 1 e 1440 (24 horas). Padrão: 15 minutos
- **maintenance_mode:** Boolean que, quando `true`, bloqueia acesso de todos os usuários não-admin
- **maintenance_message:** String opcional exibida aos usuários durante manutenção
- **registration_enabled:** Boolean que controla se novos cadastros são aceitos
- **updated_by:** UID do `auth.currentUser` — rastreabilidade de quem alterou
- **updated_at:** `serverTimestamp()` — timestamp confiável do servidor

### 3.2 Estado Inicial (quando documento não existe)

```typescript
{
  id: "global",
  session_timeout_minutes: 15,
  maintenance_mode: false,
  maintenance_message: "",
  registration_enabled: true,
  updated_by: "",
  updated_at: null,
}
```

---

## 4. Casos de Uso

### 4.1 UC-001: Carregar Configurações

**Ator:** System Admin
**Pré-condições:**
- Usuário autenticado como `system_admin`
- Acesso à rota `/admin/settings`

**Fluxo Principal:**
1. Página monta e `useEffect` chama `loadSettings()`
2. `getDoc(doc(db, "system_settings", "global"))` busca o documento
3. Se documento existe (`docSnap.exists()`): preenche estado com dados do Firestore
4. Se não existe: mantém valores padrão do estado inicial
5. `loading` muda para `false`

**Fluxo Alternativo - Erro:**
1. Erro na query Firestore
2. Toast destructive: "Erro ao carregar configurações" + `error.message`
3. `loading` muda para `false`, valores padrão mantidos

**Pós-condições:**
- Formulário exibido com valores atuais ou padrão

---

### 4.2 UC-002: Alterar Timeout de Sessão

**Ator:** System Admin
**Fluxo Principal:**
1. Admin altera valor no input numérico (min=1, max=1440)
2. `onChange` atualiza `settings.session_timeout_minutes` via `parseInt(e.target.value) || 15`
3. Valor é validado ao salvar (1 ≤ valor ≤ 1440)

**Regra de Negócio:**
- Se `parseInt` retorna `NaN`, fallback para 15

---

### 4.3 UC-003: Ativar/Desativar Modo de Manutenção

**Ator:** System Admin
**Fluxo Principal:**
1. Admin clica no Switch "Ativar modo de manutenção"
2. `onCheckedChange` atualiza `settings.maintenance_mode`
3. Se ativo (`true`): campo "Mensagem de manutenção" aparece condicionalmente
4. Admin pode preencher mensagem personalizada

**Regra de Negócio:**
- Campo de mensagem só é exibido quando `maintenance_mode === true`
- Mensagem é opcional (campo pode ficar vazio)

---

### 4.4 UC-004: Ativar/Desativar Registro de Novos Usuários

**Ator:** System Admin
**Fluxo Principal:**
1. Admin clica no Switch "Permitir novos registros"
2. `onCheckedChange` atualiza `settings.registration_enabled`

---

### 4.5 UC-005: Salvar Configurações

**Ator:** System Admin
**Pré-condições:**
- `auth.currentUser` disponível
- Timeout dentro do range válido

**Fluxo Principal:**
1. Admin clica "Salvar Configurações"
2. Verifica `auth.currentUser` — se null, toast erro "Você precisa estar autenticado"
3. Valida `session_timeout_minutes` — se fora de 1-1440, toast erro com mensagem
4. `saving` definido como `true`
5. `setDoc(docRef, { ...settings, updated_by: currentUser.uid, updated_at: serverTimestamp() })`
6. Toast sucesso: "Configurações salvas com sucesso"
7. `saving` volta para `false`

**Fluxo Alternativo - Erro:**
1. `setDoc` lança exceção
2. Toast destructive: "Erro ao salvar" + `error.message`

**Pós-condições:**
- Documento `system_settings/global` atualizado ou criado no Firestore
- `updated_by` e `updated_at` registram quem e quando salvou

---

### 4.6 UC-006: Cancelar Alterações

**Ator:** System Admin
**Fluxo Principal:**
1. Admin clica "Cancelar"
2. `router.push("/admin/dashboard")` navega para o dashboard
3. Alterações não salvas são descartadas (sem confirmação)

---

## 5. Fluxo de Processo Detalhado

```
┌─────────────────────────────────────────────────────────────────┐
│            CONFIGURAÇÕES DO SISTEMA (/admin/settings)            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ useEffect mount  │
                    │ loadSettings()   │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ getDoc(system_   │
                    │ settings/global) │
                    └──────────────────┘
                         │         │
                    Existe │         │ Não existe
                         │         │
                         ▼         ▼
              ┌──────────────┐  ┌──────────────┐
              │ setSettings  │  │ Manter       │
              │ (doc.data()) │  │ defaults     │
              └──────────────┘  └──────────────┘
                      │                 │
                      └────────┬────────┘
                               ▼
                    ┌──────────────────┐
                    │ setLoading(false) │
                    └──────────────────┘
                               │
                               ▼
              ┌────────────────────────────────┐
              │ RENDER: 3 Cards + 2 Botões     │
              │ ┌─────────────────────────┐    │
              │ │ Card: Sessão            │    │
              │ │ Input numérico (1-1440) │    │
              │ └─────────────────────────┘    │
              │ ┌─────────────────────────┐    │
              │ │ Card: Manutenção        │    │
              │ │ Switch + Msg condicional│    │
              │ └─────────────────────────┘    │
              │ ┌─────────────────────────┐    │
              │ │ Card: Registro          │    │
              │ │ Switch                  │    │
              │ └─────────────────────────┘    │
              │ [Cancelar]  [Salvar Config.]   │
              └────────────────────────────────┘
                       │              │
                  [Cancelar]     [Salvar]
                       │              │
                       ▼              ▼
              ┌──────────────┐ ┌──────────────────┐
              │ router.push  │ │ Validar auth +   │
              │ /admin/dash  │ │ timeout range    │
              └──────────────┘ └──────────────────┘
                                       │
                                  ┌────┴────┐
                             Válido         Inválido
                                  │              │
                                  ▼              ▼
                         ┌──────────────┐ ┌──────────────┐
                         │ setDoc(      │ │ Toast erro   │
                         │ global,      │ │ validação    │
                         │ ...settings) │ └──────────────┘
                         └──────────────┘
                                  │
                             ┌────┴────┐
                          Sucesso    Erro
                              │         │
                              ▼         ▼
                      ┌──────────┐ ┌──────────┐
                      │ Toast OK │ │ Toast    │
                      └──────────┘ │ destruct.│
                                   └──────────┘
```

---

## 6. Regras de Negócio

### RN-001: Documento Único (Singleton)
**Descrição:** Existe apenas um documento de configurações: `system_settings/global`. O `setDoc()` cria ou sobrescreve o documento inteiro a cada salvamento.
**Aplicação:** Todas as configurações em um único documento
**Exceções:** Nenhuma
**Justificativa:** Simplifica leitura e escrita de configurações globais

### RN-002: Rastreabilidade de Alterações
**Descrição:** Cada salvamento registra `updated_by` (UID do admin) e `updated_at` (serverTimestamp) automaticamente.
**Aplicação:** Adicionados ao payload do `setDoc` independentemente do que o admin alterou
**Exceções:** Nenhuma
**Justificativa:** Auditoria básica de quem alterou as configurações e quando

### RN-003: Mensagem de Manutenção Condicional
**Descrição:** O campo de mensagem de manutenção só aparece na interface quando `maintenance_mode === true`.
**Aplicação:** Renderização condicional `{settings.maintenance_mode && (...)}`
**Exceções:** Se modo manutenção for desativado, a mensagem permanece no estado mas não é exibida
**Justificativa:** Evita confusão mostrando campo apenas quando relevante

### RN-004: Timeout com Range Validado
**Descrição:** O timeout de sessão deve estar entre 1 e 1440 minutos (1 minuto a 24 horas).
**Aplicação:** Validação no `handleSave()` antes do `setDoc`. Input HTML tem `min="1"` e `max="1440"`
**Exceções:** Se `parseInt` retorna `NaN`, fallback para 15
**Justificativa:** Prevenir valores absurdos que quebrariam a experiência dos usuários

### RN-005: Impacto Global das Configurações
**Descrição:** Todas as configurações afetam a plataforma inteira, não apenas o admin que as alterou.
**Aplicação:** `maintenance_mode` bloqueia todos os usuários; `registration_enabled` bloqueia novos cadastros; `session_timeout` afeta todas as sessões
**Exceções:** System admin continua com acesso mesmo durante manutenção
**Justificativa:** Configurações são globais por definição

---

## 7. Estados da Interface

### 7.1 Estado: Carregando
**Quando:** `loading === true` (ao montar o componente)
**Exibição:** Loader2 com animação spin centralizado (`flex items-center justify-center h-96`)
**Interações:** Nenhuma — toda a página é substituída pelo spinner
**Duração:** ~1-2 segundos

### 7.2 Estado: Formulário Carregado
**Quando:** `loading === false`
**Exibição:**
- **Header:** Ícone Settings + "Configurações do Sistema" (h1, text-3xl) + subtexto
- **Card 1: Sessão de Usuários**
  - Input numérico com min=1, max=1440
  - Hint: "Valor padrão: 15 minutos. Recomendado: entre 15 e 60 minutos."
- **Card 2: Modo de Manutenção**
  - Switch "Ativar modo de manutenção"
  - Se ativo: Input "Mensagem de manutenção" (condicional)
- **Card 3: Registro de Novos Usuários**
  - Switch "Permitir novos registros"
- **Botões:** "Cancelar" (outline) + "Salvar Configurações" (default, ícone Save)

### 7.3 Estado: Salvando
**Quando:** `saving === true`
**Exibição:** Botão "Salvar" muda para Loader2 spin + "Salvando..." e fica `disabled`
**Duração:** ~1-2 segundos

---

## 8. Validações

### 8.1 Validações de Frontend
- **session_timeout_minutes:**
  - Input HTML: `min="1"` e `max="1440"` (validação nativa do browser)
  - JavaScript: `< 1 || > 1440` → toast "O timeout deve estar entre 1 e 1440 minutos (24 horas)"
  - Fallback: `parseInt(e.target.value) || 15` se valor inválido

- **maintenance_message:**
  - Opcional, sem validação de comprimento

- **registration_enabled:**
  - Boolean, sem validação adicional

### 8.2 Validações de Backend
- **auth.currentUser:** Verificado antes de salvar — toast "Você precisa estar autenticado" se null
- **Firestore Rules:** Escrita em `system_settings` permitida apenas para `system_admin`

### 8.3 Validações de Permissão
- **Admin Layout:** Verifica custom claim `is_system_admin === true` antes de renderizar
- **auth.currentUser:** Verificado no `handleSave` para obter UID

---

## 9. Integrações

### 9.1 Firestore — Documento `system_settings/global`
- **Tipo:** Firestore SDK (client-side)
- **Leitura:** `getDoc(doc(db, "system_settings", "global"))` no `useEffect`
- **Escrita:** `setDoc(docRef, { ...settings, updated_by, updated_at: serverTimestamp() })` no `handleSave`
- **Campos lidos/escritos:** `session_timeout_minutes`, `maintenance_mode`, `maintenance_message`, `registration_enabled`, `updated_by`, `updated_at`
- **Erros:** Capturados por try/catch, exibidos via toast destructive

### 9.2 Firebase Auth
- **Tipo:** Firebase Auth client SDK
- **Uso:** `auth.currentUser` para verificar autenticação e obter UID (`updated_by`)
- **Quando:** Apenas no `handleSave`

---

## 10. Segurança

### 10.1 Proteções Implementadas
- ✅ Verificação de `auth.currentUser` antes de salvar
- ✅ `serverTimestamp()` para timestamps confiáveis (não manipuláveis pelo cliente)
- ✅ Validação de range no timeout (1-1440)
- ✅ Rastreabilidade via `updated_by` + `updated_at`

### 10.2 Vulnerabilidades Conhecidas
- ⚠️ `setDoc()` sobrescreve documento inteiro (risco em escrita concorrente — dois admins salvando ao mesmo tempo)
- ⚠️ Sem confirmação antes de ativar modo de manutenção (impacto alto)
- ⚠️ Sem indicador de "alterações não salvas" (admin pode sair sem salvar)
- ⚠️ Não há validação de que o admin que salvou é diferente do que carregou (sem conflito detection)
- **Mitigação:** Na prática, apenas um system_admin opera o sistema

### 10.3 Dados Sensíveis
- **updated_by:** UID do admin, dado interno sem impacto de segurança
- **Configurações:** Não contêm dados pessoais, mas afetam disponibilidade do sistema

---

## 11. Performance

### 11.1 Métricas
- **Tempo de carregamento:** ~1s (1 read de documento único)
- **Requisições Firestore:** 1 read ao montar + 1 write ao salvar
- **Tamanho do componente:** ~241 linhas

### 11.2 Otimizações Implementadas
- ✅ Documento único (1 read ao carregar, 1 write ao salvar)
- ✅ Sem queries complexas ou múltiplas coleções
- ✅ Loading state com spinner previne interação prematura

### 11.3 Gargalos Identificados
- ⚠️ `setDoc` sobrescreve documento inteiro em vez de `updateDoc` com campos específicos (overhead mínimo, mas semanticamente incorreto)
- **Plano de melhoria:** Usar `updateDoc` com apenas campos alterados

---

## 12. Acessibilidade

### 12.1 Conformidade WCAG
- **Nível:** Parcial (não auditado formalmente)
- **Versão:** N/A

### 12.2 Recursos Implementados
- ✅ Labels em todos os inputs (`<Label htmlFor="...">`)
- ✅ Labels clicáveis nos switches (`cursor-pointer`)
- ✅ Textos descritivos nos cards (CardTitle + CardDescription)
- ✅ Hint text no campo de timeout
- ✅ Input numérico com `min`/`max` nativos

### 12.3 Melhorias Necessárias
- [ ] ARIA-live para feedback de salvamento
- [ ] Foco automático no primeiro campo ao carregar
- [ ] Anúncio de loading state para screen readers
- [ ] Contraste do hint text muted

---

## 13. Testes

### 13.1 Cenários de Teste
1. **Carregar configurações existentes**
   - **Dado:** Documento `system_settings/global` existe com timeout=30, manutenção=false, registro=true
   - **Quando:** Página é montada
   - **Então:** Campos refletem valores salvos: timeout=30, switch manutenção OFF, switch registro ON

2. **Carregar sem documento existente**
   - **Dado:** Documento `system_settings/global` não existe
   - **Quando:** Página é montada
   - **Então:** Campos com valores padrão: timeout=15, manutenção=false, registro=true

3. **Salvar com sucesso**
   - **Dado:** Admin alterou timeout para 30
   - **Quando:** Clica "Salvar Configurações"
   - **Então:** Toast "Configurações salvas com sucesso", documento atualizado no Firestore

4. **Timeout fora do range**
   - **Dado:** Admin digita 0 ou 1500 no timeout
   - **Quando:** Clica "Salvar"
   - **Então:** Toast erro "O timeout deve estar entre 1 e 1440 minutos"

5. **Ativar manutenção**
   - **Dado:** Manutenção desativada
   - **Quando:** Admin ativa switch de manutenção
   - **Então:** Campo "Mensagem de manutenção" aparece condicionalmente

### 13.2 Casos de Teste de Erro
1. **Firestore indisponível no carregamento:** Toast destructive com mensagem, valores padrão mantidos
2. **Firestore indisponível ao salvar:** Toast destructive com mensagem
3. **Usuário não autenticado ao salvar:** Toast "Você precisa estar autenticado"

### 13.3 Testes de Integração
- [ ] Verificar que `maintenance_mode = true` bloqueia acesso de clinic_admin/clinic_user
- [ ] Verificar que `registration_enabled = false` bloqueia página de registro
- [ ] Verificar que `session_timeout_minutes` é aplicado nas sessões ativas
- [ ] Verificar escrita concorrente (dois admins salvando ao mesmo tempo)

---

## 14. Melhorias Futuras

### 14.1 Funcionalidades
- [ ] Histórico de alterações (audit log com quem mudou o quê)
- [ ] Agendamento de manutenção programada (data/hora de início e fim)
- [ ] Configurações por módulo (não apenas globais)
- [ ] Backup/restore de configurações

### 14.2 UX/UI
- [ ] Confirmação antes de ativar modo de manutenção (impacto alto)
- [ ] Indicador de "alterações não salvas" (dirty state)
- [ ] Preview do efeito das configurações antes de salvar
- [ ] Undo/redo de alterações

### 14.3 Performance
- [ ] Usar `updateDoc` em vez de `setDoc` para campos específicos
- [ ] Cache local com TTL para evitar reload desnecessário

### 14.4 Segurança
- [ ] Proteção contra escrita simultânea (optimistic locking com `updated_at`)
- [ ] Confirmação com senha antes de alterações críticas
- [ ] Notificação por email ao alterar configurações
- [ ] Rate limiting em salvamentos

---

## 15. Dependências e Relacionamentos

### 15.1 Páginas/Componentes Relacionados
- **Admin Dashboard (`/admin/dashboard`):** Destino ao cancelar
- **Admin Layout:** Provê verificação de autenticação e navegação lateral
- **Registro (`/register`):** Afetado por `registration_enabled`
- **Login / Sessões:** Afetado por `session_timeout_minutes`
- **Toda a plataforma:** Afetada por `maintenance_mode`

### 15.2 Fluxos que Passam por Esta Página
1. **Dashboard → Settings:** Admin acessa configurações via navegação lateral
2. **Settings → Dashboard:** Cancelar volta para dashboard

### 15.3 Impacto de Mudanças
- **Alto impacto:** `maintenance_mode` afeta TODOS os usuários do sistema
- **Alto impacto:** `registration_enabled` bloqueia novos cadastros
- **Médio impacto:** `session_timeout_minutes` afeta experiência de todos os usuários
- **Baixo impacto:** Alterações visuais nos cards (apenas UI)

---

## 16. Observações Técnicas

### 16.1 Decisões de Arquitetura
- **Documento único (singleton):** Todas as configurações em `system_settings/global`. Simplifica leitura/escrita mas limita extensibilidade.
- **setDoc em vez de updateDoc:** Sobrescreve todo o documento a cada salvamento. Decisão de simplicidade que garante que o documento sempre reflete o estado completo do formulário.
- **Sem realtime listener:** Configurações são carregadas uma vez ao montar. Se outro admin alterar, as mudanças só serão visíveis após recarregar a página.

### 16.2 Padrões Utilizados
- **Controlled State:** `useState` com objeto `settings` contendo todas as configurações
- **Spread Update:** `setSettings({ ...settings, campo: valor })` para atualizar campos individuais
- **Effect on Mount:** `useEffect([], [])` para carregamento inicial
- **Loading Gate:** `if (loading) return <Loader>` antes do render principal

### 16.3 Limitações Conhecidas
- ⚠️ `setDoc` sobrescreve documento inteiro (pode perder campos adicionados por outra fonte)
- ⚠️ Sem confirmação antes de ativar manutenção (operação de alto impacto)
- ⚠️ Sem dirty state tracking (admin pode sair sem salvar alterações)
- ⚠️ `parseInt(e.target.value) || 15` — se admin digitar "0", fallback para 15 (mas validação no save captura o caso)

### 16.4 Notas de Implementação
- Componente usa `"use client"` por depender de hooks React e Firestore
- Página tem ~241 linhas
- Layout usa `p-6 space-y-6` sem container max-width (full width)
- Switch do Shadcn/ui para toggles booleanos
- Mensagem de manutenção usa Input (não Textarea) — linha única

---

## 17. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------|
| 07/02/2026 | 1.0 | Engenharia Reversa | Documentação inicial |
| 08/02/2026 | 1.1 | Engenharia Reversa | Reescrita completa seguindo template padrão (20 seções) |

---

## 18. Glossário

- **System Settings:** Configurações globais da plataforma armazenadas em documento único no Firestore
- **Singleton Document:** Documento único com ID fixo ("global") que armazena todas as configurações
- **Maintenance Mode:** Estado que bloqueia acesso de usuários não-admin à plataforma
- **Session Timeout:** Tempo de inatividade após o qual a sessão do usuário expira
- **Registration Enabled:** Flag que controla se novos usuários podem criar conta
- **serverTimestamp():** Função do Firestore que gera timestamp no servidor (não no cliente)
- **setDoc:** Operação do Firestore que cria ou sobrescreve um documento inteiro

---

## 19. Referências

### 19.1 Documentação Relacionada
- Admin Dashboard - `project_doc/admin/dashboard-documentation.md`
- Auth Register - `project_doc/auth/register-page-documentation.md`
- Auth Login - `project_doc/auth/login-page-documentation.md`

### 19.2 Links Externos
- [Firestore setDoc](https://firebase.google.com/docs/firestore/manage-data/add-data#set_a_document)
- [Firestore serverTimestamp](https://firebase.google.com/docs/firestore/manage-data/add-data#server_timestamp)
- [Shadcn/ui Switch](https://ui.shadcn.com/docs/components/switch)

### 19.3 Código Fonte
- **Componente Principal:** `src/app/(admin)/admin/settings/page.tsx`
- **Types:** `src/types/index.ts` (interface SystemSettings)
- **Firebase Config:** `src/lib/firebase.ts`

---

## 20. Anexos

### 20.1 Screenshots
[Não disponível — página renderizada no browser]

### 20.2 Diagramas
Diagrama de fluxo incluído na Seção 5.

### 20.3 Exemplos de Código

```typescript
// Exemplo: Carregamento de configurações
const docRef = doc(db, "system_settings", "global");
const docSnap = await getDoc(docRef);
if (docSnap.exists()) {
  setSettings(docSnap.data() as SystemSettings);
}

// Exemplo: Salvamento com rastreabilidade
await setDoc(docRef, {
  ...settings,
  updated_by: auth.currentUser.uid,
  updated_at: serverTimestamp(),
});

// Exemplo: Fallback para parseInt inválido
session_timeout_minutes: parseInt(e.target.value) || 15
```

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 08/02/2026
**Responsável:** Equipe de Desenvolvimento
**Status:** Aprovado
