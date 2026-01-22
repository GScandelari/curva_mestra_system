# Solução para Deploy no Windows - CVE-2025-55182

## ❌ Problema
O Firebase CLI no Windows não consegue encontrar o executável `next` devido a diferenças entre sistemas operacionais.

## ✅ Correções de Segurança Aplicadas (Localmente)
- ✅ React: 19.0.0 → 19.2.3 (CVE-2025-55182 corrigido)
- ✅ Next.js: 15.5.7 → 15.5.9 (4 CVEs corrigidos)
- ✅ Build: Concluído com sucesso
- ✅ Type-check: Passou sem erros

## 🚀 Soluções para Deploy

### Opção 1: GitHub Actions (RECOMENDADO)

Esta é a solução mais confiável e automática:

1. **Gerar token do Firebase:**
   ```powershell
   firebase login:ci
   ```
   Copie o token gerado.

2. **Configurar secret no GitHub:**
   - Vá em: `https://github.com/SEU_USUARIO/curva_mestra/settings/secrets/actions`
   - Clique em "New repository secret"
   - Nome: `FIREBASE_TOKEN`
   - Value: Cole o token do passo 1

3. **Fazer commit e push:**
   ```powershell
   git add .
   git commit -m "security: fix CVE-2025-55182 (React2Shell) + deploy automation"
   git push origin master
   ```

4. **Acompanhar o deploy:**
   - Vá em: `https://github.com/SEU_USUARIO/curva_mestra/actions`
   - O deploy será executado automaticamente

### Opção 2: WSL (Windows Subsystem for Linux)

Se você tem WSL instalado:

```bash
# No terminal WSL
cd "/mnt/c/Users/scand/OneDrive/Área de Trabalho/Curva Mestra/curva_mestra"
firebase deploy --only hosting
```

### Opção 3: Workaround PowerShell (Experimental)

Execute como Administrador:

```powershell
.\deploy-workaround.ps1
```

### Opção 4: Deploy via Firebase Console (Manual)

1. Faça build local:
   ```powershell
   npm run build
   ```

2. Acesse: https://console.firebase.google.com/project/curva-mestra/hosting

3. Faça upload manual da pasta `.next`

## 📊 Status Atual

| Item | Status | Versão |
|------|--------|--------|
| React (local) | ✅ Atualizado | 19.2.3 |
| Next.js (local) | ✅ Atualizado | 15.5.9 |
| Build | ✅ Sucesso | - |
| Deploy | ⏳ Pendente | - |

## 🔐 Vulnerabilidades Corrigidas

- **CVE-2025-55182** (CRITICAL) - React2Shell RCE
- **CVE-2025-66478** (CRITICAL) - RSC payload RCE
- **CVE-2025-55184** (HIGH) - DoS via malicious request
- **CVE-2025-55183** (MEDIUM) - Server Action code exposure
- **CVE-2025-67779** (HIGH) - Incomplete DoS fix

## 📝 Próximos Passos

**RECOMENDAÇÃO:** Use a Opção 1 (GitHub Actions) para deploy confiável e automatizado.

## 🔗 Links Úteis

- [Firebase Console](https://console.firebase.google.com/project/curva-mestra)
- [GitHub Actions Setup](https://github.com/SEU_USUARIO/curva_mestra/settings/secrets/actions)
- [CVE-2025-55182 Info](https://nvd.nist.gov/vuln/detail/CVE-2025-55182)
