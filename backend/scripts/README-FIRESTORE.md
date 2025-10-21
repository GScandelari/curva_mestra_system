# Scripts de Migração para Firestore

Este diretório contém os scripts necessários para configurar e migrar o sistema para usar o Firestore como banco de dados principal.

## Scripts Disponíveis

### 1. `setup-firestore.js`
Configura a estrutura inicial do Firestore com coleções, índices e usuário administrador.

**Uso:**
```bash
# Configuração básica
node setup-firestore.js setup [clinicId] [clinicName]

# Criar administrador
node setup-firestore.js create-admin <clinicId> <email> <password> [nome]

# Verificar status
node setup-firestore.js status [clinicId]
```

**Exemplos:**
```bash
node setup-firestore.js setup minha-clinica "Clínica Exemplo"
node setup-firestore.js create-admin minha-clinica admin@clinica.com senha123 "Administrador"
node setup-firestore.js status minha-clinica
```

### 2. `migrate-to-firestore.js`
Migra todos os dados do PostgreSQL para o Firestore, mantendo integridade referencial.

**Uso:**
```bash
node migrate-to-firestore.js [clinicId]
```

**Exemplo:**
```bash
node migrate-to-firestore.js minha-clinica
```

**Funcionalidades:**
- Backup automático dos dados PostgreSQL
- Migração em lotes para evitar timeouts
- Transformação de tipos de dados (timestamps, booleans, etc.)
- Validação de integridade após migração
- Log detalhado do processo

### 3. `test-firestore-rules-simple.js`
Testa as regras de segurança do Firestore usando o Firebase Emulator.

**Pré-requisito:**
```bash
# Iniciar o emulador do Firestore
firebase emulators:start --only firestore
```

**Uso:**
```bash
node test-firestore-rules-simple.js
```

**Testes incluídos:**
- Autenticação obrigatória
- Isolamento por clínica
- Controle de permissões por role
- Propriedade de dados

## Estrutura de Dados no Firestore

### Hierarquia de Coleções
```
/clinics/{clinicId}
  ├── /users/{userId}
  ├── /products/{productId}
  │   └── /movements/{movementId}
  ├── /patients/{patientId}
  │   └── /treatments/{treatmentId}
  ├── /requests/{requestId}
  │   └── /products/{productId}
  ├── /invoices/{invoiceId}
  │   └── /products/{productId}
  ├── /stockMovements/{movementId}
  ├── /auditLogs/{logId}
  └── /notifications/{notificationId}
```

### Transformações de Campos

| PostgreSQL | Firestore | Tipo |
|------------|-----------|------|
| `created_at` | `createdAt` | Timestamp |
| `updated_at` | `updatedAt` | Timestamp |
| `is_active` | `isActive` | Boolean |
| `password_hash` | `passwordHash` | String |
| `minimum_stock` | `minimumStock` | Number |
| `current_stock` | `currentStock` | Number |
| `expiration_date` | `expirationDate` | Timestamp |
| `invoice_number` | `invoiceNumber` | String |
| `entry_date` | `entryDate` | Timestamp |
| `entry_user_id` | `entryUserId` | String |
| `birth_date` | `birthDate` | Timestamp |
| `medical_history` | `medicalHistory` | String |
| `requester_id` | `requesterId` | String |
| `request_date` | `requestDate` | Timestamp |
| `approval_date` | `approvalDate` | Timestamp |
| `approver_id` | `approverId` | String |
| `patient_id` | `patientId` | String |
| `issue_date` | `issueDate` | Timestamp |
| `receipt_date` | `receiptDate` | Timestamp |
| `total_value` | `totalValue` | Number |
| `user_id` | `userId` | String |
| `product_id` | `productId` | String |
| `movement_type` | `movementType` | String |
| `request_id` | `requestId` | String |
| `table_name` | `tableName` | String |
| `record_id` | `recordId` | String |
| `old_values` | `oldValues` | Object |
| `new_values` | `newValues` | Object |
| `ip_address` | `ipAddress` | String |
| `user_agent` | `userAgent` | String |
| `is_read` | `isRead` | Boolean |

## Processo de Migração Completo

### 1. Preparação
```bash
# Instalar dependências
npm install

# Configurar credenciais do Firebase
export FIREBASE_SERVICE_ACCOUNT_KEY="path/to/service-account.json"
# ou
export FIREBASE_SERVICE_ACCOUNT_PATH="path/to/service-account.json"
```

