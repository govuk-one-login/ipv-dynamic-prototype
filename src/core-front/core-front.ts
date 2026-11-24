import { answerCapabilityQuestion, markFinalAnswer } from '../shared/capabilities';
import {
  AskOutcome,
  CapabilityQuestion,
  CapabilityQuestionKind,
  CriId,
  CriOption,
  DocumentAccess,
  DocumentType,
  Engine,
  EngineResult,
  LevelOfConfidence,
  RouteQuestion,
  UserCapabilities
} from '../shared/types';
import { CRI_NAMES } from './labels';
import {
  haveAccessToAlternativePhotoId,
  haveAccessToCompatiblePhone,
  haveAccessToPhotoId,
  haveBiometricPassport
} from './questions';
import { applyAnswer, nextTriageStep, toCapabilities, TriageAnswers } from './triage';

export type AskQuestion = (prompt: string, options: readonly string[]) => Promise<number>;

const DOCUMENT_ACCESS_QUESTIONS: Record<DocumentAccess, string> = {
  [DocumentAccess.PHOTO_ID]: haveAccessToPhotoId.question,
  [DocumentAccess.ALTERNATIVE_PHOTO_ID]: haveAccessToAlternativePhotoId.question,
  [DocumentAccess.BIOMETRIC_PASSPORT]: haveBiometricPassport.question
};

const DOCUMENT_TYPE_QUESTIONS: Partial<Record<DocumentType, string>> = {
  [DocumentType.ONLINE_BANKING]: 'Can you sign in to your online banking?',
  [DocumentType.BANK_ACCOUNT]: 'Do you have a UK bank account?',
  [DocumentType.NATIONAL_INSURANCE_NUMBER]: 'Do you know your National Insurance number?'
};

export const capabilityQuestionPrompt = (question: CapabilityQuestion): string => {
  switch (question.kind) {
    case CapabilityQuestionKind.DOCUMENT_ACCESS:
      return DOCUMENT_ACCESS_QUESTIONS[question.documentAccess];
    case CapabilityQuestionKind.DOCUMENT_TYPE:
      return (
        DOCUMENT_TYPE_QUESTIONS[question.documentType] ??
        `Do you have this document: ${question.documentType}?`
      );
    case CapabilityQuestionKind.DEVICE:
      return haveAccessToCompatiblePhone.question;
  }
};

interface Reconsideration {
  said: string;
  unless: string;
  ask: string;
}

const DOCUMENT_ACCESS_RECONSIDERATIONS: Record<DocumentAccess, Omit<Reconsideration, 'ask'>> = {
  [DocumentAccess.PHOTO_ID]: {
    said: "you don't have any of the accepted types of photo ID",
    unless: 'If you do have one'
  },
  [DocumentAccess.ALTERNATIVE_PHOTO_ID]: {
    said: "you don't have photo ID you can take to a Post Office",
    unless: 'If you do have one'
  },
  [DocumentAccess.BIOMETRIC_PASSPORT]: {
    said: "you don't have a biometric passport",
    unless: 'If you do have one'
  }
};

const DOCUMENT_TYPE_RECONSIDERATIONS: Partial<Record<DocumentType, Reconsideration>> = {
  [DocumentType.ONLINE_BANKING]: {
    said: "you can't sign in to your online banking",
    unless: 'If you can',
    ask: 'Can you sign in to your online banking?'
  },
  [DocumentType.NATIONAL_INSURANCE_NUMBER]: {
    said: "you don't know your National Insurance number",
    unless: 'If you do know it',
    ask: 'Do you know your National Insurance number?'
  }
};

const reconsideration = (question: CapabilityQuestion): Reconsideration => {
  switch (question.kind) {
    case CapabilityQuestionKind.DOCUMENT_ACCESS:
      return {
        ...DOCUMENT_ACCESS_RECONSIDERATIONS[question.documentAccess],
        ask: capabilityQuestionPrompt(question)
      };
    case CapabilityQuestionKind.DOCUMENT_TYPE:
      return (
        DOCUMENT_TYPE_RECONSIDERATIONS[question.documentType] ?? {
          said: `you don't have a ${question.documentType}`,
          unless: 'If you do have one',
          ask: `Do you have a ${question.documentType}?`
        }
      );
    case CapabilityQuestionKind.DEVICE:
      return {
        said: "you don't have access to a compatible phone",
        unless: 'If you do have one',
        ask: capabilityQuestionPrompt(question)
      };
  }
};

