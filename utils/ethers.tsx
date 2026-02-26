import { ethers } from 'ethers';
import addresses from './addresses.json';
import verifierAbi from './verifierAbi.json';

declare global {
  interface Window {
    ethereum: any;
  }
}

class Ethers {
  provider?: ethers.providers.Web3Provider;
  signer?: ethers.providers.JsonRpcSigner;
  contract?: ethers.Contract;
  utils: typeof ethers.utils;
  hasProvider: boolean;

  constructor() {
    this.utils = ethers.utils;
    this.hasProvider = typeof window !== 'undefined' && typeof window.ethereum !== 'undefined';

    if (!this.hasProvider) return;

    this.provider = new ethers.providers.Web3Provider(window.ethereum);
    this.signer = this.provider.getSigner();

    this.contract = new ethers.Contract(addresses.verifier, verifierAbi, this.signer);
    void this.connect();
  }

  async connect() {
    if (!this.hasProvider || !this.signer || !this.contract) return false;
    await window.ethereum.request({ method: 'eth_requestAccounts' });

    const currentNetworkId = parseInt(await window.ethereum.request({ method: 'net_version' }));
    if (currentNetworkId !== addresses.chainId) {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${addresses.chainId.toString(16)}` }],
        });
      } catch (error) {
        console.error('Error switching network:', error);
        if (error.code === 4902) {
          alert('Please add the network to your MetaMask wallet.');
        } else {
          console.error('User rejected the request.');
        }
      }
    }
    this.contract = this.contract.connect(this.signer);
    return true;
  }
}

export default Ethers;
