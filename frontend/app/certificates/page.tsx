"use client";

import { useEffect, useState, useCallback } from "react";

import { api } from "@/services/api";
import { useWallet } from "@/hooks/useWallet";
import { Button } from "@/components/common/Button";
import { PageContainer } from "@/components/layout/PageContainer";

interface CertificateListItem {
  id: string;
  certificateHash: string;
  programName: string;
  status: string;
  issuedDate: string;
}

interface ApiListResponse {
  success: boolean;
  data: CertificateListItem[];
}

const shortenHash = (hash: string): string =>
  hash.length > 14 ? `${hash.slice(0, 8)}...${hash.slice(-6)}` : hash;

const formatDate = (timestamp: string): string => {
  const n = Number(timestamp);
  if (!n) return "—";
  return new Date(n * 1000).toLocaleDateString("es-ES", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
};

const statusLabel = (status: string): string => {
  if (status === "Valid") return "Vigente";
  if (status === "Revoked") return "Revocado";
  if (status === "Expired") return "Expirado";
  return status;
};

const statusClass = (status: string): string => {
  if (status === "Valid") return "status-badge status-valid";
  if (status === "Revoked") return "status-badge status-revoked";
  if (status === "Expired") return "status-badge status-expired";
  return "status-badge status-unknown";
};

export default function CertificatesPage() {
  const { isConnected, isMetaMaskAvailable, address } = useWallet();
  const [certificates, setCertificates] = useState<CertificateListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  if (!isConnected) {
    return (
      <PageContainer>
        <section className="card">
          <p className="eyebrow">Historial</p>
          <h2>Registro de emisiones</h2>
          <p>Conecte su billetera para habilitar esta función.</p>
        </section>
        <div className="wallet-banner">
            El historial de certificados requiere una billetera conectada.
        </div>
      </PageContainer>
    );
  }

  const fetchCertificates = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.getIssuerCertificates<ApiListResponse>(address);
      setCertificates(result.data ?? []);
      setCurrentPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar certificados.");
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (isConnected && address) {
      void fetchCertificates();
    }
  }, [isConnected, address, fetchCertificates]);

  // Pagination logic
  const totalPages = Math.ceil(certificates.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCertificates = certificates.slice(startIndex, endIndex);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(Math.max(1, Math.min(newPage, totalPages)));
  };

  const handleItemsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setItemsPerPage(Number(e.target.value));
    setCurrentPage(1);
  };

  return (
    <PageContainer>
      <section className="card">
        <p className="eyebrow">Historial</p>
        <h2>Registro Histórico</h2>
        <p>Registro Histórico: Listado oficial de títulos emitidos y registrados en la red.</p>
      </section>

      {!isMetaMaskAvailable && (
        <section className="card">
          <p className="wallet-banner wallet-banner-warning">
            MetaMask no está disponible. Instale la extensión para consultar el registro histórico.
          </p>
        </section>
      )}

      {address && (
        <section className="card">
          <div className="cert-list-header">
            <p className="cert-list-meta">
              Emisor: <code>{address}</code>
            </p>
            <Button type="button" onClick={() => void fetchCertificates()} disabled={loading}>
              {loading ? "Cargando..." : "Actualizar"}
            </Button>
          </div>

          {error && <p className="wallet-banner wallet-banner-warning">{error}</p>}

          {loading && !error && (
            <p className="form-helper">Consultando registros oficiales...</p>
          )}

          {!loading && !error && certificates.length === 0 && (
            <p className="form-helper">No se encontraron títulos emitidos desde esta billetera.</p>
          )}

          {!loading && certificates.length > 0 && (
            <>
              <div className="pagination-controls">
                <div className="pagination-items-select">
                  <label htmlFor="items-per-page">Certificados por página:</label>
                  <select
                    id="items-per-page"
                    value={itemsPerPage}
                    onChange={handleItemsPerPageChange}
                    className="pagination-select"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
                <p className="pagination-info">
                  Página {currentPage} de {totalPages} ({certificates.length} certificados en total)
                </p>
              </div>

              <div className="cert-table-wrapper">
                <table className="cert-table">
                  <thead>
                    <tr>
                      <th>ID On-Chain</th>
                      <th>Código</th>
                      <th>Programa</th>
                      <th>Estado</th>
                      <th>Fecha de Emision</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedCertificates.map((cert) => (
                      <tr key={cert.id}>
                        <td>{cert.id}</td>
                        <td>
                          <code title={cert.certificateHash}>{shortenHash(cert.certificateHash)}</code>
                        </td>
                        <td>{cert.programName}</td>
                        <td>
                          <span className={statusClass(cert.status)}>
                            {statusLabel(cert.status)}
                          </span>
                        </td>
                        <td>{formatDate(cert.issuedDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pagination-footer">
                <Button
                  type="button"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || loading}
                >
                  ← Anterior
                </Button>
                <span className="pagination-counter">
                  {startIndex + 1}–{Math.min(endIndex, certificates.length)} de {certificates.length}
                </span>
                <Button
                  type="button"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages || loading}
                >
                  Siguiente →
                </Button>
              </div>
            </>
          )}
        </section>
      )}
    </PageContainer>
  );
}
