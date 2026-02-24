import { writeFileSync } from 'fs';
import { ethers } from 'hardhat';

async function main() {
  const Verifier = await ethers.getContractFactory('TurboVerifier');
  const verifier = await Verifier.deploy();

  // get the address of the deployed verifier contract
  const verifierAddr = await verifier.deployed();

  const config = {
    chainId: ethers.provider.network.chainId,
    verifier: verifierAddr.address,
  };

  console.log('Deployed at', config);
  writeFileSync('utils/addresses.json', JSON.stringify(config), { flag: 'w' });
  process.exit();
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
