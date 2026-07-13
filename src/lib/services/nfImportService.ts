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
import type { NFImport, NFImportCreate, NFNumeroStatus, NFOrigem, ParsedNF } from '@/types/nf';
import { getMasterProductByCode } from '@/lib/services/masterProductService';
import {
  addInventoryItems,
  calcularQuantidadeInventario,
  getInventoryProdutoLoteKeysByNfId,
  type AddInventoryItemsParams,
} from '@/lib/services/inventoryService';
import { registerPendingMasterProducts } from '@/lib/services/pendingMasterProductService';

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

    // Firestore rejeita addDoc() com campos explicitamente undefined
    // (ex: natureza_operacao/forma_pagamento quando o XML não os informa).
    const sanitizedData = Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined)
    );

    const docRef = await addDoc(nfImportRef, {
      ...sanitizedData,
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
    produtos_pendentes?: NFImport['produtos_pendentes'];
    error_message?: string;
    parsed_data?: ParsedNF;
    arquivo_nome?: string;
    arquivo_url?: string;
  }
): Promise<void> {
  try {
    const importRef = doc(db, 'tenants', tenantId, 'nf_imports', importId);

    // Firestore rejeita updateDoc() com campos explicitamente undefined
    // (ex: error_message: undefined quando não há erro) — filtra antes de gravar.
    const sanitizedData = data
      ? Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined))
      : {};

    await updateDoc(importRef, {
      status,
      ...sanitizedData,
      updated_at: serverTimestamp(),
    });
  } catch (error) {
    console.error('Erro ao atualizar status:', error);
    throw error;
  }
}

/**
 * Mapeia um documento Firestore de nf_imports para o tipo NFImport.
 */
function mapNFImportDoc(id: string, data: Record<string, unknown>): NFImport {
  const createdAt = data.created_at;
  const updatedAt = data.updated_at;

  return {
    id,
    tenant_id: data.tenant_id as string,
    numero_nf: data.numero_nf as string,
    origem: (data.origem as NFOrigem) ?? 'manual',
    arquivo_nome: data.arquivo_nome as string,
    arquivo_url: data.arquivo_url as string | undefined,
    status: data.status as NFImport['status'],
    produtos_importados: (data.produtos_importados as number) || 0,
    produtos_novos: (data.produtos_novos as number) || 0,
    produtos_pendentes: data.produtos_pendentes as NFImport['produtos_pendentes'],
    error_message: data.error_message as string | undefined,
    natureza_operacao: data.natureza_operacao as string | undefined,
    forma_pagamento: data.forma_pagamento as string | undefined,
    tipo_nota: data.tipo_nota as NFImport['tipo_nota'],
    parsed_data: data.parsed_data as ParsedNF | undefined,
    created_at: createdAt instanceof Timestamp ? createdAt.toDate() : new Date(createdAt as string),
    updated_at: updatedAt instanceof Timestamp ? updatedAt.toDate() : new Date(updatedAt as string),
    created_by: data.created_by as string,
  };
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

    return mapNFImportDoc(snapshot.id, snapshot.data());
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
    return snapshot.docs.map((docSnap) => mapNFImportDoc(docSnap.id, docSnap.data()));
  } catch (error) {
    console.error('Erro ao listar importações:', error);
    throw error;
  }
}

/**
 * Verifica o estado de um numero_nf para decidir se uma nova tentativa de
 * importação (via XML ou manual) deve ser bloqueada.
 *
 * Regras:
 * - Não existe nenhum import para este numero_nf → permitido (xml ou manual).
 * - Só existem imports de origem 'manual' → manual sempre permitido (fracionado);
 *   xml permitido uma única vez (converte a NF para origem 'xml', travada).
 * - Já existe import de origem 'xml' com produtos pendentes → manual bloqueado;
 *   xml permitido (reenvio do mesmo XML completa os produtos que faltam).
 * - Já existe import de origem 'xml' sem pendências (completo) → bloqueia
 *   qualquer nova tentativa (xml ou manual) para este numero_nf.
 */
export async function checkNumeroNFStatus(
  tenantId: string,
  numeroNf: string,
  attemptedOrigem: NFOrigem
): Promise<NFNumeroStatus> {
  const importsRef = collection(db, 'tenants', tenantId, 'nf_imports');
  const q = query(importsRef, where('numero_nf', '==', numeroNf));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return { exists: false, blocked: false };
  }

  const imports = snapshot.docs.map((docSnap) => mapNFImportDoc(docSnap.id, docSnap.data()));
  const xmlImport = imports.find((i) => i.origem === 'xml');

  if (!xmlImport) {
    // Só existem imports manuais para este numero_nf.
    return { exists: true, blocked: false };
  }

  const hasPending = (xmlImport.produtos_pendentes?.length ?? 0) > 0;

  if (attemptedOrigem === 'manual') {
    return {
      exists: true,
      blocked: true,
      reason: `A NF ${numeroNf} já foi importada via XML e não aceita adição manual de produtos.`,
    };
  }

  if (hasPending) {
    return { exists: true, blocked: false, xmlImport };
  }

  return {
    exists: true,
    blocked: true,
    reason: `A NF ${numeroNf} já foi totalmente importada anteriormente.`,
  };
}

