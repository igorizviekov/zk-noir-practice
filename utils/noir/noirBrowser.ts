import { Noir } from './noir';

const getCircuitArtifact = async () => {
  const response = await fetch('/api/circuit');
  if (!response.ok) {
    throw new Error('Circuit artifact not found. Run `nargo compile` in circuits/ first.');
  }
  return response.json();
};

export class NoirBrowser extends Noir {
    async compile() {
        const circuit = await getCircuitArtifact();
        await this.init(circuit);
    }
}
