"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  deleteMaterial,
  type MaterialWithId,
  useMaterials,
} from "@/modules/materials/services/materials.service";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { useTenant } from "@/shared/hooks/use-tenant";

interface MaterialListProps {
  tenantId: string;
  onEdit: (material: MaterialWithId) => void;
}

export function MaterialList({ tenantId, onEdit }: MaterialListProps) {
  const { role } = useTenant();
  const { data: materials } = useMaterials(tenantId);
  const [pendingDelete, setPendingDelete] = useState<MaterialWithId | null>(null);

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteMaterial(tenantId, pendingDelete.id);
      toast.success("Material excluído");
    } catch {
      toast.error("Não foi possível excluir o material");
    } finally {
      setPendingDelete(null);
    }
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Cor</TableHead>
            <TableHead>Preço/kg</TableHead>
            <TableHead>Estoque</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {materials.map((material) => (
            <TableRow key={material.id}>
              <TableCell>{material.name}</TableCell>
              <TableCell>{material.color}</TableCell>
              <TableCell>R$ {material.pricePerKg.toFixed(2)}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span>{material.currentStockG} g</span>
                  {material.currentStockG < material.minStockG && (
                    <Badge variant="destructive">Estoque baixo</Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {role === "admin" && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => onEdit(material)}>
                      Editar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setPendingDelete(material)}>
                      Excluir
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir material?</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
