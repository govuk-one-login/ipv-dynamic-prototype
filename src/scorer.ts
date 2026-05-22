import { Scores, ScoreType, TargetProfiles } from './types';
import { CriConfig } from './cri-config';

export const isProfileMet = (profiles: TargetProfiles, scores: Scores): boolean => {
  return Object.values(profiles).some((profile) => {
    return (
      scores[ScoreType.STRENGTH] >= profile[ScoreType.STRENGTH] &&
      scores[ScoreType.VALIDITY] >= profile[ScoreType.VALIDITY] &&
      scores[ScoreType.ACTIVITY] >= profile[ScoreType.ACTIVITY] &&
      scores[ScoreType.FRAUD] >= profile[ScoreType.FRAUD] &&
      scores[ScoreType.VERIFICATION] >= profile[ScoreType.VERIFICATION]
    );
  });
};

// Determines whether a CRI check would contribute towards meeting a target profile.
// A CRI contributes if it provides a score that is currently below the required level
// across ALL target profiles (ie. we're failing that score element everywhere).
export const contributesToScores = (targetProfiles: TargetProfiles, cri: CriConfig, currentScores: Scores): boolean => {
  return Object.entries(cri.provides).some(([scoreKey, potential]) => {
    const type = scoreKey as ScoreType;
    const current = currentScores[type] || 0;

    // Check if the current score fails to meet this element in every profile
    const failsEverywhere = Object.values(targetProfiles)
      .every(profile => current < profile[type]);

    // Only contributes if we're failing everywhere and the CRI can improve on current
    return failsEverywhere && potential > current;
  });
};
