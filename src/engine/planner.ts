import {
  AdditionalQuestion,
  CapabilityQuestion,
  CriCheck,
  CriId,
  CriOption,
  DocumentType,
  Gpg45Scores,
  IdentityData,
  ScoreType,
  TargetProfiles,
  UserCapabilities
} from '../shared/types';
import { CRI_CONFIG, CriConfig } from './cri-config';
import { CriAvailability, CriAvailabilityResult } from './eligibility';
import { buildScores, matchProfile, resolveScores } from '../shared/gpg45';
import { IdentityProfile, nearestShortfall, Shortfall } from './gpg45';
import { POLICY } from './policy';

// How sure we are that the user can actually do a check.
export enum Certainty {
  // Every requirement is answered and met.
  CONFIRMED = 'CONFIRMED',
  // Nothing contradicts it, but the user has not been asked yet.
  UNASKED = 'UNASKED',
  // A requirement is answered and not met, and the user can still be asked to reconsider.
  DECLINED = 'DECLINED'
}

export interface Candidate {
  cri: CriConfig;
  certainty: Certainty;
  questions: CapabilityQuestion[];
  question?: AdditionalQuestion;
  scores: Partial<Record<ScoreType, number>>;
  document?: DocumentType;
}

export interface Plan {
  steps: Candidate[];
  profile: string;
  scores: Gpg45Scores;
}

export interface Routes {
  // Every complete route to a target profile, best first. Empty means the level of
  // confidence cannot be reached from what the user has told us.
  plans: Plan[];
  // When there are no plans, the profile that came closest and what it was short of.
  shortfall?: Shortfall;
}

// The best this CRI could do for this user. A document they have confirmed holding wins
// over a higher-scoring one they may not have, so the app is planned on its driving
// licence check if that is all the user said they had.
const bestOutcome = (
  cri: CriConfig,
  capabilities: UserCapabilities
): { scores: Partial<Record<ScoreType, number>>; document?: DocumentType } => {
  const held = (document?: DocumentType) =>
    document !== undefined && capabilities.documentTypes[document] === true;

  const preferred = cri.provides.filter(check => held(check.document));
  const checks = preferred.length > 0 ? preferred : cri.provides;

  const rank = (check: CriCheck): number[] => {
    const scores = resolveScores(check);
    const total = Object.values(scores).reduce((sum, score) => sum + (score ?? 0), 0);

    return [scores[ScoreType.STRENGTH] ?? -1, scores[ScoreType.VALIDITY] ?? -1, total];
  };

  const byRank = (a: CriCheck, b: CriCheck): number => {
    const [left, right] = [rank(a), rank(b)];
    return right[0] - left[0] || right[1] - left[1] || right[2] - left[2];
  };

  const [best] = [...checks].sort(byRank);

  return { scores: best ? resolveScores(best) : {}, document: best?.document };
};

const toCandidate = (
  result: CriAvailabilityResult,
  capabilities: UserCapabilities
): Candidate | undefined => {
  const { cri } = result;
  if (!cri.enabled) return undefined;

  const outcome = bestOutcome(cri, capabilities);

  switch (result.availability) {
    case CriAvailability.AVAILABLE:
    case CriAvailability.FORCED:
      return { cri, certainty: Certainty.CONFIRMED, questions: [], ...outcome };
    // A CRI with its own question routes exactly like an available one — the question
    // decides whether this user takes it, not whether it is the best choice — so it must
    // not be penalised on certainty. The question travels with it for core front to ask.
    case CriAvailability.NEEDS_ANSWER:
      return {
        cri,
        certainty: Certainty.CONFIRMED,
        questions: [],
        question: cri.askQuestions,
        ...outcome
      };
    case CriAvailability.UNKNOWN:
      return {
        cri,
        certainty: Certainty.UNASKED,
        questions: result.questions,
        ...outcome
      };
    case CriAvailability.RECONSIDER:
      return { cri, certainty: Certainty.DECLINED, questions: result.blockedBy, ...outcome };
    case CriAvailability.UNAVAILABLE:
      return undefined;
  }
};

// Which check should run first when several are ready: mandatory checks, then the order
// the CRI config's weights declare, then the order they are declared in.
const precedes = (a: CriConfig, b: CriConfig): boolean => {
  const mandatory = (cri: CriConfig) => POLICY.MANDATORY_CHECKS.includes(cri.id);
  if (mandatory(a) !== mandatory(b)) return mandatory(a);
  if (a.weight !== b.weight) return a.weight < b.weight;
  return CRI_CONFIG.indexOf(a) < CRI_CONFIG.indexOf(b);
};