### 2. Configuração Inicial
```bash
# Configurar estrutura do Firestore
npm run firestore:setup minha-clinica "Nome da Clínica"

# Criar administrador inicial
node backend/scripts/setup-firestore.js create-admin minha-clinica admin@clinica.com senha123 "Administrador"
```

### 3. Deploy das Regras e Índices
```bash
# Deploy das regras de segurança
firebase deploy --only firestore:rules

# Deploy dos índices compostos
firebase deploy --only firestore:indexes
```

### 4. Testes de Segurança
```bash
# Iniciar emulador (em terminal separado)
firebase emulators:start --only firestore

# Executar testes
npm run firestore:test-rules
```

### 5. Migração de Dados
```bash
# Criar backup do PostgreSQL
npm run backup:db

# Executar migração
npm run firestore:migrate minha-clinica
```

### 6. Validação
```bash
# Verificar status da migração
node backend/scripts/setup-firestore.js status minha-clinica

# Executar testes novamente
npm run firestore:test-rules
```

## Logs e Backups

### Localização dos Arquivos
- **Backups PostgreSQL**: `backend/backups/postgresql-backup-{timestamp}.json`
- **Logs de Migração**: `backend/logs/migration-{clinicId}-{timestamp}.json`

### Estrutura do Log de Migração
```json
{
  "clinicId": "minha-clinica",
  "timestamp": "2024-01-01T10:00:00.000Z",
  "migrationLog": [
    {
      "type": "user",
      "batch": 1,
      "totalBatches": 1,
      "recordsInBatch": 5,
      "timestamp": "2024-01-01T10:00:01.000Z"
    }
  ],
  "errors": [],
  "summary": {
    "totalBatches": 8,
    "totalErrors": 0,
    "success": true
  }
}
```

## Troubleshooting

### Erro: "Could not load the default credentials"
**Solução:**
1. Configurar credenciais do Firebase:
   ```bash
   export FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
   ```
2. Ou usar arquivo de credenciais:
   ```bash
   export FIREBASE_SERVICE_ACCOUNT_PATH="/path/to/service-account.json"
   ```

### Erro: "Permission denied"
**Possíveis causas:**
1. Regras de segurança não deployadas
2. Custom claims não configurados
3. clinicId incorreto no token

**Solução:**
```bash
firebase deploy --only firestore:rules
```

### Erro: "Index not found"
**Solução:**
```bash
firebase deploy --only firestore:indexes
# Aguardar alguns minutos para criação dos índices
```

### Erro: "Test environment not initialized"
**Solução:**
1. Iniciar o emulador do Firestore:
   ```bash
   firebase emulators:start --only firestore
   ```
2. Verificar se a porta 8080 está disponível

### Erro: "Quota exceeded"
**Soluções:**
1. Reduzir tamanho dos lotes na migração
2. Implementar delays entre lotes
3. Verificar limites do projeto Firebase

## Configurações de Ambiente

### Variáveis de Ambiente Necessárias
```bash
# Firebase
FIREBASE_PROJECT_ID=curva-mestra
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
# ou
FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/service-account.json

# Para desenvolvimento com emulador
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
FIRESTORE_EMULATOR_HOST=localhost:8080

# PostgreSQL (para migração)
DATABASE_URL=postgresql://user:password@localhost:5432/database
```

### Configuração do firebase.json
```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "emulators": {
    "firestore": {
      "port": 8080
    },
    "auth": {
      "port": 9099
    }
  }
}
```

## Performance e Otimização

### Boas Práticas
1. **Consultas Eficientes**
   - Usar índices compostos
   - Limitar resultados com `.limit()`
   - Implementar paginação

2. **Estrutura de Dados**
   - Desnormalizar quando necessário
   - Usar subcoleções para dados relacionados
   - Evitar documentos > 1MB

3. **Segurança**
   - Regras restritivas
   - Validação de dados
   - Auditoria de acessos

### Monitoramento
- Firebase Console > Usage and billing
- Métricas de leitura/escrita
- Alertas de quota

## Suporte

Para problemas ou dúvidas:
1. Verificar logs de migração em `backend/logs/`
2. Executar testes de segurança
3. Consultar documentação do Firebase
4. Verificar status das regras e índices no Firebase Console