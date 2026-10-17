# UC-01: Solicitar Acesso ao Sistema

**Projeto:** Curva Mestra
**Data de Criação:** 13/07/2026
**Autor:** Guilherme Scandelari (via uml-use-case-writer)
**Status:** Implementado
**Módulo/Contexto:** Autenticação / Aquisição de Clientes
**Versão:** 2.4

> Um visitante (especialista HOF que opera uma clínica, ou consultor comercial Rennova) preenche o formulário de registro para solicitar acesso à plataforma Curva Mestra, informando seu perfil, dados de contato e domínio de atuação — sem definir senha nesta etapa. A solicitação fica pendente até ser analisada por um System Admin (ver UC-02 e UC-03) ou, quando vinculada a um código de consultor válido, pelo próprio consultor (ver UC-56); a senha de acesso só é definida depois da aprovação, via link de redefinição enviado por e-mail (UC-02). **Atualização (v2.3 — implementado, release 1.13.0):** o campo opcional do especialista deixou de ser o texto livre "Consultor Rennova de referência" e passou a ser o **código do consultor** (6 dígitos numéricos), validado no frontend (formato) e no backend (formato + existência de um consultor com `status: "active"` em `consultants`, UC-28). Quando válido, a solicitação grava `consultant_code` e `consultant_id`, que alimentam UC-56 (aprovação pelo consultor), UC-57 (lembrete diário) e o vínculo automático da clínica criada ao consultor do código (UC-02/UC-56). Código inexistente ou de consultor inativo é recusado com uma mensagem única, por decisão de segurança (RN-11). **Atualização (v2.4 — FEAT-ajustes-registro-e-busca-consultor):** o especialista passa a informar **CPF ou CNPJ** (obrigatório, com validação de dígito verificador); o volume de procedimentos e a "Região / carteira" do consultor saíram do formulário e da API; o rótulo do conselho virou "Número do conselho"; o formulário da landing passou a usar o mesmo código de 6 dígitos do consultor (Fluxo Alternativo 7c); e a API grava a solicitação pelo Admin SDK, com a criação pelo client bloqueada na rule (RN-12). O documento descreve o código de `gscandelari_setup` (merge `3da2b79`, PR #402), validado em dev-gscandelari.web.app em 16–17/10/2026. A promoção para `develop` está no PR #403 (ver seção 14).

---

## 1. Diagrama UML (Mermaid)

```mermaid
flowchart LR
    Visitante([👤 Visitante])
    Consultants[("🗄️ consultants\n(validação do código do consultor)")]

    subgraph Sistema["Curva Mestra"]
        UC01(("UC-01\nSolicitar Acesso\nao Sistema"))
    end

    Visitante --> UC01
    UC01 -.->|valida código informado\n(UC-28, RN-08)| Consultants
```

---

## 2. Atores

### 2.1 Ator Primário
**Visitante** — pessoa não autenticada que deseja usar a plataforma, se identificando com um dos dois perfis (`role`) suportados pelo formulário: **"especialista"** (profissional/clínica que opera com produtos Rennova em procedimentos de harmonização) ou **"consultor"** (consultor comercial Rennova). Se a solicitação for aprovada (UC-02 ou, quando aplicável, UC-56), este visitante se torna `clinic_admin` do tenant criado — o `role` informado aqui é usado em UC-02 (RN-02) para decidir o limite de usuários do tenant (consultor → 1 usuário; especialista → 5 usuários).

### 2.2 Atores Secundários / Sistemas Externos
Nenhum sistema externo. Toda a validação e persistência ocorre dentro do próprio sistema Curva Mestra (frontend + API route + Firestore). A coleção `consultants` (alimentada por UC-28) é consultada por este fluxo, via Admin SDK, para validar o código de consultor informado (RN-08).

---

## 3. Pré-condições
- O visitante não possui sessão Firebase Auth ativa (ver Fluxo Alternativo 7a).
- O visitante sabe seu nome completo (nome e sobrenome), o número do conselho profissional (especialista) ou o ID Rennova (consultor), e-mail e telefone/WhatsApp.
- **[v2.4]** O especialista sabe também o nome da própria clínica e um **CPF ou CNPJ** válido (com dígito verificador correto). O consultor não informa nome de clínica, região/carteira nem documento.
- Não é necessário definir uma senha neste momento (ver Histórico de Versões, v2.0). O CPF/CNPJ, que tinha deixado de ser coletado na v2.0, voltou a ser coletado só do especialista na v2.4 (RN-03).
- Se o visitante (perfil especialista) optar por informar um código de consultor, esse código precisa ter exatamente 6 dígitos numéricos e corresponder a um consultor com `status: "active"` na coleção `consultants` — caso contrário, o envio é bloqueado (ver Fluxos de Exceção 8a e 8e). O campo continua opcional: deixá-lo vazio não é pré-condição de nada.

---

## 4. Pós-condições

### 4.1 Sucesso (Garantias de Sucesso)
- **[Atualizado em v2.4]** Um documento é criado na coleção `access_requests`, **pelo Admin SDK** (RN-12), com `status: "pendente"`, `role`, o campo legado `type` (derivado de `role`), `full_name`, `email` (minúsculas e trim), `phone`, `council_number`, `consultant_code`, `consultant_id`, `created_at` e `updated_at`. Só quando `role === "especialista"`: `business_name` (nome da clínica), `document_type` (`"cpf"` ou `"cnpj"`) e `document_number` (só dígitos). O registro é montado por lista branca: `volume`, `consultant_reference` e, para o consultor, `business_name`, documento e código nunca são gravados, mesmo que venham no corpo (RN-13).
- O documento sempre contém os campos `consultant_code` e `consultant_id`: quando `role === "especialista"` e um código de consultor válido é informado, `consultant_code` recebe o código informado e `consultant_id` o id do documento correspondente em `consultants`; caso contrário, ambos são gravados como `null`. O antigo campo livre `consultant_reference` não é mais enviado pelo formulário nem gravado pela API (permanece apenas como campo opcional legado na interface `AccessRequest`). Esse vínculo é usado por UC-56 (elegibilidade de aprovação pelo consultor), UC-57 (lembrete diário) e pelo vínculo da clínica criada ao consultor do código na aprovação (UC-02/UC-56).
- Nenhuma senha é solicitada, validada ou armazenada nesta etapa — a definição de senha ocorre somente após a aprovação (UC-02/UC-56), via link de redefinição enviado por e-mail.
- **[CORRIGIDO — commit `1254abb`]** Não é criada uma segunda solicitação pendente para o mesmo e-mail — se já existir uma, a API bloqueia a criação (ver RN-09).
- Em `/register`, o visitante vê a mensagem de sucesso "Solicitação enviada com sucesso!", os campos de texto são limpos e o tipo de documento volta para CNPJ; o perfil selecionado é mantido. Na landing, o formulário é trocado pelo painel "Pedido recebido." com o protocolo da solicitação (Fluxo Alternativo 7c).
- Em `/register`, após 4 segundos, o visitante é redirecionado para `/login`. A landing não redireciona.

### 4.2 Falha (Garantias Mínimas)
- Nenhuma solicitação é criada na coleção `access_requests`.
- Se o System Admin desativou novos registros (`system_settings/global.registration_enabled === false`, UC-35), nenhuma solicitação é criada (ver Fluxo de Exceção 8f, RN-10).
- O formulário permanece preenchido, exibindo o erro específico (não há campos de senha a limpar, pois não existem nesta versão do formulário).
- Se o código de consultor informado for mal formado, não corresponder a nenhum consultor ou corresponder a um consultor inativo, nenhuma solicitação é criada (ver Fluxos de Exceção 8a e 8e).
- **[v2.4]** Se o especialista não informar o CPF/CNPJ, ou informar um tipo inválido, um tamanho errado ou um dígito verificador incorreto, nenhuma solicitação é criada (ver Fluxos de Exceção 8a e 8b, RN-03).

---

## 5. Gatilho (Trigger)
O visitante acessa a rota pública `/register` com a intenção de solicitar acesso à plataforma. **[v2.4]** O mesmo caso de uso pode começar pelo formulário "Solicitar acesso" da landing (`/`, seção `#acesso`), que envia para a mesma API (Fluxo Alternativo 7c).

---

## 6. Fluxo Principal (Basic Flow)

1. Visitante acessa `/register`.
2. Sistema verifica que não há sessão ativa (via `useAuth()`) e exibe o formulário "Solicitar Acesso", com a descrição "Distribuição fechada — cada pedido é avaliado em até 2 dias úteis".
3. Visitante seleciona o perfil (`role`): "Especialista HOF" (Operação clínica) — pré-selecionado por padrão — ou "Consultor Rennova" (Acesso comercial).
4. **[Atualizado em v2.4]** Sistema ajusta os rótulos e placeholders conforme o perfil: "Número do conselho *" (placeholder "Ex.: CRM-SP 142337 ou CRO-RJ 5678") para especialista, ou "ID Rennova *" (placeholder "Ex.: RNV-CR-0427") para consultor. Só para especialista, exibe "Nome da clínica *", "CPF ou CNPJ *" (seletor de tipo CNPJ/CPF, com CNPJ pré-selecionado, e campo `#documentNumber` com máscara) e "Código do consultor Rennova de referência (opcional)" (input `#consultantCode`, com o texto de apoio "Código de 6 dígitos informado pelo seu consultor Rennova."). Para consultor, o telefone ocupa a linha inteira e não há campo de clínica, região/carteira, documento nem código. O campo "Volume de procedimentos por mês" não existe mais.
5. Visitante preenche: nome completo, número do conselho (especialista) ou ID Rennova (consultor), e-mail profissional e telefone/WhatsApp. O especialista preenche também o nome da clínica.
6. (Somente se `role === "especialista"`) Visitante escolhe o tipo de documento (CNPJ ou CPF; trocar o tipo limpa o número, ver 7d) e digita o número, que recebe a máscara `00.000.000/0000-00` ou `000.000.000-00`. Opcionalmente, informa no campo "Código do consultor Rennova de referência" o código de 6 dígitos do seu consultor Rennova — o campo aceita apenas dígitos e no máximo 6 caracteres (caracteres não numéricos são descartados durante a digitação).
7. Visitante clica em "Solicitar acesso à Curva Mestra →".
8. **[Atualizado em v2.4]** Sistema valida no frontend com a mesma função pura usada pela API, `validateAccessRequestInput` (`src/lib/accessRequestPayload.ts`), que devolve a primeira mensagem de erro nesta ordem: perfil; nome completo (`validateFullName`); e-mail (`validateEmail`); telefone (`validatePhone`) — ver RN-04/RN-05/RN-06; número do conselho / ID Rennova (presença, RN-07); e, só para especialista: nome da clínica (presença, RN-07), CPF/CNPJ (presença, tipo, tamanho, dígitos repetidos e dígito verificador por `validateDocument`, RN-03) e, se preenchido, formato do código do consultor (`validateConsultantCode`, RN-08). Os campos obrigatórios também têm o atributo HTML `required`.
9. **[Atualizado em v2.4]** Sistema envia para `POST /api/access-requests`: `role`, `full_name`, `council_number`, `email`, `phone` e, só para especialista, `business_name`, `document_type`, `document_number` (com a máscara) e, quando preenchido, `consultant_code`. `volume` não é mais enviado.
10. **[Atualizado em v2.4]** API lê o corpo JSON (corpo inválido → 400 "Corpo da requisição inválido") e, via **Admin SDK**, o documento `system_settings/global`; se `registration_enabled === false`, retorna 403 e encerra (Fluxo de Exceção 8f, RN-10). Caso contrário (campo `true`, ausente ou documento inexistente), valida o corpo com `validateAccessRequestInput`, a mesma função do passo 8: campos obrigatórios por perfil (`role`, `full_name`, `email`, `phone`, `council_number` para os dois; `business_name`, `document_type` e `document_number` só para especialista), nome, e-mail, telefone, documento (sem a máscara: tipo, tamanho, dígitos repetidos e dígito verificador) e formato do código do consultor. Na primeira falha, retorna 400 com a mensagem (Fluxo de Exceção 8b).
11. A validação do passo 10 também confere que `role` é `"especialista"` ou `"consultor"` e normaliza os dados: textos sem espaços nas pontas, e-mail em minúsculas e `document_number` só com dígitos. Para `role === "consultor"`, `business_name`, documento e código enviados são descartados, sem erro.
12. API valida `full_name` (deve conter nome e sobrenome, 3-100 caracteres, apenas letras/espaços/acentos/hífen), `email` (regex RFC 5322 simplificada, domínio com pelo menos um ponto, até 254 caracteres) e `phone` (10 ou 11 dígitos, DDD entre 11 e 99, não pode ter todos os dígitos iguais).
13. O e-mail normalizado no passo 11 (minúsculas e trim, aqui chamado `normalizedEmail`) é usado na checagem do passo 14 e gravado no passo 17.
14. **[CORRIGIDO, commit `1254abb`]** API consulta, via **Admin SDK** (`adminDb`, de `@/lib/firebase-admin`), a coleção `access_requests` filtrando por `email == normalizedEmail` e `status == "pendente"`; se já existir alguma solicitação pendente com esse e-mail, a API retorna erro 409 e nenhum documento é criado (ver Fluxo de Exceção 8d, e RN-09).
15. Se `role === "especialista"` e um `consultant_code` não vazio foi enviado (formato já validado no passo 10 por `validateConsultantCode`), API consulta, via **Admin SDK**, a coleção `consultants` filtrando por `code == <código informado>` e `status == "active"`; se nenhum documento for encontrado, retorna erro 400 com a mensagem única "Código de consultor inválido ou inativo" (`INVALID_CONSULTANT_CODE_ERROR`) e nenhuma solicitação é criada. Formato inválido já cai no passo 10, com a mesma mensagem (ver Fluxo de Exceção 8e, RN-08 e RN-11). Para `role === "consultor"`, qualquer `consultant_code` enviado é ignorado.
16. API deriva o campo legado `type` (`"clinica"` para especialista, `"autonomo"` para consultor).
17. **[Atualizado em v2.4]** API cria o documento na coleção `access_requests` **pelo Admin SDK** (`adminDb.collection('access_requests').add`, RN-12), montado só com os campos da lista branca (RN-13): `status: "pendente"`, `normalizedEmail` no campo `email`, `consultant_code`/`consultant_id` (preenchidos quando o código foi validado no passo 15; `null` caso contrário), `created_at`/`updated_at` e, só para especialista, `business_name`, `document_type` e `document_number` (só dígitos).
18. API retorna sucesso com o `id` do documento criado e a mensagem "Solicitação enviada com sucesso!".
19. Sistema exibe a mensagem de sucesso, limpa os campos de texto do formulário e volta o tipo de documento para CNPJ.
20. Sistema aguarda 4 segundos e redireciona para `/login`. (Na landing, os passos 19-20 são diferentes — ver 7c.)
21. Caso de uso é concluído com sucesso.

---

## 7. Fluxos Alternativos

### 7a. Usuário já autenticado acessa /register (a partir do passo 1)
1. Sistema detecta sessão ativa via `useAuth()`.
2. Sistema redireciona automaticamente para `/dashboard`, sem exibir o formulário.
3. Caso de uso é encerrado.

### 7b. Troca de perfil durante o preenchimento (a partir do passo 3)
1. Visitante já havia preenchido campos do formulário, possivelmente incluindo os campos exclusivos de especialista (nome da clínica, CPF/CNPJ, código do consultor).
2. Visitante seleciona o outro perfil.
3. Sistema ajusta rótulos/placeholders dos campos compartilhados e oculta os campos exclusivos de especialista (caso o visitante mude para "consultor") — os valores já digitados nos campos compartilhados (nome, conselho/ID Rennova, e-mail, telefone) são mantidos; os campos exclusivos de especialista deixam de ser enviados no `POST` (mesmo que ainda tenham valor no estado interno da tela).
4. Retorna ao passo 5 do fluxo principal.

### 7c. [v2.4] Solicitação pela landing (a partir do passo 1)
1. Visitante preenche o formulário "Solicitar acesso" da landing (`/`, seção `#acesso`, componente `RequestAccess` de `public/landing/sections-cta.jsx`), em vez de `/register`.
2. O formulário tem os mesmos campos e regras de exibição dos passos 3 a 6, com rótulos sem asterisco: "Número do conselho" (mesmo placeholder "Ex.: CRM-SP 142337 ou CRO-RJ 5678") ou "ID Rennova", "Nome da clínica", "CPF ou CNPJ" (seletor CNPJ/CPF, CNPJ como padrão, com máscara) e "Código do consultor Rennova (opcional)" (só dígitos, no máximo 6, com a dica "Código de 6 dígitos informado pelo seu consultor Rennova."). Para consultor, não há região/carteira.
3. No envio, o client confere só o tamanho do documento ("CNPJ deve ter 14 dígitos" / "CPF deve ter 11 dígitos") e, se preenchido, o formato do código (6 dígitos; mensagem "Código de consultor inválido ou inativo"). Os demais campos dependem do atributo HTML `required`. O dígito verificador do documento e as demais regras são validados pela API (passo 10), e a mensagem da API aparece no bloco de erro do formulário.
4. O corpo enviado é o mesmo do passo 9: `consultant_code` (o antigo `consultant_reference` não é mais enviado) e sem `volume`.
5. Com sucesso, o formulário é trocado pelo painel "Pedido recebido.", com o prazo de resposta e o "Protocolo" (id da solicitação). Não há redirecionamento.
6. Os `.jsx` da landing são carregados com versão na URL (`?v=20261016`), para o navegador não reaproveitar um formulário antigo em cache (RNF-05).

### 7d. [v2.4] Troca do tipo de documento (a partir do passo 6)
1. Especialista troca o tipo entre CNPJ e CPF (em `/register` ou na landing).
2. Sistema limpa o número já digitado e passa a aplicar a máscara do novo tipo.
3. Retorna ao passo 6 do fluxo principal.

---

## 8. Fluxos de Exceção

### 8a. Falha de validação no frontend (a partir do passo 8)
1. **[Atualizado em v2.4]** `validateAccessRequestInput` reprova um campo (passo 8): perfil; nome completo, e-mail ou telefone (funções compartilhadas `validateFullName`, `validateEmail`, `validatePhone`, ver RN-04/RN-05/RN-06); número do conselho / ID Rennova vazio; ou, para especialista, nome da clínica vazio, CPF/CNPJ vazio, com tamanho errado, com todos os dígitos iguais ou com dígito verificador incorreto (RN-03), ou código do consultor fora do formato de 6 dígitos numéricos (RN-08).
2. Sistema exibe um alerta vermelho com a mensagem da validação, a mesma que a API devolveria. Exemplos: "Informe nome e sobrenome", "Número do conselho é obrigatório", "ID Rennova é obrigatório", "Nome da clínica é obrigatório", "CPF ou CNPJ é obrigatório", "CPF deve ter 11 dígitos", "CNPJ deve ter 14 dígitos", "CPF inválido: dígito verificador incorreto", "CNPJ inválido: dígito verificador incorreto", "CNPJ inválido: todos os dígitos são iguais" e "Código de consultor inválido ou inativo". As mensagens "Número de conselho (CRM/CRO) é obrigatório" e "Região / carteira é obrigatória" deixaram de existir. Na landing, a validação do client é menor (7c).
3. A requisição não é enviada à API.
4. Campos permanecem preenchidos.
5. Caso de uso retorna ao passo 5.

### 8b. Falha de validação no backend (a partir dos passos 10-12)
1. API detecta corpo JSON inválido ("Corpo da requisição inválido"), campo obrigatório ausente, `role` fora dos valores aceitos, falha na validação de `full_name`, `email` ou `phone`, ou, para especialista, nome da clínica ausente, documento ausente ("CPF ou CNPJ é obrigatório"), `document_type` diferente de `"cpf"` e `"cnpj"` ("Tipo de documento deve ser 'cpf' ou 'cnpj'") ou documento inválido (mensagens de tamanho, dígitos repetidos e dígito verificador, RN-03). **[v2.4]** Pela landing, este é o caminho normal para o dígito verificador do documento, que o client não confere (7c). **[CORRIGIDO, commit `1254abb`]** Como o frontend passou a usar exatamente as mesmas funções compartilhadas para esses três campos (RN-04/RN-05/RN-06), este caminho deixou de ser alcançável por eles através de uma submissão normal via UI; permanece como defesa em profundidade e cobre chamadas diretas à API fora do formulário.
2. API retorna erro 400 com a mensagem específica.
3. Sistema exibe o erro em alerta vermelho.
4. Caso de uso retorna ao passo 5.

### 8c. Erro no servidor (a partir do passo 17)
1. Firestore está indisponível ou ocorre erro inesperado ao criar o documento.
2. API retorna erro 500 com `{ error: string }`.
3. Sistema exibe o erro retornado ou "Erro ao processar solicitação".
4. Caso de uso retorna ao passo 5.

### 8d. [CORRIGIDO — commit `1254abb`] Solicitação pendente já existe para o mesmo e-mail (a partir do passo 14)
1. API encontra, via Admin SDK, uma solicitação em `access_requests` com o mesmo `email` (normalizado) e `status: "pendente"`.
2. API retorna erro 409 com `{ error: "Já existe uma solicitação pendente para este e-mail" }`; nenhum documento é criado.
3. Sistema exibe o erro retornado em alerta vermelho.
4. Caso de uso retorna ao passo 5.

**Comportamento anterior (histórico, antes da correção):** não havia nenhuma checagem de duplicidade — o mesmo e-mail podia gerar múltiplas solicitações com `status: "pendente"` simultâneas (ver RN-09).

### 8e. Código de consultor inválido, inexistente ou inativo (a partir do passo 15)
1. O `consultant_code` enviado (especialista) tem formato inválido (ex.: chamada direta à API, fora do formulário), não corresponde a nenhum documento em `consultants`, ou corresponde a um consultor com `status` diferente de `"active"` (ex.: suspenso, UC-29).
2. API retorna erro 400 com `{ error: "Código de consultor inválido ou inativo" }` — **a mesma mensagem nos três casos**, sem distinguir código inexistente de consultor inativo (RN-11); nenhuma solicitação é criada.
3. Sistema exibe o erro retornado em alerta vermelho.
4. Caso de uso retorna ao passo 5.

### 8f. Novos registros desativados pelo System Admin (a partir do passo 10)
1. `system_settings/global.registration_enabled` está `false` (switch "Permitir novos registros" desligado em UC-35).
2. API retorna erro 403 com `{ error: "O cadastro de novas solicitações está temporariamente desativado." }`, antes de qualquer validação de campos; nenhum documento é criado.
3. Sistema exibe o erro retornado em alerta vermelho. O formulário `/register` continua sendo exibido normalmente — a tela não consulta `registration_enabled`; o bloqueio só ocorre na submissão.
4. Caso de uso retorna ao passo 5.

---

## 9. Regras de Negócio Relacionadas

| ID | Regra | Justificativa |
|----|-------|----------------|
| RN-01 | Toda solicitação nasce com `status: "pendente"` — não existe auto-aprovação. | Controle de qualidade e prevenção de fraudes; toda entrada passa por análise humana (UC-02/UC-03), ou por um Consultor Rennova ativo, conforme as regras de elegibilidade de UC-56. |
| RN-02 | O perfil (`role`) é obrigatoriamente `"especialista"` ou `"consultor"` — determina os rótulos e campos da tela ("Número do conselho" vs. "ID Rennova"; nome da clínica e CPF/CNPJ só para especialista, desde a v2.4) e, na aprovação (UC-02, RN-02), o limite de usuários do tenant (consultor → 1 usuário; especialista → 5 usuários). | Modelo de negócio com dois perfis distintos de acesso ao ecossistema Rennova (operação clínica vs. atuação comercial). |
| RN-03 | **[Atualizada em v2.4 — FEAT-ajustes-registro-e-busca-consultor]** O sistema não coleta senha nesta etapa: a senha só é definida após a aprovação (UC-02/UC-56), pelo link de redefinição enviado por e-mail. O **CPF ou CNPJ** voltou a ser coletado (tinha saído na v2.0), **só do especialista** e obrigatório: seletor de tipo (`document_type` `"cpf"` ou `"cnpj"`, CNPJ como padrão), máscara, e validação de tamanho (11 ou 14 dígitos), de todos os dígitos iguais e de dígito verificador por `validateDocument` (`serverValidations.ts`), no client de `/register` e na API. A landing confere só o tamanho; o dígito verificador vem da API (7c). O tipo precisa bater com o tamanho ("CPF deve ter 11 dígitos" / "CNPJ deve ter 14 dígitos"). A API grava `document_number` só com dígitos. CNPJ alfanumérico não é aceito (débito técnico registrado na FEAT, decisão D2-A). O consultor não informa documento; se o corpo trouxer, é descartado. A duplicidade de documento **não** é checada aqui, só na aprovação (UC-02/RN-08, UC-56). | Adia a criação de credenciais para quando a conta já foi aprovada. O documento dá identidade à clínica desde a aprovação (o tenant nasce com ele, UC-02) e permite que o consultor a encontre pela busca por documento (UC-24/UC-25). Checar a duplicidade só na aprovação evita que esta rota pública revele se um CPF/CNPJ já é cliente. |
| RN-04 | **[CORRIGIDO — commit `1254abb`]** `full_name` deve conter nome e sobrenome (mínimo 2 palavras), entre 3 e 100 caracteres, usando apenas letras, espaços, acentos e hífen — validado por `validateFullName` (`@/lib/validations/serverValidations`), agora chamada tanto pelo backend quanto pelo frontend (`register/page.tsx`, que passou a importar e usar diretamente essa função em vez de uma checagem local de `length >= 3`). | A divergência entre a validação de frontend (antes mais permissiva) e a de backend (mais rigorosa) foi eliminada — um nome de uma única palavra agora é rejeitado já na tela, antes de qualquer chamada à API (comportamento anterior descrito no histórico do Fluxo de Exceção 8b). |
| RN-05 | **[CORRIGIDO — commit `1254abb`]** `email` é normalizado para lowercase e trim antes de ser salvo (reaproveitando a mesma variável `normalizedEmail` usada também na checagem de duplicidade, RN-09); a validação (regex RFC 5322 simplificada, domínio obrigatoriamente com um ponto, até 254 caracteres) é feita por `validateEmail` (`@/lib/validations/serverValidations`), agora chamada tanto pelo backend quanto pelo frontend — que deixou de aceitar qualquer valor contendo apenas "@". | Evita duplicidade por diferença de caixa e garante um formato de e-mail minimamente válido já na tela, antes da chamada à API — elimina a divergência frontend/backend antes documentada aqui e na RN-04. |
| RN-06 | **[CORRIGIDO — commit `1254abb`]** `phone` deve ter 10 ou 11 dígitos, DDD entre 11 e 99, e não pode ter todos os dígitos iguais — validado por `validatePhone` (`@/lib/validations/serverValidations`), agora chamada tanto pelo backend quanto pelo frontend, que deixou de aceitar qualquer valor com 10+ dígitos sem checar DDD ou dígitos repetidos. | Elimina a divergência frontend/backend das RN-04/RN-05 — a validação completa agora ocorre já na tela, antes de qualquer chamada à API. |
| RN-07 | **[Atualizada em v2.4]** `council_number` (número do conselho do especialista ou ID Rennova do consultor) é obrigatório para os dois perfis, e `business_name` (nome da clínica) só para o especialista. O client de `/register` e a API verificam só a presença (texto não vazio após trim), com a mesma função `validateAccessRequestInput`, e mensagens próprias por perfil: "Número do conselho é obrigatório", "ID Rennova é obrigatório" e "Nome da clínica é obrigatório". O mínimo de 3 caracteres que o frontend exigia até a v2.3 deixou de existir. Nenhum formato de conselho é validado. A "Região / carteira" do consultor saiu do formulário e da API: o consultor não informa `business_name`, e um valor enviado é descartado. | Não há regra de formato definida para o número do conselho (são vários conselhos na HOF). A região do consultor não era usada em regra nenhuma e virava o nome do tenant na aprovação; hoje o nome do tenant de consultor vem do `full_name` (UC-02/RN-09). |
| RN-08 | **[IMPLEMENTADO — v2.3; substitui o comportamento anterior deste item]** Até a v2.1.1, o campo "Consultor Rennova de referência" (`consultant_reference`) era texto livre, sem validação. Hoje, o campo opcional do especialista é o **código do consultor** (input `#consultantCode`): exatamente **6 dígitos numéricos** (mesmo formato gerado em UC-28), validado no frontend e no backend pela mesma função pura `validateConsultantCode` (`src/lib/validations/serverValidations.ts`). Quando preenchido, o backend (`POST /api/access-requests`) consulta via Admin SDK a coleção `consultants` por `code` + `status == "active"`; se encontrar, grava na solicitação `consultant_code` (o código) e `consultant_id` (id do documento do consultor); se não encontrar, retorna 400 (Fluxo de Exceção 8e, RN-11). Sem código, a solicitação é gravada com `consultant_code: null` e `consultant_id: null`. O campo só é considerado quando `role === "especialista"`. **[v2.4]** O formato passou a ser validado dentro de `validateAccessRequestInput` (passo 10) e a existência logo depois (passo 15). A landing também envia `consultant_code` e recebe a mesma validação da API (7c). | Vincula a solicitação a um consultor real e ativo (não apenas um nome digitado livremente), habilitando a exclusividade de aprovação de UC-56, o lembrete diário de UC-57 e o vínculo da clínica criada ao consultor do código (UC-02/UC-56); evita que códigos inexistentes ou de consultores inativos sejam aceitos silenciosamente. |
| RN-09 | **[CORRIGIDO — commit `1254abb`]** Antes, não havia nenhuma checagem de duplicidade de solicitação pendente para o mesmo e-mail — um mesmo e-mail podia gerar múltiplas solicitações pendentes simultâneas. Agora, antes da gravação, `POST /api/access-requests` consulta a coleção `access_requests` via **Admin SDK** (`adminDb`, de `@/lib/firebase-admin`) — desde a v2.4, a rota inteira usa o Admin SDK (RN-12) — filtrando por `email == normalizedEmail` e `status == "pendente"`; se encontrar alguma, retorna 409 com `{ error: "Já existe uma solicitação pendente para este e-mail" }` e não cria o documento. O uso do Admin SDK é necessário porque a regra do Firestore restringe leitura de `access_requests` a `system_admin`, e esta rota é pública/não-autenticada. | Prevenção de solicitações duplicadas para o mesmo e-mail, mantendo a rota funcional mesmo sendo pública (o Admin SDK bypassa a regra de leitura restrita a `system_admin`). Uma verificação equivalente já existia apenas em uma função de serviço (`accessRequestService.createAccessRequest`), que não é chamada por nenhuma tela — código morto (ver seção 14). |
| RN-10 | **[CORRIGIDO — commit `66c75fa`, leitura migrada para Admin SDK em `66689fe`]** `POST /api/access-requests` lê, como primeira verificação e via Admin SDK, o campo `registration_enabled` do documento `system_settings/global` (switch "Permitir novos registros", UC-35). Se for `false`, recusa a solicitação com **403** e a mensagem "O cadastro de novas solicitações está temporariamente desativado.", sem criar documento (Fluxo de Exceção 8f). Campo `true`, ausente ou documento inexistente → o fluxo segue normalmente. A tela `/register` **não** consulta o campo: o formulário continua visível e o bloqueio só aparece ao enviar. Até a v2.2, esta RN afirmava que nenhuma das duas camadas verificava o campo — desatualizada desde o commit `66c75fa`. | Permite ao System Admin fechar a entrada de novas solicitações (UC-35). A checagem fica na API (fonte da verdade), cobrindo também chamadas diretas fora do formulário. Leitura via Admin SDK porque a rota é pública e a regra do Firestore de `system_settings` exige usuário autenticado (UC-01-Q1). |
| RN-11 | **[Decisão de segurança deliberada, confirmada pelo PO]** Código de consultor com formato inválido, código inexistente e código de consultor inativo recebem **exatamente a mesma resposta**: HTTP 400 com a mensagem "Código de consultor inválido ou inativo" (constante `INVALID_CONSULTANT_CODE_ERROR`, em `serverValidations.ts`). A rota nunca informa se um código bem-formado existe. | `POST /api/access-requests` é uma rota **pública** (não autenticada): se a resposta diferenciasse "código inexistente" de "consultor inativo", qualquer pessoa poderia enumerar quais códigos de 6 dígitos existem no sistema. Contraste deliberado com UC-54 (rota autenticada de `clinic_admin`), onde o consultor inativo é informado explicitamente (409 `consultant_inactive`) para orientar a clínica. |
| RN-12 | **[Nova em v2.4 — decisão D7-A da FEAT]** A solicitação é gravada **só pelo servidor**: `POST /api/access-requests` usa o Admin SDK (`adminDb.collection('access_requests').add`), e a rule de `access_requests` passou a `allow create: if false`. Uma gravação direta pelo client SDK é negada (`PERMISSION_DENIED`), o que foi validado em dev-gscandelari.web.app. | Antes, a rule era `allow create: if true` e a API gravava pelo client SDK: qualquer visitante podia criar uma solicitação direto no Firestore, sem passar pela validação da API (documento obrigatório, código do consultor etc.). |
| RN-13 | **[Nova em v2.4]** O registro é montado por **lista branca**, só com os campos normalizados por `validateAccessRequestInput` (passo 17). O **volume de procedimentos** saiu dos dois formulários e da API: `volume` não é enviado nem gravado, mesmo que venha no corpo (ex.: formulário antigo em cache). O mesmo vale para `consultant_reference` e, no perfil consultor, para `business_name`, documento e código. Solicitações antigas que têm `volume` ou região não são alteradas. | O volume era gravado sem uso nenhum. A lista branca impede que campos fora do contrato sejam gravados e mantém a API compatível com formulários em cache, sem erro. |

---

## 10. Requisitos Especiais / Não Funcionais

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | Nenhum `tenant_id` existe neste momento — a solicitação é pré-tenant; não há nenhuma tentativa de vincular a solicitação a um tenant já existente nesta versão do fluxo (ver seção 14 sobre a função de serviço não utilizada que fazia esse tipo de vínculo). O tenant só é criado na aprovação (UC-02/UC-56). | Multi-tenant |
| RNF-02 | **[CORRIGIDO — commit `1254abb`]** A validação client-side deixou de ser mais simples que a validação server-side para `full_name`, `email` e `phone` — ambas agora usam exatamente as mesmas funções compartilhadas (`validateFullName`, `validateEmail`, `validatePhone`, ver RN-04 a RN-06). A dupla validação (frontend + backend) permanece, mas agora é simétrica para esses três campos. **[v2.4]** Desde a v2.4, toda a validação do formulário `/register` (inclusive conselho, nome da clínica e documento) usa a mesma função da API, `validateAccessRequestInput` (RN-03, RN-07). A landing valida no client só o tamanho do documento e o formato do código (7c). | Segurança / Usabilidade |
| RNF-03 | Máscara de telefone aplicada em tempo real durante a digitação. | Usabilidade |
| RNF-04 | A validação do código de consultor (RN-08) faz uma leitura adicional no Firestore (coleção `consultants`, filtro `code` + `status`, `limit(1)`) a cada submissão que informe o campo — via Admin SDK (`adminDb`), mesmo padrão já usado em RN-09/RN-10, já que esta rota é pública e não poderia ler `consultants` pelo client SDK. | Performance / Segurança |
| RNF-05 | **[Nova em v2.4]** As tags `<script>` dos `.jsx` da landing têm versão na URL (`?v=20261016`), em `src/app/route.ts` (HTML servido em `/`, com `force-dynamic`) e na cópia de referência `public/landing/index.html`. Assim o navegador não usa um `sections-cta.jsx` antigo, sem o campo de documento, que receberia 400 "CPF ou CNPJ é obrigatório". | Compatibilidade / Deploy |
| RNF-06 | **[Nova em v2.4]** `/register` usa um card `max-w-2xl` (antes `max-w-lg`), com grades `grid-cols-1 sm:grid-cols-2` (uma coluna no celular); o seletor de perfil continua com duas colunas. O layout de auth (`src/app/(auth)/layout.tsx`) mantém `max-w-md` e só alarga para `max-w-2xl` as páginas cujo card tem o atributo `data-auth-wide` (hoje, só `/register`). | Usabilidade |
| RNF-07 | **[Nova em v2.4]** A rota não registra em log os dados pessoais da solicitação (documento, nome, e-mail): o log de sucesso tem só o id, e o `console.error` registra só o erro. | Privacidade (LGPD) |

---

## 11. Frequência de Uso
Ocasional — ocorre a cada novo interessado (especialista HOF ou consultor Rennova) na plataforma. É um evento de aquisição, não uma ação de uso recorrente do sistema.

---

## 12. Casos de Uso Relacionados
- **UC-02 (Aprovar Solicitação de Acesso)** e **UC-03 (Rejeitar Solicitação de Acesso)** dependem de uma solicitação criada por este caso de uso. Não há relação formal `<<include>>`/`<<extend>>` — trata-se de uma dependência sequencial: a solicitação pendente criada aqui é pré-condição de UC-02 e UC-03. O `role` definido neste UC alimenta diretamente a regra de limite de usuários aplicada em UC-02 (RN-02).
- **UC-28 (Cadastrar Consultor)** — fonte dos códigos de 6 dígitos que este UC valida (RN-08); um código só é aceito aqui se corresponder a um consultor cadastrado por aquele UC e com `status: "active"`.
- **UC-56 (Consultor Aprova Solicitação de Acesso Vinculada ao Seu Código)** — consome o `consultant_id` gravado por este UC (RN-08) para decidir quais consultores, além do System Admin, podem aprovar a solicitação, e durante qual janela de tempo (48h de exclusividade).
- **UC-02 (Aprovar Solicitação de Acesso) / UC-56** — na aprovação, por qualquer um dos dois caminhos, a clínica criada fica vinculada ao consultor do `consultant_id` gravado aqui, desde que ele ainda esteja ativo naquele momento (ver UC-02/RN-07 e UC-56/RN-10). Sem código informado aqui, a clínica nasce sem consultor.
- **UC-57 (Notificar Consultor sobre Solicitações Pendentes)** — usa o `consultant_id` gravado aqui para decidir qual consultor recebe o lembrete diário de cada solicitação pendente.
- **[v2.4] UC-02 / UC-56 (aprovação)** — o CPF/CNPJ gravado aqui vai para o tenant criado na aprovação; a aprovação recusa com 409 um documento já usado por outra clínica (UC-02/RN-08). O nome do tenant de uma solicitação de consultor, que não tem mais `business_name`, vem do `full_name` (UC-02/RN-09).
- **[v2.4] UC-24 / UC-25 (Buscar Clínicas)** — com o documento no tenant, o consultor encontra a clínica pela busca por documento; a busca também aceita o nome da clínica ou do especialista.
- **UC-35 (Editar Configurações Globais do Sistema)** — o switch "Permitir novos registros" (`registration_enabled`) daquela tela controla este fluxo: com o campo `false`, `POST /api/access-requests` recusa novas solicitações com 403 (RN-10, Fluxo de Exceção 8f). A tela `/register` em si não lê o campo.

---

## 13. Referências
- `src/app/(auth)/register/page.tsx`
- `src/app/(auth)/layout.tsx` (container `max-w-md`, alargado para `max-w-2xl` em páginas com `data-auth-wide`, RNF-06)
- `public/landing/sections-cta.jsx` (componente `RequestAccess`, formulário da landing, 7c); `src/app/route.ts` e `public/landing/index.html` (versão `?v=` nos `<script>`, RNF-05)
- `src/app/api/access-requests/route.ts`
- `src/lib/accessRequestPayload.ts` (`validateAccessRequestInput` e mensagens, usados pela API e por `/register`)
- `firestore.rules` (`access_requests`: `allow create: if false`, RN-12) e `tests/rules/firestore-tenant-subcollections.test.ts` (`describe('access_requests')`)
- `src/__tests__/accessRequestPayload.test.ts` e `src/__tests__/accessRequestsRoute.test.ts`
- `ONLY_FOR_DEVS/TASK_COMPLETED/FEAT-ajustes-registro-e-busca-consultor.md` (v1.2)
- `src/lib/validations/serverValidations.ts` (funções usadas tanto pelo backend quanto, desde o commit `1254abb`, pelo frontend — `register/page.tsx` — deste fluxo: `validateFullName`, `validateEmail`, `validatePhone` e, desde a v2.3, `validateConsultantCode` e a constante `INVALID_CONSULTANT_CODE_ERROR` (RN-08/RN-11); desde a v2.4, também `validateDocument` / `validateCPF` / `validateCNPJ`, chamadas por `validateAccessRequestInput`; `validatePassword` e `validateCEP` não são usadas por este UC)
- `src/lib/firebase-admin.ts` (`adminDb`, usado desde o commit `1254abb` na checagem de duplicidade de solicitação pendente, RN-09, e, desde o commit `66689fe`, também na leitura de `system_settings/global` — gate de `registration_enabled`, RN-10 — que antes usava o client SDK e era negada por permissão nesta rota pública; ver seção 14, item UC-01-Q1)
- `src/types/index.ts` (interface `AccessRequest`, tipos `AccessRequestRole`, `AccessRequestType`, `AccessRequestStatus`)
- Coleção `consultants` (`src/types/index.ts`, interface `Consultant`; códigos gerados por `POST /api/consultants`, UC-28) — consultada via Admin SDK pela validação do código (RN-08). A interface `AccessRequest` ganhou `consultant_code` e `consultant_id`.
- `tests/e2e/UC-01-solicitar-acesso-ao-sistema.spec.ts` — caderno E2E, incluindo os casos do código de consultor (formato inválido no frontend, código inexistente, consultor inativo e formato inválido enviado direto à API — todos 400, sem criar documento). Atualizado na FEAT da v2.4 (commit `0500438`) para o campo de documento e sem o volume.
- `project_doc/auth/register-page-documentation.md` — **desatualizado** (descreve a versão anterior do formulário, com CPF/CNPJ e senha; ver seção 14)

---

## 14. Perguntas em Aberto / Decisões Pendentes

**[RESOLVIDO em v2.3 — implementado, release 1.13.0]** A transformação do campo "Consultor Rennova de referência" em código de consultor validado (RN-08), antes registrada aqui como pendência de implementação, foi implementada: campos `consultant_code`/`consultant_id`, validação de formato por `validateConsultantCode` (frontend e backend) e verificação de existência de consultor ativo inline na própria rota `POST /api/access-requests`, via Admin SDK. A mensagem única para código inválido/inexistente/inativo foi decidida pelo PO como medida anti-enumeração (RN-11).

**[v2.4 — pendência operacional, a confirmar]** A rule de `access_requests` com `allow create: if false` (RN-12) só pode ser publicada em produção **depois** que o hosting com a API nova (Admin SDK) estiver no ar; se entrar antes, a API antiga, que grava pelo client SDK, recebe `PERMISSION_DENIED` e todas as solicitações falham (FEAT, Seção 5.6). A publicação é manual, pelo usuário. Este documento não confirma se ela já foi feita em produção; até lá, a criação direta pelo client continua aberta lá.

**[RESOLVIDO em v2.4 — FEAT-ajustes-registro-e-busca-consultor, opção (d) de UC-02-Q1]** A pendência do parágrafo seguinte foi resolvida reintroduzindo a coleta do CPF/CNPJ neste UC, só para o especialista (RN-03). UC-02 v2.5 descreve o tenant nascendo com o documento da solicitação. O texto abaixo fica como histórico.

**[Pendência para próxima rodada, confirmada pelo usuário]** UC-02 (Aprovar Solicitação de Acesso) referencia, em suas pré/pós-condições e no código de `approve/route.ts`, os campos `document_type` e `address` da solicitação (`document_type: request.document_type ?? 'cnpj'`, `document_number: request.document_number ?? ''`) — mas o formulário atual de `/register` (este UC) não coleta mais nenhum desses campos. Na prática, todo tenant criado hoje via aprovação recebe `document_type: "cnpj"` (fallback fixo do código) e `document_number: ""` (vazio), independentemente do perfil real do solicitante (especialista ou consultor). UC-02 precisará de uma revisão própria para refletir essa realidade — não foi reescrito nesta rodada, por decisão explícita do usuário (fica para uma próxima rodada dedicada a UC-02).

**[Registrado para conhecimento, fora do escopo deste UC]** `project_doc/auth/register-page-documentation.md` (datado de 07/02/2026) descreve a versão anterior do formulário (CPF/CNPJ + senha) e está desatualizado desde o commit `6402647` ("unify access request form — remove password, align /register with landing", 29/05/2026). Não foi corrigido nesta rodada.

**[Registrado para conhecimento — relevante para UC-05, pausado]** A função `accessRequestService.createAccessRequest()` (que faria correspondência por CPF/CNPJ com um tenant existente, checaria vagas disponíveis e duplicidade de solicitação pendente) é código morto — não é chamada por nenhuma página hoje. Isso é relevante para o UC-05 (Aprovar Solicitação de Acesso pela Própria Clínica), atualmente pausado até esta revisão de UC-01 ser concluída.

**[RN-10 — RESOLVIDO em v2.3, documentação alinhada ao código]** A pendência sobre `registration_enabled` não bloquear este fluxo estava desatualizada: o gate existe em `POST /api/access-requests` desde o commit `66c75fa` (403 quando `false`), com a leitura migrada para Admin SDK em `66689fe` (UC-01-Q1). Só a API bloqueia; a tela `/register` não consulta o campo — registrado como comportamento as-is, sem pendência de produto aberta.

**[UC-01-Q1 — RESOLVIDO — commit `66689fe`]** Achado registrado na v2.1 deste documento (durante a investigação da correção de RN-09, commit `1254abb`): `POST /api/access-requests` (linha ~50, já antes daquelas mudanças) fazia uma leitura `getDoc(doc(db, 'system_settings', 'global'))` usando o **client SDK** do Firebase, nesta mesma rota pública/não-autenticada. A regra do Firestore para `system_settings` exige `isAuthenticated()` (`request.auth != null && request.auth.token.active == true`), que nega leitura para qualquer visitante não autenticado — derrubando toda a função no `catch` e retornando 500 para qualquer tentativa de enviar uma solicitação de acesso. Essa checagem havia sido adicionada em um commit anterior desta mesma sessão de trabalho (`66c75fa`, batch de UC-21/UC-28/UC-35, Alta severidade) para implementar o gate de `registration_enabled` (RN-10). **Correção:** commit `66689fe` migrou a leitura para o **Admin SDK** (`adminDb.doc('system_settings/global').get()`, de `@/lib/firebase-admin`), que bypassa as regras de segurança — mesmo padrão já usado no fix de RN-09 nesta mesma rota. **Validação:** confirmada por **análise estática de alta confiança** das regras do Firestore, e não por teste em emulador (indisponível neste ambiente de trabalho) — a semântica de `isAuthenticated()` é inequívoca (nega qualquer requisição sem `request.auth`), sem ambiguidade de interpretação que justificasse a necessidade de um teste em runtime para confirmar a causa raiz ou a correção. Ver `src/app/api/access-requests/route.ts` (linhas 48-59) e Referências (seção 13).

Nenhuma pendência aberta quanto à modelagem dos dois perfis em si: o usuário confirmou que "especialista" e "consultor" devem ser tratados como variação de dado dentro deste mesmo UC, sem fluxo alternativo dedicado — mesmo padrão adotado na versão anterior deste documento para os antigos tipos de conta (CNPJ/CPF).

---

## 15. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|--------------|
| 1.0 | 13/07/2026 | Guilherme Scandelari | Versão inicial, mapeada a partir do código atual e de `project_doc/auth/register-page-documentation.md` |
| 1.1 | 13/07/2026 | Guilherme Scandelari | Registrada a remoção definitiva do fluxo `/activate` (código de 8 dígitos) do código-fonte (PR #178, branch `chore/remove-obsolete-activate-flow`) — deixou de ser "fora de escopo" e passou a ser "não existe mais"; documentado o único caminho de onboarding válido hoje (registro → aprovação em UC-02 → definição de senha via link → login). Corrigida a RN-04: confirmado, por leitura do código (`approve/route.ts`), que a senha da solicitação não é usada para criar o usuário Auth em UC-02 (mecanismo real: senha temporária + link de redefinição). |
| 1.1.1 | 13/07/2026 | Guilherme Scandelari | Correção estrutural: removida da seção 14 a menção detalhada à remoção do fluxo `/activate` — não se tratava de uma pergunta em aberto nem de uma decisão pendente, e sim de um fato já consumado (PR #178 mergeado), incompatível com o propósito da seção 14. O registro do fato permanece de forma enxuta apenas no Histórico de Versões (linha v1.1, acima). Nenhum conteúdo factual novo foi adicionado nesta revisão. |
| 2.0 | 13/07/2026 | Guilherme Scandelari | **Reescrita completa** do documento após confirmar, por leitura direta de `register/page.tsx` e `api/access-requests/route.ts`, que o formulário real mudou radicalmente desde a versão anterior — commit `6402647` ("unify access request form — remove password, align /register with landing", 29/05/2026), anterior à própria data de criação registrada deste UC. O formulário não coleta mais CPF/CNPJ nem senha; passou a coletar um `role` ("especialista"/"consultor"), `full_name`, `council_number`, `email`, `phone`, `business_name` e, opcionalmente para especialistas, `consultant_reference`/`volume`. Todas as seções foram reescritas: Atores (perfil ao invés de tipo de documento), Pré/Pós-condições, Fluxo Principal, Fluxos Alternativos/Exceção, e Regras de Negócio (RN-01 a RN-09, incluindo divergências reais confirmadas entre validação de frontend e de backend). Registradas em Perguntas em Aberto as pendências de revisão de UC-02 (uso de `document_type`/`address` que hoje vêm sempre em fallback/vazio) e do UC-05 (pausado até esta correção). |
| 2.0.1 | 15/07/2026 | Guilherme Scandelari | Correção pontual: adicionada RN-10 e nota em "Casos de Uso Relacionados" documentando o achado crítico confirmado em UC-35 (Editar Configurações Globais do Sistema) — o campo `registration_enabled` daquela tela administrativa não é verificado por este fluxo, apesar de sua descrição sugerir esse controle. Nenhuma mudança de escopo ou reestruturação; apenas referência cruzada a um achado já investigado e documentado em UC-35. |
| 2.1 | 06/08/2026 | Guilherme Scandelari (via uml-use-case-writer) | **Correção de bugs (commit `1254abb`)**: (1) RN-09 corrigida — `POST /api/access-requests` passou a checar, via Admin SDK, se já existe uma solicitação `pendente` para o mesmo e-mail antes de criar uma nova, retornando 409 em caso positivo (novo Fluxo de Exceção 8d; Fluxo Principal ganhou o passo 14); (2) RN-04, RN-05 e RN-06 corrigidas — `register/page.tsx` passou a importar e usar as mesmas funções compartilhadas do backend (`validateFullName`, `validateEmail`, `validatePhone`), eliminando a divergência entre validação de frontend (antes mais permissiva) e backend; RNF-02 atualizada de acordo. Fluxo Principal (passo 8), Fluxos de Exceção 8a/8b e Referências (seção 13) atualizados. Adicionado, na seção 14, um novo achado não verificado (descoberto durante a investigação de RN-09): a mesma rota `POST /api/access-requests` lê `system_settings/global` via client SDK, o que pode estar sendo bloqueado pela regra do Firestore para visitantes não autenticados — não confirmado em runtime, registrado para investigação dedicada. |
| 2.1.1 | 06/08/2026 | Guilherme Scandelari (via uml-use-case-writer) | Correção pontual: item **UC-01-Q1** (seção 14) atualizado de "não verificado, Aberto" para **[RESOLVIDO — commit `66689fe`]** — a leitura de `system_settings/global` em `POST /api/access-requests` foi migrada do client SDK para o Admin SDK (`adminDb.doc('system_settings/global').get()`), eliminando o bloqueio por permissão que a regra `isAuthenticated()` do Firestore impunha a essa rota pública/não-autenticada. Validação feita por análise estática das regras do Firestore (semântica inequívoca de `isAuthenticated()`), não por teste em emulador (indisponível no ambiente de trabalho). Referência a `firebase-admin.ts` (seção 13) atualizada para refletir esse segundo uso do `adminDb` nesta rota. Nenhuma mudança de escopo ou reestruturação. |
| 2.2 | 08/10/2026 | Guilherme Scandelari (via uml-use-case-writer) | **Mudança de produto planejada, ainda não implementada.** Documentado, com a marcação `[PLANEJADO]`, que o campo "Consultor Rennova de referência" deixará de ser texto livre e passará a ser um código de consultor de 6 dígitos, validado contra a coleção `consultants` (UC-28); quando válido, a solicitação passará a gravar `consultant_code`/`consultant_id`, habilitando a nova regra de aprovação exclusiva por consultor descrita em UC-56. RN-08 reescrita; Pré-condições, Pós-condições, Fluxo Principal (passos 6, 9, 15, 17), novo Fluxo de Exceção 8e, RNF-04, Referências e Casos de Uso Relacionados (novas entradas UC-28/UC-56) atualizados. `Status` alterado de "Aprovado" para "Em Revisão" enquanto a implementação não ocorre. Registrada, na seção 14, a ressalva de que os nomes de campo/mecanismo de validação sugeridos são propostas de design, não decisões de produto fechadas. |
| 2.3 | 08/10/2026 | Guilherme Scandelari (via uml-use-case-writer) | **Mudança de produto implementada (release 1.13.0).** Removidas todas as marcações `[PLANEJADO]`: o campo opcional do especialista virou "código do consultor" de 6 dígitos numéricos (input `#consultantCode`), validado no frontend e no backend por `validateConsultantCode`; `POST /api/access-requests` verifica, via Admin SDK, a existência de consultor com `status: "active"` e grava `consultant_code`/`consultant_id` (ou `null` sem código). RN-08 reescrita como implementada; nova **RN-11** registra a decisão de segurança da mensagem única "Código de consultor inválido ou inativo" (`INVALID_CONSULTANT_CODE_ERROR`) para código mal formado, inexistente ou inativo, evitando a enumeração de códigos por uma rota pública. Resumo, diagrama, Atores secundários, Pré/Pós-condições, Fluxo Principal (passos 4, 6, 8, 9, 15, 17), Fluxos de Exceção 8a/8e, RN-01, RNF-04, Casos de Uso Relacionados (UC-02/UC-56 — vínculo da clínica ao consultor do código; UC-57), Referências (novo caderno E2E) e seção 14 (pendência marcada como resolvida) atualizados. **Correção de RN-10 (mesma rodada):** a RN dizia que `registration_enabled` não era verificado, mas `POST /api/access-requests` recusa com 403 ("O cadastro de novas solicitações está temporariamente desativado.") quando o campo é `false` desde o commit `66c75fa`. RN-10 reescrita; novo Fluxo de Exceção 8f; passo 10, Pós-condição 4.2, UC-35 em Casos de Uso Relacionados e o item RN-10 da seção 14 atualizados. **Status alterado de "Em Revisão" para "Implementado".** |
| 2.4 | 17/10/2026 | Guilherme Scandelari (via uml-use-case-writer) | **Atualização as-is — FEAT-ajustes-registro-e-busca-consultor** (`ONLY_FOR_DEVS/TASK_COMPLETED/FEAT-ajustes-registro-e-busca-consultor.md`, v1.2; PR #402, feature → `gscandelari_setup`, merge `3da2b79`; PR #403, `gscandelari_setup` → `develop`). (1) RN-03 reescrita: CPF/CNPJ obrigatório para o especialista, com seletor (CNPJ padrão / CPF), máscara e dígito verificador no client de `/register` e na API; a landing confere só o tamanho. (2) RN-07: rótulo "Número do conselho *", placeholder "Ex.: CRM-SP 142337 ou CRO-RJ 5678", mensagem "Número do conselho é obrigatório"; consultor sem "Região / carteira" (a API não exige nem grava `business_name` dele); fim do mínimo de 3 caracteres no frontend. (3) Volume removido do formulário e da API (nova RN-13, lista branca). (4) Nova RN-12: a API grava pelo Admin SDK e a rule bloqueia a criação pelo client. (5) Novo Fluxo Alternativo 7c (landing com `consultant_code`, sem `consultant_reference`) e 7d (troca do tipo de documento). (6) RNF-02 atualizada; novas RNF-05 (`?v=` nos `.jsx` da landing), RNF-06 (`/register` `max-w-2xl` e `data-auth-wide`) e RNF-07 (sem dados pessoais em log). Resumo, Ator primário, Pré/Pós-condições, Gatilho, Fluxo Principal (passos 4-6, 8-11, 13, 15, 17, 19-20), 7b, 8a, 8b, RN-02, RN-08, RN-09, seções 12, 13 e 14 atualizados. Corrigida também a mensagem de exemplo de nome em 8a ("Informe nome e sobrenome", a mensagem real de `validateFullName`). Diagrama sem mudança. Validado em dev-gscandelari.web.app em 16–17/10/2026. |

