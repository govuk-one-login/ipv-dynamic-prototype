import { answerCapabilityQuestion, markFinalAnswer } from '../shared/capabilities';
import {
  Action,
  AskOutcome,
  CredentialStore,
  CriId,
  Engine,
  EngineRequest,
  EngineResult,
  LevelOfConfidence,
  RouteQuestion,
  TargetProfiles,
  UserCapabilities,
  VerifiableCredential
} from '../shared/types';
import {CriAvailabilityResult, resolveCriAvailability } from './eligibility';
import { matchProfile } from '../shared/gpg45';
import { buildProfile, Shortfall, supportedProfiles } from './gpg45';
import {
  Certainty,
  firstOpenStep,
  isConfirmed,
  planRoutes,
  redirectOptions,
  Routes
} from './planner';
import { POLICY } from './policy';

export { findCri } from './cri-config';
export { CriAvailability } from './eligibility';
export type { CriAvailabilityResult } from './eligibility';

export const targetProfilesFor = (
  levelOfConfidence: LevelOfConfidence,
  credentials: VerifiableCredential[] = []
): TargetProfiles => supportedProfiles(levelOfConfidence, credentials);

export const describeAvailability = (
  capabilities: UserCapabilities,
  attempted: CriId[] = []
): CriAvailabilityResult[] => resolveCriAvailability(capabilities, attempted);

const describeUnachievable = (
  levelOfConfidence: LevelOfConfidence,
  shortfall?: Shortfall,
  exhaustedMandatory: CriId[] = []
): string => {
  if (exhaustedMandatory.length > 0) {
    return (
      `Sorry, ${levelOfConfidence} cannot be achieved. ` +
      `Every identity needs ${exhaustedMandatory.join(', ')}, which has already been attempted.`
    );
  }

  if (!shortfall) {
    return `Sorry, there is no way to reach ${levelOfConfidence} with the checks you can complete.`;
  }

  const missing = shortfall.missing
    .map(({ type, required, best }) => `${type} ${required} (best possible ${best})`)
    .join(', ');

  return (
    `Sorry, ${levelOfConfidence} cannot be achieved. ` +
    `The closest profile is ${shortfall.profile}, which needs ${missing}.`
  );
};

interface Batch {
  questions: RouteQuestion[];
  otherwise: AskOutcome;
}

const buildBatch = (
  capabilities: UserCapabilities,
  plan: (capabilities: UserCapabilities) => Routes,
  unachievable: (shortfall?: Shortfall) => string
): Batch => {
  const questions: RouteQuestion[] = [];
  const asked = new Set<string>();
  let current = capabilities;

  for (;;) {
    const { plans, shortfall } = plan(current);
    const [best] = plans;

    if (!best || best.steps.length === 0) {
      return { questions, otherwise: { message: unachievable(shortfall) } };
    }

    const step = firstOpenStep(best);

    if (!step) {
      const options = redirectOptions(plans);
      return {
        questions,
        otherwise: options.length > 0 ? { options } : { message: unachievable() }
      };
    }

    const [question] = step.questions;
    const retry = step.certainty === Certainty.DECLINED;
    const key = JSON.stringify(question);

    if (!asked.has(key)) {
      asked.add(key);

      const afterYes = plan(answerCapabilityQuestion(current, question, true));
      const [bestAfterYes] = afterYes.plans;
      const confirmed =
        bestAfterYes !== undefined && bestAfterYes.steps.length > 0 && isConfirmed(bestAfterYes);

      questions.push({
        question,
        criId: step.cri.id,
        document: step.document,
        achieves: best.profile,
        scores: step.scores,
        ...(retry ? { retry: true } : {}),
        ...(confirmed ? { onYes: redirectOptions(afterYes.plans) } : {})
      });
    }

    current = retry
      ? markFinalAnswer(current, question)
      : answerCapabilityQuestion(current, question, false);
  }
};

const processRequest = (evcs: CredentialStore, request: EngineRequest): EngineResult => {
  const credentials = evcs.fetch(request.userId);
  const profile = buildProfile(credentials);

  const targetProfiles = supportedProfiles(request.requiredLevelOfConfidence, credentials);
  if (Object.keys(targetProfiles).length === 0) {
    return {
      action: Action.STOP,
      message: `Sorry, no profiles are defined for ${request.requiredLevelOfConfidence}.`
    };
  }

  const matchedProfile = matchProfile(targetProfiles, profile.scores);

  const succeededCris = credentials
    .filter(credential => credential.successful || credential.nonFatalFraudFailure === true)
    .map(credential => credential.cri);
  const hasCompletedMandatoryChecks = POLICY.MANDATORY_CHECKS.every(criId =>
    succeededCris.includes(criId)
  );

  const hasRequiredData = POLICY.REQUIRED_IDENTITY_DATA.every(d => profile.identityData[d]);

  const hasCi = profile.contraIndicators.length > 0;
  if (hasCi) {
    return {
      action: Action.STOP,
      message: `Sorry, you are blocked by CIs: ${profile.contraIndicators.join(', ')}.`
    };
  }

  if (matchedProfile && hasCompletedMandatoryChecks && hasRequiredData) {
    return {
      action: Action.COMPLETE,
      message: "You've successfully achieved an identity!",
      identity: {
        levelOfConfidence: request.requiredLevelOfConfidence,
        profile: matchedProfile,
        scores: profile.scores,
        credentials
      }
    };
  }

  const outstandingMandatory = POLICY.MANDATORY_CHECKS.filter(
    criId => !succeededCris.includes(criId)
  );

  const { questions, otherwise } = buildBatch(
    request.capabilities,
    capabilities =>
      planRoutes(
        resolveCriAvailability(capabilities, request.attempted),
        request.attempted,
        profile,
        targetProfiles,
        capabilities,
        outstandingMandatory
      ),
    shortfall =>
      describeUnachievable(
        request.requiredLevelOfConfidence,
        shortfall,
        outstandingMandatory.filter(criId => request.attempted.includes(criId))
      )
  );

  if (questions.length > 0) {
    return { action: Action.ASK, questions, otherwise };
  }

  if ('options' in otherwise) {
    return { action: Action.REDIRECT, options: otherwise.options };
  }

  return { action: Action.STOP, message: otherwise.message };
};

export const createEngine = (store: CredentialStore): Engine => ({
  processRequest: request => processRequest(store, request)
});
