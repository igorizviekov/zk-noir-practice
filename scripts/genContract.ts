import { execFileSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

async function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const circuitsDir = path.join(projectRoot, 'circuits');
  const targetDir = path.join(circuitsDir, 'target');
  const artifactPath = path.join(circuitsDir, 'target/circuits.json');
  const vkPath = path.join(targetDir, 'vk');
  const contractDir = path.join(projectRoot, 'contract');
  const outputContractPath = path.join(projectRoot, 'contract/plonk_vk.sol');

  if (!fs.existsSync(contractDir)) {
    fs.mkdirSync(contractDir, { recursive: true });
  }

  execFileSync('nargo', ['compile'], {
    cwd: circuitsDir,
    stdio: 'inherit',
  });

  const bbCheck = spawnSync('bb', ['--help'], { stdio: 'ignore' });
  if (bbCheck.status !== 0) {
    throw new Error('`bb` binary not found. Install it with noirup or add it to PATH.');
  }

  execFileSync('bb', ['write_vk', '-b', artifactPath, '-o', targetDir, '--oracle_hash', 'keccak'], {
    cwd: projectRoot,
    stdio: 'inherit',
  });

  execFileSync('bb', ['write_solidity_verifier', '-k', vkPath, '-o', outputContractPath], {
    cwd: projectRoot,
    stdio: 'inherit',
  });

  if (!fs.existsSync(outputContractPath)) {
    throw new Error(`Verifier contract generation failed; expected ${outputContractPath}`);
  }

  process.exit();
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
