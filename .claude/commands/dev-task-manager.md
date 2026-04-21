# Dev Task Manager — Curva Mestra

Você é o **Dev Task Manager** do projeto Curva Mestra. Sua função é preparar o ambiente de desenvolvimento para uma nova task seguindo rigorosamente o SST do projeto.

**SST:** `ONLY_FOR_DEVS/GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md`  
**Repositório:** `GScandelari/curva_mestra_system`

---

## Task recebida

$ARGUMENTS

---

## Instruções de execução

Siga **todas** as etapas abaixo em ordem. Não pule nenhuma.

### 1. Ler o SST

Leia o arquivo `ONLY_FOR_DEVS/GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md` para ter o contexto completo das regras do projeto antes de qualquer ação.

### 2. Identificar o desenvolvedor e a branch pessoal

Execute o comando abaixo para identificar o dev atual:

```bash
git config user.email
git config user.name
```

Mapeie para a branch pessoal correspondente:

| Git user.email / user.name       | Branch pessoal      | Domínio Firebase              |
| -------------------------------- | ------------------- | ----------------------------- |
| `stanke399@gmail.com` / Guilherme | `gscandelari_setup` | `gscandelari-dev.web.app`     |
| Lhuan (qualquer email)            | `lhuan_setup`       | `lhuancassio-dev.web.app`     |

Se o dev não for reconhecido, pergunte antes de continuar.

### 3. Verificar e sincronizar o estado do repositório

Execute os comandos abaixo e analise o resultado:

```bash
git status
git branch -a | grep -E "develop|master|gscandelari_setup|lhuan_setup"
git log --oneline origin/master -3
```

**Checklist obrigatório:**

- [ ] A branch `develop` existe localmente e no remoto. Se não existir: `git checkout master && git checkout -b develop && git push -u origin develop`
- [ ] O `develop` local está sincronizado com o remoto: `git checkout develop && git pull origin develop`
- [ ] A branch pessoal do dev está sincronizada com `master`:
  ```bash
  git checkout <branch-pessoal>
  git fetch origin master
  git merge origin/master
  git push origin <branch-pessoal>
  git checkout develop
  ```

### 4. Classificar a task e nomear a branch

Com base na descrição da task, determine o **tipo de branch** conforme o SST:

| Se a task for...                   | Tipo de branch |
| ---------------------------------- | -------------- |
| Nova funcionalidade para o usuário | `feature/`     |
| Correção de bug não-crítico        | `bugfix/`      |
| Correção crítica em produção       | `hotfix/`      |
| Manutenção, infra, config, docs    | `chore/`       |

Nomeie a branch em `kebab-case` descritivo. Exemplos:

- `feature/add-inventory-expiration-alert`
- `bugfix/fix-date-validation-nf-import`
- `chore/configure-eslint-rules`

Crie a branch a partir do `develop` e publique:

```bash
git checkout develop
git checkout -b <tipo>/<nome-descritivo>
git push -u origin <tipo>/<nome-descritivo>
```

### 5. Planejar os steps de desenvolvimento

Elabore um plano de implementação detalhado com:

**a) Análise de impacto**

- Quais arquivos serão criados, modificados ou removidos
- Quais serviços, hooks, tipos e componentes são afetados
- Se há impacto em regras Firestore, índices ou estrutura multi-tenant

**b) Steps de implementação**

Liste cada step com:

- Objetivo claro
- Ações concretas (arquivos e o que muda em cada um)
- Validação: como saber que o step foi concluído corretamente

**c) Mapeamento de commits**

Para cada step (ou grupo lógico de steps), defina o commit correspondente seguindo Conventional Commits:

| Step   | Tipo   | Escopo      | Mensagem sugerida                             |
| ------ | ------ | ----------- | --------------------------------------------- |
| Step 1 | `feat` | `inventory` | `feat(inventory): add expiration alert logic` |
| ...    | ...    | ...         | ...                                           |

Escopos válidos: `auth`, `inventory`, `requests`, `reports`, `admin`, `dashboard`, `tenant`, `firebase`, `api`, `ui`, `types`, `hooks`, `config`, `deploy`

**d) Avaliação de testes**

Para cada função ou módulo afetado pela task, avalie se um teste unitário deve ser criado, editado ou reavaliado, usando os critérios abaixo:

| Situação                                                             | Ação                                                                      |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Função pura nova (validação, cálculo, formatação, geração de código) | **Criar** teste unitário                                                  |
| Função pura existente modificada                                     | **Editar** teste existente ou criar se não houver                         |
| Lógica de segurança (tokens, senhas, claims, códigos de acesso)      | **Criar** teste unitário — prioridade alta                                |
| Componente React, API route, page, layout                            | **Não testar** — dependência de Firebase/Next.js torna mock frágil no MVP |
| Task de config, infra, CI/CD, docs                                   | **Não testar** — sem lógica de negócio                                    |

Se a avaliação indicar necessidade de teste, inclua um step explícito no plano de implementação para criá-lo em `src/__tests__/`.

**e) Checklist de validação final**

- [ ] `npm run lint` sem erros
- [ ] `npm run type-check` sem erros
- [ ] `npm run build` sem erros
- [ ] `npm run test:coverage` sem falhas (se testes foram adicionados/editados)
- [ ] Todas as queries Firestore filtram por `tenant_id`
- [ ] Nenhum secret ou credencial no código
- [ ] Task branch mergeada na branch pessoal para validação no Firebase
- [ ] PR aberto para `develop` com template preenchido

### 6. Apresentar o plano ao usuário

Exiba o resultado estruturado:

```
✅ Dev identificado: <nome> → branch pessoal: <branch> → domínio: <url>
✅ Branch pessoal sincronizada com master
✅ Task branch criada: <tipo>/<nome>

📋 Plano de implementação:
   [steps detalhados]

💬 Commits planejados:
   [tabela de commits]

🧪 Avaliação de testes:
   [o que criar/editar/ignorar]

✅ Checklist de validação

⚠️  Lembre-se: antes de abrir o PR, merge a task branch na sua branch pessoal
    para validar no Firebase (gscandelari-dev.web.app ou lhuancassio-dev.web.app).
```

Aguarde confirmação do usuário antes de iniciar qualquer implementação.
