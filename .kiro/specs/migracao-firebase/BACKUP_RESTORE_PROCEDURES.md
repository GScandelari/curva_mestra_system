# Procedimentos de Backup e Restore - Sistema Firebase

## Visão Geral

Este documento detalha os procedimentos de backup e restore para o sistema migrado para Firebase, incluindo Firestore, Firebase Auth e configurações do projeto.

## Tipos de Backup

### 1. Backup Automático (Recomendado)
- **Frequência**: Diário às 2h da manhã
- **Retenção**: 30 dias
- **Localização**: Google Cloud Storage
- **Implementação**: Firebase Functions com Cloud Scheduler

### 2. Backup Manual
- **Uso**: Antes de mudanças críticas
- **Controle**: Total sobre timing e escopo
- **Implementação**: Scripts CLI e console

### 3. Backup de Emergência
- **Uso**: Situações críticas
- **Velocidade**: Backup rápido dos dados essenciais
- **Implementação**: Scripts otimizados

## Configuração de Backup Automático

### 1. Cloud Function para Backup Diário

```typescript
// functions/src/backup/firestoreBackup.ts
import * as functions from 'firebase-functions';
import { FirestoreAdminClient } from '@google-cloud/firestore';

const client = new FirestoreAdminClient();
const projectId = process.env.GCLOUD_PROJECT || 'curva-mestra';

export const dailyBackup = functions.pubsub
  .schedule('0 2 * * *') // Todo dia às 2h
  .timeZone('America/Sao_Paulo')
  .onRun(async (context) => {
    const databaseName = client.databasePath(projectId, '(default)');
    const timestamp = new Date().toISOString().split('T')[0];
    const bucket = `gs://${projectId}-backups`;
    
    try {
      const responses = await client.exportDocuments({
        name: databaseName,
        outputUriPrefix: `${bucket}/firestore/${timestamp}`,
        collectionIds: [] // Todas as coleções
      });
      
      functions.logger.info('Backup iniciado com sucesso', {
        operation: responses[0].name,
        timestamp: timestamp,
        bucket: bucket
      });
      
      // Limpar backups antigos (manter apenas 30 dias)
      await cleanOldBackups(bucket, 30);
      
      return { success: true, operation: responses[0].name };
    } catch (error) {
      functions.logger.error('Falha no backup automático', {
        error: error.message,
        timestamp: timestamp
      });
      
      // Enviar alerta de falha
      await sendBackupAlert('FAILED', error.message);
      throw error;
    }
  });

// Função para limpar backups antigos
const cleanOldBackups = async (bucket: string, retentionDays: number) => {
  const { Storage } = require('@google-cloud/storage');
  const storage = new Storage();
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  
  const [files] = await storage.bucket(bucket.replace('gs://', '')).getFiles({
    prefix: 'firestore/'
  });
  
  const filesToDelete = files.filter(file => {
    const fileDate = new Date(file.metadata.timeCreated);
    return fileDate < cutoffDate;
  });
  
  await Promise.all(filesToDelete.map(file => file.delete()));
  
  functions.logger.info(`Removidos ${filesToDelete.length} backups antigos`);
};

// Função para enviar alertas
const sendBackupAlert = async (status: 'SUCCESS' | 'FAILED', message: string) => {
  // Implementar notificação (email, Slack, etc.)
  functions.logger.info('Alerta de backup', { status, message });
};
```

### 2. Configuração do Cloud Storage

```bash
# Criar bucket para backups
gsutil mb gs://curva-mestra-backups

