import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

const ai = genkit({
  plugins: [googleAI()]
});

async function main() {
  try {
    const models = ai.registry.listActions()
      .filter(a => a.__type === 'model')
      .map(a => a.__id || a.actionId);
      // Let's just dump the registry to see what we have
      
     console.log(await ai.registry.listActions());
  } catch (e) {
    console.error("ERROR:", e);
  }
}
main();
