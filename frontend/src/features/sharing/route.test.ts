import { describe, expect, it } from "vitest";
import { buildTemplatePath, getTemplateIdFromPath, getTemplateShareUrl } from "./route";

describe("sharing route helpers", () => {
  it("parses public template paths", () => {
    expect(getTemplateIdFromPath("/t/01ARZ3NDEKTSV4RRFFQ69G5FAV")).toBe("01ARZ3NDEKTSV4RRFFQ69G5FAV");
  });

  it("ignores non-template paths", () => {
    expect(getTemplateIdFromPath("/dashboard")).toBeNull();
  });

  it("builds share URLs from a template id", () => {
    expect(buildTemplatePath("01ARZ3NDEKTSV4RRFFQ69G5FAV")).toBe("/t/01ARZ3NDEKTSV4RRFFQ69G5FAV");
    expect(getTemplateShareUrl("01ARZ3NDEKTSV4RRFFQ69G5FAV", "https://charter.test")).toBe("https://charter.test/t/01ARZ3NDEKTSV4RRFFQ69G5FAV");
  });
});
