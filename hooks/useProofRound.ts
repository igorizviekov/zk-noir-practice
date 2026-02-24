import { useCallback, useState } from 'react';

const MAX_NAME_LENGTH = 31;
const TREE_DEPTH = 4;
const TREE_LEAF_COUNT = 1 << TREE_DEPTH;
const NAME_POOL = [
  'Alice',
  'Bob',
  'Charlie',
  'Diana',
  'Ethan',
  'Fiona',
  'Grace',
  'Henry',
  'Ivy',
  'Jack',
  'Luna',
  'Mason',
];

const pickRandomNames = (pool: string[], count: number) => {
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const randomIdx = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[randomIdx]] = [shuffled[randomIdx], shuffled[i]];
  }
  return shuffled.slice(0, count);
};

export function useProofRound() {
  const [input, setInput] = useState('');
  const [nameOptions, setNameOptions] = useState<string[]>([]);

  const resetRound = useCallback(() => {
    const randomCount =
      Math.floor(Math.random() * (Math.min(NAME_POOL.length, TREE_LEAF_COUNT) - 1)) + 2;
    setNameOptions(pickRandomNames(NAME_POOL, randomCount));
    setInput('');
  }, []);

  return {
    input,
    setInput,
    nameOptions,
    resetRound,
    maxOptions: TREE_LEAF_COUNT,
    maxNameLength: MAX_NAME_LENGTH,
  };
}
