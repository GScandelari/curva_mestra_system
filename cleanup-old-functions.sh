#!/bin/bash

echo "🗑️  Limpando funções antigas do Firebase..."
echo ""
echo "Este script irá deletar as seguintes funções:"
echo "  - checkExpiringProducts (us-central1)"
echo "  - cleanupOldNotifications (us-central1)"
echo "  - updateDashboardMetrics (us-central1)"
echo "  - api (us-central1)"
echo "  - onTenantCreated (southamerica-east1)"
echo "  - onUserCreated (southamerica-east1)"
echo "  - sendTestEmail (southamerica-east1)"
echo ""
read -p "Deseja continuar? (s/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Ss]$ ]]
then
    echo "❌ Operação cancelada."
    exit 1
fi

echo ""
echo "🔄 Deletando funções antigas..."
echo ""

# Funções que não existem no código (us-central1)
echo "📦 Deletando: checkExpiringProducts (us-central1)..."
firebase functions:delete checkExpiringProducts --region us-central1 --force

echo "📦 Deletando: cleanupOldNotifications (us-central1)..."
firebase functions:delete cleanupOldNotifications --region us-central1 --force

echo "📦 Deletando: updateDashboardMetrics (us-central1)..."
firebase functions:delete updateDashboardMetrics --region us-central1 --force

echo "📦 Deletando: api (us-central1)..."
firebase functions:delete api --region us-central1 --force

# Funções comentadas (southamerica-east1)
echo "📦 Deletando: onTenantCreated (southamerica-east1)..."
firebase functions:delete onTenantCreated --region southamerica-east1 --force

echo "📦 Deletando: onUserCreated (southamerica-east1)..."
firebase functions:delete onUserCreated --region southamerica-east1 --force

echo "📦 Deletando: sendTestEmail (southamerica-east1)..."
firebase functions:delete sendTestEmail --region southamerica-east1 --force

echo ""
echo "✅ Limpeza concluída!"
echo ""
echo "Funções MANTIDAS (em uso):"
echo "  ✓ checkLicenseExpiration (southamerica-east1)"
echo "  ✓ placeholder (southamerica-east1)"
echo ""
