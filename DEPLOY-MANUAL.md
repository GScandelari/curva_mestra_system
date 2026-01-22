# 🚀 Deploy Manual - Curva Mestra

## Deploy via PowerShell (Windows)

### Opção 1: Comando Direto
```powershell
firebase deploy --only hosting
```

### Opção 2: Script Automatizado
```powershell
.\deploy.ps1
```

---

## Checklist Pré-Deploy

Antes de fazer deploy, verifique:

- [ ] Build local passou: `npm run build`
- [ ] Type-check passou: `npm run type-check`
- [ ] Commit feito: `git status`
- [ ] Push para GitHub: `git push origin master`

---

## Troubleshooting

### Erro: "Could not find the next executable"
**Solução:**
```powershell
# Adicionar ao PATH
$env:PATH = "$PWD\node_modules\.bin;$env:PATH"

# Tentar novamente
firebase deploy --only hosting
```

### Erro: "Firebase app not found"
**Solução:**
```powershell
# Verificar projeto
firebase projects:list

# Usar projeto correto
firebase use curva-mestra
```

### Erro: "Not authenticated"
**Solução:**
```powershell
# Login novamente
firebase login

# Ou use token
firebase login:ci
```

---

## Deploy Completo (Hosting + Functions)

⚠️ **ATENÇÃO:** Só faça isso se souber o que está fazendo!

```powershell
# Deploy tudo
firebase deploy

# Ou apenas hosting e functions
firebase deploy --only hosting,functions
```

---

## Verificar Deploy

Após o deploy, acesse:
- **Produção:** https://curva-mestra.web.app
- **Console:** https://console.firebase.google.com/project/curva-mestra/hosting

---

## Rollback (Desfazer Deploy)

Se algo der errado:

```powershell
# Listar versões
firebase hosting:releases

# Fazer rollback para versão anterior
firebase hosting:rollback
```

---

## Deploy via GitHub Actions (Futuro)

Quando as permissões do Google Cloud forem configuradas:

1. Faça commit
2. Push para master
3. GitHub Actions faz deploy automaticamente
4. Acompanhe em: https://github.com/SEU_USUARIO/curva_mestra/actions

**Nenhum comando manual necessário!** 🎉

---

## Suporte

- 📧 Firebase Support: https://firebase.google.com/support
- 📚 Documentação: https://firebase.google.com/docs/hosting
- 🐛 Issues: https://github.com/firebase/firebase-tools/issues