export const routeQuestionPrompt = (entry: RouteQuestion): string => {
  if (!entry.retry) {
    return capabilityQuestionPrompt(entry.question);
  }

  const { said, unless, ask } = reconsideration(entry.question);

  return `Earlier you said ${said}. ${unless}, you can use ${CRI_NAMES[entry.criId]}. ${ask}`;
};

export const answerAdditionalQuestion = (
  capabilities: UserCapabilities,
  criId: CriId,
  answer: number
): UserCapabilities => ({
  ...capabilities,
  additionalAnswers: { ...capabilities.additionalAnswers, [criId]: answer }
});

export interface Session {
  userId: string;
  requiredLevelOfConfidence: LevelOfConfidence;
  answers: TriageAnswers;
  capabilities: UserCapabilities;
  attempted: CriId[];
}

export const startSession = (
  userId: string,
  requiredLevelOfConfidence: LevelOfConfidence
): Session => ({
  userId,
  requiredLevelOfConfidence,
  answers: {},
  capabilities: toCapabilities({}),
  attempted: []
});

export const askTriageQuestions = async (
  session: Session,
  ask: AskQuestion
): Promise<Session> => {
  let answers = session.answers;
  let step = nextTriageStep(answers);

  while (step) {
    const index = await ask(step.prompt, step.options.map(option => option.label));
    answers = applyAnswer(answers, step, index);
    step = nextTriageStep(answers);
  }

  return { ...session, answers, capabilities: toCapabilities(answers) };
};

export const recordAttempt = (session: Session, criId: CriId): Session => ({
  ...session,
  attempted: session.attempted.includes(criId)
    ? [...session.attempted]
    : [...session.attempted, criId]
});

export interface RouteAnswers {
  session: Session;
  options?: CriOption[];
  message?: string;
}

export const askRouteQuestions = async (
  session: Session,
  questions: RouteQuestion[],
  otherwise: AskOutcome,
  ask: AskQuestion
): Promise<RouteAnswers> => {
  let capabilities = session.capabilities;

  for (const entry of questions) {
    const index = await ask(routeQuestionPrompt(entry), ['Yes', 'No']);
    const held = index === 0;
    capabilities =
      entry.retry && !held
        ? markFinalAnswer(capabilities, entry.question)
        : answerCapabilityQuestion(capabilities, entry.question, held);

    if (held) {
      return { session: { ...session, capabilities }, options: entry.onYes };
    }
  }

  return { session: { ...session, capabilities }, ...otherwise };
};

export const requestNextStep = (session: Session, engine: Engine): EngineResult =>
  engine.processRequest({
    userId: session.userId,
    capabilities: session.capabilities,
    requiredLevelOfConfidence: session.requiredLevelOfConfidence,
    attempted: session.attempted
  });

export interface ChosenRedirect {
  session: Session;
  criId?: CriId;
}

// Walks the CRIs the engine offered, in its order. One with no question of its own is
// taken immediately; one with a question is only taken if the user picks its first answer,
// otherwise the answer is recorded and the next CRI is offered — asking its question if it
// has one, or redirecting straight there if it does not. Running out means every option was
// declined, and the recorded answers let the engine plan again without them.
export const chooseRedirect = async (
  session: Session,
  options: CriOption[],
  ask: AskQuestion
): Promise<ChosenRedirect> => {
  let capabilities = session.capabilities;

  for (const option of options) {
    if (!option.question) {
      return { session: { ...session, capabilities }, criId: option.criId };
    }

    const answer = await ask(option.question.question, option.question.answers);
    capabilities = answerAdditionalQuestion(capabilities, option.criId, answer);

    if (answer === 0) {
      return { session: { ...session, capabilities }, criId: option.criId };
    }
  }

  return { session: { ...session, capabilities } };
};

export * from './labels';
export * from './triage';
