# Noir with Nextjs and Hardhat

## Circuit and Web App Flow

### What the circuit proves

The circuit in `./circuits/src/main.nr` proves Merkle membership over a depth-4 tree:

- private inputs:
  - `user_value: Field`
  - `sibling_path: [Field; 4]`
  - `path_indices: [bool; 4]`
- public input:
  - `merkle_root: Field`

Circuit logic:

1. It first enforces `assert(user_value != 0)` to reject the padded zero leaf case.
2. It computes the leaf as Poseidon hash of `[user_value, 0]`.
3. It converts `path_indices` (little-endian bits) into the leaf index.
4. It recomputes the Merkle root from the leaf + sibling path.
5. It asserts recomputed root equals the public `merkle_root`.

If all constraints pass, the prover has shown they know a value whose leaf exists in the committed
Merkle tree, without revealing which leaf.

### How it works with the web app

The app-side flow is:

1. `components/component.tsx` displays random name options and user input.
2. On "Calculate proof", the UI starts a Web Worker from `utils/prover.ts`.
3. The worker:
   - normalizes/validates input,
   - encodes names to field elements,
   - builds a depth-4 Poseidon Merkle tree in JS,
   - finds the matching leaf index (throws if input is not in options),
   - generates `sibling_path`, `path_indices`, and `merkle_root`,
   - compiles the Noir artifact and creates a proof with NoirJS + bb.js.
4. The worker returns either:
   - proof payload, or
   - `{ error: true, message }` (serializable error payload).
5. The UI receives the result and calls the deployed verifier contract via ethers.
6. Contract verification uses the generated proof and public inputs (`merkle_root`), then the UI
   displays success/failure toast notifications.

In short: the browser builds a private witness and ZK proof, while on-chain verification only checks
the proof against public inputs and never sees the secret user value.

## Getting Started

This example uses [Next.js](https://nextjs.org/) as the frontend framework, and
[Hardhat](https://hardhat.org/) to deploy.

1. Install dependencies with

```bash
npm i
```

2. Install a matching Noir toolchain:

```bash
noirup -v 1.0.0-beta.19
```

3. Write circuits in `./circuits/src`.

4. Compile the circuit artifact used by NoirJS:

```bash
cd circuits
nargo compile
cd ..
```

5. Create the verifier contract

Although the `npm build` already generates and compiles the circuits before deploying, you can
manually create the Solidity verifier contract:

- natively by navigating to the `.circuits/` directory and running `nargo codegen-verifier`. If you
  generate the verifier contract via this method, you may need to copy the file created at
  `./circuits/contract/plonk_vk.sol` to the hardhat contract directory at `./contract`.
- with wasm by running the `genContract.ts` script:

```bash
npx ts-node scripts/genContract.ts
```

6. Create proofs

**Natively**

In `./circuits`:

- Compile your circuits if you haven't already with `nargo compile <CIRCUIT_NAME>`.
- Populate the inputs in `Prover.toml`
- Generate proof with `nargo prove <proof_name>`

7. Verify proofs

**Natively**

In `./circuits`:

- Verify proof with `nargo verify <proof_name>`

8. Deploy

- Start a local development EVM at <http://localhost:8545>, for example with `npx hardhat node`.
- Copy `./.env.example` to `./.env` and add keys for alchemy (to act as a node) and the deployer's
  private key. Make sure you have funds in this account.
- Run `NETWORK=localhost npm build` to build the project and deploy contracts to the local
  development chain
