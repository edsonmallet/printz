import { describe, expect, it } from "vitest";
import { orderFormSchema } from "@/modules/orders/services/orders.schema";

describe("orderFormSchema", () => {
  const validInput = {
    customerName: "Maria",
    customerContact: "11999999999",
    items: [{ productId: "prod-1", quantity: 2 }],
    dueDate: "2026-09-01",
    statusId: "col-1",
    assignedPrinterId: "printer-1",
  };

  it("aceita um pedido válido", () => {
    const result = orderFormSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("aceita sem dados de cliente (opcional)", () => {
    const { customerName, customerContact, ...rest } = validInput;
    const result = orderFormSchema.safeParse(rest);
    expect(result.success).toBe(true);
  });

  it("rejeita items vazio", () => {
    const result = orderFormSchema.safeParse({ ...validInput, items: [] });
    expect(result.success).toBe(false);
  });

  it("rejeita quantity zero ou negativa", () => {
    expect(
      orderFormSchema.safeParse({
        ...validInput,
        items: [{ productId: "prod-1", quantity: 0 }],
      }).success,
    ).toBe(false);
    expect(
      orderFormSchema.safeParse({
        ...validInput,
        items: [{ productId: "prod-1", quantity: -1 }],
      }).success,
    ).toBe(false);
  });

  it("rejeita dueDate vazio", () => {
    const result = orderFormSchema.safeParse({ ...validInput, dueDate: "" });
    expect(result.success).toBe(false);
  });

  it("rejeita statusId vazio", () => {
    const result = orderFormSchema.safeParse({ ...validInput, statusId: "" });
    expect(result.success).toBe(false);
  });

  it("rejeita assignedPrinterId vazio", () => {
    const result = orderFormSchema.safeParse({ ...validInput, assignedPrinterId: "" });
    expect(result.success).toBe(false);
  });
});
