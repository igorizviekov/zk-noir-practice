import { ethers } from 'hardhat';
import {
  create_proof,
  // @ts-ignore
} from '@noir-lang/barretenberg';
import { NoirServer } from '../utils/noir/noirServer';

const input = { x: 1, y: 1 };

async function main() {
  const Verifier = await ethers.getContractFactory('TurboVerifier');
  const verifier = await Verifier.deploy();

  // get the address of the deployed verifier contract
  const verifierAddr = await verifier.deployed();

  const noir = new NoirServer();
  await noir.compile();
  const correctProof = await create_proof(noir.prover, noir.acir, input);
  const functionGasFees = await verifierAddr.estimateGas.verify(correctProof);
  console.log('Gas cost to call verify(),', functionGasFees.toString());
  process.exit();
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
