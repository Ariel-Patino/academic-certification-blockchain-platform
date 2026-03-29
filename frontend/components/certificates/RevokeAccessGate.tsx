"use client";

import { Button } from "@/components/common/Button";
import { RevokeCertificateForm } from "@/components/certificates/RevokeCertificateForm";
import { useWallet } from "@/hooks/useWallet";

export function RevokeAccessGate() {
  const {
    isMetaMaskAvailable,
    isConnected,
    isIssuerAuthenticated,
    connectAndLogin,
    errorMessage
  } = useWallet();

  if (!isMetaMaskAvailable) {
    return (
      <section className="card form-grid">
        <h2>Acceso a revocaciones</h2>
        <p className="wallet-banner wallet-banner-warning">
          MetaMask no está disponible. Instale la extensión para habilitar esta operación.
        </p>
      </section>
    );
  }

  if (!isConnected || !isIssuerAuthenticated) {
    return (
      <section className="card form-grid">
        <h2>Acceso a revocaciones</h2>
        <p className="wallet-banner wallet-banner-warning">
          Debe conectar su billetera y validar su sesión para continuar.
        </p>
        <Button type="button" onClick={() => void connectAndLogin()}>
          Conectar billetera
        </Button>
        {errorMessage && <p className="wallet-banner wallet-banner-warning">{errorMessage}</p>}
      </section>
    );
  }

  return <RevokeCertificateForm />;
}
