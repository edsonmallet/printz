"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { OrderFormDialog } from "@/modules/orders/components/order-form-dialog";
import { OrderList } from "@/modules/orders/components/order-list";
import type { OrderWithId } from "@/modules/orders/services/orders.service";

export function OrdersSection({ tenantId }: { tenantId: string }) {
  const [dialog, setDialog] = useState<{ open: boolean; order?: OrderWithId }>({ open: false });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialog({ open: true, order: undefined })}>Novo pedido</Button>
      </div>
      <OrderList tenantId={tenantId} onEdit={(order) => setDialog({ open: true, order })} />
      <OrderFormDialog
        tenantId={tenantId}
        order={dialog.order}
        open={dialog.open}
        onOpenChange={(open) => setDialog((state) => ({ ...state, open }))}
      />
    </div>
  );
}
