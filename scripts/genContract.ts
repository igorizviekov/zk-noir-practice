import { NoirServer } from '../utils/noir/noirServer';

async function main() {
  const noir = new NoirServer();
  await noir.compile();
  noir.getSmartContract();
  process.exit();
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
