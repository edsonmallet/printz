"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MaterialFormDialog } from "@/modules/materials/components/material-form-dialog";
import { MaterialList } from "@/modules/materials/components/material-list";
import type { MaterialWithId } from "@/modules/materials/services/materials.service";
import { useTenant } from "@/shared/hooks/use-tenant";

export function MaterialsSection({ tenantId }: { tenantId: string }) {
  const { role } = useTenant();
  const [dialog, setDialog] = useState<{ open: boolean; material?: MaterialWithId }>({
    open: false,
  });

  return (
    <div className="flex flex-col gap-4">
      {role === "admin" && (
        <div className="flex justify-end">
          <Button onClick={() => setDialog({ open: true, material: undefined })}>
            Novo material
          </Button>
        </div>
      )}
      <MaterialList
        tenantId={tenantId}
        onEdit={(material) => setDialog({ open: true, material })}
      />
      <MaterialFormDialog
        tenantId={tenantId}
        material={dialog.material}
        open={dialog.open}
        onOpenChange={(open) => setDialog((state) => ({ ...state, open }))}
      />
    </div>
  );
}
