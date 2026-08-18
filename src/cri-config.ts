import { CheckType, CriId, CriOutcome, IdentityData, ScoreType } from './types';

export interface CriConfig {
  id: CriId;
  checkType: CheckType;
  enabled: boolean;
  weight?: number; // unused, could define order
  provides: Partial<Record<ScoreType, number>>; // (max) scores this CRI provides
  requires: IdentityData[]; // prerequisite identity data this CRI needs to perform its check
  collects: IdentityData[]; // identity data this CRI collects
  possibleOutcomes: CriOutcome[]; // outcomes this CRI can return
  ciCode?: string;
}

const CAN_FAIL: CriOutcome[] = [
  CriOutcome.SUCCESS,
  CriOutcome.FAIL_NO_CI,
  CriOutcome.FAIL_WITH_CI
];

export const CRI_CONFIG: CriConfig[] = [
  {
    id: CriId.WEB_PASSPORT,
    checkType: CheckType.WEB_PASSPORT,
    enabled: true,
    provides: { [ScoreType.STRENGTH]: 4, [ScoreType.VALIDITY]: 2 },
    requires: [],
    collects: [IdentityData.NAME, IdentityData.DOB],
    possibleOutcomes: CAN_FAIL,
    ciCode: 'CI_DOC'
  },
  {
    id: CriId.WEB_DL,
    checkType: CheckType.WEB_DL,
    enabled: true,
    provides: { [ScoreType.STRENGTH]: 3, [ScoreType.VALIDITY]: 2 },
    requires: [],
    collects: [IdentityData.NAME, IdentityData.DOB],
    possibleOutcomes: CAN_FAIL,
    ciCode: 'CI_DOC'
  },
  {
    id: CriId.ADDRESS,
    checkType: CheckType.ADDRESS,
    enabled: true,
    provides: {}, // no scores
    requires: [IdentityData.NAME, IdentityData.DOB],
    collects: [IdentityData.ADDRESS],
    possibleOutcomes: [CriOutcome.SUCCESS]
  },
  {
    id: CriId.FRAUD,
    checkType: CheckType.FRAUD,
    enabled: true,
    provides: { [ScoreType.FRAUD]: 2, [ScoreType.ACTIVITY]: 1 },
    requires: [IdentityData.NAME, IdentityData.DOB, IdentityData.ADDRESS],
    collects: [],
    possibleOutcomes: CAN_FAIL,
    ciCode: 'CI_FRAUD'
  },
  {
    id: CriId.OPEN_BANKING,
    checkType: CheckType.OPEN_BANKING,
    enabled: true,
    provides: { [ScoreType.VERIFICATION]: 2 },
    requires: [IdentityData.NAME, IdentityData.DOB, IdentityData.ADDRESS],
    collects: [],
    possibleOutcomes: CAN_FAIL,
    ciCode: 'CI_OB'
  },
  {
    id: CriId.KBV,
    checkType: CheckType.KBV,
    enabled: true,
    provides: { [ScoreType.VERIFICATION]: 2 },
    requires: [IdentityData.NAME, IdentityData.DOB, IdentityData.ADDRESS],
    collects: [],
    possibleOutcomes: CAN_FAIL,
    ciCode: 'CI_KBV'
  }
];
