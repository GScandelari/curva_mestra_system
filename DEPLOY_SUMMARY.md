# Resumo do Deploy - Curva Mestra

**Data:** 28/11/2025 (Atualizado)  
**Status:** ✅ Concluído com Sucesso  
**Último Deploy:** 28/11/2025 às 22:30 (horário local)

## Componentes Deployados

### 1. Build do Next.js
- ✅ Build concluído com sucesso
- 42 páginas geradas
- Tempo de compilação: ~17 segundos
- Tamanho total: ~213 KB (First Load JS)

### 2. Firebase Hosting
- ✅ Deploy concluído
- 155 arquivos enviados
- URL: https://curva-mestra.web.app
- Function URL: https://ssrcurvamestra-f6gwsv7ija-uc.a.run.app

### 3. Firestore Rules
- ✅ Deploy concluído
- Regras compiladas com sucesso
- 2 avisos (não críticos):
  - Função não utilizada: hasRole
  - Variável inválida: request (linha 23:35)

### 4. Storage Rules
- ✅ Deploy concluído
- Regras compiladas com sucesso
- Estrutura configurada para:
  - `/danfe/{tenant_id}/{nf_id}.pdf`
  - `/avatars/{tenantId}/{userId}`

### 5. Cloud Functions
- ✅ Deploy concluído
- Funções ativas:
  - `checkLicenseExpiration(us-central1)` - Verificação diária de licenças (Sem alterações)
  - `placeholder(us-central1)` - Função de teste (Sem alterações)
- URL da função placeholder: https://us-central1-curva-mestra.cloudfunctions.net/placeholder
- **Nota:** Firebase detectou que não houve alterações nas functions e pulou o redeploy

## Correções Realizadas

### 1. Atualização da API do Firebase Functions
- Migrado de `firebase-functions` v1 para v2
- Corrigido `checkLicenseExpiration.ts`:
  - Atualizado import para `firebase-functions/v2`
  - Ajustado para usar `functions.scheduler.onSchedule`
  - Removido retorno de objeto (v2 não permite)
  - Adicionado inicialização do Firebase Admin

### 2. Compilação TypeScript
- Corrigidos erros de tipo
- Build concluído sem erros

## Funções Antigas (Não Deletadas)
As seguintes funções antigas foram mantidas (usuário optou por não deletar):
- `onTenantCreated(southamerica-east1)`
- `onUserCreated(southamerica-east1)`
- `sendTestEmail(southamerica-east1)`
- `checkExpiringProducts(us-central1)`
- `cleanupOldNotifications(us-central1)`
- `updateDashboardMetrics(us-central1)`
- `api(us-central1)`

## Tempos de Espera Utilizados (Deploy Atual)
- **Etapa 1:** Build do Next.js (timeout: 10 minutos) + 10s de espera
- **Etapa 2:** Build das Cloud Functions (timeout: 5 minutos) + 10s de espera
- **Etapa 3:** Deploy Hosting + Firestore Rules (timeout: 15 minutos) + 15s de espera
- **Etapa 4:** Deploy Storage Rules (timeout: 5 minutos) + 15s de espera
- **Etapa 5:** Deploy Cloud Functions (timeout: 15 minutos)

**Total de tempo de espera entre etapas:** 50 segundos  
**Timeouts totais configurados:** 50 minutos

## Avisos e Observações

### Node Version
- Projeto configurado para Node 20
- Sistema rodando Node 22.13.0
- Aviso de incompatibilidade (não crítico)

### Deprecation Warnings
- `punycode` module deprecated (não crítico)
- Não afeta funcionalidade

## Próximos Passos Recomendados

1. **Limpar funções antigas** (opcional):
   ```bash
   firebase functions:delete onTenantCreated --region southamerica-east1
   firebase functions:delete onUserCreated --region southamerica-east1
   firebase functions:delete sendTestEmail --region southamerica-east1
   firebase functions:delete checkExpiringProducts --region us-central1
   firebase functions:delete cleanupOldNotifications --region us-central1
   firebase functions:delete updateDashboardMetrics --region us-central1
   firebase functions:delete api --region us-central1
   ```

2. **Testar a aplicação**:
   - Acessar https://curva-mestra.web.app
   - Verificar login e funcionalidades principais
   - Testar upload de arquivos (Storage)

3. **Monitorar logs**:
   ```bash
   firebase functions:log
   ```

4. **Corrigir avisos do Firestore Rules** (opcional):
   - Remover função `hasRole` não utilizada
   - Corrigir variável `request` na linha 23:35

## Console do Projeto
https://console.firebase.google.com/project/curva-mestra/overview


---

## Histórico de Deploys

### Deploy #2 - 28/11/2025 22:30
- ✅ Build Next.js: 11.8s
- ✅ Build Functions: Sucesso
- ✅ Deploy Hosting: Sucesso (155 arquivos)
- ✅ Deploy Firestore Rules: Sem alterações
- ✅ Deploy Storage Rules: Sem alterações
- ✅ Deploy Functions: Sem alterações detectadas (skip)
- **Observação:** Deploy executado com tempos de espera estendidos entre etapas

### Deploy #1 - 28/11/2025 22:15
- ✅ Build Next.js: 17.0s
- ✅ Correção da API do Firebase Functions (v1 → v2)
- ✅ Deploy Hosting: Sucesso
- ✅ Deploy Firestore Rules: Sucesso
- ✅ Deploy Storage Rules: Sucesso
- ✅ Deploy Functions: 2 novas funções criadas


### Deploy #3 - 28/11/2025 23:00
- ✅ Build Next.js: 17.0s (43 páginas - +1 nova página: /api/tenants/create)
- ✅ Build Functions: Sucesso
- ✅ Deploy Hosting: Sucesso (156 arquivos - +1 arquivo)
- ✅ Deploy Firestore Rules: Atualizado
- ✅ Deploy Storage Rules: Sem alterações
- ✅ Deploy Functions: Atualizadas (região alterada para southamerica-east1)
  - checkLicenseExpiration: Movida de us-central1 para southamerica-east1
  - placeholder: Movida de us-central1 para southamerica-east1
- **Observação:** Deploy após correção de segurança (remoção de chaves expostas)
- **Mudança importante:** Functions agora estão na região southamerica-east1 (mais próxima do Brasil)


### Deploy #4 - 29/11/2025 00:15
- ✅ Build Next.js: 9.3s (43 páginas)
- ✅ Build Functions: Sucesso
- ✅ Deploy Hosting: Sucesso (156 arquivos)
- ✅ Deploy Firestore Rules: Sem alterações
- ✅ Deploy Storage Rules: Sem alterações
- ✅ Deploy Functions: Sem alterações
- **🔧 CORREÇÃO APLICADA:** Problema de licença duplicada resolvido
  - Nova função `updateLicense()` criada em `licenseService.ts`
  - Função `confirmPayment()` modificada para verificar licença existente
  - Licença agora é ATUALIZADA ao invés de criar nova
  - Arquivos modificados: 
    - `src/lib/services/licenseService.ts`
    - `src/lib/services/tenantOnboardingService.ts`
- **Observação:** Deploy com correção crítica do fluxo de onboarding


### Deploy #5 - 29/11/2025 00:45
- ✅ Build Next.js: 8.3s (43 páginas)
- ✅ Build Functions: Sucesso
- ✅ Deploy Hosting: Sucesso (156 arquivos)
- ✅ Deploy Firestore Rules: Sem alterações
- ✅ Deploy Storage Rules: Sem alterações
- ✅ Deploy Functions: Sem alterações
- **💰 NOVA FUNCIONALIDADE:** Dashboard de Faturamento Mensal
  - Adicionados 4 novos cards no dashboard do system_admin
  - Faturamento Mensal Total (soma de todos os planos)
  - Plano Semestral (R$ 59,90/mês × quantidade)
  - Plano Anual (R$ 49,90/mês × quantidade)
  - Projeção Anual (faturamento total dos contratos)
  - Arquivo modificado: `src/app/(admin)/admin/dashboard/page.tsx`
- **Observação:** Deploy com nova funcionalidade de análise financeira


### Deploy #6 - 29/11/2025 01:00
- ✅ Deploy Firestore Indexes: Sucesso
- **🔧 CORREÇÃO CRÍTICA:** Índice de licença adicionado
  - Índice composto para query de licenças ativas
  - Campos: `tenant_id` + `status` + `end_date`
  - Resolve erro no onboarding ao buscar licença existente
  - Arquivo modificado: `firestore.indexes.json`
- **⚠️ IMPORTANTE:** Firestore pode levar alguns minutos para criar o índice
- **Verificar status:** https://console.firebase.google.com/project/curva-mestra/firestore/indexes
- **Observação:** Deploy crítico para corrigir fluxo de onboarding
