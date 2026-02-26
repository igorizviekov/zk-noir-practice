## Circuit and Web App Flow

### Circuit

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

## Benchmark

The app benchmarks include witness preparation time, proof generation time, verification time.

Benchmark output is logged in the browser console.

## Quick Start

```bash
npx hardhat node
NETWORK=localhost npm run build
npm run dev
```
