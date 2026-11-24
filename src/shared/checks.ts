import { CriChecks, CriId, DocumentType, IdentityData, ScoreType } from './types';

export const CRI_CHECKS: Record<CriId, CriChecks> = {
  [CriId.CLAIMED_IDENTITY]: {
    collects: [IdentityData.NAME, IdentityData.DOB],
    successful: [{ label: 'Name and date of birth collected', scores: {} }],
    failed: []
  },
  [CriId.APP]: {
    collects: [IdentityData.NAME, IdentityData.DOB],
    successful: [
      {
        label: 'Passed DCMAW chipped passport check',
        document: DocumentType.UK_PASSPORT,
        scores: { [ScoreType.STRENGTH]: 4, [ScoreType.VALIDITY]: 3, [ScoreType.ACTIVITY]: 1 },
        biometricVerificationProcessLevel: 3
      },
      {
        label: 'Passed DCMAW chipped passport check',
        document: DocumentType.NON_UK_PASSPORT_WITH_BIOMETRIC_CHIP,
        scores: { [ScoreType.STRENGTH]: 4, [ScoreType.VALIDITY]: 3, [ScoreType.ACTIVITY]: 1 },
        biometricVerificationProcessLevel: 3
      },
      {
        label: 'Passed DCMAW driving licence check (M1B)',
        document: DocumentType.UK_DRIVING_LICENCE,
        scores: { [ScoreType.STRENGTH]: 3, [ScoreType.VALIDITY]: 2, [ScoreType.ACTIVITY]: 1 },
        biometricVerificationProcessLevel: 3
      },
      {
        label: 'Passed BRP check',
        document: DocumentType.UK_BRP,
        scores: { [ScoreType.STRENGTH]: 4, [ScoreType.VALIDITY]: 3 },
        biometricVerificationProcessLevel: 3
      },
      {
        label: 'Passed BRC check',
        document: DocumentType.UK_BRC,
        scores: { [ScoreType.STRENGTH]: 4, [ScoreType.VALIDITY]: 3 },
        biometricVerificationProcessLevel: 3
      },
      {
        label: 'Passed BRC/FWP check',
        document: DocumentType.UK_FWP,
        scores: { [ScoreType.STRENGTH]: 4, [ScoreType.VALIDITY]: 3 },
        biometricVerificationProcessLevel: 3
      }
    ],
    failed: [
      {
        label: 'Failed DCMAW driving licence liveness/likeness check',
        document: DocumentType.UK_DRIVING_LICENCE,
        scores: {
          [ScoreType.STRENGTH]: 3,
          [ScoreType.VALIDITY]: 0,
          [ScoreType.ACTIVITY]: 0
        }
      }
    ]
  },
  [CriId.F2F]: {
    collects: [],
    successful: [
      {
        label: 'Passed f2f passport check',
        document: DocumentType.UK_PASSPORT,
        scores: {
          [ScoreType.STRENGTH]: 4,
          [ScoreType.VALIDITY]: 2,
          [ScoreType.VERIFICATION]: 3
        },
        biometricVerificationProcessLevel: 3
      }
    ],
    failed: [
      {
        label: 'Failed f2f passport check',
        document: DocumentType.UK_PASSPORT,
        scores: {
          [ScoreType.STRENGTH]: 4,
          [ScoreType.VALIDITY]: 0,
          [ScoreType.VERIFICATION]: 3
        },
        biometricVerificationProcessLevel: 3
      }
    ]
  },
  [CriId.WEB_PASSPORT]: {
    collects: [IdentityData.NAME, IdentityData.DOB],
    successful: [
      {
        label: 'Passed passport check (M1A)',
        document: DocumentType.UK_PASSPORT,
        scores: { [ScoreType.STRENGTH]: 4, [ScoreType.VALIDITY]: 2 }
      }
    ],
    failed: []
  },
  [CriId.WEB_DL]: {
    collects: [IdentityData.NAME, IdentityData.DOB],
    successful: [
      {
        label: 'Passed driving licence check',
        document: DocumentType.UK_DRIVING_LICENCE,
        scores: {
          [ScoreType.STRENGTH]: 3,
          [ScoreType.VALIDITY]: 2,
          [ScoreType.ACTIVITY]: 1
        }
      }
    ],
    failed: []
  },
  [CriId.BAV]: {
    collects: [],
    successful: [
      {
        label: 'Passed Bank account verification (Stub)',
        document: DocumentType.BANK_ACCOUNT,
        scores: { [ScoreType.STRENGTH]: 3, [ScoreType.VALIDITY]: 2 }
      }
    ],
    failed: []
  },
  [CriId.NINO]: {
    collects: [],
    successful: [
      {
        label: 'Passed National Insurance Number - identity check evidence requested',
        document: DocumentType.NATIONAL_INSURANCE_NUMBER,
        scores: { [ScoreType.STRENGTH]: 2, [ScoreType.VALIDITY]: 2 }
      }
    ],
    failed: [
      {
        label: 'Failed National Insurance Number - identity check evidence requested',
        document: DocumentType.NATIONAL_INSURANCE_NUMBER,
        scores: { [ScoreType.STRENGTH]: 2, [ScoreType.VALIDITY]: 0 }
      }
    ]
  },
  [CriId.ADDRESS]: {
    collects: [IdentityData.ADDRESS],
    successful: [{ label: 'Address collected', scores: {} }],
    failed: []
  },
  [CriId.FRAUD]: {
    collects: [],
    successful: [
      {
        label: 'Passed fraud check (M1A)',
        scores: { [ScoreType.FRAUD]: 2, [ScoreType.ACTIVITY]: 0 }
      },
      {
        label: 'Passed fraud check with activity history (M1B)',
        scores: { [ScoreType.FRAUD]: 2, [ScoreType.ACTIVITY]: 1 }
      }
    ],
    failed: [
      {
        label: 'Failed fraud check (International) (M1C)',
        scores: {},
        nonFatalFraudFailure: true
      },
      {
        label: 'Failed fraud check (Unavailable) (M1C)',
        scores: {},
        nonFatalFraudFailure: true
      }
    ]
  },
  [CriId.OPEN_BANKING]: {
    collects: [],
    successful: [
      {
        label: 'Open Banking success',
        document: DocumentType.ONLINE_BANKING,
        scores: {
          [ScoreType.STRENGTH]: 3,
          [ScoreType.VALIDITY]: 3,
          [ScoreType.VERIFICATION]: 2
        }
      }
    ],
    failed: []
  },
  [CriId.KBV]: {
    collects: [],
    successful: [
      {
        label: 'Passed verification (M1A) with checkDetails',
        scores: { [ScoreType.VERIFICATION]: 2 }
      }
    ],
    failed: [
      {
        label: 'Failed verification with failedCheckDetails',
        scores: { [ScoreType.VERIFICATION]: 0 }
      }
    ]
  },
  [CriId.DWP_KBV]: {
    collects: [],
    successful: [
      {
        label: 'Passed DWP KBV (Stub)',
        scores: { [ScoreType.VERIFICATION]: 2 }
      }
    ],
    failed: []
  }
};
