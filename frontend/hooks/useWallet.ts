// Reserves a dedicated hook for MetaMask and wallet state integration.
"use client";

import {
  createElement,
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { BrowserProvider } from "ethers";

import { EthereumProvider } from "@/types/ethereum";
import { api, issuerSession, SiweNoncePayload, SiweVerifyPayload } from "@/services/api";
import { formatWeb3Error } from "@/services/web3Errors";

interface WalletState {
  address: string | null;
  chainId: string | null;
  isConnected: boolean;
  isMetaMaskAvailable: boolean;
  isIssuerAuthenticated: boolean;
  errorMessage: string | null;
  connect: () => Promise<void>;
  connectAndLogin: () => Promise<void>;
  loginIssuer: () => Promise<void>;
  logoutIssuer: () => void;
  disconnect: () => Promise<void>;
}

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data?: T;
}

const WalletContext = createContext<WalletState | null>(null);

const getEthereumProvider = (): EthereumProvider | null => {
  if (typeof window === "undefined") {
    return null;
  }

  return window.ethereum || null;
};

const normalizeAddress = (address: string | null): string | null => {
  return address ? address.toLowerCase() : null;
};

export const WalletProvider = ({ children }: PropsWithChildren) => {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [isMetaMaskAvailable, setIsMetaMaskAvailable] = useState(false);
  const [isIssuerAuthenticated, setIsIssuerAuthenticated] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const provider = getEthereumProvider();

    setIsMetaMaskAvailable(Boolean(provider));
    setIsIssuerAuthenticated(Boolean(issuerSession.getToken()));

    if (!provider) {
      return;
    }

    const syncAccounts = async () => {
      try {
        const accounts = await provider.request<string[]>({ method: "eth_accounts" });
        setAddress(normalizeAddress(accounts[0] || null));
      } catch {
        setErrorMessage("No se pudo leer la cuenta conectada en MetaMask.");
      }
    };

    const syncChainId = async () => {
      try {
        const nextChainId = await provider.request<string>({ method: "eth_chainId" });
        setChainId(nextChainId);
      } catch {
        setErrorMessage("No se pudo leer la red activa en MetaMask.");
      }
    };

    const handleAccountsChanged = (accountsValue: unknown) => {
      const accounts = Array.isArray(accountsValue) ? (accountsValue as string[]) : [];
      setAddress(normalizeAddress(accounts[0] || null));
      issuerSession.clear();
      setIsIssuerAuthenticated(false);
      setErrorMessage(null);
    };

    const handleChainChanged = (chainIdValue: unknown) => {
      setChainId(typeof chainIdValue === "string" ? chainIdValue : null);
      setErrorMessage(null);
    };

    void syncAccounts();
    void syncChainId();

    provider.on?.("accountsChanged", handleAccountsChanged);
    provider.on?.("chainChanged", handleChainChanged);

    return () => {
      provider.removeListener?.("accountsChanged", handleAccountsChanged);
      provider.removeListener?.("chainChanged", handleChainChanged);
    };
  }, []);

  const connect = async () => {
    const provider = getEthereumProvider();

    if (!provider) {
      setErrorMessage("MetaMask no esta disponible en este navegador.");
      return;
    }

    try {
      setErrorMessage(null);
      const accounts = await provider.request<string[]>({ method: "eth_requestAccounts" });
      const nextChainId = await provider.request<string>({ method: "eth_chainId" });

      setAddress(normalizeAddress(accounts[0] || null));
      setChainId(nextChainId);
    } catch (error) {
      setErrorMessage(
        formatWeb3Error(error, "La conexion con MetaMask fue cancelada o fallo.")
      );
    }
  };

  const loginIssuer = async () => {
    const provider = getEthereumProvider();

    if (!provider) {
      setErrorMessage("MetaMask no esta disponible en este navegador.");
      return;
    }

    if (!address) {
      setErrorMessage("Conecta MetaMask antes de iniciar sesion como emisor.");
      return;
    }

    try {
      setErrorMessage(null);
      const nonceResponse = await api.requestSiweNonce<ApiEnvelope<SiweNoncePayload>>(address);

      if (!nonceResponse.data?.nonce || !nonceResponse.data.message) {
        throw new Error("No se pudo obtener nonce SIWE desde backend.");
      }

      const browserProvider = new BrowserProvider(provider);
      const signer = await browserProvider.getSigner();
      const signature = await signer.signMessage(nonceResponse.data.message);

      const verifyResponse = await api.verifySiweLogin<ApiEnvelope<SiweVerifyPayload>>({
        address,
        nonce: nonceResponse.data.nonce,
        signature
      });

      const token = verifyResponse.data?.token;
      if (!token) {
        throw new Error("No se recibio token JWT en el login SIWE.");
      }

      issuerSession.setToken(token);
      setIsIssuerAuthenticated(true);
    } catch (error) {
      issuerSession.clear();
      setIsIssuerAuthenticated(false);
      setErrorMessage(
        error instanceof Error
          ? formatWeb3Error(error, error.message)
          : "No se pudo completar SIWE login."
      );
    }
  };

  const connectAndLogin = async () => {
    const provider = getEthereumProvider();

    if (!provider) {
      setErrorMessage("MetaMask no esta disponible en este navegador.");
      return;
    }

    try {
      setErrorMessage(null);

      const accounts = await provider.request<string[]>({ method: "eth_requestAccounts" });
      const nextAddress = normalizeAddress(accounts[0] || null);
      const nextChainId = await provider.request<string>({ method: "eth_chainId" });

      setAddress(nextAddress);
      setChainId(nextChainId);

      if (!nextAddress) {
        throw new Error("No se pudo obtener la cuenta de MetaMask.");
      }

      const nonceResponse = await api.requestSiweNonce<ApiEnvelope<SiweNoncePayload>>(nextAddress);

      if (!nonceResponse.data?.nonce || !nonceResponse.data.message) {
        throw new Error("No se pudo obtener nonce SIWE desde backend.");
      }

      const browserProvider = new BrowserProvider(provider);
      const signer = await browserProvider.getSigner();
      const signature = await signer.signMessage(nonceResponse.data.message);

      const verifyResponse = await api.verifySiweLogin<ApiEnvelope<SiweVerifyPayload>>({
        address: nextAddress,
        nonce: nonceResponse.data.nonce,
        signature
      });

      const token = verifyResponse.data?.token;
      if (!token) {
        throw new Error("No se recibio token JWT en el login SIWE.");
      }

      issuerSession.setToken(token);
      setIsIssuerAuthenticated(true);
    } catch (error) {
      issuerSession.clear();
      setIsIssuerAuthenticated(false);
      setErrorMessage(
        error instanceof Error
          ? formatWeb3Error(error, error.message)
          : "No se pudo completar conexion + SIWE."
      );
    }
  };

  const logoutIssuer = () => {
    issuerSession.clear();
    setIsIssuerAuthenticated(false);
  };

  const disconnect = async () => {
    const provider = getEthereumProvider();

    setErrorMessage(null);

    if (provider) {
      try {
        await provider.request({
          method: "wallet_revokePermissions",
          params: [{ eth_accounts: {} }]
        });
      } catch {
        // Some wallets do not support permission revocation; local reset still works for UI gating.
      }
    }

    issuerSession.clear();
    setIsIssuerAuthenticated(false);
    setAddress(null);
    setChainId(null);
  };

  const value = useMemo<WalletState>(() => {
    return {
      address,
      chainId,
      isConnected: Boolean(address),
      isMetaMaskAvailable,
      isIssuerAuthenticated,
      errorMessage,
      connect,
      connectAndLogin,
      loginIssuer,
      logoutIssuer,
      disconnect
    };
  }, [address, chainId, isMetaMaskAvailable, isIssuerAuthenticated, errorMessage]);

  return createElement(WalletContext.Provider, { value }, children);
};

export const useWallet = (): WalletState => {
  const context = useContext(WalletContext);

  if (!context) {
    throw new Error("useWallet must be used within WalletProvider.");
  }

  return context;
};
