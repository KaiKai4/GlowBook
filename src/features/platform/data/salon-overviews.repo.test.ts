import { describe, expect, it } from "vitest";
import { mapSalonOverviewRow } from "./salon-overviews.repo";

describe("platform salon overview read model", () => {
  it("maps the SQL read model into the platform view model", () => {
    const row = {
      id: "salon-1",
      name: "Glow Studio",
      email: "",
      contact_email: "owner@example.com",
      phone: "555",
      is_active: true,
      created_at: "2026-05-29T10:00:00.000Z",
      disabled_features: ["roles", "unknown"],
      owner_names: ["Ana Owner", ""],
      owner_count: 1,
      customer_count: 12,
      collaborator_count: 3,
      appointment_count: 40,
      service_count: 9,
      invitation_count: 2,
    };

    expect(mapSalonOverviewRow(row)).toEqual({
      id: "salon-1",
      name: "Glow Studio",
      email: "",
      contact_email: "owner@example.com",
      phone: "555",
      is_active: true,
      created_at: "2026-05-29T10:00:00.000Z",
      disabled_features: ["roles"],
      owner_names: ["Ana Owner"],
      owner_count: 1,
      customer_count: 12,
      collaborator_count: 3,
      appointment_count: 40,
      service_count: 9,
      invitation_count: 2,
    });
  });
});
