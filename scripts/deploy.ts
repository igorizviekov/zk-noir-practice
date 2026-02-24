import { readFileSync, writeFileSync } from 'fs';
import { artifacts, ethers } from 'hardhat';

function getGeneratedContractName() {
  const verifierPath = 'contract/plonk_vk.sol';
  const source = readFileSync(verifierPath, { encoding: 'utf8' });
  const verifierMatch = source.match(/contract\s+([A-Za-z_]\w*)\s+is\s+BaseZKHonkVerifier\b/);
  const fallbackMatch = source.match(/contract\s+([A-Za-z_]\w*)\s*(?:is[^{]+)?\{/);
  const match = verifierMatch ?? fallbackMatch;

  if (!match?.[1]) {
    throw new Error(`Could not detect contract name in ${verifierPath}`);
  }

  return match[1];
}

async function main() {
  const contractName = getGeneratedContractName();

  const artifact = await artifacts.readArtifact(contractName);
  const libraryNames = Object.values(artifact.linkReferences)
    .flatMap(fileRefs => Object.keys(fileRefs))
    .filter((name, idx, arr) => arr.indexOf(name) === idx);

  const libraries: Record<string, string> = {};
  for (const libraryName of libraryNames) {
    const LibraryFactory = await ethers.getContractFactory(libraryName);
    const library = await LibraryFactory.deploy();
    const deployedLibrary = await library.deployed();
    libraries[libraryName] = deployedLibrary.address;
    console.log(`Deployed library ${libraryName} at ${deployedLibrary.address}`);
  }

  const Verifier = await ethers.getContractFactory(contractName, { libraries });
  const verifier = await Verifier.deploy();

  // get the address of the deployed verifier contract
  const verifierAddr = await verifier.deployed();

  const config = {
    chainId: ethers.provider.network.chainId,
    verifier: verifierAddr.address,
  };

  console.log(`Deployed ${contractName} at`, config);
  writeFileSync('utils/addresses.json', JSON.stringify(config), { flag: 'w' });
  writeFileSync('utils/verifierAbi.json', JSON.stringify(artifact.abi), { flag: 'w' });
  process.exit();
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
