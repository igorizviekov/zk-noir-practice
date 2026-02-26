import { NoirBrowser } from '../utils/noir/noirBrowser';
import { poseidon2 } from 'poseidon-lite/poseidon2';

const TREE_DEPTH = 4;
const TREE_LEAF_COUNT = 1 << TREE_DEPTH;
const MAX_NAME_LENGTH = 31;
const FIELD_MODULUS =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

type WorkerRequest = {
  input: string;
  nameOptions: string[];
};

type NoirInput = {
  user_value: string;
  merkle_root: string;
  sibling_path: string[];
  path_indices: boolean[];
};

type FailureBenchmarks = {
  failedStage: string;
  elapsedMs: number;
  inputBuildMs?: number;
  compileMs?: number;
  witnessMs?: number;
  proveMs?: number;
};

const normalizeName = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();

const modField = (value: bigint) => {
  const reduced = value % FIELD_MODULUS;
  return reduced >= 0n ? reduced : reduced + FIELD_MODULUS;
};

const toFieldHex = (value: bigint) => `0x${modField(value).toString(16)}`;

const encodeToField = (value: string) => {
  const normalized = normalizeName(value);
  let encoded = 0n;
  for (const char of normalized) {
    encoded = (encoded << 8n) + BigInt(char.charCodeAt(0));
  }
  return modField(encoded);
};

const poseidonHash2 = (left: bigint, right: bigint) => {
  const hash = poseidon2([toFieldHex(left), toFieldHex(right)]);
  return modField(hash);
};

const hashLeaf = (value: bigint) => poseidonHash2(value, 0n);

const hashNode = (left: bigint, right: bigint) => poseidonHash2(left, right);

const buildMerkleLevels = (leaves: bigint[]) => {
  let currentLevel = leaves.map(hashLeaf);
  const levels: bigint[][] = [currentLevel];

  for (let depth = 0; depth < TREE_DEPTH; depth++) {
    const nextLevel: bigint[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      nextLevel.push(hashNode(currentLevel[i], currentLevel[i + 1]));
    }
    levels.push(nextLevel);
    currentLevel = nextLevel;
  }

  return levels;
};

const buildMerkleProof = (levels: bigint[][], leafIndex: number) => {
  let currentIndex = leafIndex;
  const siblingPath: bigint[] = [];
  const pathIndices: boolean[] = [];

  for (let depth = 0; depth < TREE_DEPTH; depth++) {
    const isRightNode = currentIndex % 2 === 1;
    const siblingIndex = isRightNode ? currentIndex - 1 : currentIndex + 1;
    siblingPath.push(levels[depth][siblingIndex]);
    pathIndices.push(isRightNode);
    currentIndex = Math.floor(currentIndex / 2);
  }

  return { siblingPath, pathIndices };
};

const validateWorkerInput = (input: string, nameOptions: string[]) => {
  const normalizedInput = normalizeName(input);
  if (normalizedInput.length > MAX_NAME_LENGTH) {
    throw new Error(`Name must be ${MAX_NAME_LENGTH} characters max.`);
  }

  if (nameOptions.length < 2 || nameOptions.length > TREE_LEAF_COUNT) {
    throw new Error('validateWorkerInput: Invalid number of options.');
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object';

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string');

const parseWorkerRequest = (value: unknown): WorkerRequest => {
  if (!isRecord(value) || typeof value.input !== 'string' || !isStringArray(value.nameOptions)) {
    throw new Error('Invalid worker input payload.');
  }

  return { input: value.input, nameOptions: value.nameOptions };
};

const buildNoirInput = (input: string, nameOptions: string[]): NoirInput => {
  validateWorkerInput(input, nameOptions);

  const encodedUserValue = encodeToField(input);
  const encodedOptionValues = nameOptions.map(encodeToField);
  const paddedLeaves = [...encodedOptionValues];
  while (paddedLeaves.length < TREE_LEAF_COUNT) {
    paddedLeaves.push(0n);
  }

  const merkleLevels = buildMerkleLevels(paddedLeaves);
  const merkleRoot = merkleLevels[TREE_DEPTH][0];
  const leafIndex = encodedOptionValues.findIndex(option => option === encodedUserValue);
  const proofLeafIndex = leafIndex >= 0 ? leafIndex : 0;
  const merkleProof = buildMerkleProof(merkleLevels, proofLeafIndex);

  return {
    user_value: toFieldHex(encodedUserValue),
    merkle_root: toFieldHex(merkleRoot),
    sibling_path: merkleProof.siblingPath.map(toFieldHex),
    path_indices: merkleProof.pathIndices,
  };
};

onmessage = async (event: MessageEvent<unknown>) => {
  const startedAt = performance.now();
  let failedStage = 'worker_init';
  let inputBuildMs: number | undefined;
  let compileMs: number | undefined;
  try {
    failedStage = 'request_parse';
    const { input, nameOptions } = parseWorkerRequest(event.data);
    failedStage = 'input_build';
    const inputBuildStart = performance.now();
    const noirInput = buildNoirInput(input, nameOptions);
    inputBuildMs = performance.now() - inputBuildStart;

    failedStage = 'circuit_compile';
    const noir = new NoirBrowser();
    const compileStart = performance.now();
    await noir.compile();
    compileMs = performance.now() - compileStart;
    failedStage = 'proof_generation';
    const proofResult = await noir.createProof({ input: noirInput });
    const { proof, witnessMs, proveMs } = proofResult;
    postMessage({
      proofData: proof,
      benchmarks: {
        inputBuildMs,
        compileMs,
        witnessMs,
        proveMs,
      },
    });
  } catch (er) {
    const message = er instanceof Error ? er.message : 'Unknown proof generation error';
    const benchmarks: FailureBenchmarks = {
      failedStage,
      elapsedMs: performance.now() - startedAt,
      inputBuildMs,
      compileMs,
    };
    if (isRecord(er) && isRecord(er.benchmark)) {
      const benchmark = er.benchmark;
      if (typeof benchmark.failedStage === 'string') {
        failedStage = benchmark.failedStage;
        benchmarks.failedStage = benchmark.failedStage;
      }
      if (typeof benchmark.witnessMs === 'number') {
        benchmarks.witnessMs = benchmark.witnessMs;
      }
      if (typeof benchmark.proveMs === 'number') {
        benchmarks.proveMs = benchmark.proveMs;
      }
    }
    postMessage({ error: true, message, benchmarks });
  } finally {
    close();
  }
};
