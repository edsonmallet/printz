# Products + Cost Calculation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CRUD de produtos referenciando material/impressora, com cálculo automático de custo total e preço sugerido (função pura) disparado ao salvar, numa rota própria `/products`.

**Architecture:** Módulo `modules/products` seguindo o padrão já estabelecido (`materials`/`printers`/`costs-settings`): schema Zod, service client-SDK com `onSnapshot`+`safeParse`+React Query, form dialog com RHF+zodResolver, tabela, seção de composição. A novidade é uma função pura de cálculo (`cost-calculation.ts`, sem I/O, testada isoladamente) que o form dialog chama no submit, combinando os dados do produto com material/impressora/costs-settings já carregados em cache.

**Tech Stack:** Next.js, Firebase client SDK, TanStack Query, React Hook Form + Zod, shadcn/ui (`Select`, `Switch`, `Table`, `Dialog`, `AlertDialog`, `Textarea`), Vitest.

## Global Constraints

- Schema (campos) em inglês; UI em português.
- `products`: leitura e escrita liberadas a qualquer membro do tenant (não só admin) — diferente de `materials`/`printers`/`settings`. CLAUDE.md §6.
- Sem upload de foto/STL nesta etapa (Storage bucket do Firebase ainda não existe) — produto não tem `photoUrl`/`stlUrl`.
- Cálculo de custo é função pura, sem I/O, testada com casos numéricos concretos — CLAUDE.md §12 chama isso de "literalmente onde o dinheiro é calculado".
- Toda leitura de doc do Firestore valida com Zod `safeParse` antes de usar (lição já aplicada em materials/printers/costs-settings — nunca fazer cast não validado tipo `as Product`).
- Numeric `<Input>` em forms usam o padrão já estabelecido: `useForm<z.input<typeof schema>, unknown, Output>()` + `value={Number.isNaN(field.value) ? "" : (field.value as number)}` + `onChange={(e) => field.onChange(e.target.valueAsNumber)}`.
- Testes em `tests/**/*.test.ts` (vitest).

---

### Task 1: Firestore rules para `products` (leitura e escrita = qualquer membro)

**Files:**
- Modify: `firestore.rules`

**Interfaces:**
- Produces: bloco de regra `tenants/{tenantId}/products/{productId}` com `allow read, write: if isMember(tenantId)` — nenhuma outra task depende do conteúdo interno.

- [ ] **Step 1: Adicionar o bloco de regra**

Em `firestore.rules`, dentro de `match /tenants/{tenantId}`, logo depois do bloco `match /printers/{printerId}`, adicionar:

```
match /products/{productId} {
  allow read: if isMember(tenantId);
  allow write: if isMember(tenantId);
}
```

Note a diferença de `materials`/`printers`/`settings`: aqui é `isMember` pros dois (leitura E escrita), não `isAdmin` pra escrita.

- [ ] **Step 2: Deploy das rules**

Run: `firebase deploy --only firestore:rules --project printz-1558b`
Expected: `✔ Deploy complete!`

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "feat: firestore rules for products (member read/write)"
```

---

### Task 2: Tipos compartilhados + schema Zod de produto (com teste)

**Files:**
- Create: `src/shared/types/product.ts`
- Create: `src/modules/products/services/products.schema.ts`
- Test: `tests/products/products.schema.test.ts`

**Interfaces:**
- Produces:
  - Em `shared/types/product.ts`:
    ```ts
    export interface PrintConfig {
      nozzleTempC: number;
      bedTempC: number;
      speedMmS: number;
      supports: boolean;
      bedAdhesion: string;
      notes?: string;
    }

    export interface ProductCalculation {
      totalCost: number;
      suggestedPrice: number;
      calculatedAt: number;
    }

    export interface Product {
      name: string;
      description?: string;
      weightG: number;
      printTimeH: number;
      printerId: string;
      materialId: string;
      printConfig: PrintConfig;
      lastCalculation: ProductCalculation;
    }
    ```
  - Em `products.schema.ts`: `productSchema`/`ProductInput` — schema do FORM (sem `lastCalculation`, que é computado, não editado pelo usuário) — e `productDocSchema` — `productSchema` estendido com `lastCalculation`, usado só pro `safeParse` na leitura do Firestore (Task 4).

  Essas interfaces/schemas são consumidas por: `cost-calculation.ts` (Task 3, usa `Product`/`PrintConfig` como referência de shape), `products.service.ts` (Task 4), `product-form-dialog.tsx` (Task 5).

- [ ] **Step 1: Escrever o teste (falhando)**

```ts
import { describe, expect, it } from "vitest";
import { productDocSchema, productSchema } from "@/modules/products/services/products.schema";

