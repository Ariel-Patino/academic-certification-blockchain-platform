// Batch certificate issuance from CSV with progress tracking.
"use client";

import { ChangeEvent, FormEvent, useEffect, useState, useRef } from "react";
import { CheckCircle2, ExternalLink, Eye, X, XCircle } from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/common/Button";
import { TxStatusBanner, TxPhase } from "@/components/common/TxStatusBanner";
import { CertificateQRCodeCard } from "@/components/certificates/CertificateQRCodeCard";
import { AcademicBadge } from "@/components/certificates/AcademicBadge";
import { useWallet } from "@/hooks/useWallet";
import { api, BatchIssuancResponse, BatchCertificateResult } from "@/services/api";
import { POLYGONSCAN_AMOY_TX_BASE } from "@/lib/constants";

interface BatchFormState {
  csvFile: File | null;
  parsedRecords: ParsedCSVRecord[];
  sharedProgramName: string;
  sharedInstitutionName: string;
}

interface ParsedCSVRecord {
  rowNumber: number;
  email: string;
  studentName: string;
  studentId: string;
  grade?: string;
  expiryDate?: number;
}

interface BatchProgress {
  totalCertificates: number;
  ipfsUploaded: number;
  blockchainAnchored: number;
}

interface BatchResult extends BatchCertificateResult {
  rowNumber?: number;
}

interface BadgeModalData {
  studentName: string;
  studentEmail: string;
  programName: string;
  institutionName: string;
  verificationUrl: string;
  certificateHash: string;
}
// Convierte dd/mm/yyyy → Unix seconds (UTC). Devuelve undefined si el formato es inválido.
const parseDdMmYyyyToUnix = (value: string): number | undefined => {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return undefined;
  const [, day, month, year] = match;
  const ts = Date.UTC(Number(year), Number(month) - 1, Number(day), 23, 59, 59);
  return Number.isNaN(ts) ? undefined : Math.floor(ts / 1000);
};

const CSV_HEADERS = ["email", "studentName", "grade", "expiryDate"];

const parseCSV = (content: string): ParsedCSVRecord[] => {
  const lines = content.trim().split("\n").filter((line) => line.trim());
  
  if (lines.length < 2) {
    throw new Error("El archivo CSV debe incluir encabezado y al menos una fila.");
  }

  const headerLine = lines[0];
  const headers = headerLine.split(",").map((h) => h.trim().toLowerCase());

  // Validate required columns
  const requiredCols = ["email", "studentname"];
  const missingCols = requiredCols.filter((col) => !headers.includes(col));

  if (missingCols.length > 0) {
    throw new Error(
      `Faltan columnas obligatorias: ${missingCols.join(", ")}. ` +
      `Esperadas: ${CSV_HEADERS.join(", ")}`
    );
  }

  const records: ParsedCSVRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    
    if (values.length < headers.length) {
      console.warn(`Row ${i + 1}: skipped (incomplete row)`);
      continue;
    }

    const rowData: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      rowData[headers[j]] = values[j];
    }

    const email = rowData["email"] || "";
    const studentName = rowData["studentname"] || "";
    const studentId = rowData["studentid"] || `BATCH-${i}`;
    const grade = rowData["grade"] || undefined;
    const expiryDateStr = rowData["expirydate"];
    const expiryDate = expiryDateStr ? parseDdMmYyyyToUnix(expiryDateStr.trim()) : undefined;

    if (!email || !studentName) {
      console.warn(`Row ${i + 1}: skipped (missing required fields)`);
      continue;
    }

    records.push({
      rowNumber: i + 1,
      email,
      studentName,
      studentId,
      grade,
      expiryDate: Number.isFinite(expiryDate) ? expiryDate : undefined
    });
  }

  if (records.length === 0) {
    throw new Error("No se encontraron registros válidos en el archivo CSV.");
  }

  return records;
};

