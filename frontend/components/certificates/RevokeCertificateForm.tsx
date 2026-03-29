"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/common/Button";
import { TxStatusBanner, TxPhase } from "@/components/common/TxStatusBanner";
import { useWallet } from "@/hooks/useWallet";
import { revokeCertificateWithMetaMask } from "@/services/blockchain";
import {
  POLYGON_AMOY_CHAIN_ID,
  POLYGONSCAN_AMOY_TX_BASE,
  PUBLIC_CONTRACT_ADDRESS
} from "@/lib/constants";

interface RevokeFormState {
  certificateId: string;
  reason: string;
}

interface RevokeResponseData {
  certificateId: string;
  reason: string;
  txHash: string;
  revokedBy: string;
}

const INITIAL_FORM_STATE: RevokeFormState = {
  certificateId: "",
  reason: ""
};

export function RevokeCertificateForm() {
  const [form, setForm] = useState<RevokeFormState>(INITIAL_FORM_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<RevokeResponseData | null>(null);
  const [txPhase, setTxPhase] = useState<TxPhase>("idle");
  const [txHashForDisplay, setTxHashForDisplay] = useState<string | null>(null);
  const {
    address,
    chainId,
    isConnected,
    isMetaMaskAvailable,
    isIssuerAuthenticated,
    errorMessage: walletErrorMessage,
    connectAndLogin
  } = useWallet();

  const walletChainId = useMemo(() => {
    if (!chainId) {
      return null;
    }

    return parseInt(chainId, 16);
  }, [chainId]);

  const isCorrectNetwork = useMemo(() => {
    if (!walletChainId) {
      return null;
    }

    return walletChainId === POLYGON_AMOY_CHAIN_ID;
  }, [walletChainId]);

  const contractAddress = PUBLIC_CONTRACT_ADDRESS.trim();

  const handleInputChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    setForm((previous) => ({
      ...previous,
      [name]: value
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessResult(null);
    setTxPhase("idle");
    setTxHashForDisplay(null);

    try {
      if (!address) {
        throw new Error("Conecta MetaMask antes de revocar un certificado.");
      }

      if (!isIssuerAuthenticated) {
        throw new Error("Inicia sesion SIWE como emisor autorizado.");
      }

      if (!contractAddress) {
        throw new Error("Falta NEXT_PUBLIC_CONTRACT_ADDRESS para ejecutar la revocacion.");
      }

      if (isCorrectNetwork !== true) {
        throw new Error("Cambia MetaMask a Polygon Amoy (chainId 80002) antes de revocar.");
      }

      const certificateId = form.certificateId.trim();
      const reason = form.reason.trim();

      if (!certificateId) {
        throw new Error("certificateId es obligatorio.");
      }

      if (!reason) {
        throw new Error("reason es obligatorio.");
      }

      // Issuer signs directly with MetaMask, no backend intermediary
      setTxPhase("requested");
      const toastId = toast.loading("Pedida: Esperando firma en MetaMask...");

      const result = await revokeCertificateWithMetaMask({
        certificateId,
        reason,
        contractAddress,
        onTxSent: (txHash) => {
          setTxPhase("pending");
          setTxHashForDisplay(txHash);
          toast.loading(
            <span>
              Pendiente: Enviando a Polygon Amoy…{" "}
              <a href={POLYGONSCAN_AMOY_TX_BASE + txHash} target="_blank" rel="noopener noreferrer" className="inline-icon-link">
                <ExternalLink size={14} aria-hidden="true" />
                Ver tx
              </a>
            </span>,
            { id: toastId }
          );
        }
      });

      setTxPhase("confirmed");
      setTxHashForDisplay(result.txHash);
      toast.success(
        <span>
          ¡Confirmado!{" "}
          <a href={POLYGONSCAN_AMOY_TX_BASE + result.txHash} target="_blank" rel="noopener noreferrer" className="inline-icon-link">
            <ExternalLink size={14} aria-hidden="true" />
            Ver en Polygonscan
          </a>
        </span>,
        { id: toastId, duration: 10000 }
      );

      setSuccessResult({
        certificateId,
        reason,
        txHash: result.txHash,
        revokedBy: result.revokedBy
      });

      setForm(INITIAL_FORM_STATE);
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("No se pudo revocar el certificado.");
      }
      const msg = error instanceof Error ? error.message : "No se pudo revocar el certificado.";
      setTxPhase("failed");
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="card form-grid" onSubmit={handleSubmit}>
      <h2>Gestión de Revocaciones</h2>
      <p className="form-helper">Gestión de Revocaciones: Anule la validez de un certificado emitido indicando el motivo oficial.</p>

      {!isMetaMaskAvailable && (
        <p className="wallet-banner wallet-banner-warning">
          MetaMask no está disponible. Instale la extensión para usar esta vista.
        </p>
      )}

      {isMetaMaskAvailable && !isConnected && (
        <div className="wallet-connect-block">
          <p className="wallet-banner wallet-banner-warning">No hay ninguna wallet conectada.</p>
          <Button type="button" onClick={() => void connectAndLogin()}>
            Conectar wallet + SIWE
          </Button>
        </div>
      )}

      {isConnected && !isIssuerAuthenticated && (
        <div className="wallet-connect-block">
          <p className="wallet-banner wallet-banner-warning">Sesión no validada. Inicie sesión para continuar.</p>
          <Button type="button" onClick={() => void connectAndLogin()}>
            Conectar wallet + SIWE
          </Button>
        </div>
      )}

      {walletErrorMessage && <p className="wallet-banner wallet-banner-warning">{walletErrorMessage}</p>}

      {isCorrectNetwork === false && (
        <p className="wallet-banner wallet-banner-warning">
          Red incorrecta en MetaMask. Debes usar Polygon Amoy (chainId 80002).
        </p>
      )}

      {!contractAddress && (
        <p className="wallet-banner wallet-banner-warning">
          Falta configuración de red para completar la revocación.
        </p>
      )}

      {isCorrectNetwork === true && contractAddress && (
        <p className="wallet-banner wallet-banner-success">
          Red validada y sesión activa. Puede revocar certificados.
        </p>
      )}

      <label>
        ID del certificado
        <input
          name="certificateId"
          inputMode="numeric"
          pattern="[0-9]+"
          placeholder="Ej. 1"
          value={form.certificateId}
          onChange={handleInputChange}
          required
        />
      </label>

      <label>
        Motivo oficial de revocación
        <textarea
          name="reason"
          placeholder="Ej. Error administrativo en los datos"
          value={form.reason}
          onChange={handleInputChange}
          rows={4}
          required
        />
      </label>

      <Button
        type="submit"
        disabled={
          isSubmitting ||
          !isMetaMaskAvailable ||
          !isConnected ||
          !isIssuerAuthenticated ||
          !contractAddress ||
          isCorrectNetwork !== true
        }
      >
        {isSubmitting ? "Invalidando..." : "Invalidar Certificado"}
      </Button>

      {isSubmitting && <p>Registrando revocacion en blockchain...</p>}

      <TxStatusBanner phase={txPhase} txHash={txHashForDisplay} />

      {errorMessage && (
        <p className="validation-error" role="alert" aria-live="polite">
          Error: {errorMessage}
        </p>
      )}

      {successResult && (
        <div aria-live="polite" className="result-stack">
          <p>Certificado invalidado correctamente.</p>
          <p>ID del certificado: {successResult.certificateId}</p>
          <p>Motivo: {successResult.reason}</p>
          <p>Código de transacción: {successResult.txHash}</p>
          <p>Ejecutado por: {successResult.revokedBy}</p>
        </div>
      )}
    </form>
  );
}
