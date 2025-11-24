# 🚀 Deploy Firebase Functions via Windows (VS Code)

## ✅ Passo a Passo

### 1️⃣ Abrir o VS Code no Windows

1. Abra o **Visual Studio Code** (aplicativo Windows, não WSL)
2. Abra a pasta do projeto:
   ```
   C:\Users\scand\OneDrive\Área de Trabalho\Curva Mestra\curva_mestra
   ```
3. Abra o **Terminal Integrado** do VS Code:
   - Menu: `Terminal > New Terminal`
   - Ou pressione: `Ctrl + '`
   - **IMPORTANTE**: Certifique-se que é PowerShell ou CMD, NÃO o terminal WSL

---

### 2️⃣ Verificar se os Secrets estão configurados

No terminal do VS Code, execute:

```powershell
cd functions
firebase functions:secrets:access SMTP_USER
firebase functions:secrets:access SMTP_PASS
```

✅ Se retornar seus valores, está OK!
❌ Se der erro, execute novamente:

```powershell
firebase functions:secrets:set SMTP_USER
# Digite: scandelari.guilherme@curvamestra.com.br

firebase functions:secrets:set SMTP_PASS
# Digite sua senha do Zoho
```

---

### 3️⃣ Voltar ao código correto

Precisamos restaurar o `index.ts` com as functions originais:

```powershell
cd src
del index.ts
ren index.ts.backup index.ts
cd ..
```

Se o backup não existir, copie este conteúdo para `functions/src/index.ts`:

```typescript
import * as admin from "firebase-admin";
import {onRequest} from "firebase-functions/v2/https";

admin.initializeApp();

// Exportar função de teste de e-mail
export {sendTestEmail} from "./sendTestEmail";

// Health check
export const healthCheck = onRequest(async (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});
```

---

### 4️⃣ Build e Deploy

No terminal do VS Code (ainda na pasta functions):

```powershell
# Compilar TypeScript
npm run build

# Voltar para raiz do projeto
cd ..

# Deploy apenas da função de teste
firebase deploy --only functions:sendTestEmail
```

**⏱️ Aguarde**: O deploy pode levar de 2 a 5 minutos.

---

### 5️⃣ Testar o E-mail

Após o deploy com sucesso, copie a URL da function (algo como):
```
https://southamerica-east1-curva-mestra.cloudfunctions.net/sendTestEmail
```

**Teste via PowerShell:**

```powershell
# Criar arquivo JSON temporário para o teste
@"
{
  "email": "scandelari.guilherme@curvamestra.com.br",
  "smtpUser": "scandelari.guilherme@curvamestra.com.br",
  "smtpPass": "SUA_SENHA_ZOHO_AQUI"
}
"@ | Out-File -FilePath test-email.json -Encoding UTF8

# Enviar requisição
curl -X POST `
  https://southamerica-east1-curva-mestra.cloudfunctions.net/sendTestEmail `
  -H "Content-Type: application/json" `
  -d "@test-email.json"

# Limpar arquivo temporário
Remove-Item test-email.json
```

**Ou use o Postman/Insomnia:**
- Method: `POST`
- URL: `https://southamerica-east1-curva-mestra.cloudfunctions.net/sendTestEmail`
- Body (JSON):
```json
{
  "email": "scandelari.guilherme@curvamestra.com.br",
  "smtpUser": "scandelari.guilherme@curvamestra.com.br",
  "smtpPass": "sua_senha_zoho"
}
```

---

## 📊 Verificar Status do Deploy

```powershell
# Ver lista de functions deployadas
firebase functions:list

# Ver logs da function
firebase functions:log --only sendTestEmail

# Ver logs em tempo real
firebase functions:log --only sendTestEmail --follow
```

---

## ❓ Troubleshooting

### Erro: "firebase: command not found"
```powershell
npm install -g firebase-tools
firebase login
```

### Erro: "Cannot find module 'firebase-admin'"
```powershell
cd functions
npm install
npm run build
cd ..
```

### Deploy trava ou timeout
- Verifique sua conexão com internet
- Tente novamente (pode ser instabilidade temporária)
- Execute: `firebase deploy --only functions:sendTestEmail --debug`

### E-mail não chega
1. Verifique a caixa de SPAM
2. Verifique os logs: `firebase functions:log`
3. Confirme que as credenciais SMTP estão corretas
4. Teste fazer login manualmente no Zoho Mail

---

## ✅ Checklist

```markdown
☐ Abrir VS Code no Windows (não WSL)
☐ Abrir terminal PowerShell/CMD no VS Code
☐ Verificar secrets configurados
☐ Compilar: npm run build
☐ Deploy: firebase deploy --only functions:sendTestEmail
☐ Aguardar deploy completar (2-5 min)
☐ Copiar URL da function
☐ Testar envio de e-mail
☐ Verificar recebimento
☐ Checar logs se houver erro
```

---

## 🎯 Resultado Esperado

Após o deploy bem-sucedido, você verá:

```
✔  Deploy complete!

Function URL (sendTestEmail):
https://southamerica-east1-curva-mestra.cloudfunctions.net/sendTestEmail
```

E ao testar, deve receber um e-mail bonito com o template do Curva Mestra em sua caixa de entrada!

---

**Boa sorte! Me avise se encontrar algum erro durante o processo.** 🚀
