// Page reserved for certificate verification tasks.
import { Suspense } from "react";

import { VerificationForm } from "@/components/certificates/VerificationForm";
import { PageContainer } from "@/components/layout/PageContainer";

export default function VerifyPage() {
  return (
    <PageContainer>
      <section className="card">
        <p className="eyebrow">Verificacion</p>
        <h2>Verificar certificado académico</h2>
        <p>Cargue el archivo del certificado o ingrese el código de verificación para validar la autenticidad y el estado del título.</p>
      </section>
      <Suspense fallback={<section className="card"><p>Cargando verificador...</p></section>}>
        <VerificationForm />
      </Suspense>
    </PageContainer>
  );
}
