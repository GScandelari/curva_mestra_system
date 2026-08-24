# CHORE — Completar integração SonarCloud no CI

**Tipo:** `chore/`  
**Data de criação:** 2026-05-05  
**Prioridade:** Média  

---

## Contexto

A integração com SonarCloud está **parcialmente configurada** — falta apenas o step de scan no workflow. A infraestrutura necessária já existe:

| Componente                    | Status | Detalhe                                              |
|-------------------------------|--------|------------------------------------------------------|
| `sonar-project.properties`    | ✅     | Raiz do projeto, configurado corretamente            |
| Secret `SONAR_TOKEN`          | ✅     | Presente no GitHub Actions (criado em 17/04/2026)   |
| Geração de coverage no CI     | ✅     | Job `sonarqube` roda `npm run test:coverage`         |
| Step de scan SonarCloud       | ❌     | **Ausente** — os dados nunca são enviados ao Sonar   |

### `sonar-project.properties` atual
```properties
sonar.projectKey=GScandelari_curva_mestra_system
sonar.projectName=Curva Mestra System
sonar.organization=gscandelari

sonar.sources=src
sonar.tests=src
sonar.test.inclusions=**/*.test.ts,**/*.spec.ts

sonar.javascript.lcov.reportPaths=coverage/lcov.info
sonar.language=ts
```

---

## O que fazer

### 1. Verificar projeto no SonarCloud
Acessar [sonarcloud.io](https://sonarcloud.io) com a conta `gscandelari` e confirmar que o projeto `GScandelari_curva_mestra_system` existe e está ativo.

Se não existir: criar o projeto em SonarCloud apontando para este repositório.

### 2. Adicionar step de scan no `.github/workflows/security.yml`

Arquivo atual (job `sonarqube`):
```yaml
sonarqube:
  runs-on: ubuntu-latest
  name: Code Quality Analysis
  steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0
    - uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
    - name: Install dependencies
      run: npm ci
    - name: Run tests with coverage
      run: npm run test:coverage
    # ← FALTA O STEP ABAIXO
```

Adicionar ao final do job:
```yaml
    - name: SonarCloud Scan
      uses: SonarSource/sonarcloud-github-action@v3
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
```

### 3. Ajustar `sonar-project.properties` (opcional)

Adicionar exclusões para não analisar arquivos desnecessários:
```properties
sonar.exclusions=**/__mocks__/**,**/*.test.ts,**/*.spec.ts,**/node_modules/**
sonar.coverage.exclusions=**/__mocks__/**,**/types/**
```

---

## Checklist de Validação

- [ ] Projeto existe e está ativo em sonarcloud.io/organizations/gscandelari
- [ ] Step `SonarCloud Scan` adicionado ao workflow
- [ ] CI roda e o job `Code Quality Analysis` passa
- [ ] Dashboard do SonarCloud mostra análise do projeto com cobertura
- [ ] Quality Gate configurado (ou deixar o padrão "Sonar way")
