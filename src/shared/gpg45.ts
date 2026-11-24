import {
  CriCheck,
  DocumentType,
  Evidence,
  Gpg45Scores,
  ScoreType,
  TargetProfiles
} from './types';

const NO_SCORE = 0;

export interface ScoredEvidence {
  scores: Partial<Record<ScoreType, number>>;
  biometricVerificationProcessLevel?: number;
  document?: DocumentType;
}

export const verificationScoreOf = (evidence: ScoredEvidence): number => {
  const declared = evidence.scores[ScoreType.VERIFICATION];
  if (declared !== undefined) {
    return declared;
  }
  if (evidence.biometricVerificationProcessLevel !== undefined) {
    return evidence.biometricVerificationProcessLevel;
  }
  return NO_SCORE;
};

export const resolveScores = (
  evidence: ScoredEvidence
): Partial<Record<ScoreType, number>> => {
  const verification = verificationScoreOf(evidence);
  const scores = { ...evidence.scores };

  if (verification > NO_SCORE) {
    scores[ScoreType.VERIFICATION] = verification;
  }

  return scores;
};

export const maxScores = (
  provides: CriCheck[]
): Partial<Record<ScoreType, number>> => {
  const scores: Partial<Record<ScoreType, number>> = {};

  for (const evidence of provides) {
    for (const [score, value] of Object.entries(resolveScores(evidence))) {
      const type = score as ScoreType;
      scores[type] = Math.max(scores[type] ?? NO_SCORE, value as number);
    }
  }

  return scores;
};

const DOCUMENT_CATEGORIES: Partial<Record<DocumentType, string>> = {
  [DocumentType.UK_DRIVING_LICENCE]: 'drivingPermit',
  [DocumentType.EU_DRIVING_LICENCE]: 'drivingPermit',
  [DocumentType.UK_PASSPORT]: 'passport',
  [DocumentType.NON_UK_PASSPORT_WITH_BIOMETRIC_CHIP]: 'passport',
  [DocumentType.NON_UK_PASSPORT]: 'passport',
  [DocumentType.BANK_ACCOUNT]: 'bankAccount',
  [DocumentType.UK_BRP]: 'residencePermit',
  [DocumentType.UK_BRC]: 'residencePermit',
  [DocumentType.UK_FWP]: 'residencePermit',
  [DocumentType.NATIONAL_INSURANCE_NUMBER]: 'socialSecurityRecord',
  [DocumentType.NATIONAL_IDENTITY_CARD]: 'idCard'
};

export const compareEvidence = (a: Evidence, b: Evidence): number =>
  a.strength - b.strength || a.validity - b.validity;

const evidenceOf = (item: ScoredEvidence): Evidence | undefined => {
  const strength = item.scores[ScoreType.STRENGTH];
  const validity = item.scores[ScoreType.VALIDITY];

  return strength !== undefined && validity !== undefined ? { strength, validity } : undefined;
};

const deduplicateEvidences = (items: ScoredEvidence[]): Evidence[] => {
  const uncategorised: Evidence[] = [];
  const byCategory = new Map<string, Evidence>();

  for (const item of items) {
    const evidence = evidenceOf(item);
    if (!evidence) continue;

    const category =
      item.document === undefined ? undefined : DOCUMENT_CATEGORIES[item.document];

    if (category === undefined) {
      uncategorised.push(evidence);
      continue;
    }

    const existing = byCategory.get(category);
    if (!existing || compareEvidence(evidence, existing) > 0) {
      byCategory.set(category, evidence);
    }
  }

  return [...uncategorised, ...byCategory.values()];
};

const highest = (values: number[]): number => Math.max(NO_SCORE, ...values);

export const buildScores = (items: ScoredEvidence[]): Gpg45Scores => ({
  evidences: deduplicateEvidences(items).sort((a, b) => compareEvidence(b, a)),
  activity: highest(items.map(item => item.scores[ScoreType.ACTIVITY] ?? NO_SCORE)),
  fraud: highest(items.map(item => item.scores[ScoreType.FRAUD] ?? NO_SCORE)),
  verification: highest(items.map(verificationScoreOf))
});

export const satisfies = (achieved: Evidence, required: Evidence): boolean =>
  achieved.strength >= required.strength && achieved.validity >= required.validity;

export const evidenceIsSatisfactory = (required: Evidence[], achieved: Evidence[]): boolean => {
  if (required.length > achieved.length) return false;

  const used = new Set<number>();

  const assign = (index: number): boolean => {
    if (index === required.length) return true;

    return achieved.some((evidence, position) => {
      if (used.has(position) || !satisfies(evidence, required[index])) return false;

      used.add(position);
      const assigned = assign(index + 1);
      used.delete(position);

      return assigned;
    });
  };

  return assign(0);
};

export const isSatisfiedBy = (profile: Gpg45Scores, achieved: Gpg45Scores): boolean =>
  evidenceIsSatisfactory(profile.evidences, achieved.evidences) &&
  profile.activity <= achieved.activity &&
  profile.fraud <= achieved.fraud &&
  profile.verification <= achieved.verification;

export const matchProfile = (
  profiles: TargetProfiles,
  scores: Gpg45Scores
): string | undefined =>
  Object.entries(profiles).find(([, profile]) => isSatisfiedBy(profile, scores))?.[0];
