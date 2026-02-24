// @ts-ignore
import { NoirBrowser } from '../utils/noir/noirBrowser';

onmessage = async event => {
  try {
    const { proof } = event.data;

    const noir = new NoirBrowser();
    await noir.compile();
    const verification = await noir.verifyProof({ proof });

    postMessage(verification);
  } catch (er) {
    postMessage(er);
  } finally {
    close();
  }
};
