import { describe, expect, it } from "vitest";
import { createDerivedDataset, NormalizedDataset } from "../dataset";
import { buildChartPreview, createChartMappingForType, sanitizeChartMapping } from "./previewModel";

function createDataset(): NormalizedDataset {
  return createDerivedDataset(
    {
      kind: "csv",
      fileName: "sales.csv",
      fileSize: 128,
      importedAt: "2026-03-17T00:00:00.000Z",
    },
    [
      { category: "A", region: "North", amount: 10 },
      { category: "A", region: "South", amount: 5 },
      { category: "B", region: "North", amount: 12 },
      { category: "B", region: "South", amount: 8 },
    ],
    ["category", "region", "amount"],
    {
      category: "Category",
      region: "Region",
      amount: "Amount",
    },
  );
}

describe("chart preview model", () => {
  it("creates chart defaults that prefer a dimension field plus numeric value field", () => {
    const dataset = createDataset();

    const mapping = createChartMappingForType("bar", dataset.fields, "Revenue");

    expect(mapping).toEqual({
      chartType: "bar",
      title: "Revenue",
      xField: "category",
      yField: "amount",
      seriesField: "region",
      colorField: null,
    });
  });

  it("aggregates cartesian preview points by category and series", () => {
    const dataset = createDataset();

    const preview = buildChartPreview(dataset, {
      chartType: "bar",
      title: "Revenue by category",
      xField: "category",
      yField: "amount",
      seriesField: "region",
      colorField: null,
    });

    expect(preview.chartType).toBe("bar");
    if (preview.chartType !== "bar") {
      throw new Error("Expected bar chart preview.");
    }

    expect(preview.issue).toBeNull();
    expect(preview.categories).toEqual(["A", "B"]);
    expect(preview.series).toEqual(["North", "South"]);
    expect(preview.points.map((point) => [point.categoryLabel, point.seriesLabel, point.value])).toEqual([
      ["A", "North", 10],
      ["A", "South", 5],
      ["B", "North", 12],
      ["B", "South", 8],
    ]);
  });

  it("aggregates repeated pie labels into slices", () => {
    const dataset = createDerivedDataset(
      {
        kind: "csv",
        fileName: "share.csv",
        fileSize: 64,
        importedAt: "2026-03-17T00:00:00.000Z",
      },
      [
        { segment: "SMB", revenue: 10 },
        { segment: "Enterprise", revenue: 25 },
        { segment: "SMB", revenue: 15 },
      ],
      ["segment", "revenue"],
      {
        segment: "Segment",
        revenue: "Revenue",
      },
    );

    const preview = buildChartPreview(dataset, {
      chartType: "pie",
      title: "Revenue share",
      labelField: "segment",
      valueField: "revenue",
      colorField: null,
    });

    expect(preview.chartType).toBe("pie");
    if (preview.chartType !== "pie") {
      throw new Error("Expected pie chart preview.");
    }

    expect(preview.issue).toBeNull();
    expect(preview.slices.map((slice) => [slice.label, slice.value])).toEqual([
      ["SMB", 25],
      ["Enterprise", 25],
    ]);
    expect(preview.totalValue).toBe(50);
  });

  it("reports an issue when the selected value field is not numeric", () => {
    const dataset = createDataset();
    const preview = buildChartPreview(dataset, {
      chartType: "line",
      title: "Invalid preview",
      xField: "category",
      yField: "region",
      seriesField: null,
      colorField: null,
    });

    expect(preview.issue).toContain("No numeric values are available");
  });

  it("sanitizes stale chart bindings against the current transformed fields", () => {
    const dataset = createDerivedDataset(
      {
        kind: "csv",
        fileName: "grouped.csv",
        fileSize: 64,
        importedAt: "2026-03-18T00:00:00.000Z",
      },
      [
        { category: "A", count_xdm: 2 },
        { category: "B", count_xdm: 4 },
      ],
      ["category", "count_xdm"],
      {
        category: "Category",
        count_xdm: "Count XDM",
      },
    );

    const sanitized = sanitizeChartMapping(
      {
        chartType: "bar",
        title: "Count by category",
        xField: "playerId",
        yField: "XDM",
        seriesField: "region",
        colorField: "region",
      },
      dataset.fields,
    );

    expect(sanitized).toEqual({
      chartType: "bar",
      title: "Count by category",
      xField: "category",
      yField: "count_xdm",
      seriesField: null,
      colorField: null,
    });
  });

  it("keeps valid chart bindings when transformed fields still exist", () => {
    const dataset = createDataset();

    const sanitized = sanitizeChartMapping(
      {
        chartType: "pie",
        title: "Revenue share",
        labelField: "category",
        valueField: "amount",
        colorField: "region",
      },
      dataset.fields,
    );

    expect(sanitized).toEqual({
      chartType: "pie",
      title: "Revenue share",
      labelField: "category",
      valueField: "amount",
      colorField: "region",
    });
  });
});
