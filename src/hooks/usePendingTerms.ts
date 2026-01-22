import { useState, useEffect } from "react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { LegalDocument } from "@/types";

export function usePendingTerms() {
  const [loading, setLoading] = useState(true);
  const [hasPendingTerms, setHasPendingTerms] = useState(false);
  const [pendingDocuments, setPendingDocuments] = useState<LegalDocument[]>([]);

  useEffect(() => {
    checkPendingTerms();
  }, [auth.currentUser]); // Re-executar quando usuário mudar

  async function checkPendingTerms() {
    if (!auth.currentUser) {
      console.log("[usePendingTerms] Nenhum usuário autenticado");
      setLoading(false);
      return;
    }

    console.log("[usePendingTerms] Verificando termos para usuário:", auth.currentUser.uid);

    try {
      // Buscar TODOS documentos ativos (tanto para novos quanto para existentes)
      const q = query(
        collection(db, "legal_documents"),
        where("status", "==", "ativo"),
        orderBy("order", "asc")
      );
      const docsSnapshot = await getDocs(q);
      const allDocs = docsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as LegalDocument[];

      console.log("[usePendingTerms] Total de documentos ativos:", allDocs.length);

      // Filtrar apenas documentos obrigatórios (para registro OU para usuários existentes)
      const docs = allDocs.filter(
        (doc) => doc.required_for_registration || doc.required_for_existing_users
      );

      console.log("[usePendingTerms] Documentos obrigatórios:", docs.length);
      docs.forEach(doc => {
        console.log(`  - ${doc.title} (v${doc.version}): reg=${doc.required_for_registration}, exist=${doc.required_for_existing_users}`);
      });

      // Buscar aceitações existentes do usuário
      const acceptancesQuery = query(
        collection(db, "user_document_acceptances"),
        where("user_id", "==", auth.currentUser.uid)
      );
      const acceptancesSnapshot = await getDocs(acceptancesQuery);

      console.log("[usePendingTerms] Aceitações existentes:", acceptancesSnapshot.size);

      // Criar mapa de documentos aceitos com suas versões
      const acceptedDocs = new Map(
        acceptancesSnapshot.docs.map((doc) => [
          doc.data().document_id,
          doc.data().document_version,
        ])
      );

      // Filtrar documentos pendentes (não aceitos ou versão diferente)
      const pending = docs.filter((doc) => {
        const acceptedVersion = acceptedDocs.get(doc.id);
        const isPending = !acceptedVersion || acceptedVersion !== doc.version;
        console.log(`  - ${doc.title}: aceito=${acceptedVersion}, versão atual=${doc.version}, pendente=${isPending}`);
        return isPending;
      });

      console.log("[usePendingTerms] Documentos pendentes:", pending.length);

      setHasPendingTerms(pending.length > 0);
      setPendingDocuments(pending);
    } catch (error) {
      console.error("[usePendingTerms] Erro ao verificar termos pendentes:", error);
    } finally {
      setLoading(false);
    }
  }

  return { loading, hasPendingTerms, pendingDocuments, refetch: checkPendingTerms };
}
