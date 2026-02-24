// @ts-ignore
import { NoirBrowser } from '../utils/noir/noirBrowser';

onmessage = async event => {
  try {
    const { input } = event.data;
    const hexInputObj = Object.entries(input).reduce((newObj, [key, value]) => {
      const numericValue = Number(value);
      if (!Number.isFinite(numericValue) || numericValue < 0) {
        throw new Error(`Invalid input for ${key}`);
      }
      newObj[key] = `0x${numericValue.toString(16).padStart(2, '0')}`;
      return newObj;
    }, {} as Record<string, string>);

    const noir = new NoirBrowser();
    await noir.compile();
    const proof = await noir.createProof({ input: hexInputObj });
    postMessage(proof);
  } catch (er) {
    console.log(er);
    postMessage(er);
  } finally {
    close();
  }
};
