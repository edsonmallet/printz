"use server";

import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminFirestore } from "@/shared/services/firebase-admin";
import type { Order } from "@/shared/types/order";

interface DebitStockActionInput {
  idToken: string;
  orderId: string;
}

export async function debitStockForOrder(input: DebitStockActionInput): Promise<void> {
  const decoded = await getAdminAuth().verifyIdToken(input.idToken);
  const tenantId = decoded.tenantId as string | undefined;
  const uid = decoded.uid;

  if (!tenantId) {
    throw new Error("Usuário sem tenant associado");
  }

  const db = getAdminFirestore();
  const orderRef = db.collection("tenants").doc(tenantId).collection("orders").doc(input.orderId);

  await db.runTransaction(async (transaction) => {
    const orderSnapshot = await transaction.get(orderRef);
    if (!orderSnapshot.exists) {
      throw new Error(`Pedido ${input.orderId} não encontrado`);
    }

    const order = orderSnapshot.data() as Order;
    if (order.stockDebited) {
      return;
    }

    for (const item of order.items) {
      if (!Number.isFinite(item.totalWeightG) || item.totalWeightG < 0) {
        throw new Error(
          `totalWeightG inválido para item do pedido ${input.orderId}: ${item.totalWeightG}`,
        );
      }
    }

    const now = Date.now();

    // Vários itens do pedido podem usar o mesmo material (ex: dois produtos
    // impressos no mesmo filamento) — agregar por materialId antes de escrever
    // evita múltiplos `transaction.update()` no mesmo documento dentro da
    // mesma transação.
    const totalWeightByMaterial = new Map<string, number>();
    for (const item of order.items) {
      totalWeightByMaterial.set(
        item.materialId,
        (totalWeightByMaterial.get(item.materialId) ?? 0) + item.totalWeightG,
      );
    }

    for (const [materialId, totalWeightG] of totalWeightByMaterial) {
      const materialRef = db
        .collection("tenants")
        .doc(tenantId)
        .collection("materials")
        .doc(materialId);
      transaction.update(materialRef, {
        currentStockG: FieldValue.increment(-totalWeightG),
      });
    }

    // `stockMovements` continua granular (um doc por item original) para
    // manter o detalhe de auditoria — cada `set()` usa um doc ref novo gerado
    // automaticamente, então não há conflito de escrita entre eles.
    for (const item of order.items) {
      const movementRef = db.collection("tenants").doc(tenantId).collection("stockMovements").doc();
      transaction.set(movementRef, {
        materialId: item.materialId,
        type: "out",
        quantityG: item.totalWeightG,
        source: `order:${input.orderId}`,
        createdAt: now,
        createdBy: uid,
      });
    }

    transaction.update(orderRef, { stockDebited: true });
  });
}
