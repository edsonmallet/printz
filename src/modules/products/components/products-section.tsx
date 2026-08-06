"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ProductFormDialog } from "@/modules/products/components/product-form-dialog";
import { ProductList } from "@/modules/products/components/product-list";
import type { ProductWithId } from "@/modules/products/services/products.service";

export function ProductsSection({ tenantId }: { tenantId: string }) {
  const [dialog, setDialog] = useState<{ open: boolean; product?: ProductWithId }>({
    open: false,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
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
