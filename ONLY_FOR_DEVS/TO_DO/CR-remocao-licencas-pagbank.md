# Change Request: Remoção de Licenças e Integração PagBank/Pagamento

**Projeto:** Curva Mestra
**Data:** 06/05/2026
**Autor:** Doc Writer (Claude)
**Status:** Planejamento
**Tipo:** Change Request
**Branch sugerida:** `chore/remove-licencas-pagbank`
**Prioridade:** Alta
**Versão:** 1.0

> O sistema possui um módulo completo de controle de licenças (`License`, `LicenseStatus`) e integração com PagBank/pagamento (assinaturas recorrentes, webhook, cartão de crédito) que foi implementado mas não está ativo no produto. A decisão de produto é remover toda essa funcionalidade do código-fonte, simplificando o modelo de dados, eliminando páginas, serviços, Firebase Functions e regras Firestore que não fazem parte do fluxo operacional do MVP. O impacto esperado é redução de superfície de código morto, build mais limpo e eliminação de riscos de segurança associados à integração de pagamento nunca testada em produção.

---

## 0. Git Flow e Convenção de Commits

**Branch base:** `develop`
**Branch da task:** `chore/remove-licencas-pagbank`
**PR target:** branch pessoal (`gscandelari_setup`) primeiro, depois PR para `develop`

```bash
git checkout develop
git pull origin develop
git checkout -b chore/remove-licencas-pagbank
```

| Step   | Tipo    | Escopo    | Mensagem sugerida                                                                             |
| ------ | ------- | --------- | --------------------------------------------------------------------------------------------- |
| STEP 1 | `chore` | `types`   | `chore(types): remove License, LicenseStatus from index.ts and clean plan fields from Tenant` |
| STEP 2 | `chore` | `types`   | `chore(types): remove onboarding payment types and plans constants`                           |
| STEP 3 | `chore` | `admin`   | `chore(admin): remove licenses pages and AdminLayout nav entry`                               |
| STEP 4 | `chore` | `clinic`  | `chore(clinic): remove license page, LicenseTab, PaymentSection components`                   |
| STEP 5 | `chore` | `clinic`  | `chore(clinic): remove setup plan and payment pages, clean ProtectedRoute onboarding flow`    |
| STEP 6 | `chore` | `api`     | `chore(api): remove pagbank subscription route and clean tenant create route`                  |
| STEP 7 | `chore` | `firebase`| `chore(firebase): remove licenseService, tenantOnboardingService payment logic and plans`     |
| STEP 8 | `chore` | `firebase`| `chore(firebase): remove checkLicenseExpiration, createPagBankSubscription, pagbankWebhook functions` |
| STEP 9 | `chore` | `firebase`| `chore(firebase): remove licenses, payment_methods, payment_history rules from firestore.rules` |
| STEP 10| `chore` | `firebase`| `chore(firebase): remove notification types license_expiring and license_expired`             |
| STEP 11| `chore` | `admin`   | `chore(admin): remove plan revenue stats and license activity from admin dashboard`            |

**Lembrete:** PR vai para `gscandelari_setup` para validacao no Firebase. Nunca merge direto para `master`.

---

## 1. Contexto e Motivacao

### 1.1 Situacao atual

O sistema possui um modulo completo de licencas e pagamento implementado mas nao ativo no produto. O inventario do codigo existente e o seguinte:

**Tipos TypeScript:**
- `src/types/index.ts` — exporta `LicenseStatus` (union: `'ativa' | 'pendente' | 'expirada' | 'suspensa'`) e `License` (interface com `id`, `tenant_id`, `plan_id`, `status`, `max_users`, `features`, `start_date`, `end_date`, `auto_renew`, `created_at`, `updated_at`)
- `src/types/index.ts` — `Tenant` contem campo `plan_id: string` (referencia ao plano) e `max_users: number`
- `src/types/tenant.ts` — `Tenant.plan_id` tipado como `'semestral' | 'anual'`; `CreateTenantData.plan_id` obrigatorio; `UpdateTenantData.plan_id` opcional; enum `PLANS` local com precos `59.90` e `49.90`
- `src/types/onboarding.ts` — arquivo inteiro dedicado a tipos de pagamento: `TenantOnboarding`, `OnboardingStatus`, `PaymentData`, `PaymentStatus`, `PaymentMethod`, `PaymentHistory`, `PlanSelectionData`, `PaymentCreationResponse`, `PaymentWebhookData`, `ClinicSetupData`
- `src/types/notification.ts` — `NotificationType` inclui `'license_expiring'` e `'license_expired'`

**Servicos:**
- `src/lib/services/licenseService.ts` — arquivo de 390 linhas com CRUD completo de licencas: `createLicense`, `updateLicense`, `getActiveLicenseByTenant`, `getLicensesByTenant`, `getLicenseById`, `updateLicenseStatus`, `renewLicense`, `suspendLicense`, `reactivateLicense`, `deleteLicense`, `isLicenseValid`, `getDaysUntilExpiration`, `isLicenseExpiringSoon`, `getExpiringSoonLicenses`, `getExpiredLicenses`, `getAllLicenses`, `processAutoRenewal`
- `src/lib/services/tenantOnboardingService.ts` — `getTenantOnboarding`, `initializeTenantOnboarding`, `needsOnboarding`, `getNextOnboardingStep`, `completeClinicSetup`, `completePlanSelection`, `confirmPayment`, `processPaymentWebhook`, `hasActiveLicense`, `resetOnboarding`. Importa `createLicense`, `getActiveLicenseByTenant`, `updateLicense` do `licenseService`. Importa `PLANS` de `plans.ts`.
- `src/lib/constants/plans.ts` — `PlanConfig`, `PLANS` (semestral R$59.90, anual R$49.90), `formatPlanPrice`, `getPlanMaxUsers`, `getPlanConfig`

**Paginas admin:**
- `src/app/(admin)/admin/licenses/page.tsx` — listagem de todas as licencas (tabela com status, plano, datas, dias restantes)
- `src/app/(admin)/admin/licenses/[id]/page.tsx` — detalhes de uma licenca com acoes: renovar, suspender, reativar, deletar
- `src/app/(admin)/admin/licenses/new/page.tsx` — formulario de criacao de nova licenca com selecao de tenant, plano e datas
- `src/app/(admin)/admin/dashboard/page.tsx` — contem calculo de receita por plano (`planCounts`, `revenue.semestral`, `revenue.anual`, `totalMonthly`, `totalAnnual`) e activity type `'license'`
- `src/app/(admin)/admin/tenants/[id]/page.tsx` — usa `formatPlanPrice`, `getPlanMaxUsers` de `plans.ts`; campo `plan_id` no formulario

**Paginas clinic:**
- `src/app/(clinic)/clinic/license/page.tsx` — pagina standalone da licenca da clinica (exibe status, plano, features, datas, seção de suporte)
- `src/app/(clinic)/clinic/setup/plan/page.tsx` — selecao de plano no onboarding (semestral/anual com precos); usa `PLANS`, `completePlanSelection`
- `src/app/(clinic)/clinic/setup/payment/page.tsx` — formulario de pagamento com cartao de credito via PagBank SDK (`PagSeguroDirectPayment`); usa `confirmPayment`, `PLANS`, `httpsCallable` para `createPagBankSubscription`
- `src/app/(clinic)/clinic/setup/success/page.tsx` — tela de sucesso apos pagamento; usa `getTenantOnboarding`, `PLANS`; redireciona para etapas pendentes

