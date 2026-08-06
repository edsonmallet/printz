"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  deleteProduct,
  type ProductWithId,
  useProducts,
} from "@/modules/products/services/products.service";
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

interface ProductListProps {
  tenantId: string;
  onEdit: (product: ProductWithId) => void;
}

export function ProductList({ tenantId, onEdit }: ProductListProps) {
  const { data: products } = useProducts(tenantId);
  const [pendingDelete, setPendingDelete] = useState<ProductWithId | null>(null);

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteProduct(tenantId, pendingDelete.id);
      toast.success("Produto excluído");
    } catch {
      toast.error("Não foi possível excluir o produto");
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
            <TableHead>Peso</TableHead>
            <TableHead>Tempo de impressão</TableHead>
            <TableHead>Custo total</TableHead>
            <TableHead>Preço sugerido</TableHead>
            <TableHead>Lucro real</TableHead>
            <TableHead>Calculado em</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product.id}>
              <TableCell>{product.name}</TableCell>
              <TableCell>{product.weightG.toFixed(2)} g</TableCell>
              <TableCell>{(product.printTimeH * 60).toFixed(2)} min</TableCell>
              <TableCell>R$ {product.lastCalculation.totalCost.toFixed(2)}</TableCell>
              <TableCell>R$ {product.lastCalculation.suggestedPrice.toFixed(2)}</TableCell>
              <TableCell>
                {product.salePrice !== undefined
                  ? `R$ ${(product.salePrice - product.lastCalculation.totalCost).toFixed(2)}`
                  : "—"}
              </TableCell>
              <TableCell>
                {new Date(product.lastCalculation.calculatedAt).toLocaleDateString("pt-BR")}
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => onEdit(product)}>
                    Editar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPendingDelete(product)}>
                    Excluir
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
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
