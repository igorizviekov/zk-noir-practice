// @ts-ignore
import { NoirBrowser } from '../utils/noir/noirBrowser';
// @ts-ignore
import { poseidon2 } from 'poseidon-lite/poseidon2';

const TREE_DEPTH = 4;
const TREE_LEAF_COUNT = 1 << TREE_DEPTH;
const MAX_NAME_LENGTH = 31;
const FIELD_MODULUS =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

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
  if (normalizedInput.length === 0) {
    throw new Error('Name can not be empty.');
  }

  if (normalizedInput.length > MAX_NAME_LENGTH) {
    throw new Error(`Name must be ${MAX_NAME_LENGTH} characters max.`);
  }

  if (!/^[a-z ]+$/.test(normalizedInput)) {
    throw new Error('Only letters and spaces are allowed.');
  }

  if (nameOptions.length < 2 || nameOptions.length > TREE_LEAF_COUNT) {
    throw new Error('Invalid number of options.');
  }
};

const buildNoirInput = (input: string, nameOptions: string[]) => {
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
  if (leafIndex < 0) {
    throw new Error('Input is not in the current name options.');
  }
  const merkleProof = buildMerkleProof(merkleLevels, leafIndex);

  return {
    user_value: toFieldHex(encodedUserValue),
    merkle_root: toFieldHex(merkleRoot),
    sibling_path: merkleProof.siblingPath.map(toFieldHex),
    path_indices: merkleProof.pathIndices,
  };
};

onmessage = async event => {
  try {
    const { input, nameOptions } = event.data as { input: string; nameOptions: string[] };
    const proofInput = buildNoirInput(input, nameOptions);
    const isHexField = (value: unknown): value is string =>
      typeof value === 'string' && /^0x[0-9a-f]+$/i.test(value);

    const normalizeNoirValue = (value: unknown, key: string): string | string[] | boolean | boolean[] => {
      if (Array.isArray(value)) {
        if (value.every(item => typeof item === 'boolean')) {
          return value as boolean[];
        }
        if (value.every(item => isHexField(item))) {
          return value as string[];
        }
        throw new Error(`Invalid array encoding for ${key}`);
      }

      if (typeof value === 'boolean') {
        return value;
      }

      if (!isHexField(value)) {
        throw new Error(`Invalid field encoding for ${key}`);
      }

      return value;
    };

    const noirInput = Object.entries(proofInput).reduce((newObj, [key, value]) => {
      newObj[key] = normalizeNoirValue(value, key);
      return newObj;
    }, {} as Record<string, string | string[] | boolean | boolean[]>);

    const noir = new NoirBrowser();
    await noir.compile();
    const proof = await noir.createProof({ input: noirInput });
    postMessage(proof);
  } catch (er) {
    console.log(er);
    const message = er instanceof Error ? er.message : 'Unknown proof generation error';
    postMessage({ error: true, message });
  } finally {
    close();
  }
};
