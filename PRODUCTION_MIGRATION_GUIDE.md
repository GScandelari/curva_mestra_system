# Guia de Migração para Produção - PostgreSQL para Firebase

Este documento fornece instruções detalhadas para executar a migração completa do sistema de gestão de inventário para clínicas da infraestrutura atual (PostgreSQL + Node.js) para Firebase.

## 📋 Pré-requisitos

### Ambiente de Sistema
- Node.js 16+ instalado
- PostgreSQL client (pg_dump) disponível
- Firebase CLI instalado e configurado
- Acesso administrativo ao projeto Firebase
- Backup do sistema atual

### Variáveis de Ambiente Necessárias

Crie um arquivo `.env` com as seguintes variáveis:

```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=inventario_clinica
DB_USER=postgres
DB_PASSWORD=sua-senha-postgresql

# Firebase Configuration
FIREBASE_PROJECT_ID=curva-mestra
FIREBASE_API_KEY=AIzaSyBtNXznf7cvdzGCcBym84ux-SjJrrKaSJU
FIREBASE_AUTH_DOMAIN=curva-mestra.firebaseapp.com
FIREBASE_STORAGE_BUCKET=curva-mestra.appspot.com

# Migration Configuration
CLINIC_ID=default-clinic
FIREBASE_HOSTING_URL=https://curva-mestra.web.app
DOMAIN_NAME=seu-dominio.com
```

## 🚀 Processo de Migração

### Fase 1: Validação Pré-Migração

Execute a validação para garantir que o sistema está pronto:

```bash
cd backend
node scripts/pre-migration-check.js
```

Este script verifica:
- ✅ Conectividade com PostgreSQL
- ✅ Configuração do Firebase
- ✅ Variáveis de ambiente
- ✅ Espaço em disco para backups
- ✅ Dependências do sistema
- ✅ Scripts de migração
- ✅ Permissões do Firebase

**⚠️ Importante**: Resolva todos os erros críticos antes de prosseguir.

### Fase 2: Execução da Migração

Execute a migração completa:

```bash
cd backend
node scripts/production-migration.js migrate
```

O processo inclui automaticamente:

1. **Backup Completo do Sistema**
   - Backup do PostgreSQL com verificação de integridade
   - Armazenamento seguro dos dados originais

2. **Migração de Usuários**
   - Transferência de usuários para Firebase Auth
   - Configuração de custom claims para roles
   - Manutenção dos IDs originais

3. **Migração de Dados**
   - Transferência de todos os dados para Firestore
   - Transformação de tipos de dados (timestamps, booleans)
   - Estruturação hierárquica das coleções

4. **Validação de Integridade**
   - Verificação de contagem de registros
   - Validação de estrutura de dados
   - Confirmação de integridade referencial

5. **Configuração de Redirecionamento**
   - Criação de página de manutenção
   - Configuração do nginx para redirecionamento
   - Preparação para transição

### Fase 3: Validação Pós-Migração

Após a migração, execute a validação:

```bash
cd backend
node scripts/post-migration-validation.js
```

Este script verifica:
- ✅ Integridade dos dados migrados
- ✅ Funcionamento do Firebase Auth
- ✅ Regras de segurança do Firestore
- ✅ Performance das consultas
- ✅ Configuração de redirecionamento

## 📊 Estrutura de Dados Migrada

### Mapeamento PostgreSQL → Firestore

```
PostgreSQL Tables          →    Firestore Collections
─────────────────────────────────────────────────────
users                     →    clinics/{clinicId}/users
products                  →    clinics/{clinicId}/products
patients                  →    clinics/{clinicId}/patients
product_requests          →    clinics/{clinicId}/requests
invoices                  →    clinics/{clinicId}/invoices
stock_movements           →    clinics/{clinicId}/stockMovements
audit_logs                →    clinics/{clinicId}/auditLogs
notifications             →    clinics/{clinicId}/notifications
```

### Transformações de Dados

- **Timestamps**: `created_at` → `createdAt` (Firestore Timestamp)
- **Booleans**: `is_active` → `isActive`
- **Snake Case**: `field_name` → `fieldName`
- **Referências**: IDs mantidos para integridade

## 🔐 Segurança e Permissões

### Firebase Auth Custom Claims

```javascript
{
  role: 'admin' | 'doctor' | 'receptionist' | 'manager',
  clinicId: 'clinic-id',
  permissions: ['manage_users', 'manage_products', ...],
  migrated: true,
  migratedAt: '2024-01-01T00:00:00.000Z'
}
```

### Regras de Segurança Firestore

- Usuários só acessam dados da própria clínica
- Roles determinam permissões de leitura/escrita
- Validação de estrutura de dados
- Auditoria de tentativas de acesso não autorizado

