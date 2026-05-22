import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { CRI_CONFIG } from './cri-config.js';
import { calculateNextStep } from './engine';
import { Action, CriId, ScoreType, UserState } from './types';

const rl = readline.createInterface({ input, output });

const initialState = (): UserState => ({
  visited: [], 
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
    [ScoreType.VERIFICATION]: 0,
  }
});

const completeCriCheck = (state: UserState, criId: CriId): UserState => {
  const cri = CRI_CONFIG.find(c => c.id === criId)!;
  const newState: UserState = {
    visited: [...state.visited, cri.checkType],
    hasData: { ...state.hasData },
    scores: { ...state.scores }
  };
  for (const [score, value] of Object.entries(cri.provides)) {
    newState.scores[score as ScoreType] = Math.max(newState.scores[score as ScoreType], value);
  }
  for (const d of cri.collects) {
    newState.hasData[d] = true;
  }
  return newState;
};

const simulateJourney = async () => {
  let state = initialState();

  console.log('Welcome to Dynamic IPV.');
  console.log('This prototype only covers a basic web proving journey targeting profiles M1A/M1B');
  console.log('and a happy path that assumes all checks are successful with max possible scores achieved at each check.\n');

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
      if (!criId) { console.log('Invalid choice.'); continue; }
    }

    console.log(`${CRI_CONFIG.find(c => c.id === criId)!.checkType}`);
    await rl.question('[Hit Enter to complete this step]');

    state = completeCriCheck(state, criId!);

    console.log('Scores:', state.scores, '\n');
  }

  rl.close();
};

simulateJourney();
