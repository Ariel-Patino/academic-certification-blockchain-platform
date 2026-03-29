// Encapsulates issuer operations so controller logic stays thin and replaceable.
import { blockchainConfig, getWallet } from "../config/blockchain";
import { ServiceResult } from "../types";

export const getIssuerStatus = async (): Promise<ServiceResult<{
  active: boolean;
  issuerAddress: string;
  chainId: number;
  contractAddress: string;
}>> => {
  return {
    success: true,
    message: "Issuer signer status retrieved successfully.",
    data: {
      active: true,
      issuerAddress: getWallet().address.toLowerCase(),
      chainId: blockchainConfig.chainId,
      contractAddress: blockchainConfig.contractAddress
    }
  };
};
