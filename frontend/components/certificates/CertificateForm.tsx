// Certificate issuance form connected to backend API.
"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { BadgeCheck, ExternalLink, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/common/Button";
import { CertificateQRCodeCard } from "@/components/certificates/CertificateQRCodeCard";
import { AcademicBadge } from "@/components/certificates/AcademicBadge";
import { TxStatusBanner, TxPhase } from "@/components/common/TxStatusBanner";
import { useWallet } from "@/hooks/useWallet";
import { api } from "@/services/api";
import { POLYGONSCAN_AMOY_TX_BASE } from "@/lib/constants";

interface IssueFormState {
  studentName: string;
  studentId: string;
  recipientEmail: string;
  programName: string;
  badgeDescription: string;
  issuerUrl: string;
  institutionName: string;
  expiryDate: string;
  replacesCertificateHash: string;
}

interface IssueResponseData {
  certificateHash?: string;
  verificationUrl?: string;
  document?: Record<string, unknown>;
  certificate?: Record<string, unknown>;
  proof?: Record<string, unknown>;
  metadataURI?: string;
  blockchain?: {
    certificateId?: string;
    txHash?: string;
  };
  replacesCertificateHash?: string | null;
  previousCertificateRevoked?: boolean;
}

interface IssueResponse {
  success: boolean;
  message: string;
  data?: IssueResponseData;
}

