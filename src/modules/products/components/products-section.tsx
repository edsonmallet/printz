"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCostsSettings } from "@/modules/costs-settings/services/costs-settings.service";
import { ProductFormDialog } from "@/modules/products/components/product-form-dialog";
import { ProductList } from "@/modules/products/components/product-list";
import type { ProductWithId } from "@/modules/products/services/products.service";

export function ProductsSection({ tenantId }: { tenantId: string }) {
  const [dialog, setDialog] = useState<{ open: boolean; product?: ProductWithId }>({
    open: false,
  });
  const { data: costsSettings } = useCostsSettings(tenantId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-end gap-2">
        {tenantId && costsSettings === null && (
          <p className="text-sm text-muted-foreground">
            Configure os custos fixos na aba Custos antes de cadastrar produtos.
          </p>
        )}
        <Button onClick={() => setDialog({ open: true, product: undefined })}>Novo produto</Button>
      </div>
      <ProductList tenantId={tenantId} onEdit={(product) => setDialog({ open: true, product })} />
      <ProductFormDialog
        tenantId={tenantId}
        product={dialog.product}
        open={dialog.open}
        onOpenChange={(open) => setDialog((state) => ({ ...state, open }))}
      />
    </div>
  );
}
