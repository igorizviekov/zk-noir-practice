import React, { useEffect, useState } from 'react';
import { ThreeDots } from 'react-loader-spinner';
import { toast } from 'react-toastify';
import Ethers from '../utils/ethers';
import { useProofRound } from '../hooks/useProofRound';

type GeneratedProof = {
  proof?: unknown;
  publicInputs?: string[];
};

type WorkerErrorPayload = {
  error: true;
  message: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object';

const isWorkerErrorPayload = (value: unknown): value is WorkerErrorPayload =>
  isRecord(value) && value.error === true && typeof value.message === 'string';

const getPublicInputs = (value: unknown): string[] => {
  if (!isRecord(value) || !('publicInputs' in value) || !Array.isArray(value.publicInputs)) {
    return [];
  }

  return value.publicInputs.filter((item): item is string => typeof item === 'string');
};

const getProofForChain = (value: unknown): unknown => {
  if (isRecord(value) && 'proof' in value) {
    return value.proof;
  }

  return value;
};

function Component() {
  const { input, setInput, nameOptions, resetRound, maxOptions, maxNameLength } = useProofRound();
  const [pending, setPending] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const verifyProof = async (proofData: unknown) => {
    try {
      const ethers = new Ethers();
      const proofForChain = getProofForChain(proofData);
      const publicInputsForChain = getPublicInputs(proofData).map(value =>
        value.startsWith('0x') ? value : `0x${value}`,
      );
      const verified = await ethers.contract.verify(proofForChain, publicInputsForChain);

      if (verified) {
        toast.success('Proof was verified on-chain');
      } else {
        toast.error('Proof was not verified on-chain');
      }
    } catch (error) {
      toast.error('On-chain verification reverted');
      console.error(error);
    }
  };

  const calculateProof = async () => {
    if (nameOptions.length < 2 || nameOptions.length > maxOptions) {
      toast.error('Name options are not ready yet. Try again.');
      return;
    }

    setPending(true);
    const worker = new Worker(new URL('../utils/prover.ts', import.meta.url));
    worker.onmessage = async (e: MessageEvent<unknown>) => {
      const workerResult = e.data;
      if (isWorkerErrorPayload(workerResult)) {
        toast.error(workerResult.message || 'Proof generation failed');
        setPending(false);
        resetRound();
      } else {
        setPending(false);
        resetRound();
        await verifyProof(workerResult);
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
    <div className="flex flex-col items-center font-mono ">
      <div className="p-14 mt-24 mb-10 border-2 border-black text-center bg-white shadow-2xl">
        <div>
          <h1 className="text-3xl font-bold">ZK proof with Noir</h1>
          <h2 className="text-xl py-5">
            This circuit proves if your input is one of the randomly selected names.
          </h2>
        </div>

        <div className="flex flex-row flex-wrap gap-10 pt-10 items-start">
          <div className="w-full md:w-[360px] text-left">
            <label className="block text-sm font-semibold mb-2" htmlFor="name-input">
              Your input
            </label>
            <input
              id="name-input"
              className="bg-gray-200 w-full h-14 px-4 text-2xl focus:outline-none rounded"
              name="name"
              type="text"
              onChange={handleChange}
              value={input}
              placeholder="Type a name"
            />
            <p className="text-xs text-gray-600 mt-2">{maxNameLength} characters maximum</p>
          </div>

          <div className="w-full md:w-[240px] text-left">
            <p className="text-sm font-semibold mb-2">Names ({nameOptions.length})</p>
            <ul className="bg-gray-100 rounded p-3 space-y-2">
              {nameOptions.map(name => (
                <li className="text-lg" key={name}>
                  {name}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="flex justify-center h-24 ">
          {pending && <ThreeDots wrapperClass="spinner" color="#000000" height={100} width={100} />}
        </div>
        <div className="w-full pb-5">
          <button
            className="text-white shadow-3xl py-3 w-[80%] bg-gradient-to-r from-neutral-950 via-indigo-950 to-purple-900 hover:bg-gradient-to-l"
            onClick={calculateProof}
          >
            Calculate proof
          </button>
        </div>
      </div>
    </div>
  );
}

export default Component;
