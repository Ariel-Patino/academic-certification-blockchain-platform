import { describe, expect, it } from "vitest";
import {
  API_LABELS,
  APP_DESCRIPTION,
  APP_NAME,
  NAV_ITEMS,
  POLYGON_AMOY_CHAIN_ID,
  POLYGON_AMOY_CHAIN_ID_HEX,
  POLYGONSCAN_AMOY_TX_BASE,
  ROUTES
} from "./constants";

describe("constants", () => {
  it("contains expected chain constants", () => {
    expect(POLYGON_AMOY_CHAIN_ID).toBe(80002);
    expect(POLYGON_AMOY_CHAIN_ID_HEX).toBe("0x13882");
    expect(POLYGONSCAN_AMOY_TX_BASE).toContain("polygonscan.com/tx/");
  });

  it("has app metadata", () => {
    expect(APP_NAME.length).toBeGreaterThan(0);
    expect(APP_DESCRIPTION.length).toBeGreaterThan(0);
  });

  it("defines stable routes", () => {
    expect(ROUTES.home).toBe("/");
    expect(ROUTES.issue).toBe("/issue");
    expect(ROUTES.batch).toBe("/batch");
    expect(ROUTES.verify).toBe("/verify");
    expect(ROUTES.revoke).toBe("/revoke");
    expect(ROUTES.certificates).toBe("/certificates");
  });

  it("keeps nav items aligned with routes", () => {
    expect(NAV_ITEMS.length).toBeGreaterThanOrEqual(6);
    expect(NAV_ITEMS.map((item) => item.href)).toEqual(
      expect.arrayContaining([ROUTES.home, ROUTES.issue, ROUTES.batch, ROUTES.verify, ROUTES.revoke, ROUTES.certificates])
    );
  });

  it("contains API labels", () => {
    expect(API_LABELS.issueCertificate).toContain("POST");
    expect(API_LABELS.verifyCertificate).toContain("GET");
    expect(API_LABELS.revokeCertificate).toContain("POST");
  });
});
