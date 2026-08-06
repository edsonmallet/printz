# Pedidos + Colunas Kanban (CRUD base) — Design

## Contexto

Etapa 6 do plano (seção 11 do CLAUDE.md) cobre pedidos + kanban interno + débito de
estoque. É grande demais pra um spec só, então foi quebrada em sub-etapas:

1. **Este spec**: CRUD de pedidos + colunas kanban configuráveis + validação de
   estoque na criação (bloqueia, permite forçar).
2. **Próximo spec** (fora deste escopo): board kanban com drag-and-drop, débito
   automático de estoque (`stockMovements`) ao entrar em produção, `statusHistory`.
3. **Fora do MVP desta etapa**: parceiros (`partnerId` sempre `null`, campo não
   aparece no form).

## Modelo de dados

Sem mudanças em relação ao já definido no CLAUDE.md seção 4:

```
tenants/{tenantId}/kanbanColumns/{columnId}
  ├─ name: string
  ├─ order: number

tenants/{tenantId}/orders/{orderId}
  ├─ customer?: { name: string, contact: string }
  ├─ items: [{ productId, name, quantity, materialId, totalWeightG, totalPrintTimeH }]
  ├─ dueDate: Timestamp
  ├─ statusId: string        // ref kanbanColumns
  ├─ assignedPrinterId: string  // obrigatório na criação
  ├─ partnerId: null         // sempre null nesta etapa
  ├─ createdAt, updatedAt
```

`totalWeightG` e `totalPrintTimeH` por item são snapshot no momento da criação
(`product.weightG × quantity`, `product.printTimeH × quantity`) — não recalculam
se o produto for editado depois.

## Módulos

### `modules/kanban-columns/`

- `services/kanban-columns.schema.ts` — Zod: `{ name: string, order: number }`
- `services/kanban-columns.service.ts`:
  - `useKanbanColumns(tenantId)` — `onSnapshot` ordenado por `order`, via TanStack Query (mesmo padrão de `useCostsSettings`/`useMaterials`)
  - `createColumn`, `updateColumn`, `deleteColumn`
  - `seedDefaultColumns(tenantId)` — chamada quando a coleção está vazia; cria 4 colunas default: "A produzir", "Em fila de impressão", "Pronto", "Entregue"
- UI: nova aba "Colunas" em `resources-page-content.tsx` (junto de Materiais/Impressoras/Custos), CRUD simples de nome + ordem, sem drag-and-drop (isso é uma etapa futura, do board)

### `modules/orders/`

- `services/orders.schema.ts` — Zod schema do form:
  - `customer`: opcional `{ name, contact }`
  - `items`: array, mínimo 1, cada item `{ productId, quantity }` (materialId/totais derivados no submit, não no schema de input do usuário)
  - `dueDate`: data obrigatória
  - `statusId`: obrigatório (select de kanbanColumns)
  - `assignedPrinterId`: obrigatório
- `services/orders.service.ts`:
  - `useOrders(tenantId)` — listener + TanStack Query, mesmo padrão dos outros módulos
  - `useOrder(tenantId, orderId)` — para tela de edição
  - `createOrder(tenantId, input)`, `updateOrder(tenantId, orderId, input)`
- `services/stock-validation.ts` — função pura:
  ```ts
  function validateStock(
    items: { materialId: string; totalWeightG: number }[],
    materials: Map<string, Pick<Material, "currentStockG">>,
    excludeOrderId?: string, // ignora consumo do próprio pedido ao editar
  ): { materialId: string; required: number; available: number; sufficient: boolean }[]
  ```
  Ao editar um pedido existente, o consumo do próprio pedido não deve ser
  contado contra o estoque disponível (senão a validação ficaria incorreta
  comparando contra o estoque já debitado por ele mesmo). Como o débito real
  de estoque só acontece na etapa do board (fora deste escopo), na prática
  isso significa: ao editar, a validação simplesmente ignora completamente
  itens que não mudaram de quantidade — MVP aqui é validar sempre contra o
  `currentStockG` atual, sem subtrair nada do próprio pedido (porque nada foi
  debitado ainda). `excludeOrderId` fica documentado mas sem efeito nesta
  etapa (no-op), preparando terreno pra quando o débito existir.
- `components/order-form-dialog.tsx`:
  - RHF + `useFieldArray` pra items (select de produto com busca + input quantidade)
  - Ao selecionar produto numa linha, popular automaticamente materialId e calcular totalWeightG/totalPrintTimeH (client-side, recalcula se quantity mudar)
  - Select de impressora (`assignedPrinterId`), select de coluna (`statusId`), date picker (`dueDate`), campos opcionais de cliente
  - No submit: roda `stock-validation`; se algum material insuficiente, mostra alerta com lista de materiais faltantes + checkbox "Criar mesmo assim"; sem marcar o checkbox, bloqueia o submit
- `components/order-list.tsx` — tabela: cliente/resumo de itens, dueDate, status (Badge), impressora, ação editar
- `components/orders-page-content.tsx` — junta list + dialog, mesmo padrão de `products-page-content.tsx`

### Rota e navegação

- `app/(dashboard)/orders/page.tsx` → renderiza `OrdersPageContent`
- `dashboard-shell.tsx`: novo item de nav "Pedidos" (ícone `ClipboardList`), entre "Produtos" e "Time"

## Erros / edge cases

- Pedido sem itens: bloqueado pelo Zod (`items.min(1)`)
- Produto sem `weightG`/`printTimeH` válido: não tratado aqui — já validado no form de produto na etapa anterior
- Estoque insuficiente: bloqueia por padrão, checkbox força criação (CLAUDE.md seção 5)

## Testes

- Unitário em `stock-validation.ts`: estoque suficiente, insuficiente, múltiplos materiais agregados corretamente (mesmo material em itens diferentes soma consumo)
