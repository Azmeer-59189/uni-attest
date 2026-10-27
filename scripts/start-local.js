const fs = require('fs');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const serverDir = path.join(root, 'server');
const chainDir = path.join(root, 'blockchain');
const clientDir = path.join(root, 'client');
const children = new Set();
const apiPort = Number(process.env.LOCAL_API_PORT || 5000);
const webPort = Number(process.env.LOCAL_WEB_PORT || 5173);
const chainPort = Number(process.env.LOCAL_CHAIN_PORT || 8545);
const rpcUrl = `http://127.0.0.1:${chainPort}`;
let stopping = false;
let provider;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  provider?.destroy();
  for (const child of children) child.kill();
  if (process.connected) process.disconnect();
  process.exitCode = code;
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
process.on('message', message => { if (message === 'stop') stop(); });
process.on('exit', () => { for (const child of children) child.kill(); });

function start(file, args, cwd, env = {}, quiet = false) {
  const child = spawn(process.execPath, [file, ...args], {
    cwd, env: { ...process.env, ...env }, stdio: quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit', windowsHide: true
  });
  children.add(child);
  if (quiet) { child.stdout.on('data', () => {}); child.stderr.on('data', () => {}); }
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', code => {
    children.delete(child);
    if (!stopping && code !== 0) { console.error(`A local development process exited (${code}).`); stop(1); }
  });
  return child;
}
function freePort(port) {
  return new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.once('error', () => reject(new Error(`Port ${port} is in use. Stop the existing backend/frontend terminals with Ctrl+C, then rerun npm run dev:local.`)));
    socket.listen(port, '127.0.0.1', () => socket.close(resolve));
  });
}

async function main() {
  const { ethers } = require(require.resolve('ethers', { paths: [serverDir] }));
  const dotenv = require(require.resolve('dotenv', { paths: [serverDir] }));
  const config = dotenv.parse(fs.readFileSync(path.join(serverDir, '.env')));
  if (!(process.env.JWT_SECRET || config.JWT_SECRET) || !(process.env.REFRESH_TOKEN_SECRET || config.REFRESH_TOKEN_SECRET)) throw new Error('Configure server/.env with JWT_SECRET and REFRESH_TOKEN_SECRET first.');
  for (const port of [apiPort, webPort, chainPort]) if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid local development port.');
  await Promise.all([freePort(apiPort), freePort(webPort), freePort(chainPort)]);
  const cli = path.join(chainDir, 'node_modules/hardhat/internal/cli/cli.js');
  console.log('Compiling the contract for the local test blockchain...');
  const compile = start(cli, ['compile'], chainDir, { PRIVATE_KEY: '' }, true);
  await new Promise((resolve, reject) => {
    compile.once('error', reject);
    compile.once('exit', code => code === 0 ? resolve() : reject(new Error('Contract compilation failed. Run npm run compile in blockchain for details.')));
  });
  if (stopping) return;
  console.log(`Starting Hardhat on localhost:${chainPort} with pre-funded test accounts...`);
  const node = start(cli, ['node', '--hostname', '127.0.0.1', '--port', String(chainPort)], chainDir, { PRIVATE_KEY: '' }, true);
  const rpc = new ethers.FetchRequest(rpcUrl);
  rpc.timeout = 1500;
  provider = new ethers.JsonRpcProvider(rpc, 1337, { staticNetwork: true, batchMaxCount: 1 });
  let ready = false;
  for (let attempt = 0; attempt < 60 && !stopping; attempt++) {
    if (node.exitCode != null) break;
    try { ready = BigInt(await provider.send('eth_chainId', [])) === 1337n; } catch (_) {}
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (stopping) return;
  if (!ready) throw new Error(`The local blockchain did not start on port ${chainPort}.`);
  const artifact = JSON.parse(fs.readFileSync(path.join(chainDir, 'artifacts/contracts/DegreeAttestation.sol/DegreeAttestation.json')));
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, await provider.getSigner(0));
  const university = process.env.UNIVERSITY_NAME || config.UNIVERSITY_NAME || 'University';
  const contract = await factory.deploy(university);
  await contract.waitForDeployment();
  if (stopping) return;
  const address = await contract.getAddress();
  console.log(`Local contract deployed: ${address}`);
  start(path.join(serverDir, 'src/app.js'), [], serverDir, {
    BLOCKCHAIN_NETWORK: 'local', BLOCKCHAIN_RPC_URL: rpcUrl,
    CONTRACT_ADDRESS: address, BLOCKCHAIN_REQUIRED: 'true', PORT: String(apiPort), CLIENT_URL: `http://localhost:${webPort}`
  });
  start(path.join(clientDir, 'node_modules/vite/bin/vite.js'), ['--host', '127.0.0.1', '--port', String(webPort), '--strictPort'], clientDir, { API_PROXY_TARGET: `http://127.0.0.1:${apiPort}` });
  console.log(`\nOpen http://localhost:${webPort} and use your existing login.`);
  console.log('Local test funds only. No wallet export, mining, or public-chain transaction is needed.');
  console.log('Keep this terminal open. Ctrl+C stops the stack; restarting resets the test blockchain.');
}

main().catch(error => { console.error(error.message); stop(1); });
