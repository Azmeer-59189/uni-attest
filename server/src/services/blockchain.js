const { ethers } = require('ethers');
const logger = require('../utils/logger');

const CONTRACT_ABI = [
  "function issueDegree(bytes32 _degreeHash) external",
  "function verifyDegree(bytes32 _degreeHash) external view returns (bool, uint256, address, string)",
  "function addIssuer(address _issuer) external",
  "function removeIssuer(address _issuer) external",
  "function authorizedIssuers(address) external view returns (bool)",
  "function owner() external view returns (address)",
  "function universityName() external view returns (string)",
  "event DegreeIssued(bytes32 indexed degreeHash, address indexed issuer, uint256 timestamp, string universityName)"
];

class BlockchainService {
  constructor() {
    this.provider = null;
    this.contract = null;
    this.wallet = null;
    this.initialized = false;
    this.networkName = 'polygon_amoy';
    this.chainId = 80002;
    this.contractAddress = null;
  }

  async initialize() {
    try {
      this.initialized = false;
      const local = process.env.BLOCKCHAIN_NETWORK === 'local';
      const rpcUrl = local ? (process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545') : (process.env.AMOY_RPC_URL || 'https://polygon-amoy.drpc.org');
      const privateKey = process.env.PRIVATE_KEY;
      const contractAddress = process.env.CONTRACT_ADDRESS;

      if ((!local && !privateKey) || !contractAddress) {
        logger.warn('Blockchain service not configured.');
        return false;
      }

      if (local && !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(rpcUrl).hostname)) throw new Error('Local blockchain mode requires a localhost RPC endpoint');
      this.provider?.destroy();
      const request = new ethers.FetchRequest(rpcUrl);
      request.timeout = 10000;
      this.chainId = local ? 1337 : 80002;
      this.networkName = local ? 'hardhat_local' : 'polygon_amoy';
      this.contractAddress = ethers.getAddress(contractAddress);
      this.provider = new ethers.JsonRpcProvider(request, this.chainId, { staticNetwork: true });
      if (BigInt(await this.provider.send('eth_chainId', [])) !== BigInt(this.chainId)) throw new Error(`Expected blockchain chain ID ${this.chainId}`);
      this.wallet = local ? await this.provider.getSigner(0) : new ethers.Wallet(privateKey, this.provider);
      this.contract = new ethers.Contract(contractAddress, CONTRACT_ABI, this.wallet);

      if (await this.provider.getCode(contractAddress) === '0x') throw new Error('Contract address has no code');
      const owner = await this.contract.owner();
      const walletAddress = await this.wallet.getAddress();
      if (owner.toLowerCase() !== walletAddress.toLowerCase() && !await this.contract.authorizedIssuers(walletAddress)) {
        throw new Error('Wallet is not an authorized issuer');
      }

      this.initialized = true;
      logger.info(`Blockchain service initialized (${local ? 'Hardhat local test chain' : 'Polygon Amoy'})`);
      logger.info(`Wallet: ${walletAddress}`);
      return true;
    } catch (error) {
      this.provider?.destroy();
      this.provider = null;
      logger.error('Failed to initialize blockchain:', error);
      return false;
    }
  }

  matchesDegree(degree) {
    if (!this.initialized || degree.blockchainNetwork !== this.networkName) return false;
    if (degree.blockchainChainId && degree.blockchainChainId !== this.chainId) return false;
    return !degree.blockchainContract || degree.blockchainContract.toLowerCase() === this.contractAddress?.toLowerCase();
  }

  async issueDegree(degreeHash, onSubmitted = async () => {}, pendingTx = null) {
    if (!this.initialized) throw new Error('Blockchain not initialized');

    try {
      const hashBytes32 = ethers.hexlify(degreeHash.startsWith('0x') ? degreeHash : '0x' + degreeHash);
      logger.info(`Issuing degree with hash: ${hashBytes32}`);

      if (pendingTx) {
        const previous = await this.provider.waitForTransaction(pendingTx, 1, 120000);
        if (!previous) throw new Error('Previous transaction is pending. Retry later.');
        if (previous.status === 1) return { success: true, transactionHash: previous.hash, blockNumber: previous.blockNumber };
      }
      const tx = await this.contract.issueDegree(hashBytes32);
      await onSubmitted(tx.hash);
      const receipt = await this.provider.waitForTransaction(tx.hash, 1, 120000);
      if (!receipt || receipt.status !== 1) throw new Error('Blockchain transaction is pending or failed. Retry issuance.');

      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber
      };
    } catch (error) {
      logger.error('Failed to issue degree:', error);
      throw error;
    }
  }

  async verifyDegree(degreeHash) {
    if (!this.initialized) throw new Error('Blockchain not initialized');

    try {
      const hashBytes32 = ethers.hexlify(degreeHash.startsWith('0x') ? degreeHash : '0x' + degreeHash);
      const [exists, timestamp, issuer, universityName] = await this.contract.verifyDegree(hashBytes32);

      return { exists, timestamp: timestamp.toString(), issuer, universityName, verified: exists };
    } catch (error) {
      logger.error('Failed to verify degree:', error);
      throw error;
    }
  }
}

module.exports = new BlockchainService();
