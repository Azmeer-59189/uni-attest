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
  }

  async initialize() {
    try {
      const rpcUrl = process.env.AMOY_RPC_URL;
      const privateKey = process.env.PRIVATE_KEY;
      const contractAddress = process.env.CONTRACT_ADDRESS;

      if (!privateKey || !contractAddress) {
        logger.warn('Blockchain service not configured.');
        return false;
      }

      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      this.wallet = new ethers.Wallet(privateKey, this.provider);
      this.contract = new ethers.Contract(contractAddress, CONTRACT_ABI, this.wallet);

      this.initialized = true;
      logger.info('Blockchain service initialized');
      logger.info(`Wallet: ${this.wallet.address}`);
      return true;
    } catch (error) {
      logger.error('Failed to initialize blockchain:', error);
      return false;
    }
  }

  async issueDegree(degreeHash) {
    if (!this.initialized) throw new Error('Blockchain not initialized');

    try {
      const hashBytes32 = ethers.hexlify(degreeHash.startsWith('0x') ? degreeHash : '0x' + degreeHash);
      logger.info(`Issuing degree with hash: ${hashBytes32}`);

      const tx = await this.contract.issueDegree(hashBytes32);
      const receipt = await tx.wait();

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