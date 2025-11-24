/**
 * Types para Sistema de Notificações e Alertas
 * Curva Mestra - Multi-Tenant SaaS
 */

import { Timestamp } from "firebase/firestore";

export type NotificationType =
  | "expiring" // Produto próximo do vencimento
  | "expired" // Produto vencido
  | "low_stock" // Estoque baixo
  | "request_approved" // Solicitação aprovada
  | "request_rejected" // Solicitação reprovada
  | "request_created" // Nova solicitação criada (para admins)
  | "new_user" // Novo usuário adicionado à clínica
  | "license_expiring" // Licença próxima do vencimento
  | "license_expired"; // Licença expirada

export type NotificationPriority = "low" | "medium" | "high" | "urgent";

export interface Notification {
  id: string;
  tenant_id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  read: boolean;

  // Links opcionais para entidades relacionadas
  product_id?: string;
  inventory_id?: string;
  request_id?: string;
  user_id?: string;

  // Metadados
  created_at: Timestamp;
  read_at?: Timestamp;

  // Informações contextuais
  metadata?: {
    product_name?: string;
    product_code?: string;
    batch_number?: string;
    expiry_date?: string;
    days_until_expiry?: number;
    current_quantity?: number;
    min_quantity?: number;
    request_number?: string;
    user_name?: string;
  };
}

export interface NotificationSettings {
  tenant_id: string;

  // Alertas de Vencimento
  enable_expiry_alerts: boolean;
  expiry_warning_days: number; // Dias de antecedência (padrão: 30)

  // Alertas de Estoque Baixo
  enable_low_stock_alerts: boolean;
  low_stock_threshold: number; // Quantidade mínima (padrão: 10)

  // Alertas de Solicitações
  enable_request_alerts: boolean;

  // Alertas de Licença
  enable_license_alerts: boolean;
  license_warning_days: number; // Dias de antecedência (padrão: 15)

  // Preferências de Notificação
  notification_sound: boolean;
  email_notifications: boolean; // Futuro

  // Metadados
  updated_at: Timestamp;
  updated_by: string;
}

export interface NotificationStats {
  total: number;
  unread: number;
  by_type: Record<NotificationType, number>;
  by_priority: Record<NotificationPriority, number>;
}

// Helper types para criação de notificações
export interface CreateNotificationInput {
  tenant_id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  product_id?: string;
  inventory_id?: string;
  request_id?: string;
  user_id?: string;
  metadata?: Notification["metadata"];
}

// Configurações padrão
export const DEFAULT_NOTIFICATION_SETTINGS: Omit<
  NotificationSettings,
  "tenant_id" | "updated_at" | "updated_by"
> = {
  enable_expiry_alerts: true,
  expiry_warning_days: 30,
  enable_low_stock_alerts: true,
  low_stock_threshold: 10,
  enable_request_alerts: true,
  enable_license_alerts: true,
  license_warning_days: 15,
  notification_sound: true,
  email_notifications: false,
};
