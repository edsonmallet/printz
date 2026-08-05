# Costs Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Doc único `tenants/{tenantId}/settings/costs` (energia, mão de obra, custos fixos, horas produtivas, markup) com form de leitura/escrita numa terceira aba "Custos" em `/settings/resources`.

**Architecture:** Um módulo, `modules/costs-settings`, seguindo o padrão de schema Zod + hook `onSnapshot`/TanStack Query já usado em `materials`/`printers`, mas sem lista/dialog — é um doc único, então o form fica direto na página, com `setDoc` fazendo upsert completo. Escrita restrita a `admin` (campos desabilitados e botão Salvar oculto pra `member`), leitura liberada a qualquer membro do tenant — regra já coberta pelo bloco `match /settings/{settingsDoc}` existente em `firestore.rules`, sem mudança de rules necessária.

**Tech Stack:** Next.js, Firebase client SDK (`firebase/firestore`), TanStack Query, React Hook Form + `@hookform/resolvers/zod`, Zod, shadcn/ui (`Input`, `Button`, `Form`), Vitest.

## Global Constraints

- Schema (campos) em inglês; textos de UI em português.
- Escrita só `admin` — leitura qualquer membro (seção 6 do CLAUDE.md), sem mudança em `firestore.rules` (o bloco `settings/{settingsDoc}` já cobre isso).
- Cada `page.tsx` em `app/` só importa e renderiza um componente de `modules/{module}/components`.
- Testes em `tests/**/*.test.ts` (vitest).

---

### Task 1: Schema Zod de costs settings (com teste)

**Files:**
- Create: `src/modules/costs-settings/services/costs-settings.schema.ts`
- Test: `tests/costs-settings/costs-settings.schema.test.ts`

**Interfaces:**
- Produces: `costsSettingsSchema` (ZodSchema) e `type CostsSettingsInput = z.infer<typeof costsSettingsSchema>` — usados pelo service (Task 2) e pelo form (Task 3).

- [ ] **Step 1: Escrever o teste (falhando)**

```ts
import { describe, expect, it } from "vitest";
import { costsSettingsSchema } from "@/modules/costs-settings/services/costs-settings.schema";

describe("costsSettingsSchema", () => {
  const validInput = {
    energyRateKwh: 0.95,
    laborCostPerHour: 25,
    monthlyFixedCosts: 800,
    monthlyProductiveHours: 160,
    defaultMarkup: 2.5,
  };

  it("aceita um input válido", () => {
    expect(costsSettingsSchema.safeParse(validInput).success).toBe(true);
  });

  it("rejeita energyRateKwh zero ou negativo", () => {
    expect(costsSettingsSchema.safeParse({ ...validInput, energyRateKwh: 0 }).success).toBe(
      false,
    );
    expect(costsSettingsSchema.safeParse({ ...validInput, energyRateKwh: -1 }).success).toBe(
      false,
    );
  });

  it("rejeita laborCostPerHour zero ou negativo", () => {
    expect(costsSettingsSchema.safeParse({ ...validInput, laborCostPerHour: 0 }).success).toBe(
      false,
    );
  });

  it("rejeita monthlyFixedCosts zero ou negativo", () => {
    expect(costsSettingsSchema.safeParse({ ...validInput, monthlyFixedCosts: 0 }).success).toBe(
      false,
    );
  });

  it("rejeita monthlyProductiveHours zero ou negativo", () => {
    expect(
      costsSettingsSchema.safeParse({ ...validInput, monthlyProductiveHours: 0 }).success,
    ).toBe(false);
  });

  it("rejeita defaultMarkup zero ou negativo", () => {
    expect(costsSettingsSchema.safeParse({ ...validInput, defaultMarkup: 0 }).success).toBe(
      false,
    );
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar falha**

Run: `npx vitest run tests/costs-settings/costs-settings.schema.test.ts`
Expected: FAIL — módulo não encontrado

- [ ] **Step 3: Implementar o schema**

```ts
import { z } from "zod";

export const costsSettingsSchema = z.object({
  energyRateKwh: z.coerce.number().positive("Tarifa de energia deve ser maior que zero"),
  laborCostPerHour: z.coerce.number().positive("Custo de mão de obra deve ser maior que zero"),
  monthlyFixedCosts: z.coerce.number().positive("Custos fixos mensais devem ser maiores que zero"),
  monthlyProductiveHours: z.coerce
    .number()
    .positive("Horas produtivas mensais devem ser maiores que zero"),
  defaultMarkup: z.coerce.number().positive("Markup padrão deve ser maior que zero"),
});

export type CostsSettingsInput = z.infer<typeof costsSettingsSchema>;
```

- [ ] **Step 4: Rodar o teste e confirmar sucesso**

Run: `npx vitest run tests/costs-settings/costs-settings.schema.test.ts`
Expected: PASS (6 testes)

- [ ] **Step 5: Commit**

```bash
git add src/modules/costs-settings/services/costs-settings.schema.ts tests/costs-settings/costs-settings.schema.test.ts
git commit -m "feat: add costs settings zod schema with validation tests"
```

---

### Task 2: Service + hook de costs settings (doc único)

**Files:**
- Create: `src/shared/types/resources.ts` — modify: adicionar `interface CostsSettings` (ver abaixo)
- Create: `src/modules/costs-settings/services/costs-settings.service.ts`

**Interfaces:**
- Consumes: `CostsSettingsInput`/`costsSettingsSchema` de `@/modules/costs-settings/services/costs-settings.schema` (Task 1), `firestore` de `@/shared/services/firebase-client`.
- Produces:
  - `interface CostsSettings { energyRateKwh: number; laborCostPerHour: number; monthlyFixedCosts: number; monthlyProductiveHours: number; defaultMarkup: number }` (em `shared/types/resources.ts`)
  - `useCostsSettings(tenantId: string | undefined): UseQueryResult<CostsSettings | undefined>`
  - `saveCostsSettings(tenantId: string, input: CostsSettingsInput): Promise<void>`

  Usados pelo form (Task 3).

- [ ] **Step 1: Adicionar o tipo em `shared/types/resources.ts`**

Adicionar ao final do arquivo existente (não remover `Material`/`Printer` já lá):

```ts
export interface CostsSettings {
  energyRateKwh: number;
  laborCostPerHour: number;
  monthlyFixedCosts: number;
  monthlyProductiveHours: number;
  defaultMarkup: number;
}
```

- [ ] **Step 2: Implementar o service**

```ts
"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { useEffect } from "react";
import type { CostsSettingsInput } from "@/modules/costs-settings/services/costs-settings.schema";
import { firestore } from "@/shared/services/firebase-client";
import type { CostsSettings } from "@/shared/types/resources";

export function useCostsSettings(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["costs-settings", tenantId] as const;

  // biome-ignore lint/correctness/useExhaustiveDependencies: queryKey is derived from tenantId, already a dependency
  useEffect(() => {
    if (!tenantId) return;
    const unsubscribe = onSnapshot(
      doc(firestore, "tenants", tenantId, "settings", "costs"),
      (snapshot) => {
        queryClient.setQueryData(queryKey, snapshot.data() as CostsSettings | undefined);
      },
      (error) => {
        console.error(
          `useCostsSettings: falha ao ouvir tenants/${tenantId}/settings/costs (possível permission-denied por claims desatualizadas):`,
          error,
        );
      },
    );
    return unsubscribe;
  }, [tenantId, queryClient]);

  return useQuery<CostsSettings | undefined>({
    queryKey,
    queryFn: () => undefined,
    enabled: !!tenantId,
    staleTime: Infinity,
    initialData: undefined,
  });
}

export async function saveCostsSettings(
  tenantId: string,
  input: CostsSettingsInput,
): Promise<void> {
  await setDoc(doc(firestore, "tenants", tenantId, "settings", "costs"), input);
}
```

- [ ] **Step 3: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 4: Commit**

```bash
git add src/shared/types/resources.ts src/modules/costs-settings/services/costs-settings.service.ts
git commit -m "feat: add costs settings CRUD service and useCostsSettings hook"
```

---

### Task 3: Form de costs settings (admin escreve, membro só lê)

**Files:**
- Create: `src/modules/costs-settings/components/costs-settings-form.tsx`

**Interfaces:**
- Consumes: `costsSettingsSchema`, `CostsSettingsInput` (Task 1); `useCostsSettings`, `saveCostsSettings` (Task 2); `useTenant` de `@/shared/hooks/use-tenant` (já existe, retorna `{ tenantId, role, isLoading }`).
- Produces: `CostsSettingsForm` — componente usado pela Task 4 (`ResourcesPageContent`):
  ```ts
  export function CostsSettingsForm({ tenantId }: { tenantId: string }): JSX.Element;
  ```

- [ ] **Step 1: Implementar o componente**

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
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
  type CostsSettingsInput,
  costsSettingsSchema,
} from "@/modules/costs-settings/services/costs-settings.schema";
import {
  saveCostsSettings,
  useCostsSettings,
} from "@/modules/costs-settings/services/costs-settings.service";
import { useTenant } from "@/shared/hooks/use-tenant";

const emptyValues: CostsSettingsInput = {
  energyRateKwh: 0,
  laborCostPerHour: 0,
  monthlyFixedCosts: 0,
  monthlyProductiveHours: 0,
  defaultMarkup: 0,
};

export function CostsSettingsForm({ tenantId }: { tenantId: string }) {
  const { role } = useTenant();
  const { data: costsSettings } = useCostsSettings(tenantId);
  const isAdmin = role === "admin";

  const form = useForm<z.input<typeof costsSettingsSchema>, unknown, CostsSettingsInput>({
    resolver: zodResolver(costsSettingsSchema),
    defaultValues: emptyValues,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset só deve rodar quando os dados carregados do doc mudam
  useEffect(() => {
    form.reset(costsSettings ?? emptyValues);
  }, [costsSettings]);

  async function onSubmit(values: CostsSettingsInput) {
    try {
      await saveCostsSettings(tenantId, values);
      toast.success("Configuração de custos salva");
    } catch {
      toast.error("Não foi possível salvar a configuração de custos");
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex max-w-md flex-col gap-4">
        <FormField
          control={form.control}
          name="energyRateKwh"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tarifa de energia (R$/kWh)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  disabled={!isAdmin}
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
          name="laborCostPerHour"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Custo de mão de obra (R$/hora)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  disabled={!isAdmin}
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
          name="monthlyFixedCosts"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Custos fixos mensais (R$)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  disabled={!isAdmin}
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
          name="monthlyProductiveHours"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Horas produtivas por mês</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="1"
                  disabled={!isAdmin}
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
          name="defaultMarkup"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Markup padrão (multiplicador, ex: 2.5)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  disabled={!isAdmin}
                  {...field}
                  value={Number.isNaN(field.value) ? "" : (field.value as number)}
                  onChange={(e) => field.onChange(e.target.valueAsNumber)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {isAdmin && (
          <Button type="submit" disabled={form.formState.isSubmitting} className="self-start">
            Salvar
          </Button>
        )}
      </form>
    </Form>
  );
}
```

- [ ] **Step 2: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 3: Checar lint**

Run: `./node_modules/.bin/biome check src/modules/costs-settings`
Expected: sem erros (use `--write` se houver só formatação).

- [ ] **Step 4: Commit**

```bash
git add src/modules/costs-settings/components/costs-settings-form.tsx
git commit -m "feat: add costs settings form, write restricted to admin"
```

---

### Task 4: Aba "Custos" em `/settings/resources`

**Files:**
- Modify: `src/modules/resources/components/resources-page-content.tsx`

**Interfaces:**
- Consumes: `CostsSettingsForm` (Task 3).
- Produces: nada — ponto de entrada final desta feature.

- [ ] **Step 1: Adicionar a terceira aba**

Substituir o conteúdo de `resources-page-content.tsx` por:

```tsx
"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CostsSettingsForm } from "@/modules/costs-settings/components/costs-settings-form";
import { MaterialsSection } from "@/modules/materials/components/materials-section";
import { PrintersSection } from "@/modules/printers/components/printers-section";
import { useTenant } from "@/shared/hooks/use-tenant";

export function ResourcesPageContent() {
  const { tenantId } = useTenant();

  if (!tenantId) return null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Materiais e impressoras</h1>
      <Tabs defaultValue="materials">
        <TabsList>
          <TabsTrigger value="materials">Materiais</TabsTrigger>
          <TabsTrigger value="printers">Impressoras</TabsTrigger>
          <TabsTrigger value="costs">Custos</TabsTrigger>
        </TabsList>
        <TabsContent value="materials">
          <MaterialsSection tenantId={tenantId} />
        </TabsContent>
        <TabsContent value="printers">
          <PrintersSection tenantId={tenantId} />
        </TabsContent>
        <TabsContent value="costs">
          <CostsSettingsForm tenantId={tenantId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 2: Checar tipos e lint**

Run: `npx tsc --noEmit && ./node_modules/.bin/biome check src/modules/resources`
Expected: sem erros.

- [ ] **Step 3: Rodar toda a suíte de testes unitários**

Run: `npx vitest run tests/materials tests/printers tests/costs-settings`
Expected: todos passam.

- [ ] **Step 4: Teste manual no browser**

Run app já em dev, logar como admin, ir em `/settings/resources`, aba "Custos", preencher e salvar, recarregar e confirmar valores persistidos. Logar como member (ou simular) e confirmar campos desabilitados e sem botão Salvar.

- [ ] **Step 5: Commit**

```bash
git add src/modules/resources/components/resources-page-content.tsx
git commit -m "feat: add costs tab to resources page"
```

---

## Spec Coverage Check

- Doc único `settings/costs` com os 5 campos → Tasks 1, 2
- Leitura membro / escrita admin sem mudar rules → Task 3 (gating na UI; regra já existente cobre o backend)
- Form direto na página, sem dialog, upsert via `setDoc` → Tasks 2, 3
- Aba "Custos" em `/settings/resources` → Task 4
- Teste unitário do schema → Task 1
