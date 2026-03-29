// Full-screen overlay shown when MetaMask is on the wrong network.
"use client";

import { AlertOctagon } from "lucide-react";
import { useState } from "react";

import { useWallet } from "@/hooks/useWallet";
import { POLYGON_AMOY_CHAIN_ID_HEX } from "@/lib/constants";
import { formatWeb3Error } from "@/services/web3Errors";

const switchToAmoy = async (): Promise<void> => {
  const ethereum = window.ethereum;
  if (!ethereum?.request) {
    throw new Error("MetaMask no esta disponible en este navegador.");
  }

  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: POLYGON_AMOY_CHAIN_ID_HEX }]
    });
  } catch (err: unknown) {
    // Error code 4902 means the chain is not added to MetaMask yet.
    const code = err && typeof err === "object" && "code" in err
      ? (err as { code: number }).code
      : null;

    if (code === 4902) {
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: POLYGON_AMOY_CHAIN_ID_HEX,
            chainName: "Polygon Amoy Testnet",
            nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
            rpcUrls: ["https://rpc-amoy.polygon.technology/"],
            blockExplorerUrls: ["https://amoy.polygonscan.com/"]
          }
        ]
      });
      return;
    }

    throw err;
  }
};

export function WrongNetworkOverlay() {
  const { isConnected, chainId } = useWallet();
  const [switchError, setSwitchError] = useState<string | null>(null);

  if (!isConnected || !chainId || chainId.toLowerCase() === POLYGON_AMOY_CHAIN_ID_HEX) {
    return null;
  }

  return (
    <div
      className="wrong-network-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-label="Red de MetaMask incompatible"
    >
      <div className="wrong-network-card">
        <span className="wrong-network-icon" aria-hidden="true">
          <AlertOctagon size={38} />
        </span>
        <h2>Red no compatible</h2>
        <p>Por favor, cambia a la red <strong>Polygon Amoy</strong> para continuar.</p>
        <p className="wrong-network-hint">Chain ID requerido: 80002 (0x13882)</p>
        <button
          type="button"
          className="button button-primary"
          onClick={() => {
            void (async () => {
              try {
                setSwitchError(null);
                await switchToAmoy();
              } catch (error) {
                setSwitchError(
                  formatWeb3Error(error, "No se pudo cambiar la red en MetaMask.")
                );
              }
            })();
          }}
        >
          Cambiar a Polygon Amoy
        </button>
        {switchError && <p className="wallet-banner wallet-banner-warning">{switchError}</p>}
      </div>
    </div>
  );
}