**Componentes:**
- `src/components/clinic/LicenseTab.tsx` — aba de licenca em painel de configuracoes da clinica; importa `PaymentSection`, `getActiveLicenseByTenant`, `getDaysUntilExpiration`, `isLicenseExpiringSoon`; exibe status, plano, usuarios, renovacao, features e datas
- `src/components/clinic/PaymentSection.tsx` — secao de metodo de pagamento e historico; le `payment_methods` e `payment_history` do Firestore; permite cadastrar/alterar cartao de credito
- `src/components/admin/TenantPaymentInfo.tsx` — componente admin que exibe historico de pagamentos e metodo de pagamento de um tenant; importa `PaymentMethod`, `PaymentHistory` de `onboarding`
- `src/components/admin/AdminLayout.tsx` — sidebar contem item "Licencas" com rota `/admin/licenses` e icone `CreditCard`

**API Routes:**
- `src/app/api/pagbank/subscription/route.ts` — proxy POST para Cloud Function `createPagBankSubscription`; recebe `tenant_id`, `plan_id`, `card_token`, dados do titular; verifica token de autenticacao

**Firebase Functions:**
- `functions/src/checkLicenseExpiration.ts` — scheduled function diaria (00:00 BRT): marca licencas expiradas, envia notificacoes de `licenca_expirando`, processa renovacoes automaticas
- `functions/src/createPagBankSubscription.ts` — callable function: cria plano e assinatura no PagBank; salva `pagbank_plan_id`, `pagbank_subscription_code` no tenant; cria documento em `licenses` se pagamento ATIVO
- `functions/src/pagbankWebhook.ts` — HTTP function: recebe notificacoes PagBank; atualiza status do tenant; suspende/reativa licencas; cria notificacoes; salva logs em `webhook_logs`
- `functions/src/index.ts` — exporta `checkLicenseExpiration`, `createPagBankSubscription`, `pagbankWebhook`

**Regras Firestore:**
- `firestore.rules` — regras para `licenses/{licenseId}`: leitura por `system_admin` e por usuarios do proprio tenant; escrita por `system_admin` e `clinic_admin` para o proprio tenant
- `firestore.rules` — regras para `payment_methods/{methodId}`: leitura/escrita por `system_admin` e por usuarios do proprio tenant
- `firestore.rules` — regras para `payment_history/{historyId}`: leitura por `system_admin` e por usuarios do proprio tenant; escrita somente por `system_admin`

**Outros referencias:**
- `src/components/auth/ProtectedRoute.tsx` — usa `needsOnboarding`, `getNextOnboardingStep` para redirecionar para `/clinic/setup`, `/clinic/setup/plan`, `/clinic/setup/payment`
- `src/app/api/tenants/create/route.ts` — grava `plan_id` e `max_users` no documento do tenant
- `src/app/api/users/create/route.ts` — le `max_users` do tenant para verificar limite de usuarios
- `src/components/clinic/UsersTab.tsx` — le `max_users` do tenant para exibir limite
- `src/lib/services/userManagementService.ts` — provavelmente le `max_users` do tenant

### 1.2 Problema identificado

- O modulo de licencas nunca foi ativado em producao: `completeClinicSetup` em `tenantOnboardingService.ts` bypassa completamente as etapas `plan_selected` e `payment_confirmed`, marcando o onboarding como `completed` sem passar por selecao de plano ou pagamento.
- As paginas `/clinic/setup/plan` e `/clinic/setup/payment` existem mas o fluxo real de onboarding as ignora.
- A Cloud Function `createPagBankSubscription` usa `PAGBANK_TOKEN` e `PAGBANK_EMAIL` como secrets que nunca foram configurados em producao.
- A funcao `checkLicenseExpiration` roda diariamente mas nao ha licencas com `status === 'ativa'` nem `end_date` real no Firestore de producao, tornando-a um cron job sem efeito.
- O codigo morto aumenta a superficie de ataque (segredos de pagamento nunca usados), dificulta manutencao e gera falsos positivos no SonarCloud.
- O campo `plan_id` em `Tenant` e usado apenas para logica de exibicao no admin dashboard (contagem de planos e calculo de receita hipotetica), nao para controle de acesso real.

### 1.3 Motivacao estrategica

A decisao de produto e que o controle de acesso ao sistema sera feito diretamente pelo `system_admin` via ativacao/desativacao do tenant (`Tenant.active`), sem intermediacao de licencas, datas de vencimento ou pagamento automatizado. O modelo de cobranca sera tratado fora do sistema (planilha, contrato, nota fiscal manual) ate que um modulo de billing dedicado seja construido do zero com requisitos claros. Remover o modulo agora evita que codigo nao testado vaze para producao e simplifica o modelo mental para todos os desenvolvedores.

---

## 2. Objetivos

1. Remover a interface `License` e o tipo `LicenseStatus` de `src/types/index.ts`.
2. Limpar campos de plano/licenca de `Tenant` (`plan_id`, e a semantica de licenca de `max_users`) sem quebrar o campo `max_users` que ainda e usado para controle de limite de usuarios.
3. Remover o arquivo `src/lib/services/licenseService.ts` inteiro.
4. Remover ou simplificar `src/lib/services/tenantOnboardingService.ts`: eliminar toda logica de pagamento, plano e licenca; manter apenas `completeClinicSetup` (sem a parte de licenca), `getTenantOnboarding`, `initializeTenantOnboarding`, `needsOnboarding`, `getNextOnboardingStep`, `resetOnboarding`.
5. Remover `src/lib/constants/plans.ts` inteiro.
6. Remover as tres paginas admin de licencas (`/admin/licenses`, `/admin/licenses/[id]`, `/admin/licenses/new`).
7. Remover a entrada "Licencas" do `AdminLayout.tsx`.
8. Remover `src/app/(clinic)/clinic/license/page.tsx`.
9. Remover `src/components/clinic/LicenseTab.tsx` e `src/components/clinic/PaymentSection.tsx`.
10. Remover `src/components/admin/TenantPaymentInfo.tsx`.
11. Remover `src/app/(clinic)/clinic/setup/plan/page.tsx` e `src/app/(clinic)/clinic/setup/payment/page.tsx`.
12. Simplificar `src/app/(clinic)/clinic/setup/success/page.tsx` para nao depender de `PLANS` nem de dados de pagamento.
13. Remover `src/app/api/pagbank/subscription/route.ts`.
14. Remover `src/types/onboarding.ts` ou manter apenas `ClinicSetupData`, `OnboardingStatus` e `TenantOnboarding` sem campos de pagamento.
15. Limpar `src/types/notification.ts`: remover `'license_expiring'` e `'license_expired'` de `NotificationType`.
16. Remover as Firebase Functions `checkLicenseExpiration`, `createPagBankSubscription`, `pagbankWebhook` do `functions/src/`.
17. Remover as regras Firestore de `licenses`, `payment_methods`, `payment_history`.
18. Simplificar o dashboard admin para remover calculo de receita hipotetica e contagem de planos.
19. Simplificar `ProtectedRoute.tsx` para remover redirecionamentos para `/clinic/setup/plan` e `/clinic/setup/payment`.

---

## 3. Requisitos

### 3.1 Requisitos Funcionais (RF)

