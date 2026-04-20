# Scripts de Desenvolvimento - Curva Mestra

Scripts utilitários para desenvolvimento e testes do sistema multi-tenant.

## Pré-requisitos

Os emuladores do Firebase devem estar rodando:

```bash
firebase emulators:start
```

## Scripts Disponíveis

### 1. seed-emulator.js

Popula o emulador com dados de teste incluindo usuários, tenants e produtos de exemplo.

**Uso:**

```bash
node scripts/seed-emulator.js
```

**O que faz:**

- Cria 1 System Admin
- Cria 3 Tenants (Alpha - ativo, Beta - ativo, Gamma - inativo)
- Cria 4 usuários (1 system admin, 2 na Alpha, 1 na Beta)
- Adiciona 2 produtos de exemplo no inventário da Alpha

**Credenciais criadas:**

| Tipo         | Email                 | Senha     | Tenant        |
| ------------ | --------------------- | --------- | ------------- |
| System Admin | admin@curvamestra.com | Admin123! | -             |
| Clinic Admin | admin@alpha.com       | Alpha123! | Clínica Alpha |
| Clinic User  | usuario@alpha.com     | Alpha123! | Clínica Alpha |
| Clinic Admin | admin@beta.com        | Beta123!  | Clínica Beta  |

### 2. test-security.js

Executa testes de validação do sistema multi-tenant.

**Uso:**

```bash
node scripts/test-security.js
```

**Testes executados:**

1. ✅ Verificar Custom Claims (roles e tenant_id)
2. ✅ Verificar Estrutura de Dados (tenants no Firestore)
3. ✅ Verificar Usuários nos Tenants
4. ✅ Verificar Inventário
5. ✅ Verificar Isolamento Multi-Tenant

**Saída esperada:**

```
✅ Testes passou: 8
❌ Testes falhou: 0
📊 Total: 8
📈 Taxa de sucesso: 100.0%
```

## Fluxo de Desenvolvimento

### Primeira vez:

```bash
# 1. Iniciar emuladores
firebase emulators:start

# 2. Em outro terminal, popular dados
node scripts/seed-emulator.js

# 3. Validar segurança
node scripts/test-security.js

# 4. Acessar Emulator UI
# Abrir http://127.0.0.1:4000 no navegador
```

### Resetar dados:

```bash
# Parar emuladores (Ctrl+C)
# Reiniciar emuladores (apaga todos os dados)
firebase emulators:start

# Popular novamente
node scripts/seed-emulator.js
```

## Links Úteis

- **Emulator UI:** http://127.0.0.1:4000
- **Auth Emulator:** http://127.0.0.1:4000/auth
- **Firestore Emulator:** http://127.0.0.1:4000/firestore
- **Functions Emulator:** http://127.0.0.1:4000/functions
- **Storage Emulator:** http://127.0.0.1:4000/storage

## Estrutura de Dados Criada

### Tenants

```
tenants/
├── tenant_clinic_alpha/
│   ├── users/
│   │   ├── {uid_admin}/
│   │   └── {uid_usuario}/
│   └── inventory/
│       ├── {produto_1}/
│       └── {produto_2}/
├── tenant_clinic_beta/
│   └── users/
│       └── {uid_admin}/
└── tenant_clinic_gamma/ (inativo)
```

### Custom Claims

```json
{
  "tenant_id": "tenant_clinic_alpha",
  "role": "clinic_admin" | "clinic_user" | "system_admin",
  "is_system_admin": boolean,
  "active": boolean
}
```

## Troubleshooting

### Erro "Cannot find module 'firebase-admin'"

```bash
npm install
```

### Emuladores não estão rodando

```bash
firebase emulators:start
```

### Usuários já existem

Os scripts detectam usuários existentes e não tentam recriá-los. Para começar do zero, reinicie os emuladores.

### Functions com timeout

Este é um warning conhecido do Firebase Functions v2 no emulador local. Não afeta a funcionalidade dos testes de Auth e Firestore.

## Próximos Passos

Depois de validar a gestão de tenants:

1. Implementar parser DANFE (OCR Python + Gemini)
2. Sistema de upload de NF-e
3. Dashboard com alertas de vencimento
4. Sistema de solicitações
5. Portal do System Admin

---

**Projeto:** Curva Mestra - Sistema SaaS Multi-Tenant
**Stack:** 100% Firebase (Auth + Firestore + Functions + Storage)
**Arquiteto:** Claude AI
**Última atualização:** 08/11/2025
