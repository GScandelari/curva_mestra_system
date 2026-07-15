# UC-45: Completar Configuração Inicial da Clínica (Onboarding)

**Projeto:** Curva Mestra
**Data de Criação:** 15/07/2026
**Autor:** Guilherme Scandelari (via uml-use-case-writer)
**Status:** Rascunho
**Módulo/Contexto:** Onboarding de Clínica
**Versão:** 1.0

> Logo após aceitar os termos legais de onboarding (UC-09, Variante B), um usuário de clínica (`clinic_admin` ou `clinic_user`) é redirecionado para `/clinic/setup`, um wizard de 2 passos ("Dados Básicos" e "Endereço") que revisa/completa os dados cadastrais da clínica (`tenants/{tenantId}`) já pré-cadastrados pelo System Admin em UC-21. Ao confirmar, os dados são atualizados e o usuário é levado ao dashboard da clínica. A rota permanece acessível a qualquer momento depois disso — não há nenhuma flag de "onboarding concluído" que a bloqueie.

---

## 1. Diagrama UML (Mermaid)

```mermaid
flowchart LR
    ClinicAdmin([👤 Clinic Admin])
    ClinicUser([👤 Clinic User])

    subgraph Sistema["Curva Mestra"]
        UC45(("UC-45\nCompletar Configuração\nInicial da Clínica"))
        UC09(("UC-09\nAceitar Termos Legais\n(Variante B)"))
        UC21(("UC-21\nCadastrar Nova Clínica\n(System Admin)"))
    end

    UC09 -.->|redireciona após\naceite, onboarding| UC45
    ClinicAdmin --> UC45
    ClinicUser --> UC45
    UC21 -.->|dados pré-cadastrados\nsão a base do formulário| UC45
    UC45 -.->|updateTenant, sempre\nrecalcula max_users| Firestore[(Firestore\ntenants/{tenantId})]
```

---

## 2. Atores

### 2.1 Ator Primário
**Clinic Admin** ou **Clinic User** — a página não faz nenhuma checagem de `claims?.role`; ambos os roles do grupo `(clinic)` têm acesso idêntico (`ProtectedRoute allowedRoles: ['clinic_admin', 'clinic_user']` no layout do grupo, sem restrição adicional nesta rota específica).

### 2.2 Atores Secundários / Sistemas Externos
Nenhum sistema externo. Consome dados previamente gravados por **System Admin** via UC-21 (Cadastrar Nova Clínica).

---

## 3. Pré-condições
- Usuário autenticado com `tenant_id` definido nos custom claims.
- Documento `tenants/{tenantId}` já existe (criado por UC-21) — a página depende de `getTenant(tenantId)` retornar um tenant válido para pré-preencher o formulário.
- **Não há pré-condição de "primeiro acesso" ou "onboarding pendente"**: a rota é sempre acessível, em qualquer momento do ciclo de vida da clínica (ver RN-04).

---

## 4. Pós-condições

### 4.1 Sucesso (Garantias de Sucesso)
- O documento `tenants/{tenantId}` é atualizado (`updateTenant`) com: `name`, `document_type`, `document_number` (dígitos), `email`, `phone` (dígitos), `address`, `city`, `state`, `cep` (dígitos), e `max_users` **sempre recalculado** a partir de `document_type` (`cnpj` → 5, `cpf` → 1 — mesma fórmula de UC-21/UC-22, nunca preservado de um valor manual anterior, se algum dia existir um).
- Usuário é redirecionado para `/clinic/dashboard`.
- Nenhuma flag é gravada indicando que o onboarding foi concluído — o tenant não ganha nenhum campo tipo `setup_completed`.

### 4.2 Falha (Garantias Mínimas)
- Se a validação client-side (passo 1 ou 2) falhar: nenhuma chamada ao Firestore ocorre; mensagem de erro específica é exibida no formulário.
- Se `updateTenant` falhar (erro de rede/permissão): mensagem de erro (`err.message` ou texto genérico "Erro ao processar solicitação") é exibida; usuário permanece na página, dados preenchidos no formulário não são perdidos.

---

## 5. Gatilho (Trigger)
Usuário é redirecionado para `/clinic/setup` automaticamente pelo `TermsInterceptor` ao concluir o aceite de termos em `/clinic/setup/terms` (UC-09, Variante B, passo 11); ou navega diretamente para a URL a qualquer momento (não há bloqueio de acesso posterior).

---