// Sequences the chosen checks so each one runs only once the identity data it requires
// has been collected by an earlier step. Returns undefined when no such order exists —
// eg. a bank account check with nothing in the set to collect a name and date of birth.
const orderSteps = (
  chosen: Candidate[],
  collected: Record<IdentityData, boolean>
): Candidate[] | undefined => {
  const remaining = [...chosen];
  const have = { ...collected };
  const ordered: Candidate[] = [];

  while (remaining.length > 0) {
    let next = -1;

    for (let index = 0; index < remaining.length; index++) {
      const { cri } = remaining[index];
      if (!cri.requires.every(dataType => have[dataType])) continue;
      if (next === -1 || precedes(cri, remaining[next].cri)) next = index;
    }

    if (next === -1) return undefined;

    const [step] = remaining.splice(next, 1);
    for (const dataType of step.cri.collects) have[dataType] = true;
    ordered.push(step);
  }

  return ordered;
};

const certaintyCount = (plan: Plan, certainty: Certainty): number =>
  plan.steps.filter(step => step.certainty === certainty).length;

const lastResortCount = (plan: Plan): number =>
  plan.steps.filter(step => step.cri.lastResort === true).length;

const totalWeight = (plan: Plan): number =>
  plan.steps.reduce((sum, step) => sum + step.cri.weight, 0);

// Best route first. Certainty outranks everything: a route the user has already confirmed
// they can complete beats one that depends on an unanswered question, which in turn beats
// one that asks them to reconsider an answer they have already given. Only then do we
// prefer routes that avoid a last resort, are shorter, and follow the configured weights.
const byBestRoute = (targetProfiles: TargetProfiles) => (a: Plan, b: Plan): number => {
  const profiles = Object.keys(targetProfiles);

  return (
    certaintyCount(a, Certainty.DECLINED) - certaintyCount(b, Certainty.DECLINED) ||
    certaintyCount(a, Certainty.UNASKED) - certaintyCount(b, Certainty.UNASKED) ||
    lastResortCount(a) - lastResortCount(b) ||
    a.steps.length - b.steps.length ||
    totalWeight(a) - totalWeight(b) ||
    profiles.indexOf(a.profile) - profiles.indexOf(b.profile)
  );
};

// Enumerates every set of remaining checks that would reach a target profile, respecting
// the user's capabilities, the identity data each check needs, the mandatory checks and
// the identity data the policy requires. The engine routes by the first step of the best
// one, which is what stops it starting a journey it cannot finish.
export const planRoutes = (
  availability: CriAvailabilityResult[],
  attempted: CriId[],
  identity: IdentityProfile,
  targetProfiles: TargetProfiles,
  capabilities: UserCapabilities,
  outstandingMandatory: CriId[]
): Routes => {
  const candidates = availability
    .filter(result => !attempted.includes(result.cri.id))
    .map(result => toCandidate(result, capabilities))
    .filter((candidate): candidate is Candidate => candidate !== undefined);

  const plans: Plan[] = [];
  const reaching: number[] = [];

  for (let mask = 0; mask < 1 << candidates.length; mask++) {
    if (reaching.some(smaller => (smaller & mask) === smaller)) continue;

    const chosen = candidates.filter((_, index) => (mask & (1 << index)) !== 0);

    if (!outstandingMandatory.every(criId => chosen.some(({ cri }) => cri.id === criId))) {
      continue;
    }

    const ordered = orderSteps(chosen, identity.identityData);
    if (!ordered) continue;

    const collected = { ...identity.identityData };

    for (const step of ordered) {
      for (const dataType of step.cri.collects) collected[dataType] = true;
    }

    if (!POLICY.REQUIRED_IDENTITY_DATA.every(dataType => collected[dataType])) continue;

    const finalScores = buildScores([...identity.credentials, ...ordered]);
    const profile = matchProfile(targetProfiles, finalScores);
    if (!profile) continue;

    reaching.push(mask);
    plans.push({ steps: ordered, profile, scores: finalScores });
  }

  if (plans.length > 0) {
    return { plans: plans.sort(byBestRoute(targetProfiles)) };
  }

  // Nothing reaches a profile. Report the shortfall against the ceiling — every candidate
  // scoring its best at once — so the refusal can say what was missing and by how much.
  const ceiling = buildScores([...identity.credentials, ...candidates]);

  return { plans: [], shortfall: nearestShortfall(targetProfiles, ceiling) };
};

// The CRI to send the user to, followed by the fallback from each lesser route. Core front
// walks the list: a CRI carrying a question is only taken if the user accepts it, otherwise
// the next one is tried — and one with no question is taken straight away.
export const redirectOptions = (plans: Plan[]): CriOption[] => {
  const options: CriOption[] = [];
  const seen = new Set<CriId>();

  for (const plan of plans) {
    const [step] = plan.steps;
    if (!step || !isConfirmed(plan) || seen.has(step.cri.id)) continue;

    seen.add(step.cri.id);
    options.push({ criId: step.cri.id, document: step.document, question: step.question });

    // Everything after a CRI with nothing to ask is unreachable, so stop there.
    if (step.question === undefined) break;
  }

  return options;
};

export const isConfirmed = (plan: Plan): boolean =>
  plan.steps.every(step => step.certainty === Certainty.CONFIRMED);

export const firstOpenStep = (plan: Plan): Candidate | undefined =>
  plan.steps.find(
    step => step.certainty !== Certainty.CONFIRMED && step.questions.length > 0
  );
