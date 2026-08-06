"use client";

import { OrdersSection } from "@/modules/orders/components/orders-section";
import { useTenant } from "@/shared/hooks/use-tenant";

export function OrdersPageContent() {
  const { tenantId } = useTenant();

  if (!tenantId) return null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Pedidos</h1>
      <OrdersSection tenantId={tenantId} />
    </div>
  );
}