## 6. Fluxo Principal (Basic Flow)

1. Usuário chega em `/clinic/setup` (via redirecionamento pós-aceite de termos, ou navegação direta).
2. Sistema chama `getTenant(tenantId)` e pré-preenche o formulário com os dados já existentes: `name`, `document_type`, `document_number` (ou `cnpj`, como fallback), `email`, `phone`, `address` (apenas a primeira parte antes da primeira vírgula), `city`, `state`, `cep` — extraindo `city`/`state`/`cep` de `address` via `parseAddressFromString` se esses campos não existirem separadamente. Define `dataPreFilled = true`.
3. Sistema exibe o título "Revisão de Dados da Clínica" (em vez de "Configuração Inicial", usado apenas quando `dataPreFilled === false`, cenário que só ocorre se `getTenant` não retornar um tenant) e um `Alert` informativo: "Os dados abaixo foram pré-cadastrados pelo administrador. Você pode revisar e editar qualquer informação antes de confirmar."
4. **Passo 1 (Dados Básicos):** usuário revisa/edita Nome da Clínica, Tipo de Documento (CNPJ/CPF — com máscara e limite de dígitos dinâmicos), Email da Clínica, Telefone; clica em "Próximo".
5. Sistema valida (client-side): nome não vazio; documento com 14 dígitos + dígitos verificadores válidos (CNPJ, via `validateCNPJ`) ou 11 dígitos sem validação de dígito verificador (CPF); e-mail contendo "@"; telefone com pelo menos 10 dígitos. Se inválido, exibe a mensagem específica e permanece no passo 1.
6. **Passo 2 (Endereço):** usuário revisa/edita CEP, Endereço, Cidade, Estado (select com as 27 UFs); pode voltar ao Passo 1 ("Voltar").
7. Usuário clica em "Confirmar e Continuar" (texto do botão quando `dataPreFilled === true`; seria "Continuar" se `dataPreFilled === false`).
8. Sistema valida (client-side): endereço, cidade e estado não vazios; CEP com exatamente 8 dígitos.
9. Sistema chama `updateTenant(tenantId, { name, document_type, document_number (limpo), email, phone (limpo), address, city, state, cep (limpo), max_users })`, com `max_users` recalculado (`document_type === 'cnpj' ? 5 : 1`).
10. Sistema redireciona para `/clinic/dashboard`.
11. Caso de uso é concluído com sucesso.

---

## 7. Fluxos Alternativos

### 7a. Tenant sem dados pré-cadastrados (a partir do passo 2)
1. `getTenant` retorna um tenant, mas sem nenhum dos campos relevantes preenchidos (cenário não observado nos fluxos de criação atuais, já que UC-21 exige nome/documento/e-mail — teoricamente possível apenas se o tenant tiver sido criado por outro caminho fora de UC-21).
2. `dataPreFilled` permanece `false`; título exibido é "Configuração Inicial" e a descrição "Complete os dados da sua clínica para ativar sua conta", sem o `Alert` informativo.

### 7b. Usuário acessa `/clinic/setup` após o onboarding já ter sido concluído (a partir do passo 1)
1. Não há nenhuma checagem que impeça o reacesso; o formulário é recarregado normalmente com os dados atuais do tenant (agora possivelmente diferentes dos originais de UC-21, se editados aqui ou em UC-22).
2. Usuário pode reenviar o formulário livremente, resultando em outro `updateTenant` idêntico ao de UC-22 (mesma fórmula de `max_users`).

---

## 8. Fluxos de Exceção

### 8a. `tenantId` ausente (a partir do passo 1)
1. `claims?.tenant_id` é `null`/`undefined`.
2. `loadExistingData` não é chamada; formulário permanece com valores vazios/padrão (`document_type: 'cnpj'`), sem mensagem de erro específica.

### 8b. Falha ao carregar dados existentes (a partir do passo 2)
1. `getTenant` lança exceção (rede, permissão, tenant inexistente).
2. Erro é apenas registrado via `console.error('Erro ao carregar dados:', error)`; a página segue para o formulário vazio (`dataPreFilled` permanece `false`), sem nenhuma mensagem visível ao usuário.

### 8c. Validação de passo falha (a partir dos passos 5 ou 8)
1. Qualquer campo obrigatório inválido/vazio.
2. Sistema exibe a mensagem de erro específica correspondente (ex.: "CNPJ inválido", "CEP deve ter 8 dígitos") em um `Alert` destrutivo; usuário permanece no passo atual.

