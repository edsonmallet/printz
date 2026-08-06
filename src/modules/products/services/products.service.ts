"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addDoc, collection, deleteDoc, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { useEffect } from "react";
import { productDocSchema } from "@/modules/products/services/products.schema";
import { firestore } from "@/shared/services/firebase-client";
import type { Product } from "@/shared/types/product";

export interface ProductWithId extends Product {
  id: string;
}

export function useProducts(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["products", tenantId] as const;

  // biome-ignore lint/correctness/useExhaustiveDependencies: queryKey is derived from tenantId, already a dependency
  useEffect(() => {
    if (!tenantId) return;
    const unsubscribe = onSnapshot(
      collection(firestore, "tenants", tenantId, "products"),
      (snapshot) => {
        const products: ProductWithId[] = snapshot.docs.flatMap((docSnapshot) => {
          const result = productDocSchema.safeParse(docSnapshot.data());
          if (!result.success) {
            console.warn(
              `useProducts: documento tenants/${tenantId}/products/${docSnapshot.id} inválido, ignorando`,
              result.error,
            );
            return [];
          }
          return [{ id: docSnapshot.id, ...result.data }];
        });
        queryClient.setQueryData(queryKey, products);
      },
      (error) => {
        console.error(
          `useProducts: falha ao ouvir tenants/${tenantId}/products (possível permission-denied por claims desatualizadas):`,
          error,
        );
      },
    );
    return unsubscribe;
  }, [tenantId, queryClient]);

  return useQuery<ProductWithId[]>({
    queryKey,
    queryFn: () => [],
    enabled: !!tenantId,
    staleTime: Infinity,
    initialData: [],
  });
}

export async function createProduct(tenantId: string, input: Product): Promise<void> {
  await addDoc(collection(firestore, "tenants", tenantId, "products"), input);
}

export async function updateProduct(
  tenantId: string,
  productId: string,
  input: Product,
): Promise<void> {
  await updateDoc(doc(firestore, "tenants", tenantId, "products", productId), input as Partial<Product>);
}

export async function deleteProduct(tenantId: string, productId: string): Promise<void> {
  await deleteDoc(doc(firestore, "tenants", tenantId, "products", productId));
}
