import {
  CriId,
  Evidence,
  Gpg45Scores,
  IdentityData,
  LevelOfConfidence
} from '../shared/types';

const EV_11: Evidence = { strength: 1, validity: 1 };
const EV_22: Evidence = { strength: 2, validity: 2 };
const EV_32: Evidence = { strength: 3, validity: 2 };
const EV_33: Evidence = { strength: 3, validity: 3 };
const EV_42: Evidence = { strength: 4, validity: 2 };
const EV_43: Evidence = { strength: 4, validity: 3 };
const EV_44: Evidence = { strength: 4, validity: 4 };

const profile = (
  evidences: Evidence[],
  activity: number,
  fraud: number,
  verification: number
): Gpg45Scores => ({ evidences, activity, fraud, verification });

export const GPG45_PROFILES: Record<string, Gpg45Scores> = {
  L1A: profile([EV_22], 0, 1, 1),
  L1B: profile([EV_32], 0, 0, 1),
  L1C: profile([EV_11], 3, 2, 2),
  L2A: profile([EV_11, EV_11], 2, 1, 2),
  L2B: profile([EV_11, EV_11], 2, 2, 1),
  L3A: profile([EV_11, EV_11, EV_11], 2, 1, 1),
  M1A: profile([EV_42], 0, 1, 2),
  M1B: profile([EV_32], 1, 2, 2),
  M1C: profile([EV_33], 0, 0, 3),
  M1D: profile([EV_22], 2, 1, 3),
  M2A: profile([EV_22, EV_22], 3, 2, 2),
  M2B: profile([EV_32, EV_22], 1, 1, 2),
  M2C: profile([EV_32, EV_22], 0, 1, 3),
  M3A: profile([EV_22, EV_22, EV_22], 2, 2, 2),
  H1A: profile([EV_43], 0, 1, 3),
  H1B: profile([EV_33], 2, 1, 3),
  H1C: profile([EV_43], 0, 0, 4),
  H2A: profile([EV_22, EV_22], 3, 2, 3),
  H2B: profile([EV_42, EV_32], 0, 2, 3),
  H2C: profile([EV_33, EV_22], 1, 1, 3),
  H2D: profile([EV_33, EV_22], 0, 1, 3),
  H2E: profile([EV_43, EV_33], 0, 0, 3),
  H3A: profile([EV_22, EV_22, EV_22], 2, 2, 3),
  V1A: profile([EV_43], 0, 3, 3),
  V1B: profile([EV_44], 0, 1, 3),
  V1C: profile([EV_43], 1, 1, 4),
  V1D: profile([EV_44], 0, 0, 4),
  V2A: profile([EV_33, EV_33], 3, 2, 3),
  V2B: profile([EV_43, EV_33], 0, 2, 3),
  V2C: profile([EV_43, EV_22], 2, 2, 3),
  V2D: profile([EV_44, EV_44], 0, 0, 3),
  V3A: profile([EV_33, EV_22, EV_22], 3, 3, 3)
};

export const POLICY: {
  PROFILES: Record<LevelOfConfidence, string[]>;
  MANDATORY_CHECKS: CriId[];
  REQUIRED_IDENTITY_DATA: IdentityData[];
} = {
  PROFILES: {
    [LevelOfConfidence.LOW]: ['L1A'],
    [LevelOfConfidence.MEDIUM]: ['M1A', 'M1B', 'M2B', 'M1C'],
    [LevelOfConfidence.HIGH]: ['H1A']
  },
  MANDATORY_CHECKS: [CriId.FRAUD],
  REQUIRED_IDENTITY_DATA: [IdentityData.NAME, IdentityData.DOB, IdentityData.ADDRESS]
};