### 8d. Falha ao salvar (a partir do passo 9)
1. `updateTenant` lança exceção.
2. Sistema exibe `err.message` ou "Erro ao processar solicitação" em um `Alert` destrutivo; usuário permanece no passo 2 com os dados preenchidos.

---

## 9. Regras de Negócio Relacionadas

| ID | Regra | Justificativa |
|----|-------|----------------|
| RN-01 | `max_users` é sempre recalculado a partir de `document_type` (`cnpj` → 5, `cpf` → 1) neste UC — a mesma fórmula determinística usada em UC-21 (criação) e UC-22 (edição pelo System Admin). Não há, em nenhum ponto do sistema, um caminho para definir um `max_users` diferente dessa fórmula fixa; portanto, reenviar este formulário não corrompe nenhum valor customizado, pois nenhum valor customizado é possível hoje. | Confirmado por leitura de `handleSubmit` (linha `max_users: formData.document_type === 'cnpj' ? 5 : 1`) e comparação com UC-21/RN-04 e UC-22 (linha 81), que usam a mesma fórmula. |
| RN-02 | A rota não distingue `clinic_admin` de `clinic_user` — ambos podem completar/reeditar os dados cadastrais da clínica livremente, tanto no client (sem checagem de `claims.role`) quanto na regra do Firestore (`allow update: if belongsToTenant(tenantId)`, sem checagem de role). | Confirmado por leitura de `ClinicSetupPage` (nenhuma referência a `claims.role`) e de `firestore.rules` (linha 46, `match /tenants/{tenantId}`). |
| RN-03 | O campo `document_number` é pré-preenchido com fallback para `tenant.cnpj` caso `tenant.document_number` esteja vazio — suporte a tenants antigos criados antes do campo `document_number` existir (nomenclatura legada `cnpj`). | Confirmado por leitura literal: `document_number: tenant.document_number \|\| tenant.cnpj \|\| ''`. |
| RN-04 | **[Achado]** Não existe nenhuma flag (`setup_completed`, `onboarding_completed` ou similar) gravada em `tenants/{tenantId}` ao final deste fluxo. A rota `/clinic/setup` permanece permanentemente acessível e funcional como uma segunda forma (não documentada como tal) de editar os dados cadastrais da própria clínica, mesmo muito tempo depois do onboarding — sem, no entanto, aparecer em nenhum menu de navegação do `ClinicLayout` fora do fluxo inicial. | Confirmado por leitura completa de `ClinicSetupPage`/`updateTenant` (nenhuma escrita de flag de conclusão) e de `ClinicLayout.tsx` (`navLinks` não inclui `/clinic/setup`). |
| RN-05 | Diferente de UC-21 (que grava `document_type`, `document_number`, `cnpj` e outros campos ao criar), este UC nunca grava o campo legado `cnpj` — apenas `document_number`. Um tenant editado por aqui pode ficar com `cnpj` desatualizado enquanto `document_number` reflete o valor real. | Confirmado por leitura do objeto `updateData` em `handleSubmit` — não inclui a chave `cnpj`. |
| RN-06 | A validação do CPF, diferente do CNPJ, verifica apenas a quantidade de dígitos (11), sem checagem de dígitos verificadores — mesma assimetria já observada em outros formulários do sistema. | Confirmado por leitura de `validateStep1` — só chama `validateCNPJ` no branch `cnpj`. |

---

## 10. Requisitos Especiais / Não Funcionais

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | Toda validação é client-side; `updateTenant` não passa por nenhuma API route com revalidação server-side — mesmo padrão já observado em UC-21/UC-22. | Segurança |
| RNF-02 | Multi-tenant: leitura e escrita sempre escopadas por `tenantId` vindo de `claims.tenant_id`; regra do Firestore reforça via `belongsToTenant`. | Multi-tenant |
| RNF-03 | O layout de grupo (`(clinic)/layout.tsx`) oculta o menu lateral (`ClinicLayout`) enquanto `pathname` começa com `/clinic/setup`, dando a esta rota uma aparência de fluxo isolado/full-screen, mesmo sendo permanentemente acessível (RN-04). | Usabilidade |

---

## 11. Frequência de Uso
Tipicamente única, no primeiro acesso de um usuário de uma clínica recém-criada (logo após UC-09 Variante B). Frequência de reacesso posterior (fluxo 7b) não determinável a partir do código, já que a rota não é linkada em nenhum menu.

