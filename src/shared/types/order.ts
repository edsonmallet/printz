export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  materialId: string;
  totalWeightG: number;
  totalPrintTimeH: number;
}

export interface Order {
  customer?: { name: string; contact: string };
  items: OrderItem[];
  dueDate: number;
  statusId: string;
  assignedPrinterId: string;
  partnerId: null;
  createdAt: number;
  updatedAt: number;
}
