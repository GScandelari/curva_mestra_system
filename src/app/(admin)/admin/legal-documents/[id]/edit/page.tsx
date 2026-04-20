'use client';

import { useParams } from 'next/navigation';
import { LegalDocumentForm } from '@/components/admin/LegalDocumentForm';

export default function EditLegalDocumentPage() {
  const params = useParams();
  return <LegalDocumentForm mode="edit" documentId={params.id as string} />;
}
