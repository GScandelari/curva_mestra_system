# Guia de Troubleshooting - Sistema Firebase

## Visão Geral

Este guia fornece soluções para problemas comuns encontrados no sistema migrado para Firebase, incluindo diagnósticos, soluções e procedimentos de recuperação.

## Problemas de Autenticação

### 1. Usuário não consegue fazer login

#### Sintomas
- Erro "Invalid email or password"
- Erro "User not found"
- Login fica carregando indefinidamente

#### Diagnóstico
```typescript
// Frontend - Debug de autenticação
import { auth } from './firebase-config';

const debugLogin = async (email: string, password: string) => {
  try {
    console.log('Tentando login para:', email);
    
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    console.log('Login bem-sucedido:', {
      uid: user.uid,
      email: user.email,
      emailVerified: user.emailVerified
    });
    
    // Verificar custom claims
    const idTokenResult = await user.getIdTokenResult();
    console.log('Custom claims:', idTokenResult.claims);
    
    if (!idTokenResult.claims.clinicId) {
      console.error('❌ Usuário sem clinicId definido');
    }
    
  } catch (error) {
    console.error('Erro no login:', {
      code: error.code,
      message: error.message
    });
  }
};
```

#### Soluções

**Problema: Usuário não migrado**
```bash
# Verificar se usuário existe no Firebase Auth
firebase auth:export users.json --project curva-mestra
grep "email@exemplo.com" users.json

# Se não existir, executar migração específica
cd backend
node scripts/migrate-users-to-firebase.js --email="email@exemplo.com"
```

**Problema: Custom claims ausentes**
```typescript
// Functions - Reconfigurar custom claims
export const fixUserClaims = functions.https.onCall(async (data, context) => {
  if (!context.auth || context.auth.token.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Apenas admins');
  }
  
  const { uid, role, clinicId } = data;
  
  await admin.auth().setCustomUserClaims(uid, {
    role: role,
    clinicId: clinicId,
    permissions: getRolePermissions(role),
    migrated: true,
    fixedAt: new Date().toISOString()
  });
  
  return { success: true, message: 'Claims atualizados' };
});
```

**Problema: Senha incorreta após migração**
```bash
# Reset de senha via Firebase CLI
firebase auth:import users.json --hash-algo=BCRYPT --project curva-mestra

# Ou forçar reset de senha
node -e "
const admin = require('firebase-admin');
admin.initializeApp();
admin.auth().generatePasswordResetLink('email@exemplo.com')
  .then(link => console.log('Reset link:', link));
"
```

### 2. Erro "Permission denied" no Firestore

#### Sintomas
- Erro ao carregar dados
- Operações de escrita falhando
- Console mostra "Missing or insufficient permissions"

#### Diagnóstico
```typescript
// Frontend - Verificar permissões
const debugFirestoreAccess = async () => {
  const user = auth.currentUser;
  if (!user) {
    console.error('❌ Usuário não autenticado');
    return;
  }
  
  const idTokenResult = await user.getIdTokenResult();
  console.log('Token claims:', idTokenResult.claims);
  
  // Testar acesso a uma coleção
  try {
    const testDoc = await db.collection('clinics/test-clinic/products').limit(1).get();
    console.log('✓ Acesso ao Firestore OK');
  } catch (error) {
    console.error('❌ Erro de acesso:', error.message);
    
    // Verificar regras específicas
    if (error.code === 'permission-denied') {
      console.log('Verificar:');
      console.log('1. Custom claims do usuário');
      console.log('2. Regras de segurança do Firestore');
      console.log('3. Estrutura de dados (clinicId correto)');
    }
  }
};
```

#### Soluções

**Problema: Regras de segurança muito restritivas**
```javascript
// firestore.rules - Regras de debug (temporárias)
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // TEMPORÁRIO: Permitir leitura para debug
    match /{document=**} {
      allow read: if request.auth != null;
      allow write: if false; // Manter escrita restrita
    }
  }
}
```

**Problema: clinicId incorreto ou ausente**
```typescript
// Functions - Corrigir clinicId do usuário
export const fixUserClinic = functions.https.onCall(async (data, context) => {
  const { uid, clinicId } = data;
  
  // Verificar se clínica existe
  const clinicDoc = await admin.firestore().collection('clinics').doc(clinicId).get();
  if (!clinicDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Clínica não encontrada');
  }
  
  // Atualizar custom claims
  const currentClaims = (await admin.auth().getUser(uid)).customClaims || {};
  await admin.auth().setCustomUserClaims(uid, {
    ...currentClaims,
    clinicId: clinicId,
    fixedAt: new Date().toISOString()
  });
  
  return { success: true };
});
```

## Problemas de Performance

### 1. Consultas lentas no Firestore

#### Sintomas
- Carregamento lento de listas
- Timeout em consultas
- Alto uso de reads no Firebase Console

#### Diagnóstico
```typescript
// Frontend - Medir performance de consultas
import { trace } from 'firebase/performance';

const measureQuery = async (queryName: string, queryFn: () => Promise<any>) => {
  const t = trace(performance, `query_${queryName}`);
  t.start();
  
  const startTime = Date.now();
  
  try {
    const result = await queryFn();
    const duration = Date.now() - startTime;
    
    t.putAttribute('duration_ms', duration.toString());
    t.putAttribute('result_count', result.length?.toString() || '1');
    
    console.log(`Query ${queryName}:`, {
      duration: `${duration}ms`,
      resultCount: result.length || 1,
      performance: duration < 1000 ? '✓ Good' : duration < 3000 ? '⚠️ Slow' : '❌ Very Slow'
    });
    
    return result;
  } finally {
    t.stop();
  }
};

// Uso
const products = await measureQuery('products_list', () => 
  firebaseProductService.getProducts({ category: 'injetaveis' })
);
```

#### Soluções

**Problema: Índices ausentes**
```bash
# Verificar índices necessários no console
# Firebase Console > Firestore > Indexes

# Criar índices via CLI
firebase firestore:indexes --project curva-mestra

# Adicionar índice específico
# firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "products",
      "queryScope": "COLLECTION",
      "fields": [
        {"fieldPath": "clinicId", "order": "ASCENDING"},
        {"fieldPath": "category", "order": "ASCENDING"},
        {"fieldPath": "expirationDate", "order": "ASCENDING"}
      ]
    }
  ]
}
```

**Problema: Consultas ineficientes**
```typescript
// ❌ Consulta ineficiente
const getAllProducts = async () => {
  const snapshot = await db.collection('clinics/clinic1/products').get();
  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(product => product.category === 'injetaveis')
    .filter(product => product.currentStock > 0);
};

// ✅ Consulta otimizada
const getProductsOptimized = async (category: string) => {
  const snapshot = await db
    .collection('clinics/clinic1/products')
    .where('category', '==', category)
    .where('currentStock', '>', 0)
    .get();
    
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};
```

**Problema: Cache inadequado**
```typescript
// Implementar cache inteligente
class FirestoreCache {
  private cache = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutos
  
  async get(key: string, queryFn: () => Promise<any>) {
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      console.log(`Cache hit: ${key}`);
      return cached.data;
    }
    
    console.log(`Cache miss: ${key}`);
    const data = await queryFn();
    
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    
    return data;
  }
  
  invalidate(pattern: string) {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}

const cache = new FirestoreCache();

// Uso
const getProductsCached = (clinicId: string, category: string) => {
  return cache.get(`products_${clinicId}_${category}`, () =>
    firebaseProductService.getProducts({ category })
  );
};
```

### 2. Firebase Functions timeout

#### Sintomas
- Erro "Function execution took longer than 60 seconds"
- Operações não completam
- Logs mostram timeout

#### Diagnóstico
```typescript
// Functions - Monitorar tempo de execução
export const slowFunction = functions
  .runWith({ timeoutSeconds: 300 }) // Aumentar timeout temporariamente
  .https.onCall(async (data, context) => {
    const startTime = Date.now();
    
    try {
      // Operação lenta
      const result = await processLargeDataset(data);
      
      const duration = Date.now() - startTime;
      functions.logger.info('Function completed', {
        duration: `${duration}ms`,
        dataSize: data.length
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      functions.logger.error('Function failed', {
        duration: `${duration}ms`,
        error: error.message
      });
      throw error;
    }
  });
```

#### Soluções

**Problema: Processamento em lote muito grande**
```typescript
// ❌ Processar tudo de uma vez
const migrateAllData = async (data: any[]) => {
  for (const item of data) {
    await processItem(item);
  }
};

// ✅ Processar em lotes menores
const migrateDataInBatches = async (data: any[], batchSize = 100) => {
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    
    await Promise.all(batch.map(processItem));
    
    // Pequena pausa para evitar rate limiting
    if (i + batchSize < data.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    functions.logger.info(`Processed batch ${i / batchSize + 1}/${Math.ceil(data.length / batchSize)}`);
  }
};
```

**Problema: Consultas Firestore lentas**
```typescript
// ✅ Otimizar consultas em Functions
const getProductsEfficient = async (clinicId: string) => {
  // Usar cursor para paginação
  const pageSize = 100;
  let lastDoc = null;
  const allProducts = [];
  
  do {
    let query = db
      .collection(`clinics/${clinicId}/products`)
      .limit(pageSize);
    
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    
    const snapshot = await query.get();
    
    if (snapshot.empty) break;
    
    allProducts.push(...snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    
  } while (lastDoc);
  
  return allProducts;
};
```

## Problemas de Dados

### 1. Dados inconsistentes após migração

#### Sintomas
- Contagens não batem
- Referências quebradas
- Dados duplicados ou ausentes

#### Diagnóstico
```typescript
// Scripts - Verificar integridade dos dados
const validateDataIntegrity = async (clinicId: string) => {
  const issues = [];
  
  // 1. Verificar referências órfãs
  const requests = await db.collection(`clinics/${clinicId}/requests`).get();
  
  for (const requestDoc of requests.docs) {
    const request = requestDoc.data();
    
    if (request.products) {
      for (const productRef of request.products) {
        const productDoc = await db.doc(`clinics/${clinicId}/products/${productRef.id}`).get();
        
        if (!productDoc.exists) {
          issues.push({
            type: 'orphaned_reference',
            collection: 'requests',
            document: requestDoc.id,
            issue: `Produto ${productRef.id} não existe`
          });
        }
      }
    }
  }
  
  // 2. Verificar duplicatas
  const products = await db.collection(`clinics/${clinicId}/products`).get();
  const invoiceNumbers = new Map();
  
  for (const productDoc of products.docs) {
    const product = productDoc.data();
    const invoiceNumber = product.invoiceNumber;
    
    if (invoiceNumbers.has(invoiceNumber)) {
      issues.push({
        type: 'duplicate_invoice',
        collection: 'products',
        documents: [invoiceNumbers.get(invoiceNumber), productDoc.id],
        issue: `Nota fiscal ${invoiceNumber} duplicada`
      });
    } else {
      invoiceNumbers.set(invoiceNumber, productDoc.id);
    }
  }
  
  return issues;
};
```

#### Soluções

**Problema: Referências quebradas**
```typescript
// Script para corrigir referências
const fixBrokenReferences = async (clinicId: string) => {
  const batch = db.batch();
  let fixCount = 0;
  
  const requests = await db.collection(`clinics/${clinicId}/requests`).get();
  
  for (const requestDoc of requests.docs) {
    const request = requestDoc.data();
    let needsUpdate = false;
    
    if (request.products) {
      const validProducts = [];
      
      for (const productRef of request.products) {
        const productDoc = await db.doc(`clinics/${clinicId}/products/${productRef.id}`).get();
        
        if (productDoc.exists) {
          validProducts.push(productRef);
        } else {
          console.log(`Removendo referência órfã: ${productRef.id}`);
          needsUpdate = true;
        }
      }
      
      if (needsUpdate) {
        batch.update(requestDoc.ref, { products: validProducts });
        fixCount++;
      }
    }
  }
  
  if (fixCount > 0) {
    await batch.commit();
    console.log(`✓ Corrigidas ${fixCount} referências quebradas`);
  }
};
```

**Problema: Dados duplicados**
```typescript
// Script para remover duplicatas
const removeDuplicates = async (clinicId: string) => {
  const products = await db.collection(`clinics/${clinicId}/products`).get();
  const invoiceMap = new Map();
  const duplicates = [];
  
  // Identificar duplicatas
  for (const doc of products.docs) {
    const product = doc.data();
    const invoiceNumber = product.invoiceNumber;
    
    if (invoiceMap.has(invoiceNumber)) {
      // Manter o mais recente
      const existing = invoiceMap.get(invoiceNumber);
      const existingDate = existing.data.createdAt?.toDate() || new Date(0);
      const currentDate = product.createdAt?.toDate() || new Date(0);
      
      if (currentDate > existingDate) {
        duplicates.push(existing.doc);
        invoiceMap.set(invoiceNumber, { doc, data: product });
      } else {
        duplicates.push(doc);
      }
    } else {
      invoiceMap.set(invoiceNumber, { doc, data: product });
    }
  }
  
  // Remover duplicatas
  const batch = db.batch();
  duplicates.forEach(doc => batch.delete(doc.ref));
  
  if (duplicates.length > 0) {
    await batch.commit();
    console.log(`✓ Removidas ${duplicates.length} duplicatas`);
  }
};
```

### 2. Problemas de sincronização em tempo real

#### Sintomas
- Dados não atualizam automaticamente
- Múltiplas versões dos mesmos dados
- Conflitos de escrita

#### Diagnóstico
```typescript
// Frontend - Debug de listeners
const debugRealtimeUpdates = () => {
  const unsubscribe = db
    .collection('clinics/clinic1/products')
    .onSnapshot(
      (snapshot) => {
        console.log('Snapshot received:', {
          size: snapshot.size,
          fromCache: snapshot.metadata.fromCache,
          hasPendingWrites: snapshot.metadata.hasPendingWrites
        });
        
        snapshot.docChanges().forEach((change) => {
          console.log(`Document ${change.type}:`, {
            id: change.doc.id,
            data: change.doc.data()
          });
        });
      },
      (error) => {
        console.error('Listener error:', error);
      }
    );
  
  return unsubscribe;
};
```

#### Soluções

**Problema: Listeners não configurados corretamente**
```typescript
// ✅ Configurar listeners robustos
const useRealtimeProducts = (clinicId: string) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    if (!clinicId) return;
    
    const unsubscribe = db
      .collection(`clinics/${clinicId}/products`)
      .onSnapshot(
        (snapshot) => {
          const productsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          setProducts(productsData);
          setLoading(false);
          setError(null);
        },
        (err) => {
          console.error('Products listener error:', err);
          setError(err.message);
          setLoading(false);
        }
      );
    
    return unsubscribe;
  }, [clinicId]);
  
  return { products, loading, error };
};
```

**Problema: Conflitos de escrita**
```typescript
// ✅ Usar transações para operações críticas
const updateProductStock = async (productId: string, adjustment: number) => {
  const productRef = db.doc(`clinics/${clinicId}/products/${productId}`);
  
  await db.runTransaction(async (transaction) => {
    const productDoc = await transaction.get(productRef);
    
    if (!productDoc.exists) {
      throw new Error('Produto não encontrado');
    }
    
    const currentStock = productDoc.data().currentStock || 0;
    const newStock = currentStock + adjustment;
    
    if (newStock < 0) {
      throw new Error('Estoque insuficiente');
    }
    
    transaction.update(productRef, {
      currentStock: newStock,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Registrar movimento
    const movementRef = db.collection(`clinics/${clinicId}/stockMovements`).doc();
    transaction.set(movementRef, {
      productId,
      type: adjustment > 0 ? 'entry' : 'exit',
      quantity: Math.abs(adjustment),
      previousStock: currentStock,
      newStock: newStock,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });
};
```

## Problemas de Deploy

### 1. Falha no deploy das Functions

#### Sintomas
- Erro durante `firebase deploy --only functions`
- Functions não aparecem no console
- Timeout durante deploy

#### Diagnóstico
```bash
# Verificar logs de deploy
firebase functions:log --project curva-mestra

# Verificar configuração
firebase functions:config:get --project curva-mestra

# Testar build local
cd functions
npm run build
```

#### Soluções

**Problema: Dependências ausentes**
```bash
# Limpar e reinstalar dependências
cd functions
rm -rf node_modules package-lock.json
npm install

# Verificar versões
npm ls firebase-functions
npm ls firebase-admin
```

**Problema: Timeout de deploy**
```bash
# Deploy individual de functions
firebase deploy --only functions:createProduct --project curva-mestra
firebase deploy --only functions:getProducts --project curva-mestra

# Ou usar deploy paralelo
firebase deploy --only functions --project curva-mestra --force
```

**Problema: Configuração de ambiente**
```bash
# Configurar variáveis de ambiente
firebase functions:config:set \
  app.project_id="curva-mestra" \
  app.clinic_id="default-clinic" \
  --project curva-mestra

# Verificar configuração
firebase functions:config:get --project curva-mestra
```

### 2. Problemas no Firebase Hosting

#### Sintomas
- Site não carrega
- Erro 404 em rotas
- Assets não encontrados

#### Diagnóstico
```bash
# Verificar status do hosting
firebase hosting:sites:list --project curva-mestra

# Verificar deploy history
firebase hosting:releases:list --project curva-mestra

# Testar build local
cd frontend
npm run build
firebase serve --only hosting
```

#### Soluções

**Problema: Build incorreto**
```bash
# Limpar e rebuildar
cd frontend
rm -rf dist node_modules
npm install
npm run build

# Verificar se dist/ foi criado corretamente
ls -la dist/
```

**Problema: Configuração de SPA**
```json
// firebase.json - Configuração correta para SPA
{
  "hosting": {
    "public": "frontend/dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

## Ferramentas de Diagnóstico

### 1. Health Check Completo

```typescript
// functions/src/utils/healthCheck.ts
export const systemHealthCheck = functions.https.onRequest(async (req, res) => {
  const checks = {
    timestamp: new Date().toISOString(),
    firestore: { status: 'unknown', details: '' },
    auth: { status: 'unknown', details: '' },
    functions: { status: 'unknown', details: '' },
    overall: 'unknown'
  };
  
  try {
    // Testar Firestore
    const testDoc = await db.collection('health').doc('test').set({
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    checks.firestore = { status: 'healthy', details: 'Write/read successful' };
  } catch (error) {
    checks.firestore = { status: 'unhealthy', details: error.message };
  }
  
  try {
    // Testar Auth
    const users = await admin.auth().listUsers(1);
    checks.auth = { status: 'healthy', details: `${users.users.length} users accessible` };
  } catch (error) {
    checks.auth = { status: 'unhealthy', details: error.message };
  }
  
  // Determinar status geral
  const unhealthyServices = Object.values(checks)
    .filter(check => typeof check === 'object' && check.status === 'unhealthy').length;
  
  checks.overall = unhealthyServices === 0 ? 'healthy' : 
                   unhealthyServices === 1 ? 'degraded' : 'unhealthy';
  
  const statusCode = checks.overall === 'healthy' ? 200 : 
                     checks.overall === 'degraded' ? 207 : 503;
  
  res.status(statusCode).json(checks);
});
```

### 2. Script de Diagnóstico Completo

```bash
#!/bin/bash
# scripts/diagnose-system.sh

echo "🔍 DIAGNÓSTICO COMPLETO DO SISTEMA"
echo "=================================="

# 1. Verificar conectividade Firebase
echo "1. Testando conectividade Firebase..."
firebase projects:list --json > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✓ Firebase CLI conectado"
else
  echo "❌ Problema com Firebase CLI"
fi

# 2. Verificar status dos serviços
echo "2. Verificando status dos serviços..."
curl -s "https://us-central1-curva-mestra.cloudfunctions.net/systemHealthCheck" | jq '.'

# 3. Verificar Functions
echo "3. Verificando Functions..."
firebase functions:list --project curva-mestra

# 4. Verificar Hosting
echo "4. Verificando Hosting..."
firebase hosting:sites:list --project curva-mestra

# 5. Verificar Firestore
echo "5. Verificando Firestore..."
firebase firestore:databases:list --project curva-mestra

# 6. Verificar logs recentes
echo "6. Logs recentes (últimos 10 minutos)..."
firebase functions:log --limit 10 --project curva-mestra

echo "=================================="
echo "✓ Diagnóstico concluído"
```

## Contatos de Suporte

### Escalação de Problemas

1. **Nível 1 - Problemas Comuns**
   - Consultar este guia
   - Verificar logs do Firebase Console
   - Executar scripts de diagnóstico

2. **Nível 2 - Problemas Técnicos**
   - Executar health check completo
   - Analisar logs detalhados
   - Verificar configurações do projeto

3. **Nível 3 - Problemas Críticos**
   - Executar procedimentos de emergência
   - Considerar rollback se necessário
   - Documentar incidente para análise

### Informações para Suporte

Ao reportar problemas, incluir:
- **Timestamp** do problema
- **Clinic ID** afetado
- **Logs** relevantes (Firebase Console, browser DevTools)
- **Passos** para reproduzir
- **Impacto** no negócio
- **Tentativas** de solução já realizadas

### Logs Importantes

- **Firebase Functions**: Firebase Console > Functions > Logs
- **Firestore**: Firebase Console > Firestore > Usage
- **Authentication**: Firebase Console > Authentication > Users
- **Hosting**: Firebase Console > Hosting > Usage
- **Performance**: Firebase Console > Performance
- **Analytics**: Firebase Console > Analytics

## Conclusão

Este guia cobre os problemas mais comuns encontrados no sistema Firebase. Para situações não cobertas:

1. Consulte a documentação oficial do Firebase
2. Verifique o status dos serviços Google Cloud
3. Execute os scripts de diagnóstico fornecidos
4. Documente novos problemas para futuras referências

Mantenha este guia atualizado conforme novos problemas são identificados e solucionados.