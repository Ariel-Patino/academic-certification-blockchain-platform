import { describe, expect, it } from "vitest";
import { formatWeb3Error } from "./web3Errors";

describe("formatWeb3Error", () => {
  it("maps user rejected error by code", () => {
    const result = formatWeb3Error({ code: 4001 }, "fallback");
    expect(result).toContain("rechazada por el usuario");
  });

  it("maps user denied error by message", () => {
    const result = formatWeb3Error({ message: "User denied transaction signature" }, "fallback");
    expect(result).toContain("rechazada por el usuario");
  });

  it("maps insufficient funds", () => {
    const result = formatWeb3Error({ shortMessage: "insufficient funds for gas * price + value" }, "fallback");
    expect(result).toContain("Fondos insuficientes");
  });

  it("maps unknown chain", () => {
    const result = formatWeb3Error({ code: 4902 }, "fallback");
    expect(result).toContain("Polygon Amoy");
  });

  it("maps already processing", () => {
    const result = formatWeb3Error({ code: -32002 }, "fallback");
    expect(result).toContain("solicitud pendiente");
  });

  it("maps network level errors", () => {
    const result = formatWeb3Error({ message: "failed to fetch" }, "fallback");
    expect(result).toContain("Error de red");
  });

  it("maps nonce errors", () => {
    const result = formatWeb3Error({ message: "nonce too low" }, "fallback");
    expect(result).toContain("nonce");
  });

  it("uses nested error payload fields", () => {
    const result = formatWeb3Error({ info: { error: { message: "network error" } } }, "fallback");
    expect(result).toContain("Error de red");
  });

  it("returns fallback for unknown errors", () => {
    const fallback = "mensaje fallback";
    const result = formatWeb3Error({ message: "algo raro" }, fallback);
    expect(result).toBe(fallback);
  });

  it("returns fallback for non-object value", () => {
    const fallback = "mensaje fallback";
    const result = formatWeb3Error("plain-text-error", fallback);
    expect(result).toBe(fallback);
  });
});
