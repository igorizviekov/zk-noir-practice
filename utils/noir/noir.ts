import { Barretenberg, UltraHonkBackend } from '@aztec/bb.js';
import { Noir as NoirJs } from '@noir-lang/noir_js';

export class Noir {
    backend: any;
    noir: any;
    circuit: any;
    protected readonly proofOptions = { verifierTarget: 'evm' as const };

    protected async init(circuit: any) {
        this.circuit = circuit;
        this.noir = new NoirJs(circuit);
        const bbApi = await Barretenberg.new();
        this.backend = new UltraHonkBackend(circuit.bytecode, bbApi);
    }

    async createProof({input} : {input: any}) {
        const { witness } = await this.noir.execute(input);
        return this.backend.generateProof(witness, this.proofOptions);
    }

    async verifyProof({proof} : {proof: any}) {
        return this.backend.verifyProof(proof, this.proofOptions);
    }
}
