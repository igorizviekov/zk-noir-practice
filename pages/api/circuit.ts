import fs from 'fs/promises';
import path from 'path';

export default async function handler(req, res) {
  try {
    const projectRoot = process.cwd();
    const circuitPath = path.join(projectRoot, 'circuits/target/circuits.json');
    const data = await fs.readFile(circuitPath, 'utf-8');
    res.status(200).json(JSON.parse(data));
  } catch (error) {
    res.status(500).json({ error: 'Circuit artifact not found. Run `nargo compile` in circuits/ first.' });
  }
}