| ID    | Descricao                                                                                                                              | Ator         | Prioridade |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ---------- |
| RF-01 | O sistema admin deve continuar exibindo a lista de clinicas (tenants) sem o campo de plano                                             | system_admin | Must       |
| RF-02 | O limite de usuarios por clinica (`max_users`) deve continuar funcionando mesmo apos remover `plan_id`                                 | system_admin | Must       |
| RF-03 | O onboarding de uma nova clinica deve completar em um unico passo (configuracao inicial), sem etapas de plano ou pagamento             | clinic_admin | Must       |
| RF-04 | O `ProtectedRoute` deve redirecionar apenas para `/clinic/setup` (configuracao inicial), nao para plano ou pagamento                   | system       | Must       |
| RF-05 | O painel admin nao deve mais exibir metricas de receita, contagem de planos ou dados de pagamento                                      | system_admin | Must       |
| RF-06 | As notificacoes do sistema nao devem mais incluir tipos `license_expiring` nem `license_expired`                                       | system       | Must       |
| RF-07 | Nenhuma page ou componente deve importar de `licenseService`, `plans`, `onboarding` (pagamento) apos a task                           | system       | Must       |
| RF-08 | O build de producao (`npm run build`) deve passar sem erros e sem referencias a modulos removidos                                      | system       | Must       |

### 3.2 Requisitos Nao Funcionais (RNF)

| ID     | Descricao                                                                                                          | Categoria        |
| ------ | ------------------------------------------------------------------------------------------------------------------ | ---------------- |
| RNF-01 | Nenhum arquivo removido pode ser referenciado por imports remanescentes — zero erros de `type-check`               | Manutenibilidade |
| RNF-02 | As regras do Firestore removidas devem ser substituidas por negacao explicita (`allow read, write: if false`) para as colecoes `licenses`, `payment_methods`, `payment_history` ate que os dados historicos sejam limpos manualmente | Seguranca        |
| RNF-03 | As Firebase Functions removidas nao devem mais aparecer no `index.ts` — zero exports de `checkLicenseExpiration`, `createPagBankSubscription`, `pagbankWebhook` | Manutenibilidade |
| RNF-04 | O campo `max_users` no tenant deve continuar sendo lido corretamente em `UsersTab.tsx` e `users/create/route.ts`   | Manutenibilidade |
| RNF-05 | Secrets do PagBank (`PAGBANK_TOKEN`, `PAGBANK_EMAIL`) nao precisam ser deletados neste CR (sao secrets no GCP, nao no codigo), mas as funcoes que os referenciam devem ser removidas | Seguranca        |

### 3.3 Regras de Negocio (RN)

| ID    | Regra                                                                                                                                                     | Justificativa                                                                     |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| RN-01 | `Tenant.max_users` deve ser mantido — ele controla o limite de usuarios por clinica independente de licencas                                              | `users/create/route.ts` e `UsersTab.tsx` le `max_users` para verificar o limite  |
| RN-02 | `Tenant.plan_id` pode ser removido do tipo TypeScript mas dados historicos no Firestore nao precisam ser migrados neste CR                                | Decisao de produto: campo nao impacta acesso operacional                          |
| RN-03 | O onboarding deve continuar existindo em sua forma simplificada: apenas a etapa `pending_setup` (configuracao da clinica) e `completed`                   | O `ProtectedRoute` depende de `needsOnboarding` e `getNextOnboardingStep`         |
| RN-04 | Dados historicos nas colecoes `licenses`, `payment_methods`, `payment_history` no Firestore NAO serao deletados neste CR — apenas o codigo e removido     | Decisao de preservacao de dados historicos; limpeza e tarefa separada             |
| RN-05 | `Tenant.active` continua sendo o unico gate de acesso ao sistema — clinicas inativas sao bloqueadas pelo `ProtectedRoute` via `claims.active === false`   | Substitui a logica de licenca como controle de acesso                             |

---

## 4. Decisoes de Design

### 4.1 Abordagem escolhida

**Remocao cirurgica por modulo, em steps atomicos, com validacao de `type-check` e `build` apos cada grupo de mudancas.**

A estrategia e remover de fora para dentro: primeiro as paginas e componentes (que importam os servicos), depois os servicos (que importam os tipos), depois os tipos. Isso evita referencias quebradas em cada commit intermediario.

Para o `tenantOnboardingService.ts`, em vez de remover o arquivo inteiro, sera feita uma simplificacao: as funcoes `completePlanSelection`, `confirmPayment` e `processPaymentWebhook` serao removidas; as demais funcoes (`getTenantOnboarding`, `initializeTenantOnboarding`, `needsOnboarding`, `getNextOnboardingStep`, `completeClinicSetup`, `resetOnboarding`) serao mantidas sem a logica de licenca.

Para `src/types/onboarding.ts`, o arquivo sera simplificado mantendo apenas `OnboardingStatus`, `TenantOnboarding` (sem campos de pagamento) e `ClinicSetupData`. Os tipos `PaymentData`, `PaymentStatus`, `PaymentMethod`, `PaymentHistory`, `PlanSelectionData`, `PaymentCreationResponse`, `PaymentWebhookData` serao removidos.

Para o `firestore.rules`, as regras das colecoes removidas serao substituidas por `allow read, write: if false` com comentario explicando que os dados historicos existem mas o acesso via frontend e bloqueado.

### 4.2 Alternativas descartadas

| Alternativa                                          | Motivo do descarte                                                                                       |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Comentar o codigo em vez de remover                  | Codigo comentado nao passa pelo `type-check` e aumenta confusao para novos devs                          |
| Manter `licenseService.ts` mas nao exporta-lo         | Ainda causaria erros de `noUnusedLocals` no `tsconfig.json`; nao resolve o problema                     |
| Remover apenas as paginas de UI e manter servicos    | Deixaria codigo morto que viola `noUnusedLocals` e poderia ser re-importado por acidente                 |
| Migrar dados do Firestore neste CR                   | Fora do escopo: dados historicos nao impactam o sistema operacional e podem ser limpos separadamente     |
| Deletar `tenantOnboardingService.ts` inteiro         | `ProtectedRoute` depende de `needsOnboarding` e `getNextOnboardingStep`; o onboarding simplificado deve existir |

### 4.3 Trade-offs aceitos

- **`Tenant.plan_id` pode continuar existindo como campo opcional no Firestore** para dados historicos sem causar problemas — a remocao e apenas no tipo TypeScript (campo removido da interface `Tenant` em `src/types/tenant.ts` e `src/types/index.ts`). Isso significa que o Firestore pode ter o campo mas o TypeScript nao o reconhece, o que e aceitavel.
- **O dashboard admin ficara mais simples** (sem metricas de receita), o que e desejavel.
- **Secrets PagBank no GCP nao sao deletados neste CR** — eles ficam orfaos no ambiente Firebase mas nao causam dano. Limpeza de secrets e responsabilidade do tech lead separadamente.

---

## 5. Mapa de Impacto

### 5.1 Arquivos a CRIAR

Nenhum arquivo novo a criar.

### 5.2 Arquivos a MODIFICAR

