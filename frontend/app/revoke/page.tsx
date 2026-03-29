"use client";

import { RevokeAccessGate } from "@/components/certificates/RevokeAccessGate";
import { PageContainer } from "@/components/layout/PageContainer";
import { useWallet } from "@/hooks/useWallet";

export default function RevokePage() {
  const { isConnected } = useWallet();

  if (!isConnected) {
    return (
      <PageContainer>
        <section className="card">
          <p className="eyebrow">Revocacion</p>
          <h2>Invalidar certificado</h2>
          <p>Conecte su billetera para habilitar esta función.</p>
        </section>
        <div className="wallet-banner">
            La invalidación de certificados requiere una billetera conectada.
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <section className="card">
        <p className="eyebrow">Revocacion</p>
        <h2>Gestión de Revocaciones</h2>
        <p>Gestión de Revocaciones: Anule la validez de un certificado emitido indicando el motivo oficial.</p>
      </section>
      <RevokeAccessGate />
    </PageContainer>
  );
}