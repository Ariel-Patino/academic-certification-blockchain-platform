"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";

type HealthStatus = "healthy" | "degraded" | "down";

interface ArchitectureReport {
  overallStatus: HealthStatus;
  checkedAt: string;
}

const resolveApiRoot = (): string => {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
  return apiBase.replace(/\/api$/, "");
};

export function RealtimeArchitectureStatus() {
  const [status, setStatus] = useState<HealthStatus | "unknown">("unknown");
  const previousStatusRef = useRef<HealthStatus | "unknown">("unknown");

  const streamUrl = useMemo(() => `${resolveApiRoot()}/api/architecture/stream`, []);

  useEffect(() => {
    const source = new EventSource(streamUrl);

    source.addEventListener("architecture", (event) => {
      try {
        const report = JSON.parse((event as MessageEvent).data) as ArchitectureReport;
        const nextStatus = report.overallStatus;

        if (previousStatusRef.current !== "unknown" && previousStatusRef.current !== nextStatus) {
          if (nextStatus === "healthy") {
            toast.success("Arquitectura recuperada: servicios saludables.");
          } else {
            toast.error(`Arquitectura ${nextStatus}: revisar dependencias externas.`);
          }
        }

        previousStatusRef.current = nextStatus;
        setStatus(nextStatus);
      } catch {
        // Ignore malformed events.
      }
    });

    source.addEventListener("error", () => {
      setStatus("unknown");
    });

    return () => {
      source.close();
    };
  }, [streamUrl]);

  const className =
    status === "healthy"
      ? "arch-pill arch-pill-healthy"
      : status === "degraded"
        ? "arch-pill arch-pill-degraded"
        : status === "down"
          ? "arch-pill arch-pill-down"
          : "arch-pill arch-pill-unknown";

  return <p className={className}>Arquitectura: {status}</p>;
}
