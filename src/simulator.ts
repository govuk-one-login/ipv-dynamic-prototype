import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import {
  askRouteQuestions,
  askTriageQuestions,
  chooseRedirect,
  CRI_LABELS,
  recordAttempt,
  requestNextStep,
  Session,
  startSession,
  triageFailure
} from './core-front/core-front';
import { createEngine, describeAvailability, targetProfilesFor } from './engine/engine';
import { createEvcs } from './evcs/evcs';
import * as render from './render';
import { CRI_CHECKS } from './shared/checks';
import { buildScores, resolveScores } from './shared/gpg45';
import {
  AchievedIdentity,
  Action,
  AskOutcome,
  CredentialStore,
  CriCheck,
  CriId,
  CriOption,
  LevelOfConfidence,
  RouteQuestion,
  VerifiableCredential
} from './shared/types';

const rl = readline.createInterface({ input, output });

const ask = async (prompt: string, options: readonly string[]): Promise<number> => {
  const list = options
    .map((option, index) => `  ${render.dim(`${index + 1}`.padStart(2))}  ${option}`)
    .join('\n');

  while (true) {
    const answer = await rl.question(`${render.question(prompt)}\n${list}\n${render.cursor()}`);
    const index = parseInt(answer, 10) - 1;
    if (options[index] !== undefined) return index;
    console.log(render.warn('Invalid choice, try again.'));
  }
};

enum JourneyType {
  NEW_IDENTITY = 'New Identity'
}

const askJourneyType = async (): Promise<JourneyType> => {
  const journeyTypes = Object.values(JourneyType);
  const index = await ask('Choose journey type', journeyTypes);
  return journeyTypes[index];
};

const askLevelOfConfidence = async (): Promise<LevelOfConfidence> => {
  const levels = Object.values(LevelOfConfidence);
  const index = await ask('Required level of confidence?', levels);
  return levels[index];
};

interface CheckOption {
  check: CriCheck;
  successful: boolean;
}

const issueCredential = (criId: CriId, option: CheckOption): VerifiableCredential => {
  const { check, successful } = option;

  return {
    cri: criId,
    check: check.label,
    successful,
    document: check.document,
    scores: check.scores,
    biometricVerificationProcessLevel: check.biometricVerificationProcessLevel,
    nonFatalFraudFailure: check.nonFatalFraudFailure,
    collected: successful ? CRI_CHECKS[criId].collects : [],
    contraIndicators: []
  };
};

const pickCheck = async (criId: CriId): Promise<CheckOption> => {
  const { successful, failed } = CRI_CHECKS[criId];
  const options: CheckOption[] = [
    ...successful.map(check => ({ check, successful: true })),
    ...failed.map(check => ({ check, successful: false }))
  ];

  const labels = render.checkOptions(
    options.map(({ check, successful: passed }) => ({
      label: check.label,
      document: check.document,
      scores: resolveScores(check),
      successful: passed
    }))
  );

  const index = await ask('Which result should this check return?', labels);
  return options[index];
};

// Everything the engine will see on the next call, laid out before it is asked. The point
// is that the decision which follows should be explainable from what is on screen.
const printState = (session: Session, evcs: CredentialStore, step: number) => {
  const stored = evcs.fetch(session.userId);
  const scores = buildScores(stored);
  const targets = targetProfilesFor(session.requiredLevelOfConfidence, stored);

  console.log(
    render.banner(
      `STEP ${step}`,
      `${session.requiredLevelOfConfidence} · ${session.userId} · ${stored.length} VC(s)`
    )
  );

  console.log(render.rule('Scores held, against every target profile'));
  render.print(render.identityScores(scores, targets));

  console.log(render.rule(`EVCS — ${stored.length} credential(s)`));
  render.print(render.credentials(stored));

  console.log(render.rule('Capabilities core-front has collected'));
  render.print(render.capabilities(session.capabilities));

  console.log(render.rule('CRI availability by group — weight, state, and the most each could award'));
  render.print(render.availability(describeAvailability(session.capabilities, session.attempted), session.attempted));
};

const printIdentity = (identity: AchievedIdentity) => {
  console.log(render.banner('IDENTITY ACHIEVED', `${identity.profile} at ${identity.levelOfConfidence}`));

  console.log(render.rule('Final scores'));
  render.print(
    render.identityScores(
      identity.scores,
      targetProfilesFor(identity.levelOfConfidence, identity.credentials)
    )
  );

  console.log(render.rule('Credentials that got the user there'));
  render.print(render.credentials(identity.credentials));
  console.log();
};

const printRouteQuestions = (questions: RouteQuestion[], otherwise: AskOutcome) => {
  console.log(render.rule('Questions in this batch, in the order they are asked'));
  render.print(render.routeQuestions(questions, otherwise));
};

const simulateJourney = async () => {
  console.log(render.banner('DYNAMIC IPV'));
  console.log(
    render.dim(
      '  A CLI simulation of a dynamic identity journey. The engine plans a route to a\n' +
        '  target profile from what is in EVCS and what the user says they have.\n'
    )
  );

  const evcs = createEvcs();
  const engine = createEngine(evcs);

  const journeyType = await askJourneyType();
  const requiredLevelOfConfidence = await askLevelOfConfidence();

  let session = startSession('user-1', requiredLevelOfConfidence);

  // Ask the engine before collecting anything. The feasibility check does not depend on
  // the user's capabilities, so if the requested level of confidence is out of reach for
  // everyone there is no point putting them through triage first.
  const feasibility = requestNextStep(session, engine);
  if (feasibility.action === Action.STOP) {
    console.log(render.decision('stop'));
    console.log(`  ${render.warn(feasibility.message)}\n`);
    rl.close();
    return;
  }

  console.log(render.rule(`Triage — ${journeyType}, targeting ${requiredLevelOfConfidence}`));
  session = await askTriageQuestions(session, ask);

  // Triage can rule the journey out on its own, in which case the engine is never asked.
  const failure = triageFailure(session.answers);
  if (failure) {
    console.log(render.halt('journey ended in triage — the engine was not called'));
    console.log(`  ${render.warn(failure)}\n`);
    rl.close();
    return;
  }

  for (let step = 1; ; step++) {
    printState(session, evcs, step);

    const next = requestNextStep(session, engine);

    if (next.action === Action.COMPLETE) {
      console.log(render.decision(`complete — ${next.message}`));
      printIdentity(next.identity);
      break;
    }

    if (next.action === Action.STOP) {
      console.log(render.decision('stop'));
      console.log(`  ${render.warn(next.message)}\n`);
      break;
    }

    let options: CriOption[];

    if (next.action === Action.ASK) {
      console.log(
        render.decision(`ask the user — ${next.questions.length} question(s) in one batch`)
      );
      printRouteQuestions(next.questions, next.otherwise);

      const answered = await askRouteQuestions(session, next.questions, next.otherwise, ask);
      session = answered.session;

      if (answered.message !== undefined) {
        console.log(render.halt('stop — carried in the batch, the engine was not called again'));
        console.log(`  ${render.warn(answered.message)}
`);
        break;
      }

      if (answered.options === undefined) {
        console.log(`
  ${render.dim('This answer needs a follow-up — asking the engine again.')}`);
        continue;
      }

      console.log(render.rule('Redirect carried in the batch — the engine was not called again'));
      options = answered.options;
    } else {
      console.log(render.decision(`redirect — ${next.options.length} option(s) offered`));
      options = next.options;
    }

    render.print(render.options(options));

    const chosen = await chooseRedirect(session, options, ask);
    session = chosen.session;

    if (chosen.criId === undefined) {
      console.log(`
  ${render.warn('Every option was declined — asking the engine again.')}`);
      continue;
    }

    console.log(render.prompt(CRI_LABELS[chosen.criId]));

    const option = await pickCheck(chosen.criId);
    evcs.store(session.userId, issueCredential(chosen.criId, option));
    session = recordAttempt(session, chosen.criId);
  }

  rl.close();
};

simulateJourney();
