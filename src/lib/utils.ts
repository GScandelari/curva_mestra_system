import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Timestamp } from "firebase/firestore";
import type { Address } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formata Firestore Timestamp ou Date para string legível
 */
export function formatTimestamp(timestamp: Timestamp | Date | undefined | null): string {
  if (!timestamp) return "-";

  try {
    const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch (error) {
    return "-";
  }
}

/**
 * Formata CNPJ (00.000.000/0000-00)
 */
export function formatCNPJ(cnpj: string): string {
  const numbers = cnpj.replace(/\D/g, "");
  if (numbers.length !== 14) return cnpj;

  return numbers.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5"
  );
}

/**
 * Formata telefone (00) 00000-0000
 */
export function formatPhone(phone: string): string {
  const numbers = phone.replace(/\D/g, "");
  if (numbers.length === 11) {
    return numbers.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  }
  if (numbers.length === 10) {
    return numbers.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  }
  return phone;
}

/**
 * Formata o endereço para exibição
 * Aceita tanto string quanto objeto Address
 */
export function formatAddress(address?: string | Address): string {
  if (!address) return "Não informado";

  if (typeof address === "string") {
    return address;
  }

  return `${address.street}, ${address.city} - ${address.state}, ${address.zip}`;
}
