# Deploy - Sistema de Acesso Antecipado

**Data:** 01/12/2025
**Funcionalidade:** Sistema completo de solicitação de acesso antecipado

## ✅ O que foi implementado

### 1. Homepage - Seção de Acesso Antecipado
- Seção destacada com botão "Solicitar Acesso Antecipado"
- Design com gradiente dourado e informações sobre benefícios
- Link direto para `/register`

### 2. Página de Registro (`/register`)
- **Fluxo em 2 etapas:**
  - Etapa 1: Escolha do tipo (Clínica ou Autônomo)
  - Etapa 2: Formulário completo com validações
- **Campos:**
  - Nome completo, email, telefone
  - Nome do negócio
  - CPF/CNPJ (auto-formatado)
  - Endereço completo (opcional)
- **Tela de sucesso** após envio

### 3. API de Criação de Solicitação
- Endpoint: `POST /api/access-requests`
- Salva no Firestore: `access_requests`
- Valida campos e formata documentos

### 4. Painel Admin (`/admin/access-requests`)
- Dashboard com estatísticas
- Tabela com todas as informações
- Botões de Aprovar/Rejeitar

### 5. API de Aprovação Automática (1 Clique)
- Endpoint: `POST /api/access-requests/[id]/approve`
- Cria automaticamente:
  - ✅ Tenant no Firestore
  - ✅ Usuário no Firebase Auth
  - ✅ Custom Claims (tenant_id, role)
  - ✅ Documento em tenants/{id}/users/{uid}
  - ✅ Licença de 6 meses grátis
  - ✅ Atualiza solicitação para "aprovada"

## 📦 Arquivos Criados/Modificados

**Novos:**
- `src/app/api/access-requests/route.ts`
- `src/app/api/access-requests/[id]/approve/route.ts`

**Modificados:**
- `src/app/page.tsx` - Seção de acesso antecipado
- `src/app/(auth)/register/page.tsx` - Reescrito completamente
- `src/app/(admin)/admin/access-requests/page.tsx` - Atualizado para novo fluxo
- `src/app/(clinic)/clinic/setup/payment/page.tsx` - Correção de tipo (provider)
- `src/lib/services/accessRequestService.ts` - Funções antigas depreciadas

## 🚀 Como fazer o Deploy (Windows PowerShell)

### 1. Navegue até o diretório do projeto:
```powershell
cd "C:\Users\scand\OneDrive\Área de Trabalho\Curva Mestra\curva_mestra"
```

### 2. Verifique o build (já foi feito):
```powershell
# O build já está pronto em .next/
# Caso queira refazer:
npm run build
```

### 3. Deploy do Frontend (Next.js):
```powershell
# Deploy para Firebase Hosting
firebase deploy --only hosting
```

### 4. Deploy das Functions (se houver alterações):
```powershell
# Opcional: apenas se quiser atualizar as Cloud Functions também
firebase deploy --only functions
```

### 5. Deploy completo (Hosting + Functions):
```powershell
# Deploy de tudo de uma vez
firebase deploy
```

## ⚠️ Importante antes do Deploy

### 1. Verificar variáveis de ambiente
Certifique-se que `.env.production` tem todas as variáveis:
```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

PAGBANK_EMAIL=scandelari.guilherme@curvamestra.com.br
PAGBANK_TOKEN=ea93c9f3-e952-4d7c-a13d-a6b44f22497b576415474e2084bb732f1a09730819f56713-c154-40f5-85f7-beb142f40d74
```

### 2. Verificar regras do Firestore
Adicione regra para `access_requests`:
```javascript
// Em firestore.rules
match /access_requests/{requestId} {
  // System admin pode ler/escrever tudo
  allow read, write: if request.auth.token.is_system_admin == true;

  // Qualquer usuário autenticado pode criar (para o /register)
  allow create: if request.auth != null;
}
```

### 3. Verificar índices do Firestore
No Firebase Console > Firestore > Indexes, crie:
```
Collection: access_requests
Fields:
  - status (Ascending)
  - created_at (Descending)
```

## 📋 Pós-Deploy - Checklist de Testes

### 1. Testar Homepage
- [ ] Acessar https://curva-mestra.web.app/
- [ ] Verificar seção "Acesso Antecipado"
- [ ] Clicar no botão "Solicitar Acesso Antecipado"

### 2. Testar Registro
- [ ] Escolher "Clínica"
- [ ] Preencher todos os campos
- [ ] Submeter formulário
- [ ] Verificar tela de sucesso

### 3. Testar Painel Admin
- [ ] Login como system_admin
- [ ] Acessar `/admin/access-requests`
- [ ] Verificar estatísticas
- [ ] Verificar tabela com solicitação

### 4. Testar Aprovação
- [ ] Clicar em "Aprovar" em uma solicitação
- [ ] Aguardar processamento (pode levar 5-10 segundos)
- [ ] Verificar toast de sucesso
- [ ] Verificar no Firestore:
  - [ ] Tenant criado
  - [ ] Usuário criado em Auth
  - [ ] Custom claims definidos
  - [ ] Licença criada

### 5. Testar Login do Novo Usuário
- [ ] Fazer logout do admin
- [ ] Fazer login com o email da solicitação
- [ ] Usar a senha temporária retornada
- [ ] Verificar acesso ao dashboard da clínica

## 🔧 Troubleshooting

### Erro: "Could not load default credentials"
**Solução:** As credenciais são carregadas automaticamente no Firebase Hosting em produção.

### Erro: "Email already exists"
**Solução:** O email já está cadastrado. Use outro email ou delete o usuário existente.

### Erro: "Insufficient permissions"
**Solução:** Verifique as regras do Firestore para `access_requests`.

### Solicitação não aparece no admin
**Solução:**
1. Verifique se está filtrando por status "pendente"
2. Verifique no Firestore Console se foi criada
3. Clique em "Atualizar" na página

## 📊 Monitoramento

Após o deploy, monitore:
- Firebase Console > Functions > Logs
- Firebase Console > Firestore > access_requests
- Firebase Console > Authentication > Users

## 🎯 Próximos Passos (Futuro)

1. Implementar envio de email com credenciais
2. Adicionar rejeitamento de solicitações
3. Filtros na tabela (por tipo, data)
4. Página de detalhes da solicitação
5. Painel de analytics de solicitações

---

**Build Status:** ✅ Sucesso
**Build Time:** ~27s
**Total Pages:** 46 rotas
**Deployment Ready:** SIM
