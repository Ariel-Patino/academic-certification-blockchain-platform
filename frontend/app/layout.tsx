// Root layout for the Next.js application and shared UI shell.
import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";

import { Navbar } from "@/components/layout/Navbar";
import { WalletStatus } from "@/components/layout/WalletStatus";
import { WalletProvider } from "@/hooks/useWallet";
import { WrongNetworkOverlay } from "@/components/layout/WrongNetworkOverlay";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { RealtimeArchitectureStatus } from "@/components/layout/RealtimeArchitectureStatus";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/constants";

import "../styles/globals.css";

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <WalletProvider>
          <div className="app-shell">
          <WrongNetworkOverlay />
          <Toaster
            position="bottom-right"
            toastOptions={{
              duration: 6000,
              style: {
                fontSize: "0.9rem",
                maxWidth: "460px",
                borderRadius: "0.75rem"
              },
              success: {
                iconTheme: { primary: "#10b981", secondary: "#fff" }
              },
              error: {
                iconTheme: { primary: "#ef4444", secondary: "#fff" }
              }
            }}
          />
            <aside className="sidebar">
              <div className="sidebar-brand">
                <p className="eyebrow">Trabajo Fin de Master</p>
                <h1>{APP_NAME}</h1>
              </div>
              <Navbar />
            </aside>
            <div className="workspace">
              <header className="top-header card">
                <div>
                  <p className="eyebrow">Deep Mint Blockchain Console</p>
                  <h2>Panel de Control de Credenciales</h2>
                </div>
                <div className="header-actions-panel">
                  <RealtimeArchitectureStatus />
                  <ThemeToggle />
                  <WalletStatus />
                </div>
              </header>
              {children}
            </div>
          </div>
        </WalletProvider>
      </body>
    </html>
  );
}
