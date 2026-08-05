# Produtos + Cálculo de Custo — Design (MVP etapa 4b)

## Objetivo

CRUD de produtos referenciando material/impressora, com cálculo automático de custo total e preço sugerido ao salvar.

## Escopo

- CRUD completo de `products` (create/read/update/delete), escopado por `tenantId`.
- Cálculo de custo como função pura, testada isoladamente, disparada automaticamente ao salvar o produto.
- Rota própria `/products` no dashboard (não é aba de `settings/resources` — CRUD principal do produto, maior escopo que materiais/impressoras).
- Fora de escopo: upload de foto/STL (`photoUrl`/`stlUrl`) — Storage bucket do Firebase ainda não existe; esses campos ficam pra quando o bucket for criado. Fora de escopo também: preview 3D, histórico de cálculo (snapshot ao longo do tempo é fase 2 per CLAUDE.md §9).

## Fórmula de custo

Função pura `calculateProductCost(product, material, printer, costsSettings)`:

```
materialCost     = (product.weightG / 1000) * material.pricePerKg * (1 + material.defaultWasteRate)
energyCost       = product.printTimeH * printer.avgPowerKw * costsSettings.energyRateKwh
depreciation     = product.printTimeH * (printer.acquisitionCost / printer.usefulLifeHours)
laborCost        = product.printTimeH * costsSettings.laborCostPerHour
fixedCostShare   = product.printTimeH * (costsSettings.monthlyFixedCosts / costsSettings.monthlyProductiveHours)

totalCost        = materialCost + energyCost + depreciation + laborCost + fixedCostShare
suggestedPrice   = totalCost * costsSettings.defaultMarkup
```

Sem I/O — recebe os 4 objetos já carregados, retorna `{ totalCost, suggestedPrice }`. Testado com casos numéricos concretos (CLAUDE.md §12: "é literalmente onde o dinheiro é calculado").

## Arquitetura

- `modules/products/services/products.schema.ts` — Zod schema do produto (sem `photoUrl`/`stlUrl`).
- `modules/products/services/cost-calculation.ts` — função pura acima + testes unitários dedicados.
- `modules/products/services/products.service.ts` — CRUD client-SDK + `useProducts(tenantId)` hook (onSnapshot + React Query, com `safeParse` na leitura — lição já aplicada em materials/printers/costs-settings).
- `modules/products/components/product-form-dialog.tsx` — form com `Select` de material (`useMaterials`) e impressora (`usePrinters`), campos de `printConfig`. Ao submeter: busca `costsSettings` via `useCostsSettings`; se `undefined`/`null`, bloqueia com toast "Configure os custos fixos antes de cadastrar produtos" (aba Custos). Caso contrário, roda `calculateProductCost` e grava produto + `lastCalculation` num único `addDoc`/`updateDoc`.
- `modules/products/components/product-list.tsx` — tabela: nome, peso, tempo, custo total, preço sugerido, ações (editar/excluir, admin+member — ver seção de segurança).
- `modules/products/components/products-section.tsx` — composição (botão novo produto + lista + dialog), mesmo padrão de `materials-section.tsx`.
- Rota: `app/(dashboard)/products/page.tsx` renderizando `ProductsPageContent` (ou reaproveitar `ProductsSection` direto, já que não tem abas).

## Dados

```
tenants/{tenantId}/products/{productId}
  name: string
  description: string (opcional)
  weightG: number (>0)
  printTimeH: number (>0)
  printerId: string (ref)
  materialId: string (ref)
  printConfig: {
    nozzleTempC: number (>0)
    bedTempC: number (>0)
    speedMmS: number (>0)
    supports: boolean
    bedAdhesion: string
    notes: string (opcional)
  }
  lastCalculation: {
    totalCost: number
    suggestedPrice: number
    calculatedAt: number (epoch ms)
  }
```

## Segurança

`firestore.rules`, novo bloco em `tenants/{tenantId}`:

```
match /products/{productId} {
  allow read: if isMember(tenantId);
  allow write: if isMember(tenantId);
}
```

Diferente de `materials`/`printers`/`settings` (escrita só admin): produtos são operação do dia a dia, qualquer membro do tenant pode criar/editar/excluir, per CLAUDE.md §6 ("admin+member" pra products/orders).

## UI / Navegação

- Rota nova `app/(dashboard)/products/page.tsx`.
- Item "Produtos" adicionado ao sidebar (`dashboard-shell.tsx`), entre "Início" e "Time" ou onde fizer sentido visualmente.
- Sem gating de admin nos botões de criar/editar/excluir (todo membro pode).

## Fluxo de erro: costs settings ausente

Se o tenant ainda não configurou `settings/costs`, salvar produto é bloqueado (toast explicativo com o motivo) — sem isso não há como calcular custo. Não bloqueia a navegação pra tela de produtos, só o submit do form.

## Testes

- Unitário de `calculateProductCost`: casos numéricos concretos, incluindo happy path e um caso de borda (ex: `printTimeH` bem pequeno, materiais com `defaultWasteRate` zero).
- Unitário do `productSchema` (Zod): campos obrigatórios, positivos, `printConfig` aninhado.

## Ordem de implementação

1. Firestore rules (`products`) + deploy
2. Schema Zod do produto + teste
3. Função pura de cálculo de custo + testes
4. Service (`useProducts` + CRUD, com safeParse)
5. Form dialog (Select material/impressora, printConfig, gate de costsSettings, roda cálculo ao salvar)
6. Lista (tabela com custo/preço) + seção
7. Rota `/products` + nav no sidebar
