"use client";

import { useId, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

import { Button } from "@/components/common/Button";

interface CertificateQRCodeCardProps {
  verificationUrl: string;
  title?: string;
}

const sanitizeFileName = (value: string): string => {
  return value.replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 64) || "certificate";
};

export function CertificateQRCodeCard({ verificationUrl, title = "Codigo QR de verificacion" }: CertificateQRCodeCardProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const canvasId = useId();

  const handleDownload = () => {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;

    if (!canvas) {
      setFeedbackMessage("No se pudo generar el QR para descarga.");
      return;
    }

    const anchor = document.createElement("a");
    const filename = `${sanitizeFileName(verificationUrl)}-qr.png`;
    anchor.href = canvas.toDataURL("image/png");
    anchor.download = filename;
    anchor.click();
    setFeedbackMessage("QR descargado correctamente.");
  };

  return (
    <section className="qr-card">
      <p className="qr-card-title">{title}</p>
      <div className="qr-card-actions">
        <Button type="button" onClick={() => setIsVisible((current) => !current)}>
          {isVisible ? "Ocultar QR" : "Mostrar QR"}
        </Button>
        {isVisible && (
          <button className="button button-secondary" type="button" onClick={handleDownload}>
            Descargar QR
          </button>
        )}
      </div>

      {isVisible && (
        <div className="qr-card-visual">
          <QRCodeCanvas
            id={canvasId}
            value={verificationUrl}
            size={360}
            includeMargin
            level="H"
          />
          <a href={verificationUrl} target="_blank" rel="noreferrer">
            Abrir enlace de verificacion
          </a>
        </div>
      )}

      {feedbackMessage && <p className="qr-card-feedback">{feedbackMessage}</p>}
    </section>
  );
}