"use client";

import { PageContainer } from "@/components/layout/PageContainer";
import { BatchCertificateForm } from "@/components/certificates/BatchCertificateForm";
import { useWallet } from "@/hooks/useWallet";

export default function BatchIssuancePage() {
  const { isConnected } = useWallet();

  if (!isConnected) {
    return (
      <PageContainer>
        <section className="card">
          <p className="eyebrow">Lotes</p>
          <h2>Emisión por lote</h2>
          <p>Conecte su billetera para habilitar esta función.</p>
        </section>
        <div className="wallet-banner">
          La emisión por lote requiere una billetera conectada.
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <BatchCertificateForm />
    </PageContainer>
  );
}