export function BatchCertificateForm() {
  const [form, setForm] = useState<BatchFormState>({
    csvFile: null,
    parsedRecords: [],
    sharedProgramName: "",
    sharedInstitutionName: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [csvParseError, setCsvParseError] = useState<string | null>(null);
  const [progress, setProgress] = useState<BatchProgress>({
    totalCertificates: 0,
    ipfsUploaded: 0,
    blockchainAnchored: 0
  });
  const [batchResults, setBatchResults] = useState<BatchResult[] | null>(null);
  const [txPhase, setTxPhase] = useState<TxPhase>("idle");
  const [txHashForDisplay, setTxHashForDisplay] = useState<string | null>(null);
  const [badgeModal, setBadgeModal] = useState<BadgeModalData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    setCsvParseError(null);
    setForm((previous) => ({ ...previous, csvFile: null, parsedRecords: [] }));

    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const content = await file.text();
      const parsedRecords = parseCSV(content);

      setForm({
        csvFile: file,
        parsedRecords,
        sharedProgramName: form.sharedProgramName,
        sharedInstitutionName: form.sharedInstitutionName
      });

      toast.success(`CSV loaded: ${parsedRecords.length} certificates ready.`);
      toast.success(`Archivo cargado: ${parsedRecords.length} certificados listos.`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "No se pudo procesar el archivo CSV.";
      setCsvParseError(msg);
      toast.error(msg);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (form.parsedRecords.length === 0) {
      setErrorMessage("Cargue un archivo CSV válido para continuar.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setBatchResults(null);
    setProgress({ totalCertificates: form.parsedRecords.length, ipfsUploaded: 0, blockchainAnchored: 0 });
    setTxPhase("idle");
    setTxHashForDisplay(null);

    try {
      if (!isConnected) {
        throw new Error("Conecta MetaMask antes de emitir certificados.");
      }

      if (!isIssuerAuthenticated) {
        throw new Error("Inicia sesion SIWE como emisor autorizado.");
      }

      setTxPhase("requested");
      const toastId = toast.loading(`Procesando lote de ${form.parsedRecords.length} certificados...`);

      // Convert parsed records to batch API payload
      const batchPayload = {
        certificates: form.parsedRecords.map((record) => ({
          studentName: record.studentName,
          studentId: record.studentId,
          recipientEmail: record.email,
          programName: form.sharedProgramName.trim(),
          institutionName: form.sharedInstitutionName.trim(),
          badgeDescription: record.grade ? `Calificación: ${record.grade}` : undefined,
          expiryDate: record.expiryDate
        }))
      };

      setTxPhase("pending");
      const response = await api.batchIssueCertificates<BatchIssuancResponse>(batchPayload);

      const txHash = response.data?.transactionHash || null;
      setProgress({
        totalCertificates: form.parsedRecords.length,
        ipfsUploaded: response.data?.ipfsUploadProgress.completed || 0,
        blockchainAnchored: response.data?.blockchainAnchorProgress.completed || 0
      });
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
          : "¡Lote de certificados emitido correctamente!",
        { id: toastId, duration: 10000 }
      );

      // Extract results from response
      const results =
        response.data?.results.map((result, idx) => ({
          ...result,
          rowNumber: form.parsedRecords[idx]?.rowNumber
        })) || [];

      setBatchResults(results);

      // Reset form
      setForm((previous) => ({
        ...previous,
        csvFile: null,
        parsedRecords: []
      }));
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "No se pudo emitir el lote de certificados.";
      setTxPhase("failed");
      toast.error(msg);
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalCertificates = form.parsedRecords.length;
  const successCount = batchResults?.filter((r) => r.success).length || 0;
  const failureCount = batchResults ? batchResults.length - successCount : 0;

  const progressPercentageIpfs = totalCertificates > 0 ? Math.round((progress.ipfsUploaded / totalCertificates) * 100) : 0;
  const progressPercentageBlockchain =
    totalCertificates > 0 ? Math.round((progress.blockchainAnchored / totalCertificates) * 100) : 0;

  return (
    <>
      <form className="card form-grid" onSubmit={handleSubmit}>
        <h2>Emisión por lote</h2>

        <p className="form-help-text">
          Cargue un archivo CSV con los estudiantes del lote y complete los datos del programa e institución.
        </p>

        <label>
          Programa para todo el lote
          <input
            name="sharedProgramName"
            value={form.sharedProgramName}
            placeholder="Ej. Certificacion Academica"
            onChange={(event) => setForm((previous) => ({ ...previous, sharedProgramName: event.target.value }))}
            required
          />
        </label>

        <label>
          Institución para todo el lote
          <input
            name="sharedInstitutionName"
            value={form.sharedInstitutionName}
            placeholder="Ej. Institucion Educativa"
            onChange={(event) => setForm((previous) => ({ ...previous, sharedInstitutionName: event.target.value }))}
            required
          />
        </label>

        <label>
          Archivo CSV
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            disabled={isSubmitting}
            required
          />
        </label>

        {csvParseError && (
          <p className="form-error-toast" role="alert" aria-live="assertive">
            Error de CSV: {csvParseError}
          </p>
        )}

        {form.parsedRecords.length > 0 && (
          <div className="batch-info">
            <p className="batch-info-title">
              Títulos a emitir: <strong>{form.parsedRecords.length}</strong>
            </p>
            <details className="batch-preview">
              <summary>Vista previa (primeros 5)</summary>
              <table className="batch-preview-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Nombre</th>
                    <th>ID Estudiante</th>
                    <th>Calificación</th>
                  </tr>
                </thead>
                <tbody>
                  {form.parsedRecords.slice(0, 5).map((record) => (
                    <tr key={record.rowNumber}>
                      <td>{record.email}</td>
                      <td>{record.studentName}</td>
                      <td>{record.studentId}</td>
                      <td>{record.grade || "N/A"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {form.parsedRecords.length > 5 && <p>... y {form.parsedRecords.length - 5} adicionales</p>}
            </details>
          </div>
        )}

        {!isConnected && (
          <div className="wallet-connect-block">
            <p className="wallet-banner wallet-banner-warning">Conecte su billetera y valide su sesión para emitir títulos.</p>
            <Button type="button" onClick={() => void connectAndLogin()}>
              Conectar billetera
            </Button>
          </div>
        )}

        {isConnected && !isIssuerAuthenticated && (
          <div className="wallet-connect-block">
            <p className="wallet-banner wallet-banner-warning">Sesión no validada. Inicie sesión para continuar.</p>
            <Button type="button" onClick={() => void connectAndLogin()}>
              Validar sesión
            </Button>
          </div>
        )}

        <Button
          type="submit"
          disabled={isSubmitting || !isConnected || !isIssuerAuthenticated || form.parsedRecords.length === 0}
        >
          {isSubmitting ? "Procesando..." : `Emitir ${totalCertificates} Certificados`}
        </Button>

        {isSubmitting && (
          <div className="batch-progress">
            <p>Procesando emisión por lote...</p>
            <div className="progress-section">
              <label>
                Carga de documentos: {progress.ipfsUploaded}/{totalCertificates}
              </label>
              <progress value={progress.ipfsUploaded} max={totalCertificates}></progress>
              <span className="progress-percentage">{progressPercentageIpfs}%</span>
            </div>
            <div className="progress-section">
              <label>
                Registro en la red: {progress.blockchainAnchored}/{totalCertificates}
              </label>
              <progress value={progress.blockchainAnchored} max={totalCertificates}></progress>
              <span className="progress-percentage">{progressPercentageBlockchain}%</span>
            </div>
          </div>
        )}

        <TxStatusBanner phase={txPhase} txHash={txHashForDisplay} />

        {errorMessage && (
          <p className="form-error-toast" role="alert" aria-live="assertive">
            Error: {errorMessage}
          </p>
        )}
      </form>

      {batchResults && (
        <div className="card batch-results-container">
          <h2>Resultados de la emisión</h2>
          <p>
            Total: {batchResults.length} | Exitosos: <strong className="success-count">{successCount}</strong> | Fallidos:{" "}
            <strong className="failure-count">{failureCount}</strong>
          </p>

          <details className="batch-results-details">
            <summary>Detalles de cada certificado</summary>
            <div className="batch-results-table-wrapper">
              <table className="batch-results-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Email</th>
                    <th>Estado</th>
                    <th>Código</th>
                    <th>IPFS</th>
                    <th>QR</th>
                    <th>Error</th>
                      <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {batchResults.map((result, idx) => (
                    <tr key={idx} className={result.success ? "row-success" : "row-failure"}>
                      <td>{result.rowNumber || idx + 1}</td>
                      <td>{result.studentEmail}</td>
                      <td>
                        {result.success ? (
                          <span className="badge badge-success">
                            <CheckCircle2 size={14} aria-hidden="true" /> Exitoso
                          </span>
                        ) : (
                          <span className="badge badge-failure">
                            <XCircle size={14} aria-hidden="true" /> Fallido
                          </span>
                        )}
                      </td>
                      <td>
                        <code>{result.certificateHash.slice(0, 16)}...</code>
                      </td>
                      <td>
                        {result.success && result.ipfsUri ? (
                          <button
                            type="button"
                            className="button button-mint"
                            onClick={() => {
                              const cid = result.ipfsUri.replace(/^ipfs:\/\//, "");
                              const url = `https://gateway.pinata.cloud/ipfs/${cid}`;
                              fetch(url)
                                .then((res) => res.blob())
                                .then((blob) => {
                                  const objectUrl = URL.createObjectURL(blob);
                                  const a = document.createElement("a");
                                  a.href = objectUrl;
                                  a.download = `certificate-${result.certificateHash.slice(0, 10)}.json`;
                                  a.click();
                                  URL.revokeObjectURL(objectUrl);
                                })
                                .catch(() => alert("Error al descargar el JSON-LD"));
                            }}
                          >
                            Descargar JSON-LD
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        {result.success && result.verificationUrl ? (
                          <CertificateQRCodeCard
                            verificationUrl={result.verificationUrl}
                            title={`QR – ${result.studentEmail}`}
                          />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>{result.error || "—"}</td>
                      <td>
                        {result.success ? (
                          <button
                            type="button"
                            className="button button-secondary badge-eye-btn"
                            title="Ver diploma"
                            onClick={() =>
                              setBadgeModal({
                                studentName: result.studentName,
                                studentEmail: result.studentEmail,
                                programName: form.sharedProgramName,
                                institutionName: form.sharedInstitutionName,
                                verificationUrl: result.verificationUrl,
                                certificateHash: result.certificateHash,
                              })
                            }
                          >
                            <Eye size={16} aria-hidden="true" />
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}

        {/* ── Badge Modal ───────────────────────────────── */}
        {badgeModal && (
          <div
            className="badge-modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Diploma del estudiante"
            onClick={(e) => { if (e.target === e.currentTarget) setBadgeModal(null); }}
          >
            <div className="badge-modal">
              <button
                type="button"
                className="badge-modal-close"
                aria-label="Cerrar"
                onClick={() => setBadgeModal(null)}
              >
                <X size={16} aria-hidden="true" />
              </button>
              <h3 style={{ margin: "0 0 1.25rem", textAlign: "center", color: "var(--ink)" }}>
                Diploma de certificación - {badgeModal.studentName}
              </h3>
              <AcademicBadge
                studentName={badgeModal.studentName}
                programName={badgeModal.programName}
                institutionName={badgeModal.institutionName}
                verificationUrl={badgeModal.verificationUrl}
                certificateId={badgeModal.certificateHash.slice(0, 16) + "…"}
              />
            </div>
          </div>
        )}
    </>
  );
}

