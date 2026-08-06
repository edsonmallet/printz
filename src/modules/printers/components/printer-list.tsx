"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  deletePrinter,
  type PrinterWithId,
  usePrinters,
} from "@/modules/printers/services/printers.service";
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

interface PrinterListProps {
  tenantId: string;
  onEdit: (printer: PrinterWithId) => void;
}

export function PrinterList({ tenantId, onEdit }: PrinterListProps) {
  const { role } = useTenant();
  const { data: printers } = usePrinters(tenantId);
  const [pendingDelete, setPendingDelete] = useState<PrinterWithId | null>(null);

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    try {
      await deletePrinter(tenantId, pendingDelete.id);
      toast.success("Impressora excluída");
    } catch {
      toast.error("Não foi possível excluir a impressora");
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
            <TableHead>Custo de aquisição</TableHead>
            <TableHead>Vida útil</TableHead>
            <TableHead>Volume de impressão</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {printers.map((printer) => (
            <TableRow key={printer.id}>
              <TableCell>{printer.name}</TableCell>
              <TableCell>R$ {printer.acquisitionCost.toFixed(2)}</TableCell>
              <TableCell>{printer.usefulLifeHours} h</TableCell>
              <TableCell>
                {printer.buildVolumeMm.x} x {printer.buildVolumeMm.y} x {printer.buildVolumeMm.z} mm
              </TableCell>
              <TableCell>
                {role === "admin" && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => onEdit(printer)}>
                      Editar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setPendingDelete(printer)}>
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
            <AlertDialogTitle>Excluir impressora?</AlertDialogTitle>
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
