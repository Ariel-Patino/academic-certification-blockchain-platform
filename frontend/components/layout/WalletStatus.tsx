"use client";

import { Button } from "@/components/common/Button";
import { useWallet } from "@/hooks/useWallet";

const shortenAddress = (address: string): string => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const formatChainId = (chainId: string | null): string => {
  if (!chainId) {
    return "red desconocida";
  }

  return `chain ${parseInt(chainId, 16)}`;
};

export function WalletStatus() {
  const {
    address,
    chainId,
    isConnected,
    isMetaMaskAvailable,
    isIssuerAuthenticated,
    errorMessage,
    connectAndLogin,
    disconnect
  } = useWallet();

  if (!isMetaMaskAvailable) {
    return <p className="wallet-pill wallet-pill-warning">MetaMask no detectado</p>;
  }

  if (!isConnected) {
    return (
      <div className="wallet-panel wallet-panel-inline">
        <Button type="button" onClick={() => void connectAndLogin()}>
          Conectar wallet + SIWE
        </Button>
        {errorMessage && <p className="wallet-pill wallet-pill-warning">{errorMessage}</p>}
      </div>
    );
  }

  return (
    <>
      <div className="wallet-panel wallet-panel-inline">
        <div className="wallet-connected-row">
          <p className="wallet-pill wallet-pill-success">
            Wallet conectada: {address ? shortenAddress(address) : "N/A"} · {formatChainId(chainId)}
          </p>
          <p className={isIssuerAuthenticated ? "wallet-pill wallet-pill-success" : "wallet-pill wallet-pill-warning"}>
            {isIssuerAuthenticated ? "Sesion emisor activa" : "Sesion emisor no iniciada"}
          </p>
          <button type="button" className="button button-secondary" onClick={() => void disconnect()}>
            Desconectar
          </button>
          {!isIssuerAuthenticated && (
            <button type="button" className="button button-secondary" onClick={() => void connectAndLogin()}>
              Conectar wallet + SIWE
            </button>
          )}
        </div>
        {errorMessage && <p className="wallet-pill wallet-pill-warning">{errorMessage}</p>}
      </div>
    </>
  );
}
