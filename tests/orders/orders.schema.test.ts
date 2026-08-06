import { describe, expect, it } from "vitest";
import {
  orderFormSchema,
  orderDocSchema,
} from "@/modules/orders/services/orders.schema";

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

describe("orderDocSchema", () => {
  const validDoc = {
    items: [
      {
        productId: "prod-1",
        name: "Vaso",
        quantity: 2,
        materialId: "mat-1",
        totalWeightG: 100,
        totalPrintTimeH: 4,
      },
    ],
    dueDate: 1735689600000,
    statusId: "col-1",
    assignedPrinterId: "printer-1",
    partnerId: null,
    stockDebited: false,
    createdAt: 1735689600000,
    updatedAt: 1735689600000,
  };

  it("aceita um documento válido com stockDebited false", () => {
    const result = orderDocSchema.safeParse(validDoc);
    expect(result.success).toBe(true);
  });

  it("aceita stockDebited true", () => {
    const result = orderDocSchema.safeParse({ ...validDoc, stockDebited: true });
    expect(result.success).toBe(true);
  });

  it("assume stockDebited false por padrão quando omitido (pedidos legados)", () => {
    const { stockDebited, ...rest } = validDoc;
    const result = orderDocSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stockDebited).toBe(false);
    }
  });
});