/**
 * Processa NF confirmada pelo usuário e grava produtos no inventário.
 *
 * Fluxo:
 *   1. Marca import como 'processing'.
 *   2. Se for reenvio de uma NF já parcialmente importada (existingXmlImport),
 *      ignora produtos cujo (codigo, lote) já está no inventário desta NF.
 *   3. Para cada NFProduct restante, busca no catálogo master por código exato (cProd).
 *   4. Produtos existentes no master são inseridos imediatamente; os que não
 *      existem viram pendências (registradas para o system_admin cadastrar).
 *   5. Marca import como 'success' (sem pendências) ou 'novo_produto_pendente'
 *      (com pendências) — em ambos os casos os produtos encontrados já foram
 *      adicionados ao estoque.
 */
export async function processNFAndAddToInventory(
  tenantId: string,
  importId: string,
  parsedData: ParsedNF,
  existingXmlImport?: NFImport
): Promise<{ success: boolean; message: string }> {
  try {
    await updateNFImportStatus(tenantId, importId, 'processing');

    type ResolvedItem = AddInventoryItemsParams['items'][number];
    const resolvedItems: ResolvedItem[] = [];
    const produtosPendentes: NonNullable<NFImport['produtos_pendentes']> = [];

    const jaImportados = existingXmlImport
      ? await getInventoryProdutoLoteKeysByNfId(tenantId, existingXmlImport.id)
      : new Set<string>();

    for (const produto of parsedData.produtos) {
      if (jaImportados.has(`${produto.codigo}::${produto.lote}`)) {
        continue; // já importado numa tentativa anterior deste mesmo XML
      }

      const { product: masterProduct } = await getMasterProductByCode(produto.codigo);

      if (!masterProduct) {
        produtosPendentes.push({ codigo: produto.codigo, nome_produto: produto.nome_produto });
        continue;
      }

      const [day, month, year] = produto.dt_validade.split('/').map(Number);
      const dtValidade = new Date(year, month - 1, day);

      const fragmentavel = masterProduct.fragmentavel ?? false;
      const unidadesPorEmbalagem = masterProduct.unidades_por_embalagem;

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
        category: masterProduct.category,
        brand: 'Rennova',
        fragmentavel,
        unidades_por_embalagem: unidadesPorEmbalagem,
        quantidade_embalagens: fragmentavel ? produto.quantidade : undefined,
        valor_por_embalagem: fragmentavel ? produto.valor_unitario : undefined,
      });
    }

    if (resolvedItems.length > 0) {
      await addInventoryItems({
        tenantId,
        nfNumero: parsedData.numero,
        nfId: importId,
        naturezaOperacao: parsedData.natureza_operacao,
        tipoNota: parsedData.tipo_nota,
        items: resolvedItems,
      });
    }

    if (produtosPendentes.length > 0) {
      await registerPendingMasterProducts(
        produtosPendentes.map((p) => ({
          tenant_id: tenantId,
          numero_nf: parsedData.numero,
          nf_id: importId,
          codigo: p.codigo,
          nome_produto: p.nome_produto,
        }))
      );
    }

    const status = produtosPendentes.length > 0 ? 'novo_produto_pendente' : 'success';
    const totalJaImportado = (existingXmlImport?.produtos_importados ?? 0) + resolvedItems.length;

    await updateNFImportStatus(tenantId, importId, status, {
      produtos_importados: totalJaImportado,
      produtos_novos: produtosPendentes.length,
      produtos_pendentes: produtosPendentes,
      parsed_data: parsedData,
      error_message:
        produtosPendentes.length > 0
          ? `Produto(s) ainda não cadastrado(s) no catálogo master: ${produtosPendentes.map((p) => p.codigo).join(', ')}. Reenvie o XML após o cadastro para completar a importação.`
          : undefined,
    });

    if (produtosPendentes.length > 0) {
      return {
        success: resolvedItems.length > 0,
        message: `${resolvedItems.length} produto(s) adicionado(s) ao estoque. ${produtosPendentes.length} produto(s) aguardando cadastro no catálogo master (o administrador foi notificado) — reenvie o XML depois de cadastrados.`,
      };
    }

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
