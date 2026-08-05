"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PrinterFormDialog } from "@/modules/printers/components/printer-form-dialog";
import { PrinterList } from "@/modules/printers/components/printer-list";
import type { PrinterWithId } from "@/modules/printers/services/printers.service";

export function PrintersSection({ tenantId }: { tenantId: string }) {
  const [dialog, setDialog] = useState<{ open: boolean; printer?: PrinterWithId }>({
    open: false,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialog({ open: true, printer: undefined })}>
          Nova impressora
        </Button>
      </div>
      <PrinterList tenantId={tenantId} onEdit={(printer) => setDialog({ open: true, printer })} />
      <PrinterFormDialog
        tenantId={tenantId}
        printer={dialog.printer}
        open={dialog.open}
        onOpenChange={(open) => setDialog((state) => ({ ...state, open }))}
      />
    </div>
  );
}