interface IssuedFormSnapshot {
  studentName: string;
  programName: string;
  institutionName: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const toUnixTimestampFromDate = (dateValue: string): number | undefined => {
  const normalizedDate = dateValue.trim();

  if (!normalizedDate) {
    return undefined;
  }

  const timestampMs = Date.parse(`${normalizedDate}T23:59:59Z`);

  if (Number.isNaN(timestampMs)) {
    throw new Error("expiryDate debe ser una fecha valida.");
  }

  return Math.floor(timestampMs / 1000);
};

const INITIAL_FORM_STATE: IssueFormState = {
  studentName: "",
  studentId: "",
  recipientEmail: "",
  programName: "",
  badgeDescription: "",
  issuerUrl: "",
  institutionName: "",
  expiryDate: "",
  replacesCertificateHash: ""
};

export function CertificateForm() {
  const [form, setForm] = useState<IssueFormState>(INITIAL_FORM_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<IssueResponseData | null>(null);
  const [formSnapshot, setFormSnapshot] = useState<IssuedFormSnapshot | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [jsonLdMessage, setJsonLdMessage] = useState<string | null>(null);
  const [txPhase, setTxPhase] = useState<TxPhase>("idle");
  const [txHashForDisplay, setTxHashForDisplay] = useState<string | null>(null);
  const { isConnected, isIssuerAuthenticated, connectAndLogin } = useWallet();

  useEffect(() => {
    if (!errorMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setErrorMessage(null);
    }, 2600);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [errorMessage]);

  const detailedJson = successResult ? JSON.stringify(successResult, null, 2) : "";
  const jsonLdDocument = successResult?.document ? JSON.stringify(successResult.document, null, 2) : "";

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
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
    setCopyMessage(null);
    setJsonLdMessage(null);
    setTxPhase("idle");
    setTxHashForDisplay(null);

    try {
      if (!isConnected) {
        throw new Error("Conecta MetaMask antes de emitir certificados.");
      }

      if (!isIssuerAuthenticated) {
        throw new Error("Inicia sesion SIWE como emisor autorizado.");
      }

      if (!EMAIL_PATTERN.test(form.recipientEmail.trim())) {
        throw new Error("recipientEmail debe tener un formato de email valido.");
      }

      setTxPhase("requested");
      const toastId = toast.loading("Enviando a Polygon Amoy...");
      const expiryDate = toUnixTimestampFromDate(form.expiryDate);

      const response = await api.issueCertificate<IssueResponse>({
        ...form,
        expiryDate,
        replacesCertificateHash: form.replacesCertificateHash.trim() || undefined
      });
      const txHash = response.data?.blockchain?.txHash || null;

      setTxPhase("confirmed");
      setTxHashForDisplay(txHash);
      toast.success(
        txHash
          ? (
              <span>
                ¡Éxito!{" "}
                <a href={POLYGONSCAN_AMOY_TX_BASE + txHash} target="_blank" rel="noopener noreferrer" className="inline-icon-link">
                  <ExternalLink size={14} aria-hidden="true" />
                  Ver en Polygonscan
                </a>
              </span>
            )
          : "¡Certificado emitido correctamente!",
        { id: toastId, duration: 10000 }
      );

      setSuccessResult(response.data || null);
      setFormSnapshot({
        studentName: form.studentName,
        programName: form.programName,
        institutionName: form.institutionName,
      });
      setForm(INITIAL_FORM_STATE);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "No se pudo emitir el certificado.";
      setTxPhase("failed");
      toast.error(msg);
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyDetails = async () => {
    if (!detailedJson) {
      return;
    }

    try {
      await navigator.clipboard.writeText(detailedJson);
      setCopyMessage("JSON copiado.");
    } catch {
      setCopyMessage("No se pudo copiar el JSON.");
    }
  };

  const handleDownloadJsonLd = () => {
    if (!jsonLdDocument) {
      return;
    }

    try {
      const blob = new Blob([jsonLdDocument], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const certificateId = successResult?.blockchain?.certificateId || "certificate";

      anchor.href = url;
      anchor.download = `certificate-jsonld-${certificateId}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      setJsonLdMessage("JSON-LD descargado.");
    } catch {
      setJsonLdMessage("No se pudo generar el JSON-LD.");
    }
  };

  return (
    <form className="card form-grid" onSubmit={handleSubmit}>
      <h2>Emitir título académico</h2>
      <p className="form-helper">Ingrese la información del estudiante y del programa para formalizar la emisión del título.</p>
      <label>
        Nombre completo del estudiante
        <input
          name="studentName"
          placeholder="Ej. Ana Perez Martinez"
          value={form.studentName}
          onChange={handleInputChange}
          required
        />
      </label>
      <label>
        Identificador academico del estudiante
        <input
          name="studentId"
          placeholder="Ej. STU-2026-001"
          value={form.studentId}
          onChange={handleInputChange}
          required
        />
      </label>
      <label>
        Correo electronico del estudiante
        <input
          name="recipientEmail"
          type="email"
          inputMode="email"
          title="Introduce un correo valido, por ejemplo estudiante@universidad.edu"
          placeholder="Ej. estudiante@universidad.edu"
          value={form.recipientEmail}
          onChange={handleInputChange}
          required
        />
      </label>
      <label>
        Programa academico o curso
        <input
          name="programName"
          placeholder="Ej. Master en Blockchain"
          value={form.programName}
          onChange={handleInputChange}
          required
        />
      </label>
      <label>
        Institucion emisora
        <input
          name="institutionName"
          placeholder="Ej. Universidad X"
          value={form.institutionName}
          onChange={handleInputChange}
          required
        />
      </label>

      <details className="json-details">
        <summary>Metadatos descriptivos (opcional)</summary>
        <div className="form-grid issue-optional-content">
          <label>
            Descripcion publica del certificado (opcional)
            <input
              name="badgeDescription"
              placeholder="Ej. Certificado academico de finalizacion"
              value={form.badgeDescription}
              onChange={handleInputChange}
            />
          </label>
          <label>
            Sitio web oficial de la institucion (opcional)
            <input
              name="issuerUrl"
              type="url"
              placeholder="Ej. https://www.universidad.edu"
              value={form.issuerUrl}
              onChange={handleInputChange}
            />
          </label>
        </div>
      </details>

      <details className="json-details">
        <summary>Vigencia del certificado (opcional)</summary>
        <div className="form-grid issue-optional-content">
          <label>
            Fecha de expiracion
            <input
              name="expiryDate"
              type="date"
              value={form.expiryDate}
              onChange={handleInputChange}
            />
          </label>
        </div>
      </details>

      <details className="json-details">
        <summary>Reemision y sustitucion (opcional)</summary>
        <div className="form-grid issue-optional-content">
          <p className="form-helper">
            Utiliza esta seccion solo cuando el nuevo certificado deba sustituir a uno previamente emitido.
          </p>
          <label>
            Código del certificado anterior a reemplazar
            <input
              name="replacesCertificateHash"
              placeholder="Ej. 0xabcdef..."
              value={form.replacesCertificateHash}
              onChange={handleInputChange}
            />
          </label>
        </div>
      </details>

      {!isConnected && (
        <div className="wallet-connect-block">
          <p className="wallet-banner wallet-banner-warning">Conecte su billetera y valide su sesión para continuar.</p>
          <Button type="button" onClick={() => void connectAndLogin()}>
            Conectar billetera
          </Button>
        </div>
      )}

      {isConnected && !isIssuerAuthenticated && (
        <div className="wallet-connect-block">
          <p className="wallet-banner wallet-banner-warning">Sesión no validada. Inicie sesión para emitir títulos.</p>
          <Button type="button" onClick={() => void connectAndLogin()}>
            Validar sesión
          </Button>
        </div>
      )}

      <Button type="submit" disabled={isSubmitting || !isConnected || !isIssuerAuthenticated}>
        {isSubmitting ? "Enviando..." : "Emitir certificado"}
      </Button>

      {isSubmitting && <p>Registrando la emisión del título...</p>}

  <TxStatusBanner phase={txPhase} txHash={txHashForDisplay} />

      {errorMessage && (
        <p className="form-error-toast" role="alert" aria-live="assertive">
          Error: {errorMessage}
        </p>
      )}

      {successResult && (
        <div aria-live="polite">
          {successResult.replacesCertificateHash && (
            <p className="wallet-banner wallet-banner-warning" role="status">
              <RefreshCw size={16} aria-hidden="true" /> Reemisión: este título reemplaza el registro{" "}
              <code>{successResult.replacesCertificateHash}</code>.
              {successResult.previousCertificateRevoked
                ? " El certificado anterior fue invalidado automáticamente."
                : " Aviso: la invalidación automática no se completó. Puede finalizarla desde la vista de revocaciones."}
            </p>
          )}

          {/* ── Diploma visual ──────────────────────────── */}
          {formSnapshot && (
            <div className="badge-congratulation">
              <h3>
                <BadgeCheck size={18} aria-hidden="true" /> ¡Certificado emitido correctamente!
              </h3>
              <p style={{ margin: "0 0 1.25rem", color: "#374151", fontSize: "0.9rem" }}>
                Código de transacción:{" "}
                <code style={{ fontSize: "0.78rem" }}>
                  {successResult.blockchain?.txHash || "N/A"}
                </code>
              </p>
              <AcademicBadge
                studentName={formSnapshot.studentName}
                programName={formSnapshot.programName}
                institutionName={formSnapshot.institutionName}
                verificationUrl={successResult.verificationUrl}
                certificateId={successResult.blockchain?.certificateId}
                polygonscanUrl={
                  successResult.blockchain?.txHash
                    ? POLYGONSCAN_AMOY_TX_BASE + successResult.blockchain.txHash
                    : undefined
                }
              />
            </div>
          )}

          <details className="json-details">
            <summary>Detalle tecnico de la emision</summary>
            <div className="json-details-actions">
              <button className="button button-mint" type="button" onClick={handleDownloadJsonLd}>
                Descargar JSON-LD
              </button>
              <button className="button button-secondary" type="button" onClick={handleCopyDetails}>
                Copiar JSON
              </button>
              {jsonLdMessage && <p>{jsonLdMessage}</p>}
              {copyMessage && <p>{copyMessage}</p>}
            </div>
            <pre className="json-preview">{detailedJson}</pre>
          </details>
        </div>
      )}
    </form>
  );
}
