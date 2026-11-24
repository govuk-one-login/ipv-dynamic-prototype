import { buildScores, satisfies } from '../shared/gpg45';
import {
  CriId,
  Evidence,
  Gpg45Scores,
  IdentityData,
  LevelOfConfidence,
  TargetProfiles,
  VerifiableCredential
} from '../shared/types';
import { GPG45_PROFILES, POLICY } from './policy';

export interface IdentityProfile {
  scores: Gpg45Scores;
  credentials: VerifiableCredential[];
  contraIndicators: string[];
  identityData: Record<IdentityData, boolean>;
}

export const buildProfile = (credentials: VerifiableCredential[]): IdentityProfile => {
  const profile: IdentityProfile = {
    scores: buildScores(credentials),
    credentials,
    contraIndicators: [],
    identityData: {
      [IdentityData.NAME]: false,
      [IdentityData.DOB]: false,
      [IdentityData.ADDRESS]: false
    }
  };

  for (const credential of credentials) {
    for (const data of credential.collected) profile.identityData[data] = true;

    for (const ci of credential.contraIndicators) {
      if (!profile.contraIndicators.includes(ci)) profile.contraIndicators.push(ci);
    }
  }

  return profile;
};

export const isFraudScoreRequired = (credentials: VerifiableCredential[]): boolean =>
  !credentials.some(
    credential => credential.cri === CriId.FRAUD && credential.nonFatalFraudFailure === true
  );

export const supportedProfiles = (
  levelOfConfidence: LevelOfConfidence,
  credentials: VerifiableCredential[]
): TargetProfiles => {
  const fraudScoreRequired = isFraudScoreRequired(credentials);
  const profiles: TargetProfiles = {};

  for (const name of POLICY.PROFILES[levelOfConfidence] ?? []) {
    const profile = GPG45_PROFILES[name];
    if (fraudScoreRequired && profile.fraud <= 0) continue;
    profiles[name] = profile;
  }

  return profiles;
};

export interface Shortfall {
  profile: string;
  missing: { type: string; required: string; best: string }[];
}

const evidenceLabel = (evidence?: Evidence): string =>
  evidence === undefined ? 'none' : `${evidence.strength}/${evidence.validity}`;

export const nearestShortfall = (
  targetProfiles: TargetProfiles,
  scores: Gpg45Scores
): Shortfall | undefined => {
  let nearest: { shortfall: Shortfall; gap: number } | undefined;

  for (const [name, profile] of Object.entries(targetProfiles)) {
    const missing: Shortfall['missing'] = [];
    let gap = 0;

    const acquired = [...scores.evidences];

    for (const required of profile.evidences) {
      const [best] = acquired;

      if (best !== undefined && satisfies(best, required)) {
        acquired.shift();
        continue;
      }

      missing.push({
        type: 'strength/validity',
        required: evidenceLabel(required),
        best: evidenceLabel(best)
      });
      gap +=
        Math.max(0, required.strength - (best?.strength ?? 0)) +
        Math.max(0, required.validity - (best?.validity ?? 0));
    }

    for (const type of ['activity', 'fraud', 'verification'] as const) {
      if (scores[type] >= profile[type]) continue;

      missing.push({ type, required: String(profile[type]), best: String(scores[type]) });
      gap += profile[type] - scores[type];
    }

    if (missing.length === 0) return undefined;

    if (!nearest || gap < nearest.gap) {
      nearest = { shortfall: { profile: name, missing }, gap };
    }
  }

  return nearest?.shortfall;
};