---

## 12. Casos de Uso Relacionados
- **UC-09 (Aceitar Termos Legais)** — Variante B (onboarding) redireciona para este UC ao concluir o aceite; fluxo sequencial, não `<<include>>`/`<<extend>>` formal.
- **UC-21 (Cadastrar Nova Clínica)** — fonte dos dados pré-preenchidos aqui; usa a mesma fórmula de `max_users` (RN-01).
- **UC-22 (Editar, Desativar e Reativar Clínica)** — caminho equivalente do lado do System Admin para editar os mesmos campos do tenant; usa a mesma fórmula de `max_users`.
- **UC-41 (Editar Perfil e Trocar Senha do Usuário de Clínica)** — este UC não cobre dados do tenant (clínica), apenas do usuário individual; são fluxos e escopos distintos, sem sobreposição.

---

## 13. Referências
- `src/app/(clinic)/clinic/setup/page.tsx` (`ClinicSetupPage`)
- `src/app/(clinic)/layout.tsx` (`isSetupRoute` — oculta menu lateral)
- `src/lib/services/tenantServiceDirect.ts` (`getTenant`, `updateTenant`)
- `src/lib/formatters.ts` (`parseAddressFromString`)
- `src/types/tenant.ts` (`UpdateTenantData`, `validateCNPJ`)
- `firestore.rules` (linhas 41-50 — regra de `tenants/{tenantId}`)
- `src/components/clinic/ClinicInfoTab.tsx` (tela somente-leitura equivalente, dentro de `my-clinic` — confirmado que **não** duplica este fluxo, ver seção 14)

---

## 14. Perguntas em Aberto / Decisões Pendentes

⚠️ Os itens abaixo são achados confirmados por leitura de código que representam decisões de produto pendentes de confirmação — não foram decididos unilateralmente por este documento.

1. **[Dúvida original resolvida por leitura de código, não requer mais confirmação]** A investigação inicial levantou uma possível duplicidade entre `/clinic/setup` e a aba "Informações da Clínica" (`ClinicInfoTab`, dentro de `my-clinic`). Confirmado: `ClinicInfoTab` é **inteiramente somente-leitura** (nenhum campo editável, nenhuma chamada de escrita) — não há sobreposição real de funcionalidade, apenas de dados exibidos. Não existe, hoje, nenhuma tela de edição dos dados da clínica pelo lado do `clinic_admin` fora desta rota de onboarding (RN-04).
2. **[Achado, requer decisão]** RN-04 — a ausência de uma flag de "onboarding concluído" significa que `/clinic/setup` funciona, na prática, como uma segunda tela de edição de dados cadastrais, sempre disponível mas não linkada em nenhum menu. É intencional (edição "escondida" de suporte) ou deveria ser bloqueada após a primeira conclusão?
3. **[Achado, requer decisão]** RN-02 — ausência de distinção entre `clinic_admin` e `clinic_user` nesta tela. Um `clinic_user` completar/reeditar os dados cadastrais da própria clínica é um comportamento aceito, ou deveria ser restrito a `clinic_admin` (como a maioria das outras telas administrativas da clínica)?
4. **[Observação]** RN-05 — o campo legado `cnpj` nunca é atualizado por este UC (só por UC-21), podendo divergir de `document_number` após uma edição aqui. Vale investigar se algum outro ponto do sistema ainda lê `tenant.cnpj` em vez de `document_number` (risco de dado desatualizado sendo exibido)?

---

## 15. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|--------------|
| 1.0 | 15/07/2026 | Guilherme Scandelari | Versão inicial, investigada por leitura completa de `ClinicSetupPage`, `(clinic)/layout.tsx`, `TermsInterceptor.tsx`, `ClinicInfoTab.tsx`, `tenantServiceDirect.ts` e `firestore.rules` (regra de `tenants/{tenantId}`). Resolvida a dúvida de possível duplicidade com `ClinicInfoTab`: confirmado que este é somente-leitura, sem sobreposição funcional real. Identificado achado relevante: não existe flag de "onboarding concluído", tornando a rota permanentemente acessível como uma segunda via de edição de dados cadastrais, sem distinção entre `clinic_admin`/`clinic_user` (RN-02/RN-04). Confirmado que `max_users` é sempre recalculado pela mesma fórmula determinística usada em UC-21/UC-22, sem risco de sobrescrever um valor customizado (pois nenhum valor customizado é possível hoje). |
