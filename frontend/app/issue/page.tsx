// Page reserved for issuer-side certificate creation tasks.
"use client";

import { useWallet } from "@/hooks/useWallet";
import { CertificateForm } from "@/components/certificates/CertificateForm";
import { PageContainer } from "@/components/layout/PageContainer";

export default function IssuePage() {
  const { isConnected } = useWallet();

  if (!isConnected) {
    return (
      <PageContainer>
        <section className="card">
          <p className="eyebrow">Emision</p>
          <h2>Emision individual</h2>
          <p>Conecte su billetera para habilitar esta función.</p>
        </section>
        <div className="wallet-banner">
            La emisión de certificados requiere una billetera conectada.
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <section className="card">
        <p className="eyebrow">Emision</p>
        <h2>Emitir título académico</h2>
        <p>Ingrese la información del estudiante y el programa académico para formalizar la emisión del título.</p>
      </section>
      <CertificateForm />
    </PageContainer>
  );
}
