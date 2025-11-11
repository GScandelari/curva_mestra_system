/**
 * Serviço para gerenciar Produtos Master (Catálogo Rennova) via Firestore
 * Collection: master_products (global, sem tenant_id)
 */

import {
  collection,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  MasterProduct,
  CreateMasterProductData,
  UpdateMasterProductData,
} from "@/types/masterProduct";

interface ListMasterProductsParams {
  limit?: number;
  activeOnly?: boolean;
  searchTerm?: string;
}

// Converter Timestamp do Firestore para Date
function convertTimestamps(data: any): any {
  const converted = { ...data };
  Object.keys(converted).forEach((key) => {
    if (converted[key] instanceof Timestamp) {
      converted[key] = converted[key].toDate();
    }
  });
  return converted;
}

// Listar todos os produtos master
export async function listMasterProducts(params: ListMasterProductsParams = {}) {
  try {
    const { limit = 100, activeOnly = false, searchTerm = "" } = params;

    console.log("[masterProductService] Iniciando busca de produtos...", { limit, activeOnly, searchTerm });

    // Query simples sem orderBy inicial para evitar erro de índice
    let q = query(
      collection(db, "master_products"),
      firestoreLimit(limit)
    );

    const snapshot = await getDocs(q);
    console.log("[masterProductService] Produtos encontrados:", snapshot.size);

    let products: MasterProduct[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...convertTimestamps(data),
      } as MasterProduct;
    });

    // Filtrar ativos (client-side)
    if (activeOnly) {
      products = products.filter((p) => p.active);
    }

    // Filtrar por termo de busca (client-side, pois Firestore não tem LIKE)
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      products = products.filter(
        (p) =>
          p.code.includes(searchLower) ||
          p.name.toLowerCase().includes(searchLower)
      );
    }

    // Ordenar por código (client-side)
    products.sort((a, b) => a.code.localeCompare(b.code));

    console.log("[masterProductService] Produtos após filtros:", products.length);
    return { products, count: products.length };
  } catch (error: any) {
    console.error("[masterProductService] ERRO DETALHADO:", {
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
      error
    });
    throw new Error(`Erro ao carregar produtos do catálogo: ${error?.message || 'Desconhecido'}`);
  }
}

// Obter detalhes de um produto master
export async function getMasterProduct(productId: string) {
  try {
    const docRef = doc(db, "master_products", productId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error("Produto não encontrado");
    }

    const product: MasterProduct = {
      id: docSnap.id,
      ...convertTimestamps(docSnap.data()),
    } as MasterProduct;

    return { product };
  } catch (error) {
    console.error("Erro ao obter produto master:", error);
    throw error;
  }
}

// Buscar produto por código
export async function getMasterProductByCode(code: string) {
  try {
    const q = query(
      collection(db, "master_products"),
      where("code", "==", code),
      firestoreLimit(1)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return { product: null };
    }

    const docSnap = snapshot.docs[0];
    const product: MasterProduct = {
      id: docSnap.id,
      ...convertTimestamps(docSnap.data()),
    } as MasterProduct;

    return { product };
  } catch (error) {
    console.error("Erro ao buscar produto por código:", error);
    throw error;
  }
}

// Criar novo produto master
export async function createMasterProduct(data: CreateMasterProductData) {
  try {
    const { code, name, active = true } = data;

    // Verificar se já existe produto com este código
    const existing = await getMasterProductByCode(code);
    if (existing.product) {
      throw new Error(`Já existe um produto com o código ${code}`);
    }

    const productData = {
      code: code.trim(),
      name: name.trim().toUpperCase(),
      active,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, "master_products"), productData);

    return {
      productId: docRef.id,
      message: "Produto criado com sucesso",
    };
  } catch (error) {
    console.error("Erro ao criar produto master:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Erro ao criar produto no catálogo");
  }
}

// Atualizar produto master existente
export async function updateMasterProduct(
  productId: string,
  data: UpdateMasterProductData
) {
  try {
    if (!productId) {
      throw new Error("productId é obrigatório");
    }

    const docRef = doc(db, "master_products", productId);

    const firestoreData: any = {
      updated_at: serverTimestamp(),
    };

    if (data.code !== undefined) {
      // Verificar se já existe outro produto com este código
      const existing = await getMasterProductByCode(data.code);
      if (existing.product && existing.product.id !== productId) {
        throw new Error(`Já existe um produto com o código ${data.code}`);
      }
      firestoreData.code = data.code.trim();
    }

    if (data.name !== undefined) {
      firestoreData.name = data.name.trim().toUpperCase();
    }

    if (data.active !== undefined) {
      firestoreData.active = data.active;
    }

    await updateDoc(docRef, firestoreData);

    return {
      productId,
      message: "Produto atualizado com sucesso",
    };
  } catch (error) {
    console.error("Erro ao atualizar produto master:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Erro ao atualizar produto no catálogo");
  }
}

// Desativar produto master (soft delete)
export async function deactivateMasterProduct(productId: string) {
  try {
    if (!productId) {
      throw new Error("productId é obrigatório");
    }

    const docRef = doc(db, "master_products", productId);

    await updateDoc(docRef, {
      active: false,
      updated_at: serverTimestamp(),
    });

    return {
      productId,
      message: "Produto desativado com sucesso",
    };
  } catch (error) {
    console.error("Erro ao desativar produto master:", error);
    throw new Error("Erro ao desativar produto no catálogo");
  }
}

// Reativar produto master
export async function reactivateMasterProduct(productId: string) {
  try {
    if (!productId) {
      throw new Error("productId é obrigatório");
    }

    const docRef = doc(db, "master_products", productId);

    await updateDoc(docRef, {
      active: true,
      updated_at: serverTimestamp(),
    });

    return {
      productId,
      message: "Produto reativado com sucesso",
    };
  } catch (error) {
    console.error("Erro ao reativar produto master:", error);
    throw new Error("Erro ao reativar produto no catálogo");
  }
}

// Deletar produto master permanentemente (usar com cuidado)
export async function deleteMasterProduct(productId: string) {
  try {
    if (!productId) {
      throw new Error("productId é obrigatório");
    }

    const docRef = doc(db, "master_products", productId);
    await deleteDoc(docRef);

    return {
      productId,
      message: "Produto deletado permanentemente",
    };
  } catch (error) {
    console.error("Erro ao deletar produto master:", error);
    throw new Error("Erro ao deletar produto do catálogo");
  }
}
