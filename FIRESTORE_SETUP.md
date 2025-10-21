# Configuração do Firestore

Este documento descreve como configurar e migrar o sistema para usar o Firestore como banco de dados principal.

## Visão Geral

A migração para Firestore envolve:
1. Configuração da estrutura de coleções
2. Implementação de regras de segurança
3. Configuração de índices compostos
4. Migração de dados do PostgreSQL
5. Testes de segurança

## Estrutura de Dados

### Hierarquia de Coleções

```
/clinics/{clinicId}
  /users/{userId}
  /products/{productId}
    /movements/{movementId}
  /patients/{patientId}
    /treatments/{treatmentId}
  /requests/{requestId}
    /products/{productId}
  /invoices/{invoiceId}
    /products/{productId}
  /stockMovements/{movementId}
  /auditLogs/{logId}
  /notifications/{notificationId}
```

### Transformações de Dados

| PostgreSQL | Firestore | Transformação |
|------------|-----------|---------------|
| `created_at` | `createdAt` | Timestamp |
| `updated_at` | `updatedAt` | Timestamp |
| `is_active` | `isActive` | Boolean |
| `password_hash` | `passwordHash` | String |
| `minimum_stock` | `minimumStock` | Number |
| `current_stock` | `currentStock` | Number |
| `expiration_date` | `expirationDate` | Timestamp |

## Scripts Disponíveis

### 1. Configuração Inicial

```bash
# Configurar Firestore com estrutura básica
npm run firestore:setup [clinicId] [clinicName]

# Exemplo
npm run firestore:setup minha-clinica "Clínica Exemplo"
```

### 2. Criar Administrador

```bash
# Criar usuário administrador inicial
node backend/scripts/setup-firestore.js create-admin <clinicId> <email> <password> [nome]

# Exemplo
node backend/scripts/setup-firestore.js create-admin minha-clinica admin@clinica.com senha123 "Administrador"
```

### 3. Migração de Dados

```bash
# Migrar dados do PostgreSQL para Firestore
npm run firestore:migrate [clinicId]

# Exemplo
npm run firestore:migrate minha-clinica
```

### 4. Testes de Segurança

```bash
# Executar testes das regras de segurança
npm run firestore:test-rules
```

### 5. Verificar Status

```bash
# Verificar status da configuração
node backend/scripts/setup-firestore.js status [clinicId]
```

## Regras de Segurança

### Princípios

1. **Autenticação Obrigatória**: Todos os usuários devem estar autenticados
2. **Isolamento por Clínica**: Usuários só acessam dados da própria clínica
3. **Controle por Roles**: Permissões baseadas em funções (admin, doctor, etc.)
4. **Propriedade de Dados**: Usuários podem modificar apenas seus próprios dados

### Roles e Permissões

| Role | Permissões |
|------|------------|
| `admin` | Acesso total, criar/deletar usuários, logs de auditoria |
| `manager` | Gerenciar produtos, notas fiscais, aprovar solicitações |
| `doctor` | Criar tratamentos, gerenciar pacientes, solicitar produtos |
| `receptionist` | Visualizar dados, criar solicitações, gerenciar pacientes |

### Exemplos de Regras

```javascript
// Usuário pode ler dados da própria clínica
allow read: if sameClinic(clinicId);

// Apenas admins podem criar usuários
allow create: if sameClinic(clinicId) && hasRole('admin');

// Usuário pode modificar suas próprias solicitações
allow update: if sameClinic(clinicId) && 
  resource.data.requesterId == request.auth.uid;
```

## Índices Compostos

### Índices Principais

1. **Produtos por categoria e vencimento**
   ```json
   {
     "collectionGroup": "products",
     "fields": [
       { "fieldPath": "category", "order": "ASCENDING" },
       { "fieldPath": "expirationDate", "order": "ASCENDING" }
     ]
   }
   ```

