"use client";

interface Web3LikeError {
  code?: number;
  message?: string;
  shortMessage?: string;
  info?: { error?: { code?: number; message?: string } };
  error?: { code?: number; message?: string };
}

const normalizeMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const candidate = error as Web3LikeError;
    return [candidate.shortMessage, candidate.message, candidate.info?.error?.message, candidate.error?.message]
      .filter(Boolean)
      .join(" | ");
  }

  return "";
};

const normalizeCode = (error: unknown): number | null => {
  if (!error || typeof error !== "object") {
    return null;
  }

  const candidate = error as Web3LikeError;
  return candidate.code ?? candidate.info?.error?.code ?? candidate.error?.code ?? null;
};

export const formatWeb3Error = (error: unknown, fallback: string): string => {
  const code = normalizeCode(error);
  const message = normalizeMessage(error).toLowerCase();

  if (code === 4001 || message.includes("user rejected") || message.includes("user denied")) {
    return "Transaccion rechazada por el usuario en MetaMask.";
  }

  if (
    message.includes("insufficient funds") ||
    message.includes("funds for gas") ||
    message.includes("gas * price + value") ||
    message.includes("exceeds allowance")
  ) {
    return "Fondos insuficientes para gas. Recarga MATIC en la wallet y vuelve a intentarlo.";
  }

  if (
    code === 4902 ||
    message.includes("unrecognized chain") ||
    message.includes("unknown chain")
  ) {
    return "La red Polygon Amoy no esta configurada en MetaMask. Anadela o cambia a esa red antes de continuar.";
  }

  if (
    code === -32002 ||
    message.includes("already processing") ||
    message.includes("request already pending")
  ) {
    return "MetaMask ya tiene una solicitud pendiente. Revisa la extension y completa o cancela la operacion actual.";
  }

  if (
    message.includes("network error") ||
    message.includes("failed to fetch") ||
    message.includes("disconnected") ||
    message.includes("timeout") ||
    message.includes("internal json-rpc error") ||
    message.includes("could not coalesce error")
  ) {
    return "Error de red al comunicar con MetaMask o Polygon. Verifica la conexion RPC e intentalo de nuevo.";
  }

  if (message.includes("nonce")) {
    return "Error de nonce de transaccion. Espera unos segundos y vuelve a intentarlo.";
  }

  return fallback;
};
