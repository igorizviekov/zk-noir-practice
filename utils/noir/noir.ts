import { Barretenberg, UltraHonkBackend } from '@aztec/bb.js';
import { Noir as NoirJs } from '@noir-lang/noir_js';

type ProofStageBenchmark = {
    failedStage: 'witness_build' | 'proof_generation';
    witnessMs?: number;
    proveMs?: number;
};

const createBenchmarkError = (error: unknown, benchmark: ProofStageBenchmark) => {
    const wrapped = error instanceof Error ? error : new Error('Proof generation failed');
    Object.assign(wrapped, { benchmark });
    return wrapped;
};

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
        const witnessStart = performance.now();
        let witness: unknown;
        let witnessMs = 0;
        try {
            const witnessResult = await this.noir.execute(input);
            witness = witnessResult.witness;
            witnessMs = performance.now() - witnessStart;
        } catch (error) {
            throw createBenchmarkError(error, {
                failedStage: 'witness_build',
                witnessMs: performance.now() - witnessStart,
            });
        }

        const proveStart = performance.now();
        let proof: unknown;
        let proveMs = 0;
        try {
            proof = await this.backend.generateProof(witness, this.proofOptions);
            proveMs = performance.now() - proveStart;
        } catch (error) {
            throw createBenchmarkError(error, {
                failedStage: 'proof_generation',
                witnessMs,
                proveMs: performance.now() - proveStart,
            });
        }

        return { proof, witnessMs, proveMs };
    }

    async verifyProof({proof} : {proof: any}) {
        const verifyStart = performance.now();
        const verified = await this.backend.verifyProof(proof, this.proofOptions);
        const offchainVerifyMs = performance.now() - verifyStart;

        return { verified, offchainVerifyMs };
    }
}
