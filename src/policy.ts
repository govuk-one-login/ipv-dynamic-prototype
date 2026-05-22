import { CheckType, IdentityData, ScoreType } from './types';

export const POLICY = {
  TARGET_PROFILES: {
    M1A: { [ScoreType.STRENGTH]: 4, [ScoreType.VALIDITY]: 2, [ScoreType.ACTIVITY]: 0, [ScoreType.FRAUD]: 1, [ScoreType.VERIFICATION]: 2 },
    M1B: { [ScoreType.STRENGTH]: 3, [ScoreType.VALIDITY]: 2, [ScoreType.ACTIVITY]: 1, [ScoreType.FRAUD]: 2, [ScoreType.VERIFICATION]: 2 }
  },
  MANDATORY_CHECKS: [CheckType.FRAUD],
  REQUIRED_IDENTITY_DATA: [IdentityData.NAME, IdentityData.DOB, IdentityData.ADDRESS]
};