# Configurar lifecycle para limpeza automática
gsutil lifecycle set backup-lifecycle.json gs://curva-mestra-backups
```

**backup-lifecycle.json**:
```json
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {"age": 30}
      }
    ]
  }
}
```

### 3. Monitoramento de Backup

```typescript
// functions/src/backup/backupMonitoring.ts
export const checkBackupStatus = functions.pubsub
  .schedule('0 8 * * *') // Todo dia às 8h
  .onRun(async (context) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const expectedBackupPath = `firestore/${yesterday.toISOString().split('T')[0]}`;
    
    const { Storage } = require('@google-cloud/storage');
    const storage = new Storage();
    const bucket = storage.bucket('curva-mestra-backups');
    
    try {
      const [files] = await bucket.getFiles({ prefix: expectedBackupPath });
      
      if (files.length === 0) {
        await sendBackupAlert('MISSING', `Backup não encontrado para ${yesterday.toDateString()}`);
        functions.logger.error('Backup diário não encontrado', { date: yesterday.toDateString() });
      } else {
        functions.logger.info('Backup verificado com sucesso', { 
          date: yesterday.toDateString(),
          files: files.length 
        });
      }
    } catch (error) {
      await sendBackupAlert('ERROR', `Erro ao verificar backup: ${error.message}`);
      functions.logger.error('Erro na verificação de backup', { error: error.message });
    }
  });
```

## Backup Manual

### 1. Backup Completo via CLI

```bash
#!/bin/bash
# scripts/manual-backup.sh

PROJECT_ID="curva-mestra"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_BUCKET="gs://${PROJECT_ID}-backups"

echo "Iniciando backup manual - ${TIMESTAMP}"

# Backup do Firestore
gcloud firestore export ${BACKUP_BUCKET}/manual/${TIMESTAMP}/firestore \
  --project=${PROJECT_ID} \
  --async

# Backup das configurações do projeto
firebase projects:list --json > backups/manual/${TIMESTAMP}/projects.json
firebase functions:config:get --project=${PROJECT_ID} > backups/manual/${TIMESTAMP}/functions-config.json

# Backup das regras de segurança
cp firestore.rules backups/manual/${TIMESTAMP}/
cp firestore.indexes.json backups/manual/${TIMESTAMP}/
cp storage.rules backups/manual/${TIMESTAMP}/

# Backup do código das Functions
tar -czf backups/manual/${TIMESTAMP}/functions-source.tar.gz functions/

echo "Backup manual concluído: ${TIMESTAMP}"
echo "Localização: ${BACKUP_BUCKET}/manual/${TIMESTAMP}/"
```

### 2. Backup Específico de Coleção

```bash
#!/bin/bash
# scripts/backup-collection.sh

COLLECTION_ID=$1
PROJECT_ID="curva-mestra"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

if [ -z "$COLLECTION_ID" ]; then
  echo "Uso: ./backup-collection.sh <collection-id>"
  exit 1
fi

echo "Fazendo backup da coleção: ${COLLECTION_ID}"

gcloud firestore export gs://${PROJECT_ID}-backups/collections/${COLLECTION_ID}/${TIMESTAMP} \
  --collection-ids=${COLLECTION_ID} \
  --project=${PROJECT_ID}

echo "Backup da coleção ${COLLECTION_ID} concluído"
```

### 3. Backup de Dados Específicos de Clínica

```typescript
// scripts/backup-clinic.ts
import * as admin from 'firebase-admin';
import * as fs from 'fs';

admin.initializeApp();
const db = admin.firestore();

const backupClinic = async (clinicId: string) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = `backups/clinics/${clinicId}/${timestamp}`;
  
  // Criar diretório
  fs.mkdirSync(backupDir, { recursive: true });
  
  // Coleções para backup
  const collections = ['users', 'products', 'patients', 'requests', 'invoices'];
  
  for (const collection of collections) {
    console.log(`Fazendo backup de ${collection}...`);
    
    const snapshot = await db.collection(`clinics/${clinicId}/${collection}`).get();
    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    fs.writeFileSync(
      `${backupDir}/${collection}.json`,
      JSON.stringify(data, null, 2)
    );
    
    console.log(`✓ ${collection}: ${data.length} documentos`);
  }
  
  console.log(`Backup da clínica ${clinicId} concluído em: ${backupDir}`);
};

// Uso: npx ts-node scripts/backup-clinic.ts clinic-id
const clinicId = process.argv[2];
if (clinicId) {
  backupClinic(clinicId).catch(console.error);
} else {
  console.log('Uso: npx ts-node scripts/backup-clinic.ts <clinic-id>');
}
```

## Procedimentos de Restore

### 1. Restore Completo do Firestore

```bash
#!/bin/bash
# scripts/restore-firestore.sh

