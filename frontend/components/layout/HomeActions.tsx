"use client";

import Link from "next/link";

import { useWallet } from "@/hooks/useWallet";
import { ROUTES } from "@/lib/constants";

export function HomeActions() {
  const { isConnected } = useWallet();

  return (
    <div className="hero-actions">
      <Link className="button" href={ROUTES.issue}>
        Emision On-Chain
      </Link>
      <Link className="button button-secondary" href={ROUTES.verify}>
        Verificar Integridad y Anclaje Blockchain
      </Link>
      {isConnected ? (
        <Link className="button button-secondary" href={ROUTES.revoke}>
          Invalidar Certificado (Revocacion On-Chain)
        </Link>
      ) : (
        <span className="button button-secondary button-disabled" aria-disabled="true">
          Invalidar Certificado (Revocacion On-Chain)
        </span>
      )}
    </div>
  );
}