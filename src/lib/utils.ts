import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Timestamp } from "firebase/firestore";
import type { Address } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formata Firestore Timestamp ou Date para string legível
 * Suporta: Timestamp instance, Date instance, serialized timestamp ({_seconds, _nanoseconds}), date string
 */
export function formatTimestamp(timestamp: Timestamp | Date | { _seconds: number; _nanoseconds: number } | string | undefined | null): string {
  if (!timestamp) return "-";

  try {
    let date: Date;

    if (timestamp instanceof Timestamp) {
      // Firestore Timestamp instance
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      // Date instance
      date = timestamp;
    } else if (typeof timestamp === "object" && "_seconds" in timestamp) {
      // Serialized Firestore timestamp from API (JSON)
      date = new Date(timestamp._seconds * 1000);
    } else if (typeof timestamp === "string") {
      // Date string
      date = new Date(timestamp);
    } else {
      return "-";
    }

    // Verificar se a data é válida
    if (isNaN(date.getTime())) {
      return "-";
    }

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
