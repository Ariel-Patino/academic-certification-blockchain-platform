"use client";

import { BrowserProvider, Contract, isAddress } from "ethers";
import { EthereumProvider } from "@/types/ethereum";
import { formatWeb3Error } from "@/services/web3Errors";

export interface RevokeOnChainInput {
  certificateId: string;
  reason: string;
  contractAddress: string;
  onTxSent?: (txHash: string) => void;
}

export interface RevokeOnChainResult {
  txHash: string;
  revokedBy: string;
}

const ACADEMIC_CERTIFICATION_REVOKE_ABI = [
  "function revokeCertificate(uint256 _certificateId, string _reason)"
] as const;

const assertMetaMaskAvailable = (): EthereumProvider => {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask no esta disponible en este navegador.");
  }

  return window.ethereum;
};

const normalizeCertificateId = (certificateIdInput: string): bigint => {
  const certificateId = String(certificateIdInput || "").trim();

  if (!/^\d+$/.test(certificateId) || certificateId === "0") {
    throw new Error("certificateId debe ser un entero positivo.");
  }

  return BigInt(certificateId);
};

export const revokeCertificateWithMetaMask = async (
  input: RevokeOnChainInput
): Promise<RevokeOnChainResult> => {
  try {
    const ethereumProvider = assertMetaMaskAvailable();

    if (!isAddress(input.contractAddress)) {
      throw new Error("Direccion de contrato invalida.");
    }

    const provider = new BrowserProvider(ethereumProvider);
    const signer = await provider.getSigner();
    const signerAddress = (await signer.getAddress()).toLowerCase();

    const contract = new Contract(input.contractAddress, ACADEMIC_CERTIFICATION_REVOKE_ABI, signer);

    const transaction = await contract.revokeCertificate(
      normalizeCertificateId(input.certificateId),
      input.reason
    );

    input.onTxSent?.(transaction.hash as string);

    await transaction.wait();

    return {
      txHash: transaction.hash,
      revokedBy: signerAddress
    };
  } catch (error) {
    throw new Error(
      formatWeb3Error(error, "No se pudo firmar o enviar la transaccion de revocacion en MetaMask.")
    );
  }
};