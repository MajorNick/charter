import { describe, expect, it } from "vitest";
import { createDerivedDataset } from "../dataset";
import { projectTransformedFields } from "./projectedFields";

describe("projectTransformedFields", () => {
  it("exposes calculated and aggregate output fields for downstream mapping", () => {
    const dataset = createDerivedDataset(
      {
        kind: "csv",
        fileName: "sales.csv",
        fileSize: 128,
        importedAt: "2026-03-17T00:00:00.000Z",
      },
      [
        { category: "A", amount: 10 },
        { category: "B", amount: 20 },
      ],
      ["category", "amount"],
      {
        category: "Category",
        amount: "Amount",
      },
    );

    const projected = projectTransformedFields(dataset.fields, [
      {
        id: "calc-band",
        label: "Band",
        type: "calculate",
        outputField: "band",
        expression: '{amount} > 10 ? "high" : "low"',
        outputKind: "string",
      },
      {
        id: "group-category",
        label: "Group",
        type: "group",
        groupBy: ["category"],
        aggregates: [{ operation: "sum", field: "amount", as: "total_amount" }],
      },
    ]);

    expect(projected.map((field) => [field.key, field.kind])).toEqual([
      ["category", "string"],
      ["total_amount", "number"],
    ]);
  });

  it("keeps calculated fields available when runtime preview is not yet available", () => {
    const dataset = createDerivedDataset(
      {
        kind: "csv",
        fileName: "sales.csv",
        fileSize: 128,
        importedAt: "2026-03-17T00:00:00.000Z",
      },
      [{ category: "A", amount: 10 }],
      ["category", "amount"],
      {
        category: "Category",
        amount: "Amount",
      },
    );

    const projected = projectTransformedFields(dataset.fields, [
      {
        id: "calc-label",
        label: "Label",
        type: "calculate",
        outputField: "chart_label",
        expression: '{category} + " bucket"',
        outputKind: "string",
      },
    ]);

    expect(projected.some((field) => field.key === "chart_label")).toBe(true);
  });
});
