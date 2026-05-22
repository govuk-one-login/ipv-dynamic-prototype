import { POLICY } from './policy';
import { CRI_CONFIG } from './cri-config';
import { isProfileMet, contributesToScores } from './scorer';
import { Action, EngineResult, UserState } from './types';

export const calculateNextStep = (state: UserState): EngineResult => {
  const profileMet = isProfileMet(POLICY.TARGET_PROFILES, state.scores);

  const hasCompletedMandatoryChecks = POLICY.MANDATORY_CHECKS.every(checkType => state.visited.includes(checkType));

  const hasRequiredData = POLICY.REQUIRED_IDENTITY_DATA.every(d => state.hasData[d]);

  if (profileMet && hasCompletedMandatoryChecks && hasRequiredData) {
    return { action: Action.COMPLETE, message: 'You\'ve successfully achieved an identity!' };
  }

  // Find all checks that are:
  // 1. Enabled
  // 2. That the user hasn't done yet
  // 3. Where the user has the prerequisite identity data
  const eligibleChecks = CRI_CONFIG.filter(cri =>
    cri.enabled &&
    !state.visited.includes(cri.checkType) &&
    cri.requires.every(dataType => state.hasData[dataType])
  );

  // Prioritise mandatory checks
  const mandatoryChecks = eligibleChecks.filter(cri => POLICY.MANDATORY_CHECKS.includes(cri.checkType));
  if (mandatoryChecks.length > 0) {
    return { action: Action.REDIRECT, criId: mandatoryChecks[0].id };
  }

  // We only want to do checks that contribute to meeting a target profile
  // We don't want to do eg. another doc check if we've already got enough strength/validity
  const scoreContributors = eligibleChecks.filter(cri => contributesToScores(POLICY.TARGET_PROFILES, cri, state.scores));
  if (scoreContributors.length > 0) {
    // If we have more than one option, we need to ask the user to choose
    if (scoreContributors.length > 1) {
      return {
        action: Action.CHOOSE,
        options: scoreContributors,
      };
    }
    return { action: Action.REDIRECT, criId: scoreContributors[0].id }; 
  }

  // If we haven't got all the required identity data, we should collect it
  const dataCollectors = eligibleChecks.filter(cri => cri.collects.some(dataType => !state.hasData[dataType]));
  if (dataCollectors.length > 0) {
    return { action: Action.REDIRECT, criId: dataCollectors[0].id };
  }

  return {
    action: Action.STOP,
    message: 'Sorry there are no more options available to try.',
  };
};

