// Builds a verification certificate PDF from an on-chain validated result.
"use client";

import jsPDF from "jspdf";
import QRCode from "qrcode";

import { POLYGONSCAN_AMOY_TX_BASE } from "@/lib/constants";

export interface VerificationPdfPayload {
  programName: string;
  institutionName: string;
  issuedAt: string;
  certificateHash: string;
  verificationUrl: string;
}

const LEGAL_TEXT =
  "Sello digital legal: Este certificado de verificacion acredita que la integridad y autenticidad del documento fueron contrastadas contra el hash anclado en Polygon Amoy. Su validez puede re-comprobarse en cualquier momento usando el hash blockchain incluido en este PDF.";

const toDataUrl = async (url: string): Promise<string> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("No se pudo cargar el logo institucional para el PDF.");
  }

  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("No se pudo convertir el logo institucional."));
    };
    reader.onerror = () => reject(new Error("No se pudo leer el logo institucional."));
    reader.readAsDataURL(blob);
  });
};

const toReadableDate = (isoDate: string): string => {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }

  return new Intl.DateTimeFormat("es-ES", {
    year: "numeric",
    month: "long",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(parsed);
};

const normalizeFileName = (programName: string): string => {
  const base = String(programName || "certificado-verificacion").toLowerCase();
  return base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "certificado-verificacion";
};

const truncate = (value: string, maxLength = 90): string => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
};

export const exportVerificationCertificatePdf = async (
  payload: VerificationPdfPayload
): Promise<void> => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const marginX = 16;
  const contentWidth = 178;

  const logoDataUrl = await toDataUrl("/institution-logo.svg");
  const qrDataUrl = await QRCode.toDataURL(payload.verificationUrl, {
    width: 280,
    margin: 1,
    color: { dark: "#0f172a", light: "#ffffff" }
  });

  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, 210, 297, "F");

  doc.addImage(logoDataUrl, "PNG", marginX, 14, 96, 27);

  doc.setTextColor(17, 24, 39);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Certificado de Verificacion", marginX, 51);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text("Prueba de veracidad emitida por verificacion blockchain", marginX, 57);

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.roundedRect(marginX, 63, contentWidth, 78, 2.5, 2.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text("Datos verificados", marginX + 5, 71);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`Curso: ${truncate(payload.programName, 85)}`, marginX + 5, 80);
  doc.text(`Institucion: ${truncate(payload.institutionName, 85)}`, marginX + 5, 88);
  doc.text(`Fecha de emision: ${toReadableDate(payload.issuedAt)}`, marginX + 5, 96);

  doc.setFont("helvetica", "bold");
  doc.text("Hash blockchain (Polygon Amoy):", marginX + 5, 106);
  doc.setFont("courier", "normal");
  doc.setFontSize(8.5);
  const hashLines = doc.splitTextToSize(payload.certificateHash, contentWidth - 11);
  doc.text(hashLines, marginX + 5, 112);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(37, 99, 235);
  const txLink = `${POLYGONSCAN_AMOY_TX_BASE}${payload.certificateHash}`;
  doc.textWithLink("Consultar hash en Polygonscan", marginX + 5, 130, { url: txLink });

  doc.setTextColor(15, 23, 42);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(marginX, 149, contentWidth, 104, 2.5, 2.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("QR de verificacion", marginX + 5, 157);

  doc.addImage(qrDataUrl, "PNG", marginX + 9, 162, 52, 52);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  const verificationUrlLines = doc.splitTextToSize(payload.verificationUrl, 104);
  doc.text(verificationUrlLines, marginX + 66, 175);
  doc.textWithLink("Abrir enlace de verificacion", marginX + 66, 197, {
    url: payload.verificationUrl
  });

  doc.setFillColor(241, 245, 249);
  doc.roundedRect(marginX, 259, contentWidth, 26, 2.5, 2.5, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.3);
  doc.setTextColor(51, 65, 85);
  const legalLines = doc.splitTextToSize(LEGAL_TEXT, contentWidth - 10);
  doc.text(legalLines, marginX + 5, 266);

  const safeFileName = normalizeFileName(payload.programName);
  doc.save(`certificado-verificacion-${safeFileName}.pdf`);
};
