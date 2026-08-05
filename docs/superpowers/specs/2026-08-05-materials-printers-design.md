# Materiais e Impressoras — CRUD (etapa 3 do MVP)

## Objetivo

Cadastro de materiais (com controle de estoque) e impressoras (perfil de custo), pré-requisito pro cálculo de custo de produto (etapa 4).

## Escopo

- CRUD completo (create/read/update/delete) de `materials` e `printers`, escopados por `tenantId`.
- Controle de estoque nesta etapa é limitado a: campo `currentStockG` editável direto no formulário de material, e alerta visual quando `currentStockG < minStockG`.
- `stockMovements` (lançamento de entrada/saída rastreado) fica pra etapa de pedidos (seção 11 do CLAUDE.md), onde o débito automático por pedido faz sentido.
- Fora de escopo: uso de `printerId`/`materialId` em produtos (etapa 4), qualquer cálculo de custo.

## Arquitetura

Segue o padrão já estabelecido em `modules/team`:

- `modules/materials/{components,services}` e `modules/printers/{components,services}` — módulos irmãos, sem dependência entre si.
- `services/*.schema.ts`: schema Zod, reaproveitado no client (RHF via `zodResolver`).
- `services/*.service.ts`: funções client-SDK (`addDoc`, `updateDoc`, `deleteDoc`) direto no Firestore — sem Server Action, porque não há lógica privilegiada (claims, e-mail) envolvida; a Firestore Rule já garante `admin` do tenant.
- `hooks/use-materials.ts` / `hooks/use-printers.ts`: `onSnapshot` + `queryClient.setQueryData`, mesmo padrão de `useMembers`.
- Rota: `app/(dashboard)/settings/resources/page.tsx`, componente de página em `modules/materials/components` (ou um componente compartilhado que compõe os dois módulos) usando shadcn `Tabs` — aba "Materiais" e aba "Impressoras".

## Dados

```
tenants/{tenantId}/materials/{materialId}
  name: string
  pricePerKg: number (>0)
  defaultWasteRate: number (0–1)
  color: string
  density: number (>0)
  currentStockG: number (>=0)
  minStockG: number (>=0)

tenants/{tenantId}/printers/{printerId}
  name: string
  acquisitionCost: number (>0)
  usefulLifeHours: number (>0)
  avgPowerKw: number (>0)
  buildVolumeMm: { x: number, y: number, z: number } (>0 cada)
  notes: string (opcional)
```

Tipos em `shared/types/tenant.ts` (mesmo arquivo dos demais tipos de tenant) ou em arquivo próprio `shared/types/resources.ts` — decisão de implementação, sem impacto no design.

## UI

- Tabela (shadcn `Table`) por aba, com botão "Novo material" / "Nova impressora" abrindo um `Dialog` com o form (RHF + zodResolver).
- Ações de editar/excluir por linha (dropdown ou ícones).
- Linha de material com `currentStockG < minStockG` ganha destaque visual (badge "Estoque baixo" ou cor de aviso).
- Exclusão com confirmação (`AlertDialog` do shadcn) — sem checagem de uso por produto nesta etapa (produtos ainda não existem).

## Segurança (Firestore Rules)

Adicionar em `firestore.rules`, dentro de `match /tenants/{tenantId}`, mesmo padrão de `settings`:

```
match /materials/{materialId} {
  allow read: if isMember(tenantId);
  allow write: if isAdmin(tenantId);
}

match /printers/{printerId} {
  allow read: if isMember(tenantId);
  allow write: if isAdmin(tenantId);
}
```

## Testes

- Unitário dos schemas Zod (`materials.schema.ts`, `printers.schema.ts`): valores numéricos obrigatoriamente positivos, `defaultWasteRate` entre 0 e 1, campos obrigatórios.
- Sem teste de Security Rules novo nesta etapa (regra é idêntica ao padrão já coberto em `tenant-isolation.test.ts` pra `settings`); se o teste existente for parametrizável, estender pra cobrir `materials`/`printers` é bônus, não bloqueante.

## Ordem de implementação

1. Firestore rules (`materials`, `printers`) + deploy
2. Tipos + schemas Zod (com testes unitários)
3. Services client-SDK (CRUD)
4. Hooks (`onSnapshot` + React Query)
5. Componentes (form, tabela, dialog) por módulo
6. Página `settings/resources` com Tabs compondo os dois módulos
