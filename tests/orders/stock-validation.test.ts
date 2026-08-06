import { describe, expect, it } from "vitest";
import { validateStock } from "@/modules/orders/services/stock-validation";

describe("validateStock", () => {
  it("marca sufficient true quando estoque cobre o consumo", () => {
    const result = validateStock(
      [{ materialId: "pla-branco", totalWeightG: 100 }],
      new Map([["pla-branco", { currentStockG: 500 }]]),
    );
    expect(result).toEqual([
      { materialId: "pla-branco", required: 100, available: 500, sufficient: true },
    ]);
  });

  it("marca sufficient false quando estoque não cobre o consumo", () => {
    const result = validateStock(
      [{ materialId: "pla-branco", totalWeightG: 600 }],
      new Map([["pla-branco", { currentStockG: 500 }]]),
    );
    expect(result).toEqual([
      { materialId: "pla-branco", required: 600, available: 500, sufficient: false },
    ]);
  });

  it("soma consumo de itens diferentes que usam o mesmo material", () => {
    const result = validateStock(
      [
        { materialId: "pla-branco", totalWeightG: 200 },
        { materialId: "pla-branco", totalWeightG: 200 },
      ],
      new Map([["pla-branco", { currentStockG: 300 }]]),
    );
    expect(result).toEqual([
      { materialId: "pla-branco", required: 400, available: 300, sufficient: false },
    ]);
  });

  it("trata material desconhecido no mapa como estoque zero", () => {
    const result = validateStock([{ materialId: "pla-verde", totalWeightG: 50 }], new Map());
    expect(result).toEqual([
      { materialId: "pla-verde", required: 50, available: 0, sufficient: false },
    ]);
  });

  it("retorna um resultado por material distinto, na ordem de primeira ocorrência", () => {
    const result = validateStock(
      [
        { materialId: "pla-branco", totalWeightG: 100 },
        { materialId: "pla-preto", totalWeightG: 50 },
      ],
      new Map([
        ["pla-branco", { currentStockG: 1000 }],
        ["pla-preto", { currentStockG: 1000 }],
      ]),
    );
    expect(result.map((r) => r.materialId)).toEqual(["pla-branco", "pla-preto"]);
  });
});
