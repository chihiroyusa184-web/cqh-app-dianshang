import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { initialState } from './domain.js';

export async function openStore(filePath) {
  let state;
  try { state = JSON.parse(await readFile(filePath, 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    state = initialState();
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(state, null, 2), { flag: 'wx' });
  }
  let pending = Promise.resolve();
  return {
    snapshot() { return structuredClone(state); },
    transact(operation) {
      const result = pending.then(async () => {
        const draft = structuredClone(state);
        const value = operation(draft);
        const temporary = filePath + '.' + randomUUID() + '.tmp';
        await writeFile(temporary, JSON.stringify(draft, null, 2));
        await rename(temporary, filePath);
        state = draft;
        return value;
      });
      pending = result.catch(() => {});
      return result;
    }
  };
}
