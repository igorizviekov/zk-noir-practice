import React, { useEffect, useState } from 'react';
import { ThreeDots } from 'react-loader-spinner';
import { toast } from 'react-toastify';
import Ethers from '../utils/ethers';
import { useProofRound } from '../hooks/useProofRound';

type WorkerErrorPayload = {
  error: true;
  message: string;
  benchmarks?: {
    failedStage: string;
    elapsedMs: number;
    inputBuildMs?: number;
    compileMs?: number;
    witnessMs?: number;
    proveMs?: number;
  };
};

type ProofBenchmarks = {
  inputBuildMs: number;
  compileMs: number;
  witnessMs: number;
  proveMs: number;
};

type PartialProofBenchmarks = Partial<ProofBenchmarks>;

type WorkerSuccessPayload = {
  proofData: unknown;
  benchmarks?: PartialProofBenchmarks;
};

const BENCH_GROUP_STYLES = {
  success: 'color: #166534; font-weight: 700;',
  failure: 'color: #b91c1c; font-weight: 700;',
} as const;

const isWorkerErrorPayload = (value: unknown): value is WorkerErrorPayload =>
  (() => {
    if (value === null || typeof value !== 'object') return false;
    const record = value as Record<string, unknown>;
    if (record.error !== true || typeof record.message !== 'string') return false;
    if (!('benchmarks' in record) || !record.benchmarks) return true;
    if (record.benchmarks === null || typeof record.benchmarks !== 'object') return false;
    const benchmarks = record.benchmarks as Record<string, unknown>;
    const optionalNumberFields = ['inputBuildMs', 'compileMs', 'witnessMs', 'proveMs'] as const;
    return (
      typeof benchmarks.failedStage === 'string' &&
      typeof benchmarks.elapsedMs === 'number' &&
      optionalNumberFields.every(key => !(key in benchmarks) || typeof benchmarks[key] === 'number')
    );
  })();

const isProofBenchmarks = (value: unknown): value is PartialProofBenchmarks =>
  (() => {
    if (value === null || typeof value !== 'object') return false;
    const record = value as Record<string, unknown>;
    const optionalNumberFields = ['inputBuildMs', 'compileMs', 'witnessMs', 'proveMs'] as const;
    return optionalNumberFields.every(key => !(key in record) || typeof record[key] === 'number');
  })();

const isWorkerSuccessPayload = (value: unknown): value is WorkerSuccessPayload =>
  (() => {
    if (value === null || typeof value !== 'object') return false;
    const record = value as Record<string, unknown>;
    return (
      'proofData' in record &&
      (!('benchmarks' in record) ||
        record.benchmarks === undefined ||
        isProofBenchmarks(record.benchmarks))
    );
  })();

const getPublicInputs = (value: unknown): string[] => {
  if (
    value === null ||
    typeof value !== 'object' ||
    !('publicInputs' in value) ||
    !Array.isArray(value.publicInputs)
  ) {
    return [];
  }

  return value.publicInputs.filter((item): item is string => typeof item === 'string');
};

const getProofForChain = (value: unknown): unknown => {
  if (value !== null && typeof value === 'object' && 'proof' in value) {
    return value.proof;
  }

  return value;
};

const logBenchGroupStart = (path: 'success' | 'failure') => {
  console.group('%c[ZK:Bench][UI] Proof Pipeline', BENCH_GROUP_STYLES[path]);
};

const STAGE_ORDER: Record<string, number> = {
  request_parse: 0,
  input_build: 0,
  circuit_compile: 1,
  witness_build: 2,
  proof_generation: 3,
};

const PIPELINE_STAGES: Array<{
  order: number;
  label: string;
  key: keyof ProofBenchmarks;
}> = [
  { order: 0, label: '[ZK:Worker][InputBuild] buildNoirInput()', key: 'inputBuildMs' },
  { order: 1, label: '[ZK:Worker][Compile] noir.compile()', key: 'compileMs' },
  { order: 2, label: '[ZK:Worker][WitnessBuild] noir.execute()', key: 'witnessMs' },
  { order: 3, label: '[ZK:Worker][ProofGen] backend.generateProof()', key: 'proveMs' },
];

const formatMs = (value: number) => `${value.toFixed(2)} ms`;

const logPipelineLines = (params: {
  path: 'success' | 'failure';
  workerBenchmarks?: PartialProofBenchmarks & { failedStage?: string; elapsedMs?: number };
  onchainVerifyMs?: number;
  onchainStatus: 'ok' | 'failed' | 'skipped';
}) => {
  const { path, workerBenchmarks, onchainVerifyMs, onchainStatus } = params;
  const failedStage = workerBenchmarks?.failedStage;
  const elapsedMs = workerBenchmarks?.elapsedMs;
  const failedOrder =
    path === 'failure' && failedStage && failedStage in STAGE_ORDER
      ? STAGE_ORDER[failedStage]
      : Number.POSITIVE_INFINITY;

  const formatStageValue = (order: number, ms?: number) => {
    if (path === 'success' || order < failedOrder) {
      return typeof ms === 'number' ? formatMs(ms) : 'n/a';
    }
    if (order > failedOrder) return 'skipped';
    if (typeof ms === 'number') return `failed at ${formatMs(ms)}`;
    if (typeof elapsedMs === 'number') return `failed by ${formatMs(elapsedMs)}`;
    return 'failed';
  };

  PIPELINE_STAGES.forEach(stage => {
    console.log(`${stage.label}: ${formatStageValue(stage.order, workerBenchmarks?.[stage.key])}`);
  });

  const onchainText =
    onchainStatus === 'ok' && typeof onchainVerifyMs === 'number'
      ? formatMs(onchainVerifyMs)
      : onchainStatus === 'failed' && typeof onchainVerifyMs === 'number'
      ? `failed at ${formatMs(onchainVerifyMs)}`
      : 'skipped';

  console.log(`[ZK:OnChain][VerifyCall] contract.verify(): ${onchainText}`);
};

