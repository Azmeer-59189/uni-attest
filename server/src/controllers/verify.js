const Degree = require('../models/Degree');
const blockchainService = require('../services/blockchain');
const { checkIntegrity } = require('../services/integrity');

// Public pages show only enough of the CNIC to compare against the holder's card.
const maskCnic = cnic => typeof cnic === 'string' && cnic.length >= 4 ? `${cnic.slice(0, -5).replace(/\d/g, '•')}${cnic.slice(-5)}` : undefined;

exports.verifyByHash = async (req, res, next) => {
  try {
    const input = (req.params.hash || '').trim();
    const attestationNumber = /^ATT-\d{4}-\d{6}$/i.test(input) ? input.toUpperCase() : null;
    if (!attestationNumber && !/^(0x)?[a-fA-F0-9]{64}$/.test(input)) return res.status(400).json({ verified: false, error: 'Enter an attestation number (ATT-2026-000123) or a 64-character verification hash.' });
    const hash = input.replace(/^0x/, '').toLowerCase();
    const degree = await Degree.findOne(attestationNumber ? { attestationNumber, issuanceStatus: 'issued' } : { $or: [
      { hash }, { hash: `0x${hash}` }, { blockchainTx: hash }, { blockchainTx: `0x${hash}` }
    ] });
    if (!degree) return res.status(404).json({ verified: false, error: attestationNumber ? 'No attestation was issued with this number.' : 'No degree found with this hash.' });
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
        ...snapshot, cnic: maskCnic(snapshot.cnic), hash: degree.hash, blockchainTx: degree.blockchainTx,
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
