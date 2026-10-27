const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('DegreeAttestation', function () {
  let contract, owner, issuer, outsider;
  const degreeHash = ethers.sha256(ethers.toUtf8Bytes('immutable degree snapshot'));
  beforeEach(async function () {
    [owner, issuer, outsider] = await ethers.getSigners();
    contract = await ethers.deployContract('DegreeAttestation', ['Test University']);
    await contract.waitForDeployment();
  });
  it('rejects unauthorized issuance', async function () {
    await expect(contract.connect(outsider).issueDegree(degreeHash)).to.be.revertedWith('Not authorized');
  });
  it('records the hash and issuer and prevents duplicates', async function () {
    await contract.addIssuer(issuer.address);
    await expect(contract.connect(issuer).issueDegree(degreeHash)).to.emit(contract, 'DegreeIssued');
    const [exists, timestamp, address, university] = await contract.verifyDegree(degreeHash);
    expect(exists).to.equal(true);
    expect(timestamp).to.be.greaterThan(0n);
    expect(address).to.equal(issuer.address);
    expect(university).to.equal('Test University');
    await expect(contract.issueDegree(degreeHash)).to.be.revertedWith('Already attested');
  });
  it('rejects an empty hash', async function () {
    await expect(contract.issueDegree(ethers.ZeroHash)).to.be.revertedWith('Invalid hash');
  });
  it('only lets the owner manage issuers', async function () {
    await expect(contract.connect(outsider).addIssuer(issuer.address)).to.be.revertedWith('Not owner');
    await contract.addIssuer(issuer.address);
    await contract.removeIssuer(issuer.address);
    await expect(contract.connect(issuer).issueDegree(degreeHash)).to.be.revertedWith('Not authorized');
    await expect(contract.removeIssuer(owner.address)).to.be.revertedWith('Cannot remove owner');
  });
  it('reports an unknown degree as absent', async function () {
    expect((await contract.verifyDegree(degreeHash))[0]).to.equal(false);
  });
});
