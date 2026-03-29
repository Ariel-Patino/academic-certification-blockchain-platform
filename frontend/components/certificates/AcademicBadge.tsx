// Diploma visual component for issued academic certificates.
"use client";

import { useRef } from "react";
import { Download, ExternalLink, FileBadge, QrCode } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";

export interface AcademicBadgeProps {
  studentName: string;
  programName: string;
  institutionName?: string;
  issuedDate?: string;
  verificationUrl?: string;
  certificateId?: string;
  polygonscanUrl?: string;
}

function AcademicSeal() {
  return (
    <svg
      width="88"
      height="88"
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Sello académico"
    >
      <circle cx="50" cy="50" r="47" fill="none" stroke="#8247e5" strokeWidth="2.5" />
      <circle cx="50" cy="50" r="40" fill="#f5f0ff" />
      <circle cx="50" cy="50" r="38" fill="none" stroke="#8247e5" strokeWidth="0.8" strokeDasharray="4 3" />
      {/* Graduation cap board */}
      <polygon points="50,22 82,38 50,54 18,38" fill="#8247e5" />
      {/* Cap top stem */}
      <rect x="48" y="38" width="4" height="14" fill="#6d35d4" />
      {/* Cap base */}
      <rect x="34" y="54" width="32" height="6" rx="3" fill="#6d35d4" />
      {/* Tassel cord */}
      <line x1="82" y1="38" x2="82" y2="54" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" />
      {/* Tassel end */}
      <circle cx="82" cy="57" r="3.5" fill="#fbbf24" />
      <text x="50" y="78" fontSize="7" textAnchor="middle" fill="#8247e5" fontFamily="serif" letterSpacing="2">
        HONOR
      </text>
    </svg>
  );
}

function formatDate(dateStr?: string): string {
  if (dateStr) return dateStr;
  return new Date().toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function AcademicBadge({
  studentName,
  programName,
  institutionName,
  issuedDate,
  verificationUrl,
  certificateId,
  polygonscanUrl,
}: AcademicBadgeProps) {
  const badgeRef = useRef<HTMLDivElement>(null);
  const QR_SIZE = 220;
  const qrCanvasId = `verification-qr-${String(certificateId || studentName)
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .toLowerCase()}`;


    const getDiplomaNode = () =>
        (document.getElementById("diploma-container") as HTMLDivElement | null) ?? badgeRef.current;

    const waitForRender = async () => {
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
        await new Promise((resolve) => setTimeout(resolve, 80));
    };

    const captureDiploma = async (pixelRatio = 2) => {
    const target = getDiplomaNode();
    if (!target) throw new Error("Diploma container not found");    

    await waitForRender();

    const { toJpeg } = await import("html-to-image");
    const width = Math.round(target.offsetWidth);
    const height = Math.round(target.offsetHeight);

        return await toJpeg(target, {
            quality: 0.95,
            pixelRatio,
            backgroundColor: "#ffffff",
            width,
            height,
            canvasWidth: width * pixelRatio,
            canvasHeight: height * pixelRatio,
            cacheBust: true,
            skipAutoScale: true,
        });
    };

  const handleDownloadPng = async () => {    
    if (!badgeRef.current) return;
    try {
        const target = getDiplomaNode();
        if (!target) return;
        await waitForRender();
        const { toPng } = await import("html-to-image");
        const width = Math.round(target.offsetWidth);
        const height = Math.round(target.offsetHeight);
        const dataUrl = await toPng(target, {
          pixelRatio: 2,
          backgroundColor: "#ffffff",
          width,
          height,
          canvasWidth: width * 2,
          canvasHeight: height * 2,
          cacheBust: true,
          skipAutoScale: true,
        });
        const anchor = document.createElement("a");
        anchor.href = dataUrl;
        anchor.download = `diploma-${studentName.replace(/\s+/g, "-").toLowerCase()}.png`;
        anchor.click();
    } catch {
      alert("No se pudo generar la imagen.");
    }
  };

  const handleDownloadPdf = async () => {
    if (!badgeRef.current) return;
    try {
      
      const { default: jsPDF } = await import("jspdf");
      const target = getDiplomaNode();
      if (!target) return;

      const dataUrl = await captureDiploma(2);
      const sourceWidth = Math.round(target.offsetWidth);
      const sourceHeight = Math.round(target.offsetHeight);  

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 8;
      const maxWidth = pageWidth - margin * 2;
      const maxHeight = pageHeight - margin * 2;
  
      const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
      const pdfWidth = sourceWidth * scale;
      const pdfHeight = sourceHeight * scale;
      const x = (pageWidth - pdfWidth) / 2;
      const y = (pageHeight - pdfHeight) / 2;
  
      doc.addImage(dataUrl, "JPEG", x, y, pdfWidth, pdfHeight, undefined, "MEDIUM");
      doc.save(`diploma-${studentName.replace(/\s+/g, "-").toLowerCase()}.pdf`);
    } catch {
      alert("No se pudo generar el PDF.");
    }
  };

  const downloadRawQR = () => {
    const canvas = document.getElementById(qrCanvasId) as HTMLCanvasElement | null;
    if (!canvas) {
      alert("No se pudo encontrar el QR para descargar.");
      return;
    }

    const anchor = document.createElement("a");
    const idPart = String(certificateId || studentName)
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .slice(0, 64) || "certificado";
    anchor.href = canvas.toDataURL("image/png");
    anchor.download = `Verificacion-Blockchain-${idPart}.png`;
    anchor.click();
  };

  return (
    <div className="academic-badge-wrapper">
      <div id="diploma-container" ref={badgeRef}>
        <div className="diploma-inner">
          <AcademicSeal />
          <p className="diploma-kicker">Certificado academico</p>
          <h2 className="diploma-title">Diploma de Honor</h2>
          <p className="diploma-subtitle">se otorga a</p>

          <p className="diploma-student-name">{studentName}</p>

          <p className="diploma-text">por haber completado satisfactoriamente</p>
          <p className="diploma-program">{programName}</p>

          {institutionName && <p className="diploma-institution">{institutionName}</p>}

          <p className="diploma-date">
            Emitido el <strong>{formatDate(issuedDate)}</strong>
          </p>

          {certificateId && <p className="diploma-cert-id">Certificado N.° {certificateId}</p>}
        </div>

        {verificationUrl && (
          <div className="diploma-qr-slot">
            <QRCodeCanvas
              id={qrCanvasId}
              value={verificationUrl}
              size={QR_SIZE}
              includeMargin
              level="H"
              bgColor="#ffffff"
              fgColor="#004d40"
            />
          </div>
        )}
      </div>

      <div className="badge-export-actions">
        <button
          type="button"
          className="button button-secondary"
          onClick={handleDownloadPng}
        >
          <Download size={18} aria-hidden="true" />
          Descargar como Imagen
        </button>
        <button
          type="button"
          className="button button-mint"
          onClick={handleDownloadPdf}
        >
          <FileBadge size={18} aria-hidden="true" />
          Descargar como PDF
        </button>
        {verificationUrl && (
          <button
            type="button"
            className="button button-secondary"
            onClick={downloadRawQR}
          >
            <QrCode size={18} aria-hidden="true" />
            Descargar solo QR
          </button>
        )}
        {verificationUrl && (
          <a
            className="button button-secondary"
            href={verificationUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Verificar certificado
          </a>
        )}
        {polygonscanUrl && (
          <a
            className="button button-mint"
            href={polygonscanUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={16} aria-hidden="true" />
            Ver en Polygonscan
          </a>
        )}
      </div>
    </div>
  );
}
