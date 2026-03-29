"use client";

import { useEffect, useMemo, useState } from "react";

type HealthStatus = "healthy" | "degraded" | "down";

interface ServiceHealth {
  status: HealthStatus;
  latencyMs: number | null;
}

interface ArchitecturePayload {
  success: boolean;
  data: {
    checkedAt: string;
    overallStatus: HealthStatus;
    polygon: ServiceHealth;
    ipfs: ServiceHealth;
    database: ServiceHealth;
  };
}

const resolveApiUrl = (): string => {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
};

const latencyToWidth = (latencyMs: number | null): number => {
  if (!latencyMs || latencyMs <= 0) return 5;
  return Math.max(5, Math.min(100, Math.round((latencyMs / 1200) * 100)));
};

export function InsightsPanel() {
  const [payload, setPayload] = useState<ArchitecturePayload["data"] | null>(null);

  const architectureUrl = useMemo(() => `${resolveApiUrl()}/architecture`, []);

  useEffect(() => {
    let active = true;

    const fetchData = async () => {
      try {
        const response = await fetch(architectureUrl, { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const parsed = (await response.json()) as ArchitecturePayload;
        if (active && parsed.success && parsed.data) {
          setPayload(parsed.data);
        }
      } catch {
        // Keep last snapshot if request fails.
      }
    };

    void fetchData();
    const interval = setInterval(() => {
      void fetchData();
    }, 20_000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [architectureUrl]);

  if (!payload) {
    return (
      <section className="card insights-panel">
        <p className="eyebrow">Dashboard</p>
        <h3>Métricas operativas en vivo</h3>
        <p className="form-helper">Cargando telemetría de arquitectura...</p>
      </section>
    );
  }

  const services = [
    { label: "Polygon", value: payload.polygon },
    { label: "IPFS", value: payload.ipfs },
    { label: "Database", value: payload.database }
  ];

  return (
    <section className="card insights-panel">
      <div className="insights-title-row">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h3>Métricas operativas en vivo</h3>
        </div>
        <p className={`arch-pill arch-pill-${payload.overallStatus}`}>Estado global: {payload.overallStatus}</p>
      </div>

      <div className="insights-grid">
        {services.map((service) => (
          <article key={service.label} className="insight-card">
            <p className="insight-label">{service.label}</p>
            <p className="insight-status">{service.value.status}</p>
            <div className="latency-bar-track" role="presentation">
              <div className="latency-bar-fill" style={{ width: `${latencyToWidth(service.value.latencyMs)}%` }} />
            </div>
            <p className="insight-latency">
              Latencia: {service.value.latencyMs === null ? "N/A" : `${service.value.latencyMs} ms`}
            </p>
          </article>
        ))}
      </div>

      <p className="form-helper">Última actualización: {new Date(payload.checkedAt).toLocaleTimeString("es-ES")}</p>
    </section>
  );
}
