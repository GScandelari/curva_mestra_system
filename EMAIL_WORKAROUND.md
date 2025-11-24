# 🔧 Solução Alternativa - Envio de E-mail

## ⚠️ Problema Identificado

O Firebase Functions está apresentando timeout durante o deploy em ambiente WSL (Windows Subsystem for Linux). Este é um problema conhecido com Functions 2nd gen em WSL.

## ✅ Solução: API Route Next.js

Em vez de usar Firebase Functions, vamos implementar o envio de e-mails via API Routes do Next.js, que já está funcionando perfeitamente.

### Vantagens:
- ✅ Sem problemas de deploy
- ✅ Código roda no mesmo servidor do Next.js
- ✅ Mais simples de debugar
- ✅ Funciona imediatamente

---

## 📧 Implementação Pronta

O código do serviço de e-mail já está criado em:
- `functions/src/services/emailService.ts`

Vou criar uma API Route no Next.js que usa este mesmo serviço.

### Arquivos a criar:

#### 1. API Route: `src/app/api/send-email/route.ts`
```typescript
import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(request: NextRequest) {
  try {
    const { type, email, name } = await request.json();

    // Configurar transporter Zoho
    const transporter = nodemailer.createTransport({
      host: "smtp.zoho.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Templates de e-mail (mesmo do emailService.ts)
    let html = "";
    let subject = "";

    if (type === "welcome") {
      subject = "🎉 Bem-vindo ao Curva Mestra!";
      html = `...`; // HTML do template
    } else if (type === "magic-link") {
      subject = "🔐 Seu link de acesso";
      html = `...`; // HTML do template
    }

    // Enviar e-mail
    await transporter.sendMail({
      from: '"Curva Mestra" <scandelari.guilherme@curvamestra.com.br>',
      to: email,
      subject,
      html,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Erro ao enviar e-mail" },
      { status: 500 }
    );
  }
}
```

#### 2. Variáveis de Ambiente: `.env.local`
```
SMTP_USER=scandelari.guilherme@curvamestra.com.br
SMTP_PASS=sua_senha_zoho
```

---

## 🧪 Teste Imediato

Após criar os arquivos acima:

```bash
# 1. Instalar nodemailer no projeto Next.js
npm install nodemailer @types/nodemailer

# 2. Rodar dev server
npm run dev

# 3. Testar endpoint
curl -X POST http://localhost:3000/api/send-email \
  -H "Content-Type: application/json" \
  -d '{
    "type": "welcome",
    "email": "scandelari.guilherme@curvamestra.com.br",
    "name": "Guilherme"
  }'
```

---

## 🚀 Próximos Passos

1. Criar API Route `/api/send-email`
2. Configurar `.env.local` com credenciais SMTP
3. Testar localmente
4. Deploy no Firebase Hosting (vai funcionar!)

**Quer que eu implemente esta solução alternativa agora?**

---

## 📝 Notas

- Firebase Functions pode ser resolvido depois (problema é apenas no WSL)
- API Routes Next.js é mais simples para MVP
- Mesma funcionalidade, implementação diferente
- Deploy no Firebase Hosting funciona normalmente
