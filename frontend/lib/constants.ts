// Centralizes frontend constants used across pages, hooks and services.
export const POLYGON_AMOY_CHAIN_ID_HEX = "0x13882"; // 80002 decimal
export const POLYGON_AMOY_CHAIN_ID = 80002;
export const POLYGONSCAN_AMOY_TX_BASE = "https://amoy.polygonscan.com/tx/";
export const POLYGON_AMOY_RPC_URL =
  process.env.NEXT_PUBLIC_AMOY_RPC_URL || "https://rpc-amoy.polygon.technology/";
export const PUBLIC_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";

export const APP_NAME = "Certificacion Academica Digital";
export const APP_DESCRIPTION = "Plataforma para emitir y verificar certificados academicos en blockchain.";

export const ROUTES = {
  home: "/",
  issue: "/issue",
  batch: "/batch",
  verify: "/verify",
  revoke: "/revoke",
  certificates: "/certificates"
} as const;

export const NAV_ITEMS = [
  { label: "Inicio", href: ROUTES.home },
  { label: "Emitir", href: ROUTES.issue },
  { label: "Lotes (CSV)", href: ROUTES.batch },
  { label: "Verificar", href: ROUTES.verify },
  { label: "Invalidar", href: ROUTES.revoke },
  { label: "Historial", href: ROUTES.certificates }
] as const;

export const API_LABELS = {
  issueCertificate: "POST /api/certificates",
  batchIssueCertificates: "POST /api/certificates/batch",
  verifyCertificate: "GET /api/verify?certificateHash=...",
  revokeCertificate: "POST /api/certificates/revoke"
} as const;