describe("productSchema", () => {
  const validInput = {
    name: "Vaso geométrico",
    description: "Vaso decorativo pequeno",
    weightG: 45,
    printTimeH: 3.5,
    printerId: "printer-1",
    materialId: "material-1",
    printConfig: {
      nozzleTempC: 210,
      bedTempC: 60,
      speedMmS: 50,
      supports: false,
      bedAdhesion: "brim",
      notes: "",
    },
  };

  it("aceita um produto válido", () => {
    expect(productSchema.safeParse(validInput).success).toBe(true);
  });

  it("aceita sem description e sem printConfig.notes (opcionais)", () => {
    const { description, ...withoutDescription } = validInput;
    const { notes, ...printConfigWithoutNotes } = validInput.printConfig;
    const result = productSchema.safeParse({
      ...withoutDescription,
      printConfig: printConfigWithoutNotes,
    });
    expect(result.success).toBe(true);
  });

  it("rejeita nome vazio", () => {
    expect(productSchema.safeParse({ ...validInput, name: "" }).success).toBe(false);
  });

  it("rejeita weightG ou printTimeH zero ou negativos", () => {
    expect(productSchema.safeParse({ ...validInput, weightG: 0 }).success).toBe(false);
    expect(productSchema.safeParse({ ...validInput, printTimeH: -1 }).success).toBe(false);
  });

  it("rejeita printerId ou materialId vazios", () => {
    expect(productSchema.safeParse({ ...validInput, printerId: "" }).success).toBe(false);
    expect(productSchema.safeParse({ ...validInput, materialId: "" }).success).toBe(false);
  });

  it("rejeita printConfig com valores não positivos", () => {
    const result = productSchema.safeParse({
      ...validInput,
      printConfig: { ...validInput.printConfig, nozzleTempC: 0 },
    });
    expect(result.success).toBe(false);
  });

  it("rejeita printConfig.bedAdhesion vazio", () => {
    const result = productSchema.safeParse({
      ...validInput,
      printConfig: { ...validInput.printConfig, bedAdhesion: "" },
    });
    expect(result.success).toBe(false);
  });
});

describe("productDocSchema", () => {
  const validInput = {
    name: "Vaso geométrico",
    weightG: 45,
    printTimeH: 3.5,
    printerId: "printer-1",
    materialId: "material-1",
    printConfig: {
      nozzleTempC: 210,
      bedTempC: 60,
      speedMmS: 50,
      supports: false,
      bedAdhesion: "brim",
    },
    lastCalculation: {
      totalCost: 12.5,
      suggestedPrice: 31.25,
      calculatedAt: 1735689600000,
    },
  };

  it("aceita um doc completo com lastCalculation", () => {
    expect(productDocSchema.safeParse(validInput).success).toBe(true);
  });

  it("rejeita doc sem lastCalculation", () => {
    const { lastCalculation, ...withoutCalculation } = validInput;
    expect(productDocSchema.safeParse(withoutCalculation).success).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar falha**

Run: `npx vitest run tests/products/products.schema.test.ts`
Expected: FAIL — módulo não encontrado

- [ ] **Step 3: Criar `shared/types/product.ts`**

```ts
export interface PrintConfig {
  nozzleTempC: number;
  bedTempC: number;
  speedMmS: number;
  supports: boolean;
  bedAdhesion: string;
  notes?: string;
}

export interface ProductCalculation {
  totalCost: number;
  suggestedPrice: number;
  calculatedAt: number;
}

export interface Product {
  name: string;
  description?: string;
  weightG: number;
  printTimeH: number;
  printerId: string;
  materialId: string;
  printConfig: PrintConfig;
  lastCalculation: ProductCalculation;
}
```

- [ ] **Step 4: Implementar `products.schema.ts`**

```ts
import { z } from "zod";

const printConfigSchema = z.object({
  nozzleTempC: z.coerce.number().positive("Temperatura do bico deve ser maior que zero"),
  bedTempC: z.coerce.number().positive("Temperatura da mesa deve ser maior que zero"),
  speedMmS: z.coerce.number().positive("Velocidade deve ser maior que zero"),
  supports: z.boolean(),
  bedAdhesion: z.string().min(1, "Adesão à mesa obrigatória"),
  notes: z.string().optional(),
});

export const productSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  description: z.string().optional(),
  weightG: z.coerce.number().positive("Peso deve ser maior que zero"),
  printTimeH: z.coerce.number().positive("Tempo de impressão deve ser maior que zero"),
  printerId: z.string().min(1, "Selecione uma impressora"),
  materialId: z.string().min(1, "Selecione um material"),
  printConfig: printConfigSchema,
});

export type ProductInput = z.infer<typeof productSchema>;

export const productDocSchema = productSchema.extend({
  lastCalculation: z.object({
    totalCost: z.number(),
    suggestedPrice: z.number(),
    calculatedAt: z.number(),
  }),
});
```

- [ ] **Step 5: Rodar o teste e confirmar sucesso**

Run: `npx vitest run tests/products/products.schema.test.ts`
Expected: PASS (9 testes)

- [ ] **Step 6: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 7: Commit**

```bash
git add src/shared/types/product.ts src/modules/products/services/products.schema.ts tests/products/products.schema.test.ts
git commit -m "feat: add product shared types and zod schema with validation tests"
```

---

### Task 3: Função pura de cálculo de custo (com testes)

**Files:**
- Create: `src/modules/products/services/cost-calculation.ts`
- Test: `tests/products/cost-calculation.test.ts`

**Interfaces:**
- Consumes: nada de outras tasks diretamente — usa apenas os shapes de `Material`, `Printer`, `CostsSettings` (já existentes em `@/shared/types/resources`) via `Pick<>`.
- Produces:
  ```ts
  export interface ProductCostInput {
    weightG: number;
    printTimeH: number;
  }

  export interface ProductCost {
    totalCost: number;
    suggestedPrice: number;
  }

  export function calculateProductCost(
    product: ProductCostInput,
    material: Pick<Material, "pricePerKg" | "defaultWasteRate">,
    printer: Pick<Printer, "avgPowerKw" | "acquisitionCost" | "usefulLifeHours">,
    costsSettings: CostsSettings,
  ): ProductCost;
  ```
  Consumida pelo form dialog (Task 5).

- [ ] **Step 1: Escrever os testes (falhando)**

```ts
import { describe, expect, it } from "vitest";
import { calculateProductCost } from "@/modules/products/services/cost-calculation";

describe("calculateProductCost", () => {
  const product = { weightG: 50, printTimeH: 2 };
  const material = { pricePerKg: 100, defaultWasteRate: 0.1 };
  const printer = { avgPowerKw: 0.2, acquisitionCost: 2000, usefulLifeHours: 5000 };
  const costsSettings = {
    energyRateKwh: 0.9,
    laborCostPerHour: 20,
    monthlyFixedCosts: 600,
    monthlyProductiveHours: 200,
    defaultMarkup: 3,
  };

  it("calcula totalCost como soma dos 5 componentes", () => {
    const materialCost = (50 / 1000) * 100 * 1.1; // 5.5
    const energyCost = 2 * 0.2 * 0.9; // 0.36
    const depreciation = 2 * (2000 / 5000); // 0.8
    const laborCost = 2 * 20; // 40
    const fixedCostShare = 2 * (600 / 200); // 6
    const expectedTotal = materialCost + energyCost + depreciation + laborCost + fixedCostShare;

    const result = calculateProductCost(product, material, printer, costsSettings);

    expect(result.totalCost).toBeCloseTo(expectedTotal, 6);
  });

  it("calcula suggestedPrice como totalCost * defaultMarkup", () => {
    const result = calculateProductCost(product, material, printer, costsSettings);
    expect(result.suggestedPrice).toBeCloseTo(result.totalCost * costsSettings.defaultMarkup, 6);
  });

  it("com defaultWasteRate zero, materialCost é só peso vezes preço", () => {
    const result = calculateProductCost(
      product,
      { ...material, defaultWasteRate: 0 },
      printer,
      costsSettings,
    );
    const materialCostSemPerda = (50 / 1000) * 100;
    const energyCost = 2 * 0.2 * 0.9;
    const depreciation = 2 * (2000 / 5000);
    const laborCost = 2 * 20;
    const fixedCostShare = 2 * (600 / 200);
    const expectedTotal =
      materialCostSemPerda + energyCost + depreciation + laborCost + fixedCostShare;
    expect(result.totalCost).toBeCloseTo(expectedTotal, 6);
  });

  it("com printTimeH bem pequeno, resultado ainda é positivo e finito", () => {
    const result = calculateProductCost(
      { weightG: 5, printTimeH: 0.01 },
      material,
      printer,
      costsSettings,
    );
    expect(result.totalCost).toBeGreaterThan(0);
    expect(Number.isFinite(result.totalCost)).toBe(true);
    expect(Number.isFinite(result.suggestedPrice)).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar falha**

Run: `npx vitest run tests/products/cost-calculation.test.ts`
Expected: FAIL — módulo não encontrado

- [ ] **Step 3: Implementar a função**

```ts
import type { CostsSettings, Material, Printer } from "@/shared/types/resources";

export interface ProductCostInput {
  weightG: number;
  printTimeH: number;
}

export interface ProductCost {
  totalCost: number;
  suggestedPrice: number;
}

export function calculateProductCost(
  product: ProductCostInput,
  material: Pick<Material, "pricePerKg" | "defaultWasteRate">,
  printer: Pick<Printer, "avgPowerKw" | "acquisitionCost" | "usefulLifeHours">,
  costsSettings: CostsSettings,
): ProductCost {
  const materialCost =
    (product.weightG / 1000) * material.pricePerKg * (1 + material.defaultWasteRate);
  const energyCost = product.printTimeH * printer.avgPowerKw * costsSettings.energyRateKwh;
  const depreciation = product.printTimeH * (printer.acquisitionCost / printer.usefulLifeHours);
  const laborCost = product.printTimeH * costsSettings.laborCostPerHour;
  const fixedCostShare =
    product.printTimeH * (costsSettings.monthlyFixedCosts / costsSettings.monthlyProductiveHours);

  const totalCost = materialCost + energyCost + depreciation + laborCost + fixedCostShare;
  const suggestedPrice = totalCost * costsSettings.defaultMarkup;

  return { totalCost, suggestedPrice };
}
```

- [ ] **Step 4: Rodar os testes e confirmar sucesso**

Run: `npx vitest run tests/products/cost-calculation.test.ts`
Expected: PASS (4 testes)

- [ ] **Step 5: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 6: Commit**

```bash
git add src/modules/products/services/cost-calculation.ts tests/products/cost-calculation.test.ts
git commit -m "feat: add pure cost calculation function with tests"
```

---

### Task 4: Service + hook de produtos (CRUD, com safeParse na leitura)

**Files:**
- Create: `src/modules/products/services/products.service.ts`

**Interfaces:**
- Consumes: `Product` de `@/shared/types/product` (Task 2), `productDocSchema` de `@/modules/products/services/products.schema` (Task 2), `firestore` de `@/shared/services/firebase-client`.
- Produces:
  - `interface ProductWithId extends Product { id: string }`
  - `useProducts(tenantId: string | undefined): UseQueryResult<ProductWithId[]>`
  - `createProduct(tenantId: string, input: Product): Promise<void>`
  - `updateProduct(tenantId: string, productId: string, input: Product): Promise<void>`
  - `deleteProduct(tenantId: string, productId: string): Promise<void>`

  Usados pelos componentes das Tasks 5 e 6. Note que `create`/`updateProduct` recebem `Product` completo (incluindo `lastCalculation`, já calculado pelo chamador) — não `ProductInput` do form, que não tem `lastCalculation`.

- [ ] **Step 1: Implementar o service**

```ts
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
  await updateDoc(doc(firestore, "tenants", tenantId, "products", productId), input);
}

export async function deleteProduct(tenantId: string, productId: string): Promise<void> {
  await deleteDoc(doc(firestore, "tenants", tenantId, "products", productId));
}
```

- [ ] **Step 2: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 3: Commit**

```bash
git add src/modules/products/services/products.service.ts
git commit -m "feat: add products CRUD service with safeParse validation on read"
```

---

### Task 5: Formulário de produto (Select material/impressora, printConfig, cálculo ao salvar)

**Files:**
- Create: `src/modules/products/components/product-form-dialog.tsx`

**Interfaces:**
- Consumes: `productSchema`, `ProductInput` (Task 2); `calculateProductCost` (Task 3); `createProduct`, `updateProduct`, `ProductWithId` (Task 4); `useMaterials` de `@/modules/materials/services/materials.service`; `usePrinters` de `@/modules/printers/services/printers.service`; `useCostsSettings` de `@/modules/costs-settings/services/costs-settings.service`.
- Produces: `ProductFormDialog`:
  ```ts
  interface ProductFormDialogProps {
    tenantId: string;
    product?: ProductWithId;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }
  export function ProductFormDialog(props: ProductFormDialogProps): JSX.Element;
  ```
  Usado pela Task 6 (`ProductsSection`).

- [ ] **Step 1: Adicionar o componente shadcn `Switch`** (necessário pro campo `printConfig.supports`, ainda não existe no projeto)

Run: `printf 'n\n' | npx shadcn@latest add switch --yes` (responda "não" se perguntar pra sobrescrever algum arquivo existente — só queremos o `switch.tsx` novo).

Verify: `ls src/components/ui/switch.tsx` existe.

- [ ] **Step 2: Implementar o componente**

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useMaterials } from "@/modules/materials/services/materials.service";
import { usePrinters } from "@/modules/printers/services/printers.service";
import { calculateProductCost } from "@/modules/products/services/cost-calculation";
import { type ProductInput, productSchema } from "@/modules/products/services/products.schema";
import {
  createProduct,
  type ProductWithId,
  updateProduct,
} from "@/modules/products/services/products.service";
import { useCostsSettings } from "@/modules/costs-settings/services/costs-settings.service";

const emptyValues: ProductInput = {
  name: "",
  description: "",
  weightG: 0,
  printTimeH: 0,
  printerId: "",
  materialId: "",
  printConfig: {
    nozzleTempC: 0,
    bedTempC: 0,
    speedMmS: 0,
    supports: false,
    bedAdhesion: "",
    notes: "",
  },
};

interface ProductFormDialogProps {
  tenantId: string;
  product?: ProductWithId;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductFormDialog({
  tenantId,
  product,
  open,
  onOpenChange,
}: ProductFormDialogProps) {
  const { data: materials } = useMaterials(tenantId);
  const { data: printers } = usePrinters(tenantId);
  const { data: costsSettings } = useCostsSettings(tenantId);

  const form = useForm<z.input<typeof productSchema>, unknown, ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: emptyValues,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset só deve rodar quando o dialog abre ou o produto alvo muda
  useEffect(() => {
    if (open) {
      form.reset(product ?? emptyValues);
    }
  }, [open, product]);

  async function onSubmit(values: ProductInput) {
    if (!costsSettings) {
      toast.error("Configure os custos fixos antes de cadastrar produtos (aba Custos)");
      return;
    }
    const material = materials.find((m) => m.id === values.materialId);
    const printer = printers.find((p) => p.id === values.printerId);
    if (!material || !printer) {
      toast.error("Material ou impressora selecionados não foram encontrados");
      return;
    }

    const { totalCost, suggestedPrice } = calculateProductCost(
      { weightG: values.weightG, printTimeH: values.printTimeH },
      material,
      printer,
      costsSettings,
    );

    const productData = {
      ...values,
      lastCalculation: { totalCost, suggestedPrice, calculatedAt: Date.now() },
    };

    try {
      if (product) {
        await updateProduct(tenantId, product.id, productData);
        toast.success("Produto atualizado");
      } else {
        await createProduct(tenantId, productData);
        toast.success("Produto criado");
      }
      onOpenChange(false);
    } catch {
      toast.error("Não foi possível salvar o produto");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? "Editar produto" : "Novo produto"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="weightG"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Peso (g)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.1"
                      {...field}
                      value={Number.isNaN(field.value) ? "" : (field.value as number)}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="printTimeH"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tempo de impressão (horas)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.1"
                      {...field}
                      value={Number.isNaN(field.value) ? "" : (field.value as number)}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="materialId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Material</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um material" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {materials.map((material) => (
                        <SelectItem key={material.id} value={material.id}>
                          {material.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="printerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Impressora</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma impressora" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {printers.map((printer) => (
                        <SelectItem key={printer.id} value={printer.id}>
                          {printer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="printConfig.nozzleTempC"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Temperatura do bico (°C)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="1"
                      {...field}
                      value={Number.isNaN(field.value) ? "" : (field.value as number)}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="printConfig.bedTempC"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Temperatura da mesa (°C)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="1"
                      {...field}
                      value={Number.isNaN(field.value) ? "" : (field.value as number)}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="printConfig.speedMmS"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Velocidade (mm/s)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="1"
                      {...field}
                      value={Number.isNaN(field.value) ? "" : (field.value as number)}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="printConfig.bedAdhesion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adesão à mesa</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="ex: brim, raft, nenhuma" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="printConfig.supports"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <FormLabel>Usa suporte</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="printConfig.notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações de impressão</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 4: Checar lint**

Run: `./node_modules/.bin/biome check src/modules/products`
Expected: sem erros (use `--write` se houver só formatação).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/switch.tsx src/modules/products/components/product-form-dialog.tsx
git commit -m "feat: add product create/edit form dialog with automatic cost calculation"
```

---

### Task 6: Lista de produtos (com custo/preço) + composição da seção

**Files:**
- Create: `src/modules/products/components/product-list.tsx`
- Create: `src/modules/products/components/products-section.tsx`

**Interfaces:**
- Consumes: `useProducts`, `deleteProduct`, `ProductWithId` (Task 4); `ProductFormDialog` (Task 5).
- Produces: `ProductsSection` — usado pela Task 7 (rota `/products`):
  ```ts
  export function ProductsSection({ tenantId }: { tenantId: string }): JSX.Element;
  ```

- [ ] **Step 1: Implementar `product-list.tsx`**

```tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  deleteProduct,
  type ProductWithId,
  useProducts,
} from "@/modules/products/services/products.service";

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
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product.id}>
              <TableCell>{product.name}</TableCell>
              <TableCell>{product.weightG} g</TableCell>
              <TableCell>{product.printTimeH} h</TableCell>
              <TableCell>R$ {product.lastCalculation.totalCost.toFixed(2)}</TableCell>
              <TableCell>R$ {product.lastCalculation.suggestedPrice.toFixed(2)}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => onEdit(product)}>
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPendingDelete(product)}
                  >
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
```

- [ ] **Step 2: Implementar `products-section.tsx`**

```tsx
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
        <Button onClick={() => setDialog({ open: true, product: undefined })}>
          Novo produto
        </Button>
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
```

Note: sem gating de `role === "admin"` aqui (diferente de `materials-section.tsx`/`printers-section.tsx`) — qualquer membro do tenant pode criar/editar/excluir produtos, per Global Constraints.

- [ ] **Step 3: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 4: Commit**

```bash
git add src/modules/products/components/product-list.tsx src/modules/products/components/products-section.tsx
git commit -m "feat: add product list with cost/price columns and CRUD actions"
```

---

### Task 7: Rota `/products` + item de navegação no sidebar

**Files:**
- Create: `src/modules/products/components/products-page-content.tsx`
- Create: `src/app/(dashboard)/products/page.tsx`
- Modify: `src/shared/components/dashboard-shell.tsx`

**Interfaces:**
- Consumes: `ProductsSection` (Task 6), `useTenant` de `@/shared/hooks/use-tenant`.
- Produces: rota `/products` renderizada e navegável pelo sidebar — ponto de entrada final desta feature.

- [ ] **Step 1: Implementar `products-page-content.tsx`**

```tsx
"use client";

import { ProductsSection } from "@/modules/products/components/products-section";
import { useTenant } from "@/shared/hooks/use-tenant";

export function ProductsPageContent() {
  const { tenantId } = useTenant();

  if (!tenantId) return null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Produtos</h1>
      <ProductsSection tenantId={tenantId} />
    </div>
  );
}
```

- [ ] **Step 2: Implementar a rota**

```tsx
import { ProductsPageContent } from "@/modules/products/components/products-page-content";

export default function ProductsPage() {
  return <ProductsPageContent />;
}
```

- [ ] **Step 3: Adicionar item de navegação no sidebar**

Em `src/shared/components/dashboard-shell.tsx`, importar o ícone `Package` de `lucide-react` (adicionar ao import existente `LayoutDashboard, LogOut, Users, Wrench` → `LayoutDashboard, LogOut, Package, Users, Wrench`) e adicionar ao array `navItems`, entre `"/"` e `"/team"`:

```ts
const navItems = [
  { href: "/", label: "Início", icon: LayoutDashboard },
  { href: "/products", label: "Produtos", icon: Package },
  { href: "/team", label: "Time", icon: Users },
  { href: "/settings/resources", label: "Recursos e custos", icon: Wrench },
];
```

- [ ] **Step 4: Checar tipos e lint**

Run: `npx tsc --noEmit && ./node_modules/.bin/biome check src/modules/products src/shared/components/dashboard-shell.tsx "src/app/(dashboard)/products"`
Expected: sem erros.

- [ ] **Step 5: Rodar toda a suíte de testes unitários**

Run: `npx vitest run tests/materials tests/printers tests/costs-settings tests/products`
Expected: todos passam.

- [ ] **Step 6: Teste manual no browser**

Com o app em dev: ir em "Produtos" no sidebar, criar um produto (selecionando material/impressora já cadastrados e com `settings/costs` já configurado), confirmar que custo/preço aparecem na tabela após salvar. Editar e excluir. Se `settings/costs` não estiver configurado, confirmar que o toast de erro aparece e o produto não é salvo.

- [ ] **Step 7: Commit**

```bash
git add src/modules/products/components/products-page-content.tsx "src/app/(dashboard)/products/page.tsx" src/shared/components/dashboard-shell.tsx
git commit -m "feat: add products route and sidebar nav item"
```

---

## Spec Coverage Check

- CRUD de produtos → Tasks 2, 4, 5, 6
- Fórmula de custo (5 componentes) como função pura testada → Task 3
- Cálculo automático ao salvar → Task 5
- Bloqueio quando `settings/costs` não existe → Task 5
- Tabela mostra custo/preço → Task 6
- Leitura/escrita liberada a qualquer membro (sem gating de admin) → Tasks 1, 6
- Sem `photoUrl`/`stlUrl` (Storage bucket pendente) → Task 2 (schema não inclui esses campos)
- Rota própria + nav no sidebar → Task 7
- `safeParse` na leitura (lição de materials/printers/costs-settings) → Task 4
