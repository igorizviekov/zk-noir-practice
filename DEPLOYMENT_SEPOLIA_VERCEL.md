## 1) One-time prerequisites (local machine)

Install Node dependencies:

```bash
npm install
```

Install Noir + Barretenberg CLI tools used by `scripts/genContract.ts`:

- `nargo`
- `bb`

Verify both are available:

```bash
nargo --version
bb --help
```

If `bb` is missing, install/update with `noirup` and make sure the binary is in your `PATH`.

## 2) Create and fund your Sepolia deployer wallet

1. Create a dedicated wallet in MetaMask (or use an existing dev wallet).
2. Copy the wallet private key (for deploy script usage).
3. Fund wallet with Sepolia ETH from a faucet.
4. Save wallet address to check transactions on Etherscan Sepolia.

Security tips:

- Never commit private keys.
- Use small test balances only.
- Prefer a dedicated deployer wallet for CI/Vercel.

## 3) Configure local `.env`

Create `.env` in project root (same folder as `package.json`).

Use this template:

```bash
SEPOLIA_DEPLOYER_PRIVATE_KEY="0xYOUR_SEPOLIA_PRIVATE_KEY"
SEPOIA_ALCHEMY_KEY="YOUR_ALCHEMY_API_KEY"
NETWORK="sepolia"
```

Important note for this repo:

## 4) Deploy locally exactly as production flow

Run:

```bash
NETWORK=sepolia npm run build
```

What happens automatically:

1. `scripts/genContract.ts` compiles Noir + generates Solidity verifier.
2. Hardhat compiles contracts.
3. Hardhat deploys verifier (and required libraries) to Sepolia.
4. `scripts/deploy.ts` writes:
   - `utils/addresses.json`
   - `utils/verifierAbi.json`
5. Next.js frontend build runs.

## 5) Validate local app against Sepolia

Start app:

```bash
npm run dev
```

Then in browser:

1. Open app.
2. Connect wallet.
3. Accept network switch to Sepolia (or switch manually in MetaMask).
4. Run one proof flow from UI.
5. Confirm toast/log shows on-chain verification success.

## 6) Quick health checks if verify fails

Check these first:

1. `utils/addresses.json` has:
   - `chainId` = `11155111` (Sepolia)
   - non-empty `verifier` address
2. Wallet currently connected to Sepolia.
3. Deployer transaction exists on Sepolia explorer.
4. Vercel/local build used correct env vars (`NETWORK=sepolia`, `SEPOIA_ALCHEMY_KEY`, private key).
5. `bb` and `nargo` versions are installed and working.

## 7) Configure Vercel project

In Vercel UI:

1. Import repository.
2. Framework preset: **Next.js**.
3. Build command: keep `npm run build`.
4. Install command: keep default (`npm install`).
5. Add environment variables (Production and/or Preview):
   - `NETWORK=sepolia`
   - `SEPOLIA_DEPLOYER_PRIVATE_KEY=0xYOUR_SEPOLIA_PRIVATE_KEY`
   - `SEPOIA_ALCHEMY_KEY=YOUR_ALCHEMY_API_KEY`

Do not expose private key in client-side env vars.

## 8) Deploy on Vercel

Deploy by pushing to your connected branch (or click Deploy in Vercel).

During Vercel build, same flow runs:

1. Generate verifier
2. Deploy to Sepolia
3. Write `utils/addresses.json` and ABI
4. Build and publish frontend

## 9) Post-deploy verification checklist (Vercel URL)

After Vercel deploy completes:

1. Open deployed Vercel URL.
2. Connect wallet and switch to Sepolia.
3. Execute proof flow.
4. Confirm on-chain verification success.
5. Verify deployed contract address in logs/explorer.

## 10) Operational behavior to remember

With current build flow, **every build can deploy a new verifier contract**.

That means:

- Latest built frontend uses latest deployed verifier address.
- Rebuild/redeploy can change verifier address.

This is expected with current design and kept intentionally unchanged.
