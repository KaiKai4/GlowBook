import { describe, expect, it } from "vitest";
import { readFeedbackStatusForm } from "./set-feedback-status-form";

describe("readFeedbackStatusForm", () => {
  it("'resolved' marca el reporte como resuelto", () => {
    const data = new FormData();
    data.set("id", "r-1");
    data.set("status", "resolved");

    expect(readFeedbackStatusForm(data)).toEqual({ id: "r-1", status: "resolved" });
  });

  it("cualquier otro valor o ausencia vuelve el reporte a 'new'", () => {
    expect(readFeedbackStatusForm(new FormData())).toEqual({ id: "", status: "new" });

    const other = new FormData();
    other.set("status", "pending");
    expect(readFeedbackStatusForm(other).status).toBe("new");
  });
});
