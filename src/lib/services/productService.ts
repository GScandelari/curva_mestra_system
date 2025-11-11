import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface Product {
  id: string;
  code: string;
  name: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface CreateProductData {
  code: string;
  name: string;
}

export interface UpdateProductData {
  code?: string;
  name?: string;
}

/**
 * Lista todos os produtos Rennova cadastrados
 */
export async function listProducts(): Promise<Product[]> {
  try {
    const productsRef = collection(db, "products");
    const q = query(productsRef, orderBy("code", "asc"));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Product[];
  } catch (error) {
    console.error("Erro ao listar produtos:", error);
    throw error;
  }
}

/**
 * Busca um produto por ID
 */
export async function getProduct(productId: string): Promise<Product | null> {
  try {
    const productRef = doc(db, "products", productId);
    const productDoc = await getDoc(productRef);

    if (!productDoc.exists()) {
      return null;
    }

    return {
      id: productDoc.id,
      ...productDoc.data(),
    } as Product;
  } catch (error) {
    console.error("Erro ao buscar produto:", error);
    throw error;
  }
}

/**
 * Verifica se já existe um produto com o código informado
 */
export async function checkProductCodeExists(code: string, excludeId?: string): Promise<boolean> {
  try {
    const productsRef = collection(db, "products");
    const q = query(productsRef, where("code", "==", code));
    const snapshot = await getDocs(q);

    if (excludeId) {
      // Se estamos editando, ignora o próprio produto
      return snapshot.docs.some((doc) => doc.id !== excludeId);
    }

    return !snapshot.empty;
  } catch (error) {
    console.error("Erro ao verificar código do produto:", error);
    throw error;
  }
}

/**
 * Cria um novo produto Rennova
 */
export async function createProduct(data: CreateProductData): Promise<string> {
  try {
    // Verifica se o código já existe
    const codeExists = await checkProductCodeExists(data.code);
    if (codeExists) {
      throw new Error("Já existe um produto cadastrado com este código");
    }

    const productsRef = collection(db, "products");
    const productData = {
      code: data.code.trim(),
      name: data.name.trim(),
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    };

    const docRef = await addDoc(productsRef, productData);
    return docRef.id;
  } catch (error) {
    console.error("Erro ao criar produto:", error);
    throw error;
  }
}

/**
 * Atualiza um produto existente
 */
export async function updateProduct(
  productId: string,
  data: UpdateProductData
): Promise<void> {
  try {
    // Se está alterando o código, verifica se já existe
    if (data.code) {
      const codeExists = await checkProductCodeExists(data.code, productId);
      if (codeExists) {
        throw new Error("Já existe um produto cadastrado com este código");
      }
    }

    const productRef = doc(db, "products", productId);
    const updateData: any = {
      updated_at: serverTimestamp(),
    };

    if (data.code !== undefined) {
      updateData.code = data.code.trim();
    }
    if (data.name !== undefined) {
      updateData.name = data.name.trim();
    }

    await updateDoc(productRef, updateData);
  } catch (error) {
    console.error("Erro ao atualizar produto:", error);
    throw error;
  }
}

/**
 * Remove um produto
 */
export async function deleteProduct(productId: string): Promise<void> {
  try {
    const productRef = doc(db, "products", productId);
    await deleteDoc(productRef);
  } catch (error) {
    console.error("Erro ao remover produto:", error);
    throw error;
  }
}
