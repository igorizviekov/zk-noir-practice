import path from 'path';
import fs from 'fs';
import { Noir } from './noir';

export class NoirServer extends Noir {
  private projectRoot = path.join(__dirname, '../../');
  private targetDir = path.join(this.projectRoot, 'circuits/target');
  private circuitArtifactPath = path.join(this.targetDir, 'circuits.json');

  async compile() {
    if (!fs.existsSync(this.circuitArtifactPath)) {
      throw new Error('Circuit artifact missing at circuits/target/circuits.json. Run `nargo compile` in circuits/ first.');
    }
    const circuit = JSON.parse(fs.readFileSync(this.circuitArtifactPath, { encoding: 'utf8' }));
    await this.init(circuit);
  }

  async generateVerifierContract() {
    const contractDir = path.join(this.projectRoot, 'contract');
    if (!fs.existsSync(contractDir)) {
      console.log('Contract folder does not exist. Creating...');
      fs.mkdirSync(contractDir, { recursive: true });
    }

    const verifierContractPath = path.join(contractDir, 'plonk_vk.sol');
    if (fs.existsSync(verifierContractPath)) {
      fs.unlinkSync(verifierContractPath);
    }

    const solidityVerifier = await this.backend.getSolidityVerifier();
    fs.writeFileSync(verifierContractPath, solidityVerifier, { encoding: 'utf8', flag: 'w' });

    return verifierContractPath;
  }
}
