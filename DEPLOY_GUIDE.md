# 🚀 Guia de Deploy - Curva Mestra System

## ✅ Deploy Automático Configurado

Agora você tem scripts automatizados para fazer deploy sempre que houver alterações.

## 🛠️ Opções de Deploy

### Opção 1: Script Node.js (Recomendado)
```bash
# Deploy com mensagem automática
node scripts/deployAll.js

# Deploy com mensagem customizada
node scripts/deployAll.js -m "feat: Nova funcionalidade X"
node scripts/deployAll.js -m "fix: Correção do bug Y"
node scripts/deployAll.js -m "docs: Atualização da documentação"

# Ver ajuda
node scripts/deployAll.js --help
```

### Opção 2: Script Batch (Windows)
```bash
# Deploy com mensagem automática
deploy.bat

# Deploy com mensagem customizada
deploy.bat "feat: Nova funcionalidade X"
```

### Opção 3: Comandos Manuais
```bash
# 1. Git
git add .
git commit -m "Sua mensagem"
git push origin main

# 2. Build
cd frontend
npm run build
cd ..

# 3. Deploy Firebase
firebase deploy --only "functions,hosting" --project curva-mestra
```

## 📋 O que o Deploy Automático Faz

1. **Verifica alterações** no Git
2. **Adiciona todos os arquivos** (`git add .`)
3. **Faz commit** com mensagem automática ou customizada
4. **Faz push** para o repositório (`git push origin main`)
5. **Faz build** do frontend (`npm run build`)
6. **Deploy no Firebase** (functions + hosting)

## 🎯 Tipos de Mensagens de Commit

Use estas convenções para mensagens de commit:

```bash
# Novas funcionalidades
node scripts/deployAll.js -m "feat: Adicionar sistema de notificações"

# Correções de bugs
node scripts/deployAll.js -m "fix: Corrigir erro SYS_001 no login"

# Documentação
node scripts/deployAll.js -m "docs: Atualizar guia de instalação"

# Refatoração
node scripts/deployAll.js -m "refactor: Melhorar estrutura do código"

# Testes
node scripts/deployAll.js -m "test: Adicionar testes unitários"

# Configuração
node scripts/deployAll.js -m "chore: Atualizar dependências"

# Performance
node scripts/deployAll.js -m "perf: Otimizar carregamento da página"

# Estilo/UI
node scripts/deployAll.js -m "style: Melhorar design da interface"
```

## 🔍 Verificação Pós-Deploy

Após cada deploy, verifique:

### 1. URLs da Aplicação
- **Frontend**: https://curva-mestra.web.app
- **Console Firebase**: https://console.firebase.google.com/project/curva-mestra/overview
- **Repositório Git**: https://github.com/GScandelari/curva_mestra_system

### 2. Testes Rápidos
```bash
# Testar APIs
node scripts/testAPIClient.js no-auth

# Verificar status do sistema
node scripts/systemStatus.js

# Debug SYS_001 (se necessário)
node scripts/debugSYS001.js
```

### 3. Logs do Firebase
```bash
# Ver logs em tempo real
firebase functions:log --project curva-mestra --follow

# Ver logs recentes
firebase functions:log --project curva-mestra
```

## ⚡ Deploy Rápido para Desenvolvimento

Para mudanças pequenas durante desenvolvimento:

```bash
# Deploy super rápido
node scripts/deployAll.js -m "wip: Trabalho em progresso"

# Ou apenas
node scripts/deployAll.js
```

## 🚨 Troubleshooting

### Erro: "git push failed"
```bash
# Verificar status
git status

# Resolver conflitos se necessário
git pull origin main

# Tentar novamente
node scripts/deployAll.js
```

### Erro: "npm run build failed"
```bash
# Verificar erros no frontend
cd frontend
npm run build

# Corrigir erros e tentar novamente
```

### Erro: "firebase deploy failed"
```bash
# Verificar login
firebase login

# Verificar projeto
firebase projects:list

# Tentar deploy manual
firebase deploy --only "functions,hosting" --project curva-mestra
```

## 📊 Monitoramento

### Verificar Deploy
- ✅ **Git**: Commit aparece no GitHub
- ✅ **Build**: Arquivos gerados em `frontend/dist/`
- ✅ **Firebase**: Aplicação atualizada em https://curva-mestra.web.app

### Logs de Deploy
O script salva logs detalhados de cada deploy, incluindo:
- Timestamp do deploy
- Mensagem do commit
- Tempo total de execução
- URLs de verificação

## 🎯 Workflow Recomendado

1. **Fazer alterações** no código
2. **Testar localmente** (`npm run dev`)
3. **Deploy automático** (`node scripts/deployAll.js -m "Sua mensagem"`)
4. **Verificar aplicação** em https://curva-mestra.web.app
5. **Testar funcionalidades** críticas

## 📝 Exemplo Completo

```bash
# 1. Fazer alterações no código
# ... editar arquivos ...

# 2. Deploy com mensagem descritiva
node scripts/deployAll.js -m "feat: Implementar ferramentas de debug SYS_001"

# 3. Verificar resultado
# - Abrir https://curva-mestra.web.app
# - Testar funcionalidade
# - Verificar console do navegador

# 4. Se tudo OK, continuar desenvolvimento
# Se houver problemas, corrigir e fazer novo deploy
```

---

## ✅ Status Atual

- 🚀 **Deploy automático**: Configurado e testado
- 🔧 **Scripts**: Funcionando perfeitamente
- 🌐 **Aplicação**: Disponível em https://curva-mestra.web.app
- 📱 **Debug tools**: Instalados e funcionais
- 🔍 **Monitoramento**: Ativo

**Próximos passos**: Use `node scripts/deployAll.js` sempre que fizer alterações!