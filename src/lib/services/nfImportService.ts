/**
 * NF Import Service
 * Gerencia importação de Notas Fiscais (DANFE)
 */

import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import type { NFImport, NFImportCreate, ParsedNF } from '@/types/nf';
import { getProductByCode } from '@/lib/services/productService';
import {
  addInventoryItems,
  calcularQuantidadeInventario,
  type AddInventoryItemsParams,
} from '@/lib/services/inventoryService';

/**
 * Upload de arquivo PDF para Firebase Storage
 */
export async function uploadNFFile(tenantId: string, file: File): Promise<string> {
  try {
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name}`;
    const storageRef = ref(storage, `danfe/${tenantId}/${fileName}`);

    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);

    return downloadURL;
  } catch (error) {
    console.error('Erro ao fazer upload do arquivo:', error);
    throw new Error('Erro ao fazer upload do arquivo');
  }
}

/**
 * Cria um registro de importação de NF
 */
export async function createNFImport(data: NFImportCreate): Promise<string> {
  try {
    const nfImportRef = collection(db, 'tenants', data.tenant_id, 'nf_imports');

    const docRef = await addDoc(nfImportRef, {
      ...data,
      status: 'pending',
      produtos_importados: 0,
      produtos_novos: 0,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });

    return docRef.id;
  } catch (error) {
    console.error('Erro ao criar importação:', error);
    throw new Error('Erro ao criar registro de importação');
  }
}

/**
 * Atualiza status da importação
 */
export async function updateNFImportStatus(
  tenantId: string,
  importId: string,
  status: NFImport['status'],
  data?: {
    produtos_importados?: number;
    produtos_novos?: number;
    error_message?: string;
    parsed_data?: ParsedNF;
  }
): Promise<void> {
  try {
    const importRef = doc(db, 'tenants', tenantId, 'nf_imports', importId);

    await updateDoc(importRef, {
      status,
      ...data,
      updated_at: serverTimestamp(),
    });
  } catch (error) {
    console.error('Erro ao atualizar status:', error);
    throw error;
  }
}

/**
 * Busca importação por ID
 */
export async function getNFImport(tenantId: string, importId: string): Promise<NFImport | null> {
  try {
    const importRef = doc(db, 'tenants', tenantId, 'nf_imports', importId);

    const snapshot = await getDoc(importRef);

    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data();
    return {
      id: snapshot.id,
      tenant_id: data.tenant_id,
      numero_nf: data.numero_nf,
      arquivo_nome: data.arquivo_nome,
      arquivo_url: data.arquivo_url,
      status: data.status,
      produtos_importados: data.produtos_importados || 0,
      produtos_novos: data.produtos_novos || 0,
      error_message: data.error_message,
      parsed_data: data.parsed_data,
      created_at:
        data.created_at instanceof Timestamp ? data.created_at.toDate() : new Date(data.created_at),
      updated_at:
        data.updated_at instanceof Timestamp ? data.updated_at.toDate() : new Date(data.updated_at),
      created_by: data.created_by,
    };
  } catch (error) {
    console.error('Erro ao buscar importação:', error);
    throw error;
  }
}

/**
 * Lista importações de NF do tenant
 */
export async function listNFImports(
  tenantId: string,
  limitResults: number = 50
): Promise<NFImport[]> {
  try {
    const importsRef = collection(db, 'tenants', tenantId, 'nf_imports');

    const q = query(importsRef, orderBy('created_at', 'desc'), limit(limitResults));

    const snapshot = await getDocs(q);
    const imports: NFImport[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      imports.push({
        id: doc.id,
        tenant_id: data.tenant_id,
        numero_nf: data.numero_nf,
        arquivo_nome: data.arquivo_nome,
        arquivo_url: data.arquivo_url,
        status: data.status,
        produtos_importados: data.produtos_importados || 0,
        produtos_novos: data.produtos_novos || 0,
        error_message: data.error_message,
        parsed_data: data.parsed_data,
        created_at:
          data.created_at instanceof Timestamp
            ? data.created_at.toDate()
            : new Date(data.created_at),
        updated_at:
          data.updated_at instanceof Timestamp
            ? data.updated_at.toDate()
            : new Date(data.updated_at),
        created_by: data.created_by,
      });
    });

    return imports;
  } catch (error) {
    console.error('Erro ao listar importações:', error);
    throw error;
  }
}

/**
 * Processa NF confirmada pelo usuário e grava produtos no inventário.
 *
 * Fluxo:
 *   1. Marca import como 'processing'.
 *   2. Para cada NFProduct, busca no catálogo master por código exato (cProd).
 *   3. Se qualquer produto não existe no master, aborta e marca como 'novo_produto_pendente'.
 *   4. Se todos existem, aplica calcularQuantidadeInventario e chama addInventoryItems.
 *   5. Marca import como 'success'.
 */
export async function processNFAndAddToInventory(
  tenantId: string,
  importId: string,
  parsedData: ParsedNF
): Promise<{ success: boolean; message: string }> {
  try {
    await updateNFImportStatus(tenantId, importId, 'processing');

    type ResolvedItem = AddInventoryItemsParams['items'][number];
    const resolvedItems: ResolvedItem[] = [];
    const produtosNovos: string[] = [];

    for (const produto of parsedData.produtos) {
      const masterProduct = await getProductByCode(produto.codigo);

      if (!masterProduct) {
        produtosNovos.push(produto.codigo);
        continue;
      }

      const [day, month, year] = produto.dt_validade.split('/').map(Number);
      const dtValidade = new Date(year, month - 1, day);

      const masterAny = masterProduct as unknown as Record<string, unknown>;
      const fragmentavel = Boolean(masterAny.fragmentavel);
      const unidadesPorEmbalagem = masterAny.unidades_por_embalagem as number | undefined;

      const { quantidade_inicial, valor_unitario } = calcularQuantidadeInventario({
        quantidadeInformada: produto.quantidade,
        fragmentavel,
        unidadesPorEmbalagem,
        valorInformado: produto.valor_unitario,
      });

      resolvedItems.push({
        produto_id: masterProduct.id,
        codigo_produto: produto.codigo,
        nome_produto: produto.nome_produto,
        lote: produto.lote,
        quantidade: quantidade_inicial,
        dt_validade: dtValidade,
        valor_unitario,
        category: masterAny.category as string | undefined,
        fragmentavel,
        unidades_por_embalagem: unidadesPorEmbalagem,
        quantidade_embalagens: fragmentavel ? produto.quantidade : undefined,
        valor_por_embalagem: fragmentavel ? produto.valor_unitario : undefined,
      });
    }

    if (produtosNovos.length > 0) {
      await updateNFImportStatus(tenantId, importId, 'novo_produto_pendente', {
        produtos_importados: 0,
        produtos_novos: produtosNovos.length,
        parsed_data: parsedData,
        error_message: `Produtos não encontrados no catálogo master: ${produtosNovos.join(', ')}`,
      });

      return {
        success: false,
        message: `${produtosNovos.length} produto(s) não encontrado(s) no catálogo master. Solicite ao administrador que cadastre os produtos antes de reimportar.`,
      };
    }

    await addInventoryItems({
      tenantId,
      nfNumero: parsedData.numero,
      nfId: importId,
      items: resolvedItems,
    });

    await updateNFImportStatus(tenantId, importId, 'success', {
      produtos_importados: resolvedItems.length,
      produtos_novos: 0,
      parsed_data: parsedData,
    });

    return {
      success: true,
      message: `${resolvedItems.length} produto(s) adicionado(s) ao estoque com sucesso.`,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro ao processar NF';
    await updateNFImportStatus(tenantId, importId, 'error', {
      error_message: msg,
    });
    return { success: false, message: msg };
  }
}
