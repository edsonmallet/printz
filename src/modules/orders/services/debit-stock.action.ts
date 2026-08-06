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

    const now = Date.now();
    for (const item of order.items) {
      const materialRef = db
        .collection("tenants")
        .doc(tenantId)
        .collection("materials")
        .doc(item.materialId);
      transaction.update(materialRef, {
        currentStockG: FieldValue.increment(-item.totalWeightG),
      });

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
