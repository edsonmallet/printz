"use client";

import { ProductsSection } from "@/modules/products/components/products-section";
import { useTenant } from "@/shared/hooks/use-tenant";

export function ProductsPageContent() {
  const { tenantId } = useTenant();

  if (!tenantId) return null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Produtos</h1>
      <ProductsSection tenantId={tenantId} />
    </div>
  );
}
