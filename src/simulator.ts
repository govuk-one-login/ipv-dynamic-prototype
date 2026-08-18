import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { CRI_CONFIG, CriConfig } from './cri-config.js';
import { calculateNextStep } from './engine';
import { applyOutcome } from './outcomes';
import { Action, CriId, CriOutcome, ScoreType, UserState } from './types';

const rl = readline.createInterface({ input, output });

const initialState = (): UserState => ({
  attempted: [],
  succeeded: [],
  hasData: {
    NAME: false,
    ADDRESS: false,
    DOB: false
  },
  scores: {
    [ScoreType.STRENGTH]: 0,
    [ScoreType.VALIDITY]: 0,
    [ScoreType.FRAUD]: 0,
    [ScoreType.ACTIVITY]: 0,
    [ScoreType.VERIFICATION]: 0
  },
  cis: []
});

const pickOutcome = async (cri: CriConfig): Promise<CriOutcome> => {
  if (cri.possibleOutcomes.length === 1) {
    return cri.possibleOutcomes[0];
  }
  const prompt = cri.possibleOutcomes.map((o, i) => `  ${i + 1}: ${o}`).join('\n');
  const answer = await rl.question(`Outcome of this check?\n${prompt}\n> `);
  return cri.possibleOutcomes[parseInt(answer) - 1] ?? cri.possibleOutcomes[0];
};

const simulateJourney = async () => {
  let state = initialState();

  console.log('Welcome to Dynamic IPV.');
  console.log('This prototype covers a basic web proving journey targeting profiles M1A/M1B.');
  console.log('Each check can now succeed or fail (with or without raising a CI).\n');

  while (true) {
    const next = calculateNextStep(state);

    if (next.action === Action.COMPLETE || next.action === Action.STOP) {
      console.log(next.message);
      break;
    }

    let criId = next.action === Action.REDIRECT ? next.criId : undefined;

    if (next.action === Action.CHOOSE) {
      const opts = next.options;
      const prompt = opts.map((o, i) => `  ${i + 1}: ${o.checkType}`).join('\n');
      const answer = await rl.question(`Pick an option:\n${prompt}\n> `);
      criId = opts[parseInt(answer) - 1]?.id;
      if (!criId) {
        console.log('Invalid choice.');
        continue;
      }
    }

    const cri = CRI_CONFIG.find(c => c.id === criId)!;
    console.log(`\n➡  ${cri.checkType}`);

    const outcome = await pickOutcome(cri);
    state = applyOutcome(state, criId as CriId, outcome);

    console.log(`Outcome: ${outcome}`);
    console.log('Scores:', state.scores);
    if (state.cis.length) console.log('CIs:', state.cis);
    console.log();
  }

  rl.close();
};

simulateJourney();