2. **Produtos com estoque baixo**
   ```json
   {
     "collectionGroup": "products", 
     "fields": [
       { "fieldPath": "currentStock", "order": "ASCENDING" },
       { "fieldPath": "minimumStock", "order": "ASCENDING" }
     ]
   }
   ```

3. **Solicitações por status e data**
   ```json
   {
     "collectionGroup": "requests",
     "fields": [
       { "fieldPath": "status", "order": "ASCENDING" },
       { "fieldPath": "requestDate", "order": "DESCENDING" }
     ]
   }
   ```

### Deploy dos Índices

```bash
# Deploy das regras e índices
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

## Processo de Migração

### Pré-requisitos

1. Firebase CLI instalado e configurado
2. Projeto Firebase configurado
3. Credenciais de serviço configuradas
4. Backup do PostgreSQL criado

### Passos da Migração

1. **Preparação**
   ```bash
   # Instalar dependências
   cd backend
   npm install
   
   # Configurar Firebase
   npm run firestore:setup
   ```

2. **Backup dos Dados**
   ```bash
   # Criar backup do PostgreSQL
   npm run backup:db
   ```

3. **Migração**
   ```bash
   # Executar migração
   npm run firestore:migrate
   ```

4. **Validação**
   ```bash
   # Testar regras de segurança
   npm run firestore:test-rules
   
   # Verificar status
   node backend/scripts/setup-firestore.js status
   ```

5. **Deploy**
   ```bash
   # Deploy das configurações
   firebase deploy --only firestore
   ```

## Monitoramento e Manutenção

### Logs de Migração

Os logs são salvos em:
- `backend/logs/migration-{clinicId}-{timestamp}.json`
- `backend/backups/postgresql-backup-{timestamp}.json`

### Validação de Integridade

O script de migração inclui validação automática que compara:
- Contagem de registros PostgreSQL vs Firestore
- Integridade referencial
- Tipos de dados

### Troubleshooting

#### Erro: "Permission denied"
- Verificar se as regras de segurança estão deployadas
- Confirmar custom claims do usuário
- Validar clinicId no token

#### Erro: "Index not found"
- Deploy dos índices: `firebase deploy --only firestore:indexes`
- Aguardar criação dos índices (pode levar alguns minutos)

#### Erro: "Quota exceeded"
- Verificar limites do Firestore
- Implementar paginação nas consultas
- Otimizar tamanho dos documentos

## Custos e Performance

### Otimizações

1. **Consultas Eficientes**
   - Usar índices compostos
   - Limitar resultados com `.limit()`
   - Implementar paginação

2. **Estrutura de Dados**
   - Desnormalizar quando necessário
   - Usar subcoleções para dados relacionados
   - Evitar documentos muito grandes

3. **Cache**
   - Implementar cache local
   - Usar listeners em tempo real apenas quando necessário
   - Cache de consultas frequentes

### Monitoramento de Custos

- Firebase Console > Usage and billing
- Alertas de quota
- Métricas de leitura/escrita

## Segurança

### Boas Práticas

1. **Autenticação**
   - Usar Firebase Auth
   - Implementar custom claims
   - Validar tokens no backend

2. **Autorização**
   - Regras de segurança restritivas
   - Princípio do menor privilégio
   - Auditoria de acessos

3. **Dados Sensíveis**
   - Não armazenar senhas em texto plano
   - Criptografar dados sensíveis
   - Logs de auditoria para alterações

## Suporte

Para problemas ou dúvidas:
1. Verificar logs de migração
2. Executar testes de segurança
3. Consultar documentação do Firebase
4. Verificar status das regras e índices

## Referências

- [Documentação do Firestore](https://firebase.google.com/docs/firestore)
- [Regras de Segurança](https://firebase.google.com/docs/firestore/security/get-started)
- [Índices Compostos](https://firebase.google.com/docs/firestore/query-data/indexing)
- [Firebase CLI](https://firebase.google.com/docs/cli)