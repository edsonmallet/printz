# Board Kanban + Débito de Estoque — Design

## Contexto

Segunda sub-etapa da Etapa 6 (seção 11 do CLAUDE.md), depois de
[2026-08-05-orders-crud-design.md](2026-08-05-orders-crud-design.md) (CRUD
de pedidos + colunas configuráveis, já implementado). Esse spec cobre:

1. Board kanban com drag-and-drop pra mudar o `statusId` do pedido.
2. Débito automático de estoque quando o pedido entra na coluna de produção
   (CLAUDE.md seção 5), disparado pelo drag-and-drop.

**Fora do escopo:** `statusHistory` (subcoleção do CLAUDE.md seção 4 —
adiada; controle de double-debit usa um flag simples no pedido em vez de
histórico), parceiros, reordenação de cards dentro da mesma coluna.

## Modelo de dados

### `kanbanColumns/{id}` — novo campo

```
isProductionEntry: boolean  // default false
```

Admin marca, no CRUD de colunas, qual coluna representa "entrada em
produção". Não há enforcement de unicidade — se o admin marcar mais de uma
coluna, cada uma dispara o débito independentemente na primeira vez que um
pedido entra nela. Ficar marcado errado é responsabilidade do admin, não
validado pelo client.

### `orders/{id}` — novo campo

```
stockDebited: boolean  // default false na criação
```

### Nova coleção `tenants/{tenantId}/stockMovements/{movementId}`

```
materialId: string
type: "out"          // única direção usada nesta etapa — entradas manuais (compra de filamento) ficam fora do escopo
quantityG: number
source: string        // `order:{orderId}`
createdAt: number
createdBy: string     // uid de quem arrastou o card
```

## Débito de estoque

`src/modules/orders/services/stock-debit.ts`:

```ts
async function debitStockForOrder(
  tenantId: string,
  order: OrderWithId,
  createdBy: string,
): Promise<void>
```

Implementado com `runTransaction`:
1. Lê o doc do pedido dentro da transação; se `stockDebited === true`, sai
   sem fazer nada (idempotente — protege contra o usuário arrastar o card
   pra fora e de volta pra coluna de produção, ou double-fire do handler).
2. Para cada item do pedido, `increment(-item.totalWeightG)` no
   `currentStockG` do material correspondente (sem clamping em zero —
   pedidos criados com "criar mesmo assim" já passaram por estoque
   insuficiente na criação; o débito pode deixar `currentStockG` negativo,
   isso é esperado e visível no alerta de estoque mínimo).
3. Cria um doc em `stockMovements` por item (`type: "out"`,
   `source: "order:{orderId}"`).
4. Seta `order.stockDebited = true` no mesmo write.

Chamado pelo board sempre que um card é solto numa coluna com
`isProductionEntry === true` — a checagem de idempotência dentro da
transação é o que evita double-debit, não uma checagem no client antes de
chamar.

## Board

### `modules/kanban-columns/` — mudanças

- `kanban-columns.schema.ts`: adiciona `isProductionEntry: z.boolean().default(false)`
- `kanban-column-form-dialog.tsx`: adiciona um `Switch` "Coluna de entrada em produção" (mesmo padrão do `Switch` já usado em `product-form-dialog.tsx` pro campo `printConfig.supports`)

### `modules/orders/` — novo componente `orders-board.tsx`

- Dependência nova: `@dnd-kit/core` (`DndContext`, `useDraggable`,
  `useDroppable`, `DragOverlay` pro card sendo arrastado)
- Colunas: `useKanbanColumns(tenantId)`, ordenadas por `order`, cada uma um
  droppable (`useDroppable({ id: column.id })`)
- Cards: `useOrders(tenantId)` agrupados por `statusId`; cada card
  (`useDraggable({ id: order.id })`) mostra cliente (ou "—"), itens
  resumidos, impressora, data de entrega — mesmo conteúdo que já existe em
  `order-list.tsx`, reaproveitado num componente `order-card.tsx` menor
- `onDragEnd`: se a coluna de destino for diferente da atual,
  `updateOrder(tenantId, orderId, { ...order, statusId: newColumnId })`;
  se a coluna de destino tiver `isProductionEntry`, chama
  `debitStockForOrder(tenantId, order, user.uid)` (via `useAuth()`) depois
  do `updateOrder`
- Sem reordenação dentro da mesma coluna — só mudança de coluna
- Formatação de `dueDate` no card reaproveita `toLocaleDateString("pt-BR")`
  sobre o timestamp já armazenado (mesma lógica local-midnight corrigida em
  `order-form-dialog.tsx`/`order-list.tsx` na etapa anterior) — não
  reintroduzir parsing UTC aqui

### `orders-page-content.tsx` — toggle Lista/Board

Envolve `OrderList`/`OrdersBoard` num `Tabs` (mesmo padrão de
`resources-page-content.tsx`): aba "Lista" (conteúdo atual) e aba "Board"
(novo). `OrderFormDialog` de criar/editar continua acessível pelas duas
(botão "Novo pedido" fica fora do `Tabs`, no topo da seção, como já é hoje
em `orders-section.tsx`).

## Erros / edge cases

- Arrastar um pedido pra fora e de volta pra coluna de produção: segunda
  chamada de `debitStockForOrder` é no-op pela checagem `stockDebited`
  dentro da transação.
- Coluna de produção excluída depois que pedidos já passaram por ela:
  `stockDebited` já está `true`, nada quebra — o campo é histórico, não
  depende da coluna continuar existindo.
- Falha de rede/permissão durante o drag: `onDragEnd` deve fazer
  rollback visual (o dnd-kit já não persiste posição — a UI só reflete o
  novo `statusId` depois que o Firestore confirma via `onSnapshot`); se
  `updateOrder` ou `debitStockForOrder` rejeitar, mostrar toast de erro.

## Testes

- Unitário: nenhuma lógica pura nova além do que já existe
  (`debitStockForOrder` depende de `runTransaction`, que precisa do
  emulador — mesma limitação de ambiente já documentada nos specs
  anteriores; sem teste automatizado de transação nesta etapa, só teste
  manual/emulador quando disponível).
- `kanban-columns.schema.test.ts`: adicionar caso pro novo campo
  `isProductionEntry` (default `false`, aceita `true`).
