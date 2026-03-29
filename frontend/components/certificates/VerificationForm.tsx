// Certificate verification form connected to backend API.
"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/common/Button";
import { CertificateQRCodeCard } from "@/components/certificates/CertificateQRCodeCard";
import {
  DocumentVerificationData,
  HashVerificationData,
  verifyCertificateDocumentClientSide,
  verifyCertificateHashClientSide
} from "@/services/universalVerification";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function VerificationForm() {
  const searchParams = useSearchParams();
  const [certificateHash, setCertificateHash] = useState("");
  const [recipientEmailForCheck, setRecipientEmailForCheck] = useState("");
  const [jsonFileName, setJsonFileName] = useState<string>("");
  const [uploadedDocument, setUploadedDocument] = useState<unknown | null>(null);
  const [isVerifyingHash, setIsVerifyingHash] = useState(false);
  const [isVerifyingDocument, setIsVerifyingDocument] = useState(false);
  const [hashErrorMessage, setHashErrorMessage] = useState<string | null>(null);
  const [documentErrorMessage, setDocumentErrorMessage] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [hashResult, setHashResult] = useState<HashVerificationData | null>(null);
  const [documentResult, setDocumentResult] = useState<DocumentVerificationData | null>(null);
  const autoValidatedHashRef = useRef<string | null>(null);

  const getStatusVisual = (status: string): { label: string; cssClass: string } => {
    const normalized = status.toLowerCase();

    if (normalized === "valid") {
      return { label: "Valido", cssClass: "status-badge status-valid" };
    }

    if (normalized === "revoked") {
      return { label: "Revocado", cssClass: "status-badge status-revoked" };
    }

    if (normalized === "expired") {
      return { label: "Expirado", cssClass: "status-badge status-expired" };
    }

    return { label: status || "Desconocido", cssClass: "status-badge status-unknown" };
  };

  const getVerificationUrl = (hashValue: string | null | undefined): string | null => {
    if (!hashValue) {
      return null;
    }

    if (typeof window === "undefined") {
      return null;
    }

    return `${window.location.origin}/verify?hash=${encodeURIComponent(hashValue)}`;
  };

  const verificationUrlFromDocument = getVerificationUrl(documentResult?.certificateHash);
  const verificationUrlFromHashCheck = getVerificationUrl(hashResult?.exists ? certificateHash : null);

  const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setCertificateHash(event.target.value);
  };

  const verifyByHash = async (hashInput: string) => {
    const normalizedHash = hashInput.trim();

    setIsVerifyingHash(true);
    setHashErrorMessage(null);
    setHashResult(null);

    try {
      const result = await verifyCertificateHashClientSide(normalizedHash);
      setHashResult(result);
    } catch (error) {
      if (error instanceof Error) {
        setHashErrorMessage(error.message);
      } else {
        setHashErrorMessage("No se pudo verificar el certificado.");
      }
    } finally {
      setIsVerifyingHash(false);
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    setDocumentErrorMessage(null);
    setDocumentResult(null);

    const file = event.target.files?.[0];
    if (!file) {
      setUploadedDocument(null);
      setJsonFileName("");
      return;
    }

    setJsonFileName(file.name);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      setUploadedDocument(parsed);
    } catch {
      setUploadedDocument(null);
      setDocumentErrorMessage("El archivo no contiene un JSON valido.");
    }
  };

  const handleHashSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    await verifyByHash(certificateHash);
  };

  useEffect(() => {
    const hashFromQuery =
      searchParams.get("hash")?.trim() ||
      searchParams.get("certificateHash")?.trim() ||
      "";

    if (!hashFromQuery || hashFromQuery === autoValidatedHashRef.current) {
      return;
    }

    autoValidatedHashRef.current = hashFromQuery;
    setCertificateHash(hashFromQuery);
    void verifyByHash(hashFromQuery);
  }, [searchParams]);

  const handleDocumentSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!uploadedDocument) {
      setDocumentErrorMessage("Debes seleccionar un archivo JSON de certificado.");
      return;
    }

    if (recipientEmailForCheck.trim() && !EMAIL_PATTERN.test(recipientEmailForCheck.trim())) {
      setDocumentErrorMessage("El email de verificacion debe tener un formato valido.");
      return;
    }

    setIsVerifyingDocument(true);
    setDocumentErrorMessage(null);
    setDocumentResult(null);

    try {
      const result = await verifyCertificateDocumentClientSide(uploadedDocument, recipientEmailForCheck.trim() || undefined);
      setDocumentResult(result);
    } catch (error) {
      if (error instanceof Error) {
        setDocumentErrorMessage(error.message);
      } else {
        setDocumentErrorMessage("No se pudo verificar el documento del certificado.");
      }
    } finally {
      setIsVerifyingDocument(false);
    }
  };

  const handleExportVerificationPdf = async () => {
    if (!documentResult || !verificationUrlFromDocument || !documentResult.overallValid) {
      return;
    }

    setIsExportingPdf(true);
    setDocumentErrorMessage(null);

    try {
      const { exportVerificationCertificatePdf } = await import("@/services/verificationPdf");

      await exportVerificationCertificatePdf({
        programName: documentResult.programName,
        institutionName: documentResult.institutionName,
        issuedAt: documentResult.onChainIssuedAt || documentResult.issuedAt,
        certificateHash: documentResult.certificateHash,
        verificationUrl: verificationUrlFromDocument
      });
    } catch (error) {
      setDocumentErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo generar el Certificado de Verificacion en PDF."
      );
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <>
      <form className="card form-grid" onSubmit={handleHashSubmit}>
        <h2>Consultar estado del certificado</h2>
        <p className="form-helper">Ingrese el código de verificación para consultar la vigencia del título.</p>
        <label>
          Código de verificación
          <input
            name="certificateHash"
            placeholder="Ej. 0xabc123..."
            value={certificateHash}
            onChange={handleChange}
            required
          />
        </label>

        <Button type="submit" disabled={isVerifyingHash}>
          {isVerifyingHash ? "Consultando..." : "Consultar estado"}
        </Button>

        {isVerifyingHash && <p>Consultando estado del título...</p>}

        {hashErrorMessage && (
          <p role="alert" aria-live="polite">
            Error: {hashErrorMessage}
          </p>
        )}

        {hashResult && (
          <div aria-live="polite">
            <p>Resultado de la consulta:</p>
            <p>Código de verificación: {hashResult.certificateHash || certificateHash || "N/A"}</p>
            <p>Registro encontrado: {String(hashResult.exists)}</p>
            <p>Vigencia: {String(hashResult.isValid)}</p>
            <p>Emisor: {hashResult.issuerName || "N/A"}</p>
            <p>Dirección del emisor: {hashResult.issuer || "N/A"}</p>
            <p>Fecha de emisión registrada: {hashResult.issuedAt || "N/A"}</p>
            <p>ID de estudiante: {hashResult.studentId || "No disponible en esta consulta"}</p>
            <p>Destinatario: {hashResult.recipient || "N/A"}</p>
            <p>
              Estado: <span className={getStatusVisual(hashResult.status).cssClass}>{getStatusVisual(hashResult.status).label}</span>
            </p>

            {!hashResult.exists && (
              <p className="validation-error" role="alert">
                Código de verificación no encontrado.
              </p>
            )}

            {hashResult.exists && !hashResult.isValid && hashResult.status.toLowerCase() === "revoked" && (
              <p className="validation-error" role="alert">
                Certificado revocado por el emisor.
              </p>
            )}

            {hashResult.exists && !hashResult.isValid && hashResult.status.toLowerCase() === "expired" && (
              <p className="validation-error" role="alert">
                Certificado expirado en blockchain.
              </p>
            )}

            {hashResult.isValid && verificationUrlFromHashCheck && (
              <CertificateQRCodeCard
                verificationUrl={verificationUrlFromHashCheck}
                title="QR del estado validado"
              />
            )}
          </div>
        )}
      </form>

      <form className="card form-grid" onSubmit={handleDocumentSubmit}>
        <h2>Validar certificado por archivo</h2>
        <p className="form-helper">Cargue el archivo del certificado o ingrese el código de verificación para validar la autenticidad y el estado del título.</p>
        <label className="upload-dropzone">
          <span className="upload-dropzone-title">Cargar archivo del certificado</span>
          <span className="upload-dropzone-subtitle">Seleccione un archivo de certificado para validar autenticidad, emisor y estado.</span>
          <input type="file" accept="application/json,.json" onChange={handleFileChange} required />
        </label>

        {jsonFileName && <p>Archivo seleccionado: {jsonFileName}</p>}

        <label>
          Email del Graduado (opcional)
          <input
            type="email"
            inputMode="email"
            title="Introduce un email valido, por ejemplo graduado@universidad.edu"
            placeholder="Ej. graduado@universidad.edu"
            value={recipientEmailForCheck}
            onChange={(event) => setRecipientEmailForCheck(event.target.value)}
          />
        </label>

        <Button type="submit" disabled={isVerifyingDocument}>
          {isVerifyingDocument ? "Validando..." : "Validar certificado"}
        </Button>

        {isVerifyingDocument && <p>Validando autenticidad y estado del título...</p>}

        {documentErrorMessage && (
          <p role="alert" aria-live="polite">
            Error: {documentErrorMessage}
          </p>
        )}

        {documentResult && (
          <div aria-live="polite" className="verification-result-grid">
            <p className="verification-result-title">Resultado de validación:</p>
            <p>
              Emisor (on-chain): {documentResult.issuerName || "N/A"} ({documentResult.issuer || "N/A"})
            </p>
            <p>Curso: {documentResult.programName || "N/A"}</p>
            <p>Institucion: {documentResult.institutionName || "N/A"}</p>
            <p>Fecha de emision (on-chain): {documentResult.onChainIssuedAt || "N/A"}</p>
            <p>Fecha de emision (JSON): {documentResult.issuedAt || "N/A"}</p>
            <p>ID del estudiante / identidad privada: {documentResult.recipientIdentity || documentResult.studentId || "N/A"}</p>

            {documentResult.recipientIdentityMatchesProvidedEmail === true && (
              <p className="identity-confirmed" role="status">
                <CheckCircle2 size={16} aria-hidden="true" /> Identidad del Titular Confirmada
              </p>
            )}
            {documentResult.recipientIdentityMatchesProvidedEmail === false && (
              <p className="identity-mismatch" role="alert">
                <AlertTriangle size={16} aria-hidden="true" /> Código válido, pero la identidad no coincide
              </p>
            )}
            <p>Código en la red: {documentResult.certificateHash || "N/A"}</p>
            <p>
              Estado actual: <span className={getStatusVisual(documentResult.status).cssClass}>{getStatusVisual(documentResult.status).label}</span>
            </p>

            {documentResult.validationErrorMessage && (
              <p className="validation-error" role="alert">
                Error de validacion: {documentResult.validationErrorMessage}
              </p>
            )}

            {documentResult.replacesCertificateHash && (
              <p className="wallet-banner wallet-banner-success" role="status">
                <RefreshCw size={16} aria-hidden="true" /> Este certificado corresponde a una versión actualizada del registro{" "}
                <code>{documentResult.replacesCertificateHash}</code>. El certificado original ha sido marcado como reemplazado.
              </p>
            )}
            {documentResult.replacedByHash && (
              <p className="wallet-banner wallet-banner-warning" role="alert">
                <AlertTriangle size={16} aria-hidden="true" /> Este certificado fue reemplazado. Version actualizada:{" "}
                <code>{documentResult.replacedByHash}</code>.
              </p>
            )}

            {!documentResult.replacedByHash && (
              <p className="wallet-banner wallet-banner-warning" role="note">
                Nota: no se registró un reemplazo posterior para este certificado.
              </p>
            )}

            <p>Integridad del documento: {documentResult.hashMatches ? "Correcta" : "Fallida"}</p>
            <p>Firma técnica: {documentResult.signatureValid ? "Válida" : "Inválida"}</p>
            <p>Firmante coincide con emisor registrado: {documentResult.issuerMatchesOnChain ? "Sí" : "No"}</p>
            <p>Emisor habilitado por administración: {documentResult.issuerAuthorized ? "Sí" : "No"}</p>
            <p>Estado emisor: {documentResult.issuerStatus || "N/A"}</p>
            <p>Emisor verificado: {documentResult.issuerVerified === null ? "N/A" : String(documentResult.issuerVerified)}</p>
            <p>Fecha consistente: {documentResult.issuedAtConsistent ? "Sí" : "No"}</p>
            <p>Diferencia de timestamp (segundos): {documentResult.issuedAtSkewSeconds ?? "N/A"}</p>
            <p>Motivo de revocación: {documentResult.revocationReason || "N/A"}</p>
            <p>Fecha de revocación: {documentResult.revokedAt || "N/A"}</p>
            <p>Revocado por: {documentResult.revokedBy || "N/A"}</p>
            <p>Resultado global: {String(documentResult.overallValid)}</p>

            {documentResult.overallValid && verificationUrlFromDocument && (
              <>
                <CertificateQRCodeCard
                  verificationUrl={verificationUrlFromDocument}
                  title="QR de verificacion para documento valido"
                />
                <Button type="button" onClick={() => void handleExportVerificationPdf()} disabled={isExportingPdf}>
                  {isExportingPdf ? "Generando PDF..." : "Descargar Certificado de Verificacion (PDF)"}
                </Button>
              </>
            )}
          </div>
        )}
      </form>
    </>
  );
}