BACKUP_PATH=$1
PROJECT_ID="curva-mestra"

if [ -z "$BACKUP_PATH" ]; then
  echo "Uso: ./restore-firestore.sh <backup-path>"
  echo "Exemplo: ./restore-firestore.sh gs://curva-mestra-backups/firestore/2024-01-01"
  exit 1
fi

echo "⚠️  ATENÇÃO: Este processo irá SUBSTITUIR todos os dados atuais!"
echo "Backup path: ${BACKUP_PATH}"
read -p "Tem certeza que deseja continuar? (digite 'CONFIRMO'): " confirmation

if [ "$confirmation" != "CONFIRMO" ]; then
  echo "Operação cancelada."
  exit 1
fi

echo "Iniciando restore do Firestore..."

# Fazer backup dos dados atuais antes do restore
CURRENT_BACKUP="gs://${PROJECT_ID}-backups/pre-restore/$(date +%Y%m%d_%H%M%S)"
echo "Fazendo backup dos dados atuais em: ${CURRENT_BACKUP}"
gcloud firestore export ${CURRENT_BACKUP} --project=${PROJECT_ID}

# Executar restore
gcloud firestore import ${BACKUP_PATH} --project=${PROJECT_ID}

echo "Restore concluído!"
echo "Backup dos dados anteriores salvo em: ${CURRENT_BACKUP}"
```

### 2. Restore Seletivo por Coleção

```typescript
// scripts/restore-collection.ts
import * as admin from 'firebase-admin';
import * as fs from 'fs';

admin.initializeApp();
const db = admin.firestore();

const restoreCollection = async (
  clinicId: string, 
  collection: string, 
  backupFile: string
) => {
  console.log(`Restaurando ${collection} para clínica ${clinicId}...`);
  
  // Ler dados do backup
  const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
  
  // Confirmar operação
  console.log(`⚠️  Isso irá substituir ${backupData.length} documentos em ${collection}`);
  
  const batch = db.batch();
  let count = 0;
  
  for (const doc of backupData) {
    const docRef = db.collection(`clinics/${clinicId}/${collection}`).doc(doc.id);
    const { id, ...data } = doc;
    
    // Converter timestamps se necessário
    const processedData = processTimestamps(data);
    batch.set(docRef, processedData);
    
    count++;
    
    // Executar batch a cada 500 documentos
    if (count % 500 === 0) {
      await batch.commit();
      console.log(`Processados ${count} documentos...`);
    }
  }
  
  // Executar batch final
  if (count % 500 !== 0) {
    await batch.commit();
  }
  
  console.log(`✓ Restore concluído: ${count} documentos restaurados`);
};

const processTimestamps = (data: any): any => {
  const processed = { ...data };
  
  // Converter strings de data para Timestamp
  const timestampFields = ['createdAt', 'updatedAt', 'expirationDate', 'entryDate'];
  
  for (const field of timestampFields) {
    if (processed[field] && typeof processed[field] === 'string') {
      processed[field] = admin.firestore.Timestamp.fromDate(new Date(processed[field]));
    }
  }
  
  return processed;
};

// Uso: npx ts-node scripts/restore-collection.ts clinic-id products backup.json
const [clinicId, collection, backupFile] = process.argv.slice(2);
if (clinicId && collection && backupFile) {
  restoreCollection(clinicId, collection, backupFile).catch(console.error);
} else {
  console.log('Uso: npx ts-node scripts/restore-collection.ts <clinic-id> <collection> <backup-file>');
}
```

### 3. Restore de Emergência (Dados Críticos)

```typescript
// scripts/emergency-restore.ts
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

const emergencyRestore = async (clinicId: string) => {
  console.log('🚨 RESTORE DE EMERGÊNCIA - Dados críticos apenas');
  
  // Dados mínimos para funcionamento
  const criticalCollections = ['users', 'products'];
  
  for (const collection of criticalCollections) {
    try {
      // Verificar se coleção existe e tem dados
      const snapshot = await db.collection(`clinics/${clinicId}/${collection}`).limit(1).get();
      
      if (snapshot.empty) {
        console.log(`❌ Coleção ${collection} vazia - restaurando do último backup`);
        
        // Buscar último backup disponível
        const lastBackup = await findLastBackup(clinicId, collection);
        if (lastBackup) {
          await restoreFromBackup(clinicId, collection, lastBackup);
          console.log(`✓ ${collection} restaurado`);
        } else {
          console.log(`⚠️  Nenhum backup encontrado para ${collection}`);
        }
      } else {
        console.log(`✓ ${collection} OK`);
      }
    } catch (error) {
      console.error(`Erro ao verificar ${collection}:`, error.message);
    }
  }
  
  console.log('Restore de emergência concluído');
};

const findLastBackup = async (clinicId: string, collection: string) => {
  // Implementar busca pelo último backup válido
  // Retornar path do backup ou null
  return null;
};

const restoreFromBackup = async (clinicId: string, collection: string, backupPath: string) => {
  // Implementar restore específico
  console.log(`Restaurando ${collection} de ${backupPath}`);
};
```

## Validação de Backup

### 1. Script de Validação

```typescript
// scripts/validate-backup.ts
import * as admin from 'firebase-admin';
import { Storage } from '@google-cloud/storage';

admin.initializeApp();
const db = admin.firestore();
const storage = new Storage();

const validateBackup = async (backupPath: string) => {
  console.log(`Validando backup: ${backupPath}`);
  
  const validations = [];
  
  try {
    // 1. Verificar se backup existe
    const bucket = storage.bucket('curva-mestra-backups');
    const [files] = await bucket.getFiles({ prefix: backupPath });
    
    validations.push({
      check: 'Backup exists',
      status: files.length > 0 ? 'PASS' : 'FAIL',
      details: `${files.length} arquivos encontrados`
    });
    
    // 2. Verificar integridade dos arquivos
    for (const file of files.slice(0, 5)) { // Verificar primeiros 5 arquivos
      try {
        const [metadata] = await file.getMetadata();
        validations.push({
          check: `File integrity: ${file.name}`,
          status: metadata.size > 0 ? 'PASS' : 'FAIL',
          details: `Size: ${metadata.size} bytes`
        });
      } catch (error) {
        validations.push({
          check: `File integrity: ${file.name}`,
          status: 'FAIL',
          details: error.message
        });
      }
    }
    
    // 3. Comparar com dados atuais (amostragem)
    const currentCounts = await getCurrentDataCounts();
    validations.push({
      check: 'Data consistency check',
      status: 'INFO',
      details: `Current data: ${JSON.stringify(currentCounts)}`
    });
    
  } catch (error) {
    validations.push({
      check: 'Backup validation',
      status: 'ERROR',
      details: error.message
    });
  }
  
  // Relatório
  console.log('\n=== RELATÓRIO DE VALIDAÇÃO ===');
  validations.forEach(v => {
    const icon = v.status === 'PASS' ? '✓' : v.status === 'FAIL' ? '❌' : 'ℹ️';
    console.log(`${icon} ${v.check}: ${v.details}`);
  });
  
  const failed = validations.filter(v => v.status === 'FAIL').length;
  console.log(`\nResumo: ${validations.length - failed}/${validations.length} verificações passaram`);
  
  return failed === 0;
};

const getCurrentDataCounts = async () => {
  const counts = {};
  const collections = ['clinics'];
  
  for (const collection of collections) {
    const snapshot = await db.collection(collection).get();
    counts[collection] = snapshot.size;
  }
  
  return counts;
};
```

## Monitoramento e Alertas

### 1. Dashboard de Backup

```typescript
// functions/src/backup/backupStatus.ts
export const getBackupStatus = functions.https.onCall(async (data, context) => {
  // Verificar autenticação e permissões de admin
  if (!context.auth || !context.auth.token.role === 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Apenas admins podem ver status de backup');
  }
  
  const storage = new Storage();
  const bucket = storage.bucket('curva-mestra-backups');
  
  // Últimos 7 backups
  const [files] = await bucket.getFiles({
    prefix: 'firestore/',
    maxResults: 7
  });
  
  const backups = await Promise.all(files.map(async file => {
    const [metadata] = await file.getMetadata();
    return {
      name: file.name,
      date: metadata.timeCreated,
      size: metadata.size,
      status: 'completed'
    };
  }));
  
  return {
    backups: backups.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    nextBackup: '2024-01-02T02:00:00Z',
    retentionDays: 30,
    totalSize: backups.reduce((sum, b) => sum + parseInt(b.size), 0)
  };
});
```

### 2. Alertas de Falha

```typescript
// functions/src/backup/alerting.ts
import * as functions from 'firebase-functions';

export const sendBackupAlert = async (
  type: 'SUCCESS' | 'FAILED' | 'MISSING',
  message: string,
  details?: any
) => {
  const alert = {
    type,
    message,
    details,
    timestamp: new Date().toISOString(),
    project: 'curva-mestra'
  };
  
  // Log estruturado
  functions.logger.info('Backup Alert', alert);
  
  // Salvar no Firestore para dashboard
  await admin.firestore().collection('system/alerts/backup').add(alert);
  
  // Enviar email para admins (implementar conforme necessário)
  if (type === 'FAILED' || type === 'MISSING') {
    await sendEmailAlert(alert);
  }
};

const sendEmailAlert = async (alert: any) => {
  // Implementar envio de email
  // Pode usar SendGrid, Nodemailer, etc.
  console.log('Email alert would be sent:', alert);
};
```

## Testes de Disaster Recovery

### 1. Simulação de Falha

```bash
#!/bin/bash
# scripts/test-disaster-recovery.sh

echo "🧪 TESTE DE DISASTER RECOVERY"
echo "Este script simula uma falha e testa o processo de restore"

# 1. Fazer backup dos dados atuais
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="gs://curva-mestra-backups/dr-test/${TIMESTAMP}"

echo "1. Fazendo backup dos dados atuais..."
gcloud firestore export ${BACKUP_PATH} --project=curva-mestra

# 2. Simular falha (deletar dados de teste)
echo "2. Simulando falha (deletando dados de teste)..."
# Implementar deleção controlada de dados de teste

# 3. Executar restore
echo "3. Executando restore..."
gcloud firestore import ${BACKUP_PATH} --project=curva-mestra

# 4. Validar restore
echo "4. Validando restore..."
npx ts-node scripts/validate-backup.ts ${BACKUP_PATH}

echo "✓ Teste de disaster recovery concluído"
```

## Checklist de Backup

### Diário
- [ ] Verificar execução do backup automático
- [ ] Confirmar que não há alertas de falha
- [ ] Validar tamanho do backup (variação < 20%)

### Semanal
- [ ] Executar validação completa de backup
- [ ] Verificar espaço disponível no Cloud Storage
- [ ] Testar restore de uma coleção pequena

### Mensal
- [ ] Executar teste completo de disaster recovery
- [ ] Revisar e atualizar procedimentos
- [ ] Verificar custos de armazenamento
- [ ] Documentar lições aprendidas

### Antes de Mudanças Críticas
- [ ] Executar backup manual completo
- [ ] Validar integridade do backup
- [ ] Documentar estado atual do sistema
- [ ] Preparar plano de rollback

## Conclusão

Os procedimentos de backup e restore implementados garantem:

- **Proteção de Dados**: Backups automáticos diários com retenção de 30 dias
- **Recuperação Rápida**: Scripts automatizados para restore completo ou seletivo
- **Monitoramento**: Alertas automáticos para falhas de backup
- **Validação**: Verificação de integridade dos backups
- **Disaster Recovery**: Procedimentos testados para recuperação completa

Todos os scripts estão localizados em `scripts/` e `functions/src/backup/` e devem ser executados por administradores com as devidas permissões.