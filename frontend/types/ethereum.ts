export interface EthereumRequestArguments {
  method: string;
  params?: unknown[] | object;
}

export interface EthereumProvider {
  isMetaMask?: boolean;
  request: <T = unknown>(args: EthereumRequestArguments) => Promise<T>;
  on?: (eventName: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (eventName: string, listener: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export {};