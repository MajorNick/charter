import { describe, expect, it } from "vitest";
import { createDerivedDataset, NormalizedDataset } from "../dataset";
import { executeTransformPipeline } from "./engine";

function createDataset(): NormalizedDataset {
  return createDerivedDataset(
    {
      kind: "csv",
      fileName: "sales.csv",
      fileSize: 128,
      importedAt: "2026-03-17T00:00:00.000Z",
    },
    [
      { category: "A", region: "North", amount: 10, active: true },
      { category: "A", region: "South", amount: 20, active: false },
      { category: "B", region: "North", amount: 15, active: true },
      { category: "B", region: "South", amount: null, active: false },
    ],
    ["category", "region", "amount", "active"],
    {
      category: "Category",
      region: "Region",
      amount: "Amount",
      active: "Active",
    },
  );
}

describe("executeTransformPipeline", () => {
  it("filters, calculates, sorts, selects, and renames rows deterministically", () => {
    const dataset = createDataset();

    const result = executeTransformPipeline(dataset, {
      source: {
        kind: "csv",
        fields: dataset.fields.map((field) => ({
          key: field.key,
          label: field.label,
          sourceKey: field.sourceKey,
          kind: field.kind,
          nullable: field.nullable,
        })),
      },
      transforms: [
        {
          id: "filter-active",
          label: "Active only",
          type: "filter",
          combinator: "and",
          rules: [{ field: "active", operator: "equals", value: true }],
        },
        {
          id: "calc-band",
          label: "Band",
          type: "calculate",
          outputField: "band",
          expression: '{amount} >= 15 ? "high" : "low"',
          outputKind: "string",
        },
        {
          id: "sort-amount",
          label: "Sort",
          type: "sort",
          rules: [{ field: "amount", direction: "desc" }],
        },
        {
          id: "select-fields",
          label: "Select",
          type: "select",
          fields: ["category", "amount", "band"],
        },
        {
          id: "rename-band",
          label: "Rename",
          type: "rename",
          mappings: [{ from: "band", to: "performance_band" }],
        },
      ],
    });

    expect(result.dataset.rows).toEqual([
      { category: "B", amount: 15, performance_band: "high" },
      { category: "A", amount: 10, performance_band: "low" },
    ]);
    expect(result.dataset.fields.map((field) => field.key)).toEqual([
      "category",
      "amount",
      "performance_band",
    ]);
    expect(result.traces).toEqual([
      {
        stepId: "filter-active",
        stepType: "filter",
        rowCount: 2,
        fieldOrder: ["category", "region", "amount", "active"],
      },
      {
        stepId: "calc-band",
        stepType: "calculate",
        rowCount: 2,
        fieldOrder: ["category", "region", "amount", "active", "band"],
      },
      {
        stepId: "sort-amount",
        stepType: "sort",
        rowCount: 2,
        fieldOrder: ["category", "region", "amount", "active", "band"],
      },
      {
        stepId: "select-fields",
        stepType: "select",
        rowCount: 2,
        fieldOrder: ["category", "amount", "band"],
      },
      {
        stepId: "rename-band",
        stepType: "rename",
        rowCount: 2,
        fieldOrder: ["category", "amount", "performance_band"],
      },
    ]);
  });

  it("groups and aggregates rows into a derived dataset", () => {
    const dataset = createDataset();

    const result = executeTransformPipeline(dataset, {
      source: {
        kind: "csv",
        fields: dataset.fields.map((field) => ({
          key: field.key,
          label: field.label,
          sourceKey: field.sourceKey,
          kind: field.kind,
          nullable: field.nullable,
        })),
      },
      transforms: [
        {
          id: "group-category",
          label: "Group by category",
          type: "group",
          groupBy: ["category"],
          aggregates: [
            { operation: "sum", field: "amount", as: "total_amount" },
            { operation: "count", as: "row_count" },
          ],
        },
      ],
    });

    expect(result.dataset.rows).toEqual([
      { category: "A", total_amount: 30, row_count: 2 },
      { category: "B", total_amount: 15, row_count: 2 },
    ]);
    expect(result.dataset.fields.map((field) => [field.key, field.kind])).toEqual([
      ["category", "string"],
      ["total_amount", "number"],
      ["row_count", "number"],
    ]);
  });

  it("supports whole-dataset aggregation when no group-by fields are selected", () => {
    const dataset = createDataset();

    const result = executeTransformPipeline(dataset, {
      source: {
        kind: "csv",
        fields: dataset.fields.map((field) => ({
          key: field.key,
          label: field.label,
          sourceKey: field.sourceKey,
          kind: field.kind,
          nullable: field.nullable,
        })),
      },
      transforms: [
        {
          id: "count-amount",
          label: "Count XDM",
          type: "group",
          groupBy: [],
          aggregates: [{ operation: "count", field: "amount", as: "count_xdm" }],
        },
      ],
    });

    expect(result.dataset.rows).toEqual([{ count_xdm: 3 }]);
    expect(result.dataset.fields.map((field) => field.key)).toEqual(["count_xdm"]);
  });

  it("rejects duplicate group output field names", () => {
    const dataset = createDataset();

    expect(() =>
      executeTransformPipeline(dataset, {
        source: {
          kind: "csv",
          fields: dataset.fields.map((field) => ({
            key: field.key,
            label: field.label,
            sourceKey: field.sourceKey,
            kind: field.kind,
            nullable: field.nullable,
          })),
        },
        transforms: [
          {
            id: "group-duplicate",
            label: "Duplicate aliases",
            type: "group",
            groupBy: ["category"],
            aggregates: [{ operation: "count", as: "category" }],
          },
        ],
      }),
    ).toThrow("Group step would produce duplicate field names");
  });

  it("rejects incompatible template source kinds", () => {
    const dataset = createDataset();

    expect(() =>
      executeTransformPipeline(dataset, {
        source: {
          kind: "json",
          fields: [],
        },
        transforms: [],
      }),
    ).toThrow("Template expects a JSON source");
  });
});