function Component() {
  const { input, setInput, nameOptions, resetRound, maxOptions, maxNameLength } = useProofRound();
  const [pending, setPending] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !pending) {
      e.preventDefault();
      void calculateProof();
    }
  };

  const verifyProof = async (proofData: unknown, workerBenchmarks?: PartialProofBenchmarks) => {
    const onchainVerifyStart = performance.now();
    try {
      const ethers = new Ethers();
      const proofForChain = getProofForChain(proofData);
      const publicInputsForChain = getPublicInputs(proofData).map(value =>
        value.startsWith('0x') ? value : `0x${value}`,
      );
      const verified = await ethers.contract.verify(proofForChain, publicInputsForChain);
      const onchainVerifyMs = performance.now() - onchainVerifyStart;

      logBenchGroupStart(verified ? 'success' : 'failure');
      logPipelineLines({
        path: verified ? 'success' : 'failure',
        workerBenchmarks,
        onchainVerifyMs,
        onchainStatus: 'ok',
      });
      console.groupEnd();

      if (verified) {
        toast.success('Proof was verified on-chain');
      } else {
        toast.error('Proof was not verified on-chain');
      }
    } catch {
      const onchainVerifyMs = performance.now() - onchainVerifyStart;
      logBenchGroupStart('failure');
      logPipelineLines({
        path: 'failure',
        workerBenchmarks,
        onchainVerifyMs,
        onchainStatus: 'failed',
      });
      console.groupEnd();
      toast.error('On-chain verification reverted');
    }
  };

  const calculateProof = async () => {
    if (pending) return;

    if (nameOptions.length < 2 || nameOptions.length > maxOptions) {
      toast.error('Name options are not ready yet. Try again.');
      return;
    }

    setPending(true);
    const worker = new Worker(new URL('../utils/prover.ts', import.meta.url));
    worker.onmessage = async (e: MessageEvent<unknown>) => {
      const workerResult = e.data;
      if (isWorkerErrorPayload(workerResult)) {
        if (workerResult.benchmarks) {
          logBenchGroupStart('failure');
          logPipelineLines({
            path: 'failure',
            workerBenchmarks: workerResult.benchmarks,
            onchainStatus: 'skipped',
          });
          console.groupEnd();
        }
        toast.error(workerResult.message || 'Proof generation failed');
        setPending(false);
        resetRound();
      } else {
        if (isWorkerSuccessPayload(workerResult)) {
          await verifyProof(
            workerResult.proofData,
            isProofBenchmarks(workerResult.benchmarks) ? workerResult.benchmarks : undefined,
          );
        } else {
          await verifyProof(workerResult);
        }
        setPending(false);
        resetRound();
      }
      worker.terminate();
    };
    worker.onerror = () => {
      toast.error('Proof generation failed');
      setPending(false);
      resetRound();
      worker.terminate();
    };
    worker.postMessage({ input, nameOptions });
  };

  useEffect(() => {
    resetRound();
    new Ethers();
  }, []);

  return (
    <div className="flex flex-col items-center font-mono w-full px-2 sm:px-4">
      <div className="w-full max-w-4xl p-6 sm:p-10 md:p-14 mt-24 mb-10 border-2 border-black text-center bg-white shadow-2xl overflow-hidden">
        <div>
          <h1 className="text-3xl font-bold">ZK proof with Noir</h1>
          <h2 className="text-xl py-5">
            This app checks whether the entered input is in the current random list, and confirms it
            without revealing the input to the blockchain.
          </h2>
        </div>

        <div className="flex flex-row flex-wrap gap-10 pt-10 items-start justify-center">
          <div className="w-full md:w-[360px] text-left">
            <label className="block text-sm font-semibold mb-2" htmlFor="name-input">
              Your name
            </label>
            <input
              id="name-input"
              className="bg-gray-200 w-full h-14 px-4 text-2xl focus:outline-none rounded"
              name="name"
              type="text"
              onChange={handleChange}
              onKeyDown={handleInputKeyDown}
              value={input}
              placeholder="Type a name"
            />
          </div>

          <div className="w-full md:w-[240px] text-left min-w-0 max-w-full">
            <p className="text-sm font-semibold mb-2">Valid names ({nameOptions.length})</p>
            <ul className="w-full max-w-full bg-gray-100 rounded p-3 space-y-2 max-h-64 overflow-y-auto overflow-x-hidden">
              {nameOptions.map(name => (
                <li className="text-lg break-all" key={name}>
                  {name}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="flex justify-center h-24 ">
          {pending && <ThreeDots wrapperClass="spinner" color="#a855f7" height={100} width={100} />}
        </div>
        <div className="w-full pb-5">
          <button
            className="text-white shadow-3xl py-3 w-[80%] bg-gradient-to-r from-neutral-950 via-indigo-950 to-purple-900 transform transition-all duration-700 ease-out hover:scale-[1.02] hover:brightness-125 hover:shadow-[0_0_24px_rgba(168,85,247,0.55)] hover:bg-gradient-to-r hover:from-indigo-700 hover:via-purple-600 hover:to-pink-500 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:brightness-100 disabled:hover:shadow-none disabled:hover:from-neutral-950 disabled:hover:via-indigo-950 disabled:hover:to-purple-900"
            onClick={calculateProof}
            disabled={pending}
          >
            Verify
          </button>
        </div>
      </div>
    </div>
  );
}

export default Component;
