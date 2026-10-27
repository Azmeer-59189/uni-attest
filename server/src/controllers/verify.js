const Degree = require('../models/Degree');
const blockchainService = require('../services/blockchain');
const { checkIntegrity } = require('../services/integrity');

exports.verifyByHash = async (req, res, next) => {
  try {
    const input = (req.params.hash || '').trim();
    if (!/^(0x)?[a-fA-F0-9]{64}$/.test(input)) return res.status(400).json({ verified: false, error: 'A valid degree or transaction hash is required.' });
    const hash = input.replace(/^0x/, '').toLowerCase();
    const degree = await Degree.findOne({ $or: [
      { hash }, { hash: `0x${hash}` }, { blockchainTx: hash }, { blockchainTx: `0x${hash}` }
    ] });
    if (!degree) return res.status(404).json({ verified: false, error: 'No degree found with this hash.' });
    const integrity = checkIntegrity(degree);
    const localChain = degree.blockchainNetwork === 'hardhat_local';
    const networkLabel = localChain ? 'Local test blockchain' : 'Polygon Amoy';
    const chain = { checked: false, verified: false, error: null };
    if (integrity.verified && (degree.blockchainRequired || degree.blockchainTx)) {
      if (blockchainService.initialized && !blockchainService.matchesDegree(degree)) {
        chain.error = `This record belongs to ${networkLabel} on its original contract. That network and contract must be configured to verify it.`;
      } else if (blockchainService.initialized) {
        try { Object.assign(chain, await blockchainService.verifyDegree(degree.hash), { checked: true }); }
        catch (_) { chain.checked = true; chain.error = 'Blockchain verification is temporarily unavailable.'; }
      } else chain.error = 'Blockchain verification is temporarily unavailable.';
    }
    const requiresChain = degree.blockchainRequired || Boolean(degree.blockchainTx);
    const verified = integrity.verified && (!requiresChain || chain.verified);
    const snapshot = degree.snapshot?.toObject() || {};
    await Degree.updateOne({ _id: degree._id }, { $inc: { verificationCount: 1 }, $set: { lastVerifiedAt: new Date() } });
    res.json({
      verified, localIntegrityVerified: integrity.verified,
      verificationLevel: verified ? (chain.verified ? (localChain ? 'local_blockchain' : 'blockchain') : 'local_integrity') : 'unverified',
      status: !integrity.verified ? integrity.status : requiresChain && !chain.verified ? 'blockchain_unverified' : 'verified',
      error: !integrity.verified ? integrity.error : requiresChain && !chain.verified ? (chain.error || `The degree hash was not found on ${networkLabel}.`) : null,
      degree: {
        ...snapshot, hash: degree.hash, blockchainTx: degree.blockchainTx,
        blockchainVerification: chain,
        blockchainNetwork: degree.blockchainNetwork,
        blockchainNetworkLabel: networkLabel,
        blockchainChainId: degree.blockchainChainId,
        blockchainContract: degree.blockchainContract,
        polygonScanUrl: degree.blockchainTx && !localChain ? `https://amoy.polygonscan.com/tx/${degree.blockchainTx}` : null,
        pdfUrl: verified ? degree.pdfUrl : null
      }
    });
  } catch (error) { next(error); }
};
