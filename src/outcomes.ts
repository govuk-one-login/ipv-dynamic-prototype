import { CRI_CONFIG } from './cri-config';
import { CriId, CriOutcome, ScoreType, UserState } from './types';

// Applies the result of attempting a CRI to the user's state.
// SUCCESS adds max scores and collected data; failures record the attempt
// and if applicable raises a CI.
export const applyOutcome = (
  state: UserState,
  criId: CriId,
  outcome: CriOutcome
): UserState => {
  const cri = CRI_CONFIG.find(c => c.id === criId)!;

  const newState: UserState = {
    attempted: state.attempted.includes(criId)
      ? [...state.attempted]
      : [...state.attempted, criId],
    succeeded: [...state.succeeded],
    hasData: { ...state.hasData },
    scores: { ...state.scores },
    cis: [...state.cis]
  };

  switch (outcome) {
    case CriOutcome.SUCCESS:
      if (!newState.succeeded.includes(criId)) newState.succeeded.push(criId);
      for (const [score, value] of Object.entries(cri.provides)) {
        newState.scores[score as ScoreType] = Math.max(
          newState.scores[score as ScoreType],
          value as number
        );
      }
      for (const d of cri.collects) newState.hasData[d] = true;
      break;

    case CriOutcome.FAIL_NO_CI:
      // Attempt recorded only — no scores, no data
      break;

    case CriOutcome.FAIL_WITH_CI:
      if (cri.ciCode && !newState.cis.includes(cri.ciCode)) newState.cis.push(cri.ciCode);
      break;
  }

  return newState;
};
