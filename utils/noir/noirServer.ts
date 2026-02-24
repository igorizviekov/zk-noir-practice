import initNoirWasm, { acir_read_bytes, compile } from '@noir-lang/noir_wasm';
// @ts-ignore
import { initialiseResolver } from '@noir-lang/noir-source-resolver';
// @ts-ignore
import { setup_generic_prover_and_verifier } from '@noir-lang/barretenberg';
import path from 'path';
import fs from 'fs';
import { Noir } from './noir';

export class NoirServer extends Noir {
  async compile() {
    initialiseResolver((id: any) => {
      try {
        const code = fs.readFileSync(`circuits/src/${id}`, { encoding: 'utf8' }) as string;
        return code;
      } catch (err) {
        console.error(err);
        throw err;
      }
    });

    const compiled_noir = compile({
      entry_point: 'main.nr',
    });
    this.compiled = compiled_noir;

    this.acir = acir_read_bytes(this.compiled.circuit);

    [this.prover, this.verifier] = await setup_generic_prover_and_verifier(this.acir);
  }

  getSmartContract() {
    const sc = this.verifier.SmartContract();

    if (!fs.existsSync(path.join(__dirname, '../../contract'))) {
      console.log('Contract folder does not exist. Creating...');
      fs.mkdirSync(path.join(__dirname, '../../contract'));
    }

    if (fs.existsSync(path.join(__dirname, '../../contract/plonk_vk.sol'))) {
      fs.unlinkSync(path.join(__dirname, '../../contract/plonk_vk.sol'));
    }

    fs.writeFileSync(path.join(__dirname, '../../contract/plonk_vk.sol'), sc, {
      flag: 'w',
    });

    return sc;
  }
}