| Arquivo                                                        | Natureza da mudanca                                                                                                                                                 |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/types/index.ts`                                           | Remover secao `LICENSE` inteira: `LicenseStatus` e `License`; remover `plan_id: string` e semantica de licenca de `Tenant.max_users` (manter campo mas sem comentario "NOVO: 1 para CPF, 5 para CNPJ") |
| `src/types/tenant.ts`                                          | Remover `plan_id` de `Tenant`, `CreateTenantData`, `UpdateTenantData`; remover enum `PLANS` local; manter `max_users` e demais campos                               |
| `src/types/onboarding.ts`                                      | Manter apenas `OnboardingStatus`, `TenantOnboarding` (sem `payment_data`, `payment_method`, `payment_confirmed`, `selected_plan_id`), `ClinicSetupData`; remover todos os tipos de pagamento |
| `src/types/notification.ts`                                    | Remover `'license_expiring'` e `'license_expired'` de `NotificationType`                                                                                            |
| `src/lib/services/tenantOnboardingService.ts`                  | Remover funcoes: `completePlanSelection`, `confirmPayment`, `processPaymentWebhook`, `hasActiveLicense`; remover imports de `licenseService` e `plans`; simplificar `completeClinicSetup` sem logica de licenca |
| `src/components/admin/AdminLayout.tsx`                         | Remover item de navegacao "Licencas" (href `/admin/licenses`, icone `CreditCard`) do array `navigation`                                                             |
| `src/app/(admin)/admin/dashboard/page.tsx`                     | Remover campos de receita da interface `DashboardStats` (`planCounts`, `revenue`); remover calculo de `semestralTenants`, `anualTenants`, receita hipotetica; remover import de `PLANS`; remover activity type `'license'` |
| `src/app/(admin)/admin/tenants/[id]/page.tsx`                  | Remover imports de `formatPlanPrice`, `getPlanMaxUsers`; remover campo `plan_id` do formulario; remover `TenantPaymentInfo`                                          |
| `src/app/(admin)/admin/tenants/page.tsx`                       | Verificar e remover qualquer referencia a `plan_id` ou `license` na listagem                                                                                        |
| `src/app/(admin)/admin/tenants/new/page.tsx`                   | Remover campo `plan_id` do formulario de criacao; remover import de `PLANS`                                                                                         |
| `src/app/(clinic)/clinic/setup/success/page.tsx`               | Remover import de `PLANS`; remover logica de redirecionamento para plano e pagamento; simplificar para redirecionar apenas para `/clinic/dashboard`                  |
| `src/components/auth/ProtectedRoute.tsx`                       | Remover imports de `needsOnboarding` e `getNextOnboardingStep` — manter redirecionamento para `/clinic/setup` mas sem os casos `pending_plan` e `pending_payment`    |
| `src/app/api/tenants/create/route.ts`                          | Remover campo `plan_id` do `tenantData` gravado no Firestore; verificar se `max_users` ainda e passado corretamente                                                  |
| `firestore.rules`                                              | Substituir bloco `match /licenses/{licenseId}` por `allow read, write: if false`; substituir `match /payment_methods/{methodId}` por `allow read, write: if false`; substituir `match /payment_history/{historyId}` por `allow read, write: if false` |
| `functions/src/index.ts`                                       | Remover exports de `checkLicenseExpiration`, `createPagBankSubscription`, `pagbankWebhook`                                                                          |

### 5.3 Arquivos a REMOVER

| Arquivo                                                        | Motivo                                                                                           |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `src/lib/services/licenseService.ts`                           | Modulo completo de licencas: todo o CRUD de `licenses` e removido                               |
| `src/lib/constants/plans.ts`                                   | Definicoes de planos (semestral/anual) com precos: nao usadas mais apos CR                       |
| `src/app/(admin)/admin/licenses/page.tsx`                      | Pagina de listagem de licencas no painel admin                                                   |
| `src/app/(admin)/admin/licenses/[id]/page.tsx`                 | Pagina de detalhes/acoes de licenca individual                                                   |
| `src/app/(admin)/admin/licenses/new/page.tsx`                  | Formulario de criacao de nova licenca                                                            |
| `src/app/(clinic)/clinic/license/page.tsx`                     | Pagina standalone de licenca para clinic_admin                                                   |
| `src/app/(clinic)/clinic/setup/plan/page.tsx`                  | Etapa de selecao de plano no onboarding                                                          |
| `src/app/(clinic)/clinic/setup/payment/page.tsx`               | Etapa de pagamento com cartao via PagBank no onboarding                                          |
| `src/components/clinic/LicenseTab.tsx`                         | Aba de licenca no painel de configuracoes da clinica                                             |
| `src/components/clinic/PaymentSection.tsx`                     | Secao de metodo de pagamento e historico de pagamentos                                           |
| `src/components/admin/TenantPaymentInfo.tsx`                   | Componente admin de historico e metodo de pagamento do tenant                                    |
| `src/app/api/pagbank/subscription/route.ts`                    | Proxy para Cloud Function `createPagBankSubscription`                                            |
| `functions/src/checkLicenseExpiration.ts`                      | Scheduled function de verificacao diaria de licencas                                             |
| `functions/src/createPagBankSubscription.ts`                   | Callable function de criacao de assinatura no PagBank                                            |
| `functions/src/pagbankWebhook.ts`                              | HTTP function de webhook do PagBank                                                              |

### 5.4 Impacto no Firestore

| Colecao                | Acao                             | Detalhes                                                                                                 |
| ---------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `licenses`             | NENHUMA (dados preservados)      | Regras substituidas por `if false` — dados historicos permanecem no Firestore sem acesso via frontend   |
| `payment_methods`      | NENHUMA (dados preservados)      | Regras substituidas por `if false` — dados historicos permanecem                                         |
| `payment_history`      | NENHUMA (dados preservados)      | Regras substituidas por `if false` — dados historicos permanecem                                         |
| `tenant_onboarding`    | LEITURA/ESCRITA mantidas         | Colecao permanece necessaria para o fluxo simplificado de setup da clinica                               |
| `tenants`              | ESCRITA alterada via code        | Campo `plan_id` deixa de ser gravado em novas criacoes de tenant; dados historicos com `plan_id` permanecem |
| `webhook_logs`         | NENHUMA                          | Colecao existente, sem regra explicita atualmente; sem mudanca                                           |
| `payment_errors`       | NENHUMA                          | Colecao criada pela Function removida; sem regra explicita; dados ficam orfaos                           |

### 5.5 O que NAO muda

- Autenticacao, Custom Claims e `useAuth` — sem alteracao.
- `Tenant.max_users` — mantido e continua sendo lido por `users/create/route.ts` e `UsersTab.tsx`.
- `Tenant.active` — continua sendo o gate de acesso ao sistema.
- `Tenant.suspension` / `SuspensionInfo` — mantidos para controle manual de suspensao pelo admin.
- O modulo de inventario, solicitacoes, relatorios, produtos Rennova e consultores — sem alteracao.
- O onboarding simplificado (apenas etapa de configuracao da clinica via `/clinic/setup`) — mantido.
- Firebase Functions de email (`onUserCreated`, `onTenantCreated`, `onAccessRequestCreated`, `sendCustomEmail`, `sendTempPasswordEmail`, `sendRejectionEmail`, `processEmailQueue`) — sem alteracao.
- `firestore.rules` para colecoes de usuarios, tenants, inventario, solicitacoes, produtos, consultores, documentos legais, notificacoes, solicitacoes de acesso — sem alteracao.

---

## 6. Especificacao Tecnica

### 6.1 Mudancas no modelo de dados

**`src/types/index.ts` — secao LICENSE (remover completamente):**

```ts
// REMOVER estas linhas (linhas 213-228 do arquivo atual):

export type LicenseStatus = 'ativa' | 'pendente' | 'expirada' | 'suspensa';

export interface License {
  id: string;
  tenant_id: string;
  plan_id: string;
  status: LicenseStatus;
  max_users: number;
  features: string[];
  start_date: Timestamp;
  end_date: Timestamp;
  auto_renew: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}
```

**`src/types/index.ts` — interface `Tenant` (linha 78, campo `plan_id`):**

```ts
// ANTES (linha 77-78 do arquivo atual):
  plan_id: string;
  max_users: number; // NOVO: 1 para CPF, 5 para CNPJ

// DEPOIS:
  max_users: number; // Limite de usuarios: 1 para CPF (autonomo), 5 para CNPJ (clinica)
```

**`src/types/tenant.ts` — interface `Tenant` (remover `plan_id`):**

```ts
// ANTES:
  plan_id: 'semestral' | 'anual';
  max_users: number;

// DEPOIS:
  max_users: number;
```

**`src/types/tenant.ts` — interface `CreateTenantData` (remover `plan_id`):**

```ts
// Remover:
  plan_id: 'semestral' | 'anual';
```

**`src/types/tenant.ts` — interface `UpdateTenantData` (remover `plan_id`):**

```ts
// Remover:
  plan_id?: 'semestral' | 'anual';
```

**`src/types/tenant.ts` — const `PLANS` (remover todo o bloco):**

```ts
// Remover o export const PLANS = { semestral: {...}, anual: {...} } as const;
// Remover as funcoes formatCNPJ permanecem (sao utilitarias independentes)
```

**`src/types/onboarding.ts` — estado novo (simplificado):**

```ts
import { Timestamp } from 'firebase/firestore';

export type OnboardingStatus =
  | 'pending_setup'  // Aguardando configuracao inicial
  | 'completed';     // Onboarding completo (sem etapas de plano/pagamento)

export interface TenantOnboarding {
  tenant_id: string;
  status: OnboardingStatus;
  setup_completed: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
  completed_at?: Timestamp;
}

export interface ClinicSetupData {
  name: string;
  document_type: 'cnpj' | 'cpf';
  document_number: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  cep: string;
}

// REMOVER: PaymentData, PaymentStatus, PlanSelectionData, PaymentCreationResponse,
//          PaymentWebhookData, PaymentMethod, PaymentHistory
```

**`src/types/notification.ts` — `NotificationType` (remover dois valores):**

```ts
// ANTES inclui:
  | 'license_expiring'
  | 'license_expired'

// DEPOIS: remover essas duas linhas
```

### 6.2 Mudancas em servicos

**`src/lib/services/tenantOnboardingService.ts` — funcoes a REMOVER:**

- `completePlanSelection(tenantId, planData)` — remover inteira
- `confirmPayment(tenantId, paymentData)` — remover inteira (importava `createLicense`, `getActiveLicenseByTenant`, `updateLicense`)
- `processPaymentWebhook(notificationCode)` — remover inteira
- `hasActiveLicense(tenantId)` — remover inteira

**`src/lib/services/tenantOnboardingService.ts` — `completeClinicSetup` simplificado:**

```ts
// ANTES: atualizava onboarding com plan_selected: true, payment_confirmed: true
// DEPOIS: atualizava onboarding apenas com setup_completed: true, status: 'completed'

export async function completeClinicSetup(
  tenantId: string,
  setupData: ClinicSetupData
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateTenant(tenantId, {
      name: setupData.name,
      document_type: setupData.document_type,
      document_number: setupData.document_number.replace(/\D/g, ''),
      email: setupData.email,
      phone: setupData.phone.replace(/\D/g, ''),
      address: setupData.address,
      city: setupData.city,
      state: setupData.state,
      cep: setupData.cep.replace(/\D/g, ''),
      max_users: setupData.document_type === 'cnpj' ? 5 : 1,
    });

    const onboardingRef = doc(db, 'tenant_onboarding', tenantId);
    await updateDoc(onboardingRef, {
      setup_completed: true,
      status: 'completed' as OnboardingStatus,
      completed_at: Timestamp.now(),
      updated_at: Timestamp.now(),
    });

    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro ao completar setup';
    console.error('Erro ao completar setup:', error);
    return { success: false, error: msg };
  }
}
```

**`src/lib/services/tenantOnboardingService.ts` — `getNextOnboardingStep` simplificado:**

```ts
// ANTES: retornava 'pending_plan' e 'pending_payment' como passos intermediarios
// DEPOIS: retorna apenas 'pending_setup' ou null (onboarding completo)

export async function getNextOnboardingStep(
  tenantId: string
): Promise<OnboardingStatus | null> {
  const onboarding = await getTenantOnboarding(tenantId);

  if (!onboarding || !onboarding.setup_completed) {
    return 'pending_setup';
  }

  return null; // Onboarding completo
}
```

**`src/lib/services/tenantOnboardingService.ts` — imports a remover:**

```ts
// Remover estas linhas de import:
import { createLicense, getActiveLicenseByTenant, updateLicense } from './licenseService';
import { PLANS } from '@/lib/constants/plans';
import type { PlanSelectionData, PaymentData } from '@/types/onboarding';
```

### 6.3 Mudancas na UI

**`src/components/auth/ProtectedRoute.tsx` — simplificacao do switch de onboarding:**

```ts
// ANTES: switch com casos 'pending_plan' e 'pending_payment'
// DEPOIS: apenas o caso 'pending_setup'
switch (nextStep) {
  case 'pending_setup':
    router.push('/clinic/setup');
    return;
  default:
    break;
}
```

Tambem remover imports de `getNextOnboardingStep` que nao sera mais necessaria se `needsOnboarding` bastar. Verificar se `needsOnboarding` continua sendo necessaria (sim, para o check inicial).

**`src/app/(clinic)/clinic/setup/success/page.tsx` — simplificacao:**

Remover: import de `PLANS`, estado `planId`, funcao `checkOnboardingStatus` que redireciona para plano/pagamento.
Manter: redirecionamento direto para `/clinic/dashboard` sem verificar onboarding (o `ProtectedRoute` ja garante).

**`src/app/(admin)/admin/dashboard/page.tsx` — remover bloco de receita:**

Remover da interface `DashboardStats`: `planCounts`, `revenue` e todos os subcampos.
Remover do `loadDashboardStats`: o calculo de `semestralTenants`, `anualTenants`, `planCounts`, `revenue`.
Remover do JSX: cards de "Receita Mensal", "Plano Semestral", "Plano Anual", "Receita Anual Projetada".
Remover import de `PLANS`.
Manter: contagem de `totalTenants`, `activeTenants`, `totalUsers`, `activeUsers` e listagem de atividades recentes (sem o tipo `'license'`).

**`src/components/admin/AdminLayout.tsx` — remover item de navegacao:**

```ts
// REMOVER do array navigation:
{
  name: 'Licencas',
  href: '/admin/licenses',
  icon: CreditCard,
},
// Se CreditCard nao for usado por mais nenhum item, remover do import do lucide-react
```

### 6.4 Mudancas em API Routes

**`src/app/api/tenants/create/route.ts` — remover `plan_id` do tenantData:**

```ts
// ANTES (linha 39 do arquivo atual):
      plan_id: data.plan_id,