## 📈 Monitoramento e Logs

### Logs de Migração

Os logs são salvos em:
- `backend/logs/migrations/migration-{timestamp}.json`
- `backend/logs/pre-migration/validation-{timestamp}.json`
- `backend/logs/post-migration/validation-{timestamp}.json`

### Estrutura do Log

```json
{
  "id": "migration-1640995200000",
  "clinicId": "default-clinic",
  "startTime": "2024-01-01T00:00:00.000Z",
  "endTime": "2024-01-01T01:00:00.000Z",
  "status": "completed",
  "steps": [...],
  "errors": [...],
  "summary": {...}
}
```

## 🔄 Rollback (Emergência)

Em caso de problemas críticos, execute o rollback:

```bash
cd backend
node scripts/production-migration.js rollback --confirm
```

**⚠️ Atenção**: O rollback remove usuários do Firebase Auth, mas os dados do Firestore precisam ser removidos manualmente.

## 📋 Checklist Pós-Migração

### Validação Técnica
- [ ] Todos os usuários migrados com sucesso
- [ ] Contagem de dados PostgreSQL = Firestore
- [ ] Firebase Auth funcionando
- [ ] Regras de segurança ativas
- [ ] Performance aceitável (< 1s para consultas básicas)

### Validação Funcional
- [ ] Login de usuários funcionando
- [ ] CRUD de produtos funcionando
- [ ] Gestão de pacientes funcionando
- [ ] Sistema de solicitações funcionando
- [ ] Relatórios e dashboards funcionando

### Configuração de Produção
- [ ] DNS apontando para Firebase Hosting
- [ ] SSL/HTTPS configurado
- [ ] Monitoramento ativo
- [ ] Backup automático configurado
- [ ] Alertas de erro configurados

## 🚨 Troubleshooting

### Problemas Comuns

#### 1. Erro de Permissão Firebase
```
Error: Permission denied
```
**Solução**: Verificar se o service account tem permissões adequadas no projeto Firebase.

#### 2. Timeout na Migração
```
Error: Request timeout
```
**Solução**: Reduzir o `batchSize` no script de migração ou executar em lotes menores.

#### 3. Inconsistência de Dados
```
Error: Data count mismatch
```
**Solução**: Verificar logs detalhados e re-executar migração para registros específicos.

#### 4. Falha na Validação
```
Error: Validation failed
```
**Solução**: Revisar regras de segurança do Firestore e configuração de custom claims.

### Comandos de Diagnóstico

```bash
# Verificar status da migração
node scripts/production-migration.js status migration-{id}

# Validar dados específicos
node scripts/post-migration-validation.js

# Verificar logs do Firebase
firebase functions:log

# Testar regras de segurança
cd backend && node scripts/test-firestore-rules-simple.js
```

## 📞 Suporte

### Logs Importantes
- Migration logs: `backend/logs/migrations/`
- Firebase Functions logs: Firebase Console
- Application logs: Browser DevTools

### Informações para Suporte
- Migration ID
- Clinic ID
- Timestamp do erro
- Logs completos da migração
- Configuração do ambiente

## 🎯 Próximos Passos

Após migração bem-sucedida:

1. **Monitoramento Intensivo** (primeira semana)
   - Verificar performance diariamente
   - Monitorar custos do Firebase
   - Acompanhar feedback dos usuários

2. **Otimização** (segunda semana)
   - Ajustar índices do Firestore
   - Otimizar consultas lentas
   - Configurar cache quando necessário

3. **Arquivamento** (após 30 dias)
   - Arquivar sistema PostgreSQL antigo
   - Manter backups por período de retenção
   - Documentar lições aprendidas

## 📊 Estimativas de Tempo

| Fase | Tempo Estimado | Observações |
|------|----------------|-------------|
| Pré-validação | 15-30 min | Depende da configuração |
| Migração | 30-120 min | Depende do volume de dados |
| Pós-validação | 15-30 min | Testes automatizados |
| **Total** | **1-3 horas** | Para sistema médio |

## 💰 Estimativa de Custos

### Comparação Mensal (Sistema Médio)

| Serviço | Atual | Firebase | Economia |
|---------|-------|----------|----------|
| Servidor | $50-100 | $0 | $50-100 |
| Database | $20-50 | $10-25 | $10-25 |
| SSL/CDN | $10-20 | $0 | $10-20 |
| Backup | $10-15 | $5 | $5-10 |
| **Total** | **$90-185** | **$15-30** | **$75-155** |

---

**📝 Nota**: Este guia deve ser seguido cuidadosamente. Em caso de dúvidas, execute primeiro em ambiente de teste.