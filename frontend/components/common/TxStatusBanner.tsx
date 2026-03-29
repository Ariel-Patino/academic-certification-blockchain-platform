// Visual stepper that reflects the four MetaMask transaction phases.
"use client";

import { Check, Circle, ExternalLink, XCircle } from "lucide-react";

import { POLYGONSCAN_AMOY_TX_BASE } from "@/lib/constants";

export type TxPhase = "idle" | "requested" | "pending" | "confirmed" | "failed";

interface TxStatusBannerProps {
  phase: TxPhase;
  txHash?: string | null;
  errorMessage?: string | null;
}

const STEPPER_PHASES: { key: TxPhase; label: string; description: string }[] = [
  { key: "requested", label: "Pedida", description: "Esperando firma en MetaMask" },
  { key: "pending", label: "Pendiente", description: "Tx enviada a Polygon Amoy" },
  { key: "confirmed", label: "Confirmada", description: "Bloque minado" }
];

const PHASE_ORDER: Record<TxPhase, number> = {
  idle: -1,
  requested: 0,
  pending: 1,
  confirmed: 2,
  failed: -1
};

export function TxStatusBanner({ phase, txHash, errorMessage }: TxStatusBannerProps) {
  if (phase === "idle") {
    return null;
  }

  if (phase === "failed") {
    return (
      <div className="tx-status-banner tx-status-failed" role="alert" aria-live="assertive">
        <span className="tx-status-icon" aria-hidden="true">
          <XCircle size={16} />
        </span>
        <span>{errorMessage || "La transacción falló."}</span>
      </div>
    );
  }

  const currentOrder = PHASE_ORDER[phase];

  return (
    <div className="tx-status-banner" role="status" aria-live="polite">
      <ol className="tx-stepper" aria-label="Estado de la transacción">
        {STEPPER_PHASES.map(({ key, label, description }) => {
          const stepOrder = PHASE_ORDER[key];
          const isDone = currentOrder > stepOrder;
          const isActive = currentOrder === stepOrder;

          return (
            <li
              key={key}
              className={`tx-step${isDone ? " tx-step-done" : ""}${isActive ? " tx-step-active" : ""}`}
              aria-current={isActive ? "step" : undefined}
            >
              <span className="tx-step-dot" aria-hidden="true">
                {isDone ? <Check size={12} /> : <Circle size={12} />}
              </span>
              <span className="tx-step-label">{label}</span>
              {isActive && <span className="tx-step-desc">{description}</span>}
            </li>
          );
        })}
      </ol>

      {txHash && (
        <a
          className="tx-hash-link"
          href={POLYGONSCAN_AMOY_TX_BASE + txHash}
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink size={16} aria-hidden="true" />
          Ver en Polygonscan
        </a>
      )}
    </div>
  );
}