// DEPOIS: remover essa linha
// max_users continua sendo gravado normalmente
```

**`src/app/api/pagbank/subscription/route.ts` — REMOVER arquivo inteiro.**

---

## 7. Plano de Implementacao

### STEP 1 — Remover tipos de licenca e pagamento

**Objetivo:** Eliminar `License`, `LicenseStatus`, `plan_id` de `Tenant` e simplificar `onboarding.ts` para que os servicos e pages possam ser deletados sem referencias quebradas.

**Arquivos afetados:**
- `src/types/index.ts` — remover secao LICENSE e campo `plan_id` de `Tenant`
- `src/types/tenant.ts` — remover `plan_id` de `Tenant`, `CreateTenantData`, `UpdateTenantData`; remover const `PLANS` local
- `src/types/onboarding.ts` — simplificar para apenas `OnboardingStatus`, `TenantOnboarding`, `ClinicSetupData`
- `src/types/notification.ts` — remover `'license_expiring'` e `'license_expired'` de `NotificationType`

**Acoes:**
1. Em `src/types/index.ts`, deletar as linhas 213-228 (secao `LICENSE`).
2. Em `src/types/index.ts`, remover `plan_id: string` da interface `Tenant` (linha 77).
3. Em `src/types/tenant.ts`, remover `plan_id` de `Tenant`, `CreateTenantData`, `UpdateTenantData` e remover o export `const PLANS`.
4. Em `src/types/onboarding.ts`, reescrever o arquivo mantendo apenas `OnboardingStatus`, `TenantOnboarding`, `ClinicSetupData` conforme secao 6.1.
5. Em `src/types/notification.ts`, remover `'license_expiring'` e `'license_expired'`.
6. Executar `npm run type-check` — espera-se erros nos arquivos que importam os tipos removidos; isso e esperado neste step.

**Validacao:** Os tipos removidos nao existem mais. Os erros de `type-check` sao apenas em arquivos que serao modificados/removidos nos proximos steps.

**Commit:** `chore(types): remove License, LicenseStatus from index.ts and clean plan fields from Tenant`

---

### STEP 2 — Remover constants/plans e simplificar tenantOnboardingService

**Objetivo:** Eliminar `plans.ts` e simplificar o servico de onboarding para que a remocao de `licenseService` seja possivel no proximo step.

**Arquivos afetados:**
- `src/lib/constants/plans.ts` — deletar
- `src/lib/services/tenantOnboardingService.ts` — remover funcoes de pagamento e imports de licenca/planos

**Acoes:**
1. Deletar `src/lib/constants/plans.ts`.
2. Em `tenantOnboardingService.ts`, remover imports: `createLicense`, `getActiveLicenseByTenant`, `updateLicense` de `licenseService`; `PLANS` de `plans.ts`; tipos de pagamento de `onboarding`.
3. Remover as funcoes: `completePlanSelection`, `confirmPayment`, `processPaymentWebhook`, `hasActiveLicense`.
4. Reescrever `completeClinicSetup` sem logica de licenca (conforme secao 6.2).
5. Reescrever `getNextOnboardingStep` sem casos de plano/pagamento (conforme secao 6.2).
6. Reescrever `needsOnboarding` se necessario (verificar se ainda funciona sem campos `plan_selected` e `payment_confirmed` em `TenantOnboarding`).
7. Executar `npm run type-check`.

**Validacao:** `npm run type-check` sem erros em `tenantOnboardingService.ts`. `plans.ts` nao existe mais.

**Commit:** `chore(types): remove onboarding payment types and plans constants`

---

### STEP 3 — Remover paginas admin de licencas e atualizar AdminLayout e dashboard

**Objetivo:** Eliminar as tres paginas de licencas no admin e atualizar o layout e dashboard para nao referenciar licencas ou planos.

**Arquivos afetados:**
- `src/app/(admin)/admin/licenses/` — deletar diretorio inteiro (3 arquivos)
- `src/components/admin/AdminLayout.tsx` — remover item "Licencas"
- `src/app/(admin)/admin/dashboard/page.tsx` — remover metricas de receita e planos
- `src/app/(admin)/admin/tenants/[id]/page.tsx` — remover `formatPlanPrice`, `getPlanMaxUsers`, `TenantPaymentInfo`
- `src/app/(admin)/admin/tenants/page.tsx` — verificar e remover referencias a `plan_id`
- `src/app/(admin)/admin/tenants/new/page.tsx` — remover campo `plan_id`
- `src/components/admin/TenantPaymentInfo.tsx` — deletar

**Acoes:**
1. Deletar `src/app/(admin)/admin/licenses/page.tsx`, `src/app/(admin)/admin/licenses/[id]/page.tsx`, `src/app/(admin)/admin/licenses/new/page.tsx`.
2. Em `AdminLayout.tsx`, remover o objeto `{ name: 'Licencas', href: '/admin/licenses', icon: CreditCard }` do array `navigation`. Remover `CreditCard` do import do lucide-react se nao for mais usado.
3. Em `dashboard/page.tsx`, remover campos de receita conforme secao 6.3.
4. Em `tenants/[id]/page.tsx`, remover `formatPlanPrice`, `getPlanMaxUsers`, `TenantPaymentInfo`, campo `plan_id` do formulario.
5. Deletar `src/components/admin/TenantPaymentInfo.tsx`.
6. Executar `npm run type-check` e `npm run lint`.

**Validacao:** Nenhuma pagina em `/admin/licenses/*` e servida. AdminLayout nao exibe "Licencas". Dashboard exibe apenas contadores de tenants e usuarios.

**Commit:** `chore(admin): remove licenses pages and AdminLayout nav entry`

---

### STEP 4 — Remover componentes e paginas clinic de licenca/pagamento

**Objetivo:** Eliminar `LicenseTab`, `PaymentSection`, a pagina `/clinic/license`, e os componentes de onboarding de plano e pagamento.

**Arquivos afetados:**
- `src/components/clinic/LicenseTab.tsx` — deletar
- `src/components/clinic/PaymentSection.tsx` — deletar
- `src/app/(clinic)/clinic/license/page.tsx` — deletar
- `src/app/(clinic)/clinic/setup/plan/page.tsx` — deletar
- `src/app/(clinic)/clinic/setup/payment/page.tsx` — deletar
- `src/app/(clinic)/clinic/setup/success/page.tsx` — simplificar

**Acoes:**
1. Deletar os cinco arquivos listados.
2. Verificar se `LicenseTab` e `PaymentSection` sao importados em algum outro componente alem do que sera removido — buscar por `import.*LicenseTab` e `import.*PaymentSection` em todo `src/`.
3. Simplificar `setup/success/page.tsx` conforme secao 6.3.
4. Executar `npm run type-check` e `npm run lint`.

**Validacao:** Rotas `/clinic/license`, `/clinic/setup/plan`, `/clinic/setup/payment` retornam 404. Tela de sucesso redireciona diretamente para `/clinic/dashboard`.

**Commit:** `chore(clinic): remove license page, LicenseTab, PaymentSection components`

---

### STEP 5 — Simplificar ProtectedRoute e remover API route do PagBank

**Objetivo:** Remover redirecionamentos para plano/pagamento do `ProtectedRoute` e eliminar a API route do PagBank.

**Arquivos afetados:**
- `src/components/auth/ProtectedRoute.tsx` — simplificar switch de onboarding
- `src/app/api/pagbank/subscription/route.ts` — deletar

**Acoes:**
1. Em `ProtectedRoute.tsx`, simplificar o switch de `nextStep` para tratar apenas `'pending_setup'` conforme secao 6.3. Remover casos `'pending_plan'` e `'pending_payment'`.
2. Verificar se `getNextOnboardingStep` ainda e necessario em `ProtectedRoute` ou se apenas `needsOnboarding` basta.
3. Deletar `src/app/api/pagbank/subscription/route.ts`.
4. Verificar se o diretorio `src/app/api/pagbank/` ficou vazio — se sim, deletar o diretorio tambem.
5. Executar `npm run type-check` e `npm run lint`.

**Validacao:** Clinica com onboarding incompleto e redirecionada apenas para `/clinic/setup`. POST para `/api/pagbank/subscription` retorna 404.

**Commit:** `chore(clinic): remove setup plan and payment pages, clean ProtectedRoute onboarding flow`

---

### STEP 6 — Remover licenseService e atualizar API de criacao de tenant

**Objetivo:** Deletar o arquivo `licenseService.ts` e limpar a API route de criacao de tenant.

**Arquivos afetados:**
- `src/lib/services/licenseService.ts` — deletar
- `src/app/api/tenants/create/route.ts` — remover `plan_id` do tenantData

**Acoes:**
1. Antes de deletar, buscar por `import.*licenseService` em todo `src/` para garantir que nenhum arquivo ainda importa o servico.
2. Deletar `src/lib/services/licenseService.ts`.
3. Em `tenants/create/route.ts`, remover a linha `plan_id: data.plan_id` do objeto `tenantData`. Confirmar que `max_users: data.max_users` ainda e gravado.
4. Executar `npm run type-check`, `npm run lint` e `npm run build`.

**Validacao:** `npm run build` sem erros. Nenhum modulo tenta importar `licenseService`.

**Commit:** `chore(firebase): remove licenseService, tenantOnboardingService payment logic and plans`

---

### STEP 7 — Remover Firebase Functions de licenca e PagBank

**Objetivo:** Eliminar as tres Cloud Functions relacionadas a licencas e pagamento.

**Arquivos afetados:**
- `functions/src/checkLicenseExpiration.ts` — deletar
- `functions/src/createPagBankSubscription.ts` — deletar
- `functions/src/pagbankWebhook.ts` — deletar
- `functions/src/index.ts` — remover tres exports

**Acoes:**
1. Deletar os tres arquivos de functions.
2. Verificar se ha arquivos em `functions/src/lib/` ou `functions/src/types/` referenciados exclusivamente pelas functions deletadas (ex: `pagbankClient`, `types/pagbank`). Se sim, deletar tambem.
3. Em `functions/src/index.ts`, remover as linhas:
   - `export { checkLicenseExpiration } from './checkLicenseExpiration';`
   - `export { createPagBankSubscription } from './createPagBankSubscription';`
   - `export { pagbankWebhook } from './pagbankWebhook';`
   - Remover o comentario `// Scheduled Functions - Licencas` e `// PagBank Integration`.
4. Executar `npm run type-check` no diretorio de functions (se houver script) e verificar que o build das functions nao quebra.

**Validacao:** `functions/src/index.ts` nao exporta mais `checkLicenseExpiration`, `createPagBankSubscription`, `pagbankWebhook`. Os arquivos deletados nao existem mais.

**Commit:** `chore(firebase): remove checkLicenseExpiration, createPagBankSubscription, pagbankWebhook functions`

---

### STEP 8 — Atualizar firestore.rules

**Objetivo:** Substituir as regras de `licenses`, `payment_methods`, `payment_history` por bloqueio explicito.

**Arquivos afetados:**
- `firestore.rules` — modificar tres blocos de regras

**Acoes:**
1. Substituir o bloco `match /licenses/{licenseId}` (linhas 131-148 do arquivo atual) por:
   ```
   // Colecao de licencas — DESATIVADA (dados historicos preservados, sem acesso via frontend)
   match /licenses/{licenseId} {
     allow read, write: if false;
   }
   ```
2. Substituir o bloco `match /payment_methods/{methodId}` (linhas 209-220) por:
   ```
   // Metodos de pagamento — DESATIVADOS (dados historicos preservados)
   match /payment_methods/{methodId} {
     allow read, write: if false;
   }
   ```
3. Substituir o bloco `match /payment_history/{historyId}` (linhas 223-234) por:
   ```
   // Historico de pagamentos — DESATIVADO (dados historicos preservados)
   match /payment_history/{historyId} {
     allow read, write: if false;
   }
   ```
4. Executar `npm run firebase:deploy:rules` no ambiente de dev para validar a sintaxe.

**Validacao:** `firebase deploy --only firestore:rules` sem erros. Tentativa de leitura de `licenses` no emulador retorna permissao negada.

**Commit:** `chore(firebase): remove licenses, payment_methods, payment_history rules from firestore.rules`

---

### STEP 9 — Verificacao final e build completo

**Objetivo:** Garantir que `lint`, `type-check` e `build` passam sem nenhum erro.

**Acoes:**
1. Executar `npm run lint` — zero erros ou warnings.
2. Executar `npm run type-check` — zero erros TypeScript.
3. Executar `npm run build` — build de producao sem falhas.
4. Executar `npm run test` — todos os testes existentes passando.
5. Verificar manualmente no ambiente Firebase pessoal:
   - Login como `system_admin`: sidebar nao exibe "Licencas"; dashboard sem metricas de receita.
   - Login como `clinic_admin` com onboarding incompleto: redirecionado para `/clinic/setup`, nao para `/clinic/setup/plan`.
   - Login como `clinic_admin` com onboarding completo: acesso normal ao dashboard.
   - Criacao de nova clinica via `/admin/tenants/new`: sem campo de plano.

**Commit:** Nenhum commit adicional; o build e a validacao sao o criterio de aceite.

---

## 8. Estrategia de Testes

| Funcao                       | Arquivo de teste                         | Cenarios obrigatorios                                                                                                                         |
| ---------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `completeClinicSetup`        | N/A (depende do Firebase)                | Nao testar — validar manualmente via emuladores                                                                                               |
| `getNextOnboardingStep`      | N/A (depende do Firebase)                | Nao testar — validar manualmente via emuladores                                                                                               |
| Demais funcoes               | N/A                                      | Nao ha funcoes puras novas neste CR — sem novos testes unitarios necessarios                                                                  |

**Regras aplicadas:**
- Este CR e uma remocao de codigo, nao uma adicao de funcionalidade — zero testes novos sao necessarios.
- Os testes existentes em `src/__tests__/` devem continuar passando — nenhum deles testa licencas ou pagamento.
- Validacao e feita via `build` e testes manuais no ambiente Firebase pessoal.

---

## 9. Checklist de Definition of Done

```
[ ] npm run lint        — zero erros ou warnings
[ ] npm run type-check  — zero erros TypeScript
[ ] npm run build       — build de producao sem falhas
[ ] npm run test        — todos os testes existentes passando

[ ] REMOCOES — Tipos:
    [ ] License e LicenseStatus removidos de src/types/index.ts
    [ ] plan_id removido de Tenant, CreateTenantData, UpdateTenantData em src/types/tenant.ts
    [ ] const PLANS removida de src/types/tenant.ts
    [ ] src/types/onboarding.ts simplificado (sem tipos de pagamento)
    [ ] license_expiring e license_expired removidos de NotificationType

[ ] REMOCOES — Servicos e constants:
    [ ] src/lib/services/licenseService.ts DELETADO
    [ ] src/lib/constants/plans.ts DELETADO
    [ ] tenantOnboardingService.ts: completePlanSelection, confirmPayment, processPaymentWebhook, hasActiveLicense REMOVIDAS
    [ ] tenantOnboardingService.ts: imports de licenseService e plans REMOVIDOS

[ ] REMOCOES — Paginas admin:
    [ ] src/app/(admin)/admin/licenses/page.tsx DELETADO
    [ ] src/app/(admin)/admin/licenses/[id]/page.tsx DELETADO
    [ ] src/app/(admin)/admin/licenses/new/page.tsx DELETADO
    [ ] AdminLayout.tsx sem item "Licencas" na sidebar

[ ] REMOCOES — Paginas clinic:
    [ ] src/app/(clinic)/clinic/license/page.tsx DELETADO
    [ ] src/app/(clinic)/clinic/setup/plan/page.tsx DELETADO
    [ ] src/app/(clinic)/clinic/setup/payment/page.tsx DELETADO

[ ] REMOCOES — Componentes:
    [ ] src/components/clinic/LicenseTab.tsx DELETADO
    [ ] src/components/clinic/PaymentSection.tsx DELETADO
    [ ] src/components/admin/TenantPaymentInfo.tsx DELETADO

[ ] REMOCOES — API Routes e Functions:
    [ ] src/app/api/pagbank/subscription/route.ts DELETADO
    [ ] functions/src/checkLicenseExpiration.ts DELETADO
    [ ] functions/src/createPagBankSubscription.ts DELETADO
    [ ] functions/src/pagbankWebhook.ts DELETADO
    [ ] functions/src/index.ts sem exports das tres functions removidas

[ ] MODIFICACOES:
    [ ] src/components/auth/ProtectedRoute.tsx: sem redirecionamento para /clinic/setup/plan nem /clinic/setup/payment
    [ ] src/app/(clinic)/clinic/setup/success/page.tsx: sem import de PLANS nem logica de plano
    [ ] src/app/(admin)/admin/dashboard/page.tsx: sem metricas de receita ou planos
    [ ] src/app/(admin)/admin/tenants/create/route.ts: sem campo plan_id no tenantData
    [ ] firestore.rules: licenses, payment_methods, payment_history com allow read, write: if false

[ ] VERIFICACAO MANUAL no Firebase pessoal:
    [ ] Sidebar admin nao exibe "Licencas"
    [ ] Dashboard admin sem metricas de receita
    [ ] Onboarding de clinica: etapa de plano e pagamento nao aparecem
    [ ] ProtectedRoute: clinica com setup incompleto vai para /clinic/setup (nao /plan nem /payment)
    [ ] Criacao de novo tenant: campo plan_id nao e gravado

[ ] Multi-tenant: max_users continua sendo lido corretamente por users/create/route.ts e UsersTab.tsx
[ ] Seguranca: nenhuma referencia a PAGBANK_TOKEN nem PAGBANK_EMAIL no codigo da aplicacao (apenas nos arquivos deletados das functions)
[ ] Branch pessoal: task branch mergeada na branch pessoal para validacao no Firebase
[ ] PR: aberto para gscandelari_setup com template preenchido
```

---

## 10. Riscos e Mitigacoes

| Risco                                                                                              | Probabilidade | Impacto | Mitigacao                                                                                                                             |
| -------------------------------------------------------------------------------------------------- | ------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Algum componente nao mapeado importa `licenseService` ou `plans`                                   | Media         | Alto    | Executar `grep -r "licenseService\|from.*plans" src/` antes de deletar os arquivos; confirmar zero resultados                        |
| `ProtectedRoute` deixa de funcionar corretamente sem os casos de plano/pagamento                   | Media         | Alto    | Testar manualmente com conta de clinica com onboarding incompleto no emulador                                                        |
| `UsersTab` ou `users/create/route.ts` quebra por depender de `plan_id` em vez de `max_users`       | Baixa         | Medio   | Verificar o codigo de ambos: `UsersTab.tsx` le `tenantData.max_users` (linha 91); `users/create/route.ts` le `tenantData?.max_users` (linha 73) — sem dependencia de `plan_id` |
| Dados do Firestore com `plan_id` causam erros de tipo no TypeScript                                | Baixa         | Baixo   | Firestore nao valida schema — campos extras no documento nao causam erro no runtime; apenas o tipo TypeScript e alterado               |
| Remocao de `checkLicenseExpiration` causa erro no deploy de functions se houver cache               | Baixa         | Baixo   | Executar `firebase deploy --only functions` apos remover do `index.ts`; o deploy elimina a function automaticamente                   |
| `tenant_onboarding` com campos `plan_selected` e `payment_confirmed` no Firestore causa erros       | Baixa         | Baixo   | Os campos extras no Firestore nao causam erro no runtime — o tipo TypeScript simplificado simplesmente os ignora                      |
| Paginas de licenca eram referenciadas por links/navegacao nao mapeados                              | Baixa         | Medio   | Buscar por `/admin/licenses` e `/clinic/license` em todo o `src/` antes de deletar                                                   |

---

## 11. Glossario

| Termo                   | Definicao                                                                                                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| License                 | Interface TypeScript que representava uma licenca de acesso ao sistema com data de inicio, termino, plano, max_users e features. Removida neste CR.       |
| LicenseStatus           | Union type com valores `'ativa' | 'pendente' | 'expirada' | 'suspensa'`. Removido neste CR.                                                              |
| plan_id                 | Campo do tenant que identificava o plano contratado (`'semestral'` ou `'anual'`). Removido do tipo TypeScript; dados historicos permanecem no Firestore.  |
| max_users               | Campo do tenant que define o limite de usuarios permitidos (1 para CPF, 5 para CNPJ). MANTIDO — e o unico campo de limites que continua operacional.      |
| PagBank                 | Provedor de pagamento que foi integrado via SDK (`PagSeguroDirectPayment`) e Firebase Function. A integracao e completamente removida neste CR.            |
| TenantOnboarding        | Documento em `tenant_onboarding/{tenantId}` que rastreia o progresso de configuracao da clinica. Simplificado para apenas `pending_setup` e `completed`. |
| checkLicenseExpiration  | Scheduled Firebase Function que rodava diariamente para marcar licencas expiradas. Removida neste CR.                                                     |
| createPagBankSubscription | Callable Firebase Function que criava assinaturas no PagBank. Removida neste CR.                                                                       |
| pagbankWebhook          | HTTP Firebase Function que recebia notificacoes do PagBank. Removida neste CR.                                                                            |
| codigo morto            | Codigo que existe no repositorio mas nao e executado no produto (dead code). Todo o modulo de licencas e pagamento era codigo morto no MVP.               |

---

## 12. Referencias

- `src/types/index.ts` — definicoes de `License` e `LicenseStatus` a serem removidas (linhas 213-228)
- `src/types/tenant.ts` — campo `plan_id` em tres interfaces e enum `PLANS` local
- `src/types/onboarding.ts` — todos os tipos de pagamento a serem removidos
- `src/lib/services/licenseService.ts` — 390 linhas de CRUD de licencas: deletar inteiro
- `src/lib/services/tenantOnboardingService.ts` — integracao com `licenseService` e `PLANS`: simplificar
- `src/lib/constants/plans.ts` — configuracao de planos com precos: deletar inteiro
- `functions/src/checkLicenseExpiration.ts` — scheduled function diaria: deletar
- `functions/src/createPagBankSubscription.ts` — callable function PagBank: deletar
- `functions/src/pagbankWebhook.ts` — HTTP function PagBank: deletar
- `functions/src/index.ts` — remover tres exports das functions deletadas
- `firestore.rules` (linhas 131-148, 209-234) — regras de `licenses`, `payment_methods`, `payment_history`: substituir por `if false`
- `src/components/auth/ProtectedRoute.tsx` — simplificar switch de onboarding
- `ONLY_FOR_DEVS/GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md` — Git Flow, Conventional Commits, PRs

---

## 13. Historico de Versoes

| Versao | Data       | Autor               | O que mudou     |
| ------ | ---------- | ------------------- | --------------- |
| 1.0    | 06/05/2026 | Doc Writer (Claude) | Versao inicial  |
