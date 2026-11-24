import {
  CapabilityQuestion,
  CapabilityQuestionKind,
  CriId,
  UserCapabilities
} from '../shared/types';
import { isFinalAnswer } from '../shared/capabilities';
import { CRI_CONFIG, CriConfig, CriRequirements } from './cri-config';

export enum CriAvailability {
  AVAILABLE = 'AVAILABLE',
  FORCED = 'FORCED',
  NEEDS_ANSWER = 'NEEDS_ANSWER',
  UNKNOWN = 'UNKNOWN',
  RECONSIDER = 'RECONSIDER',
  UNAVAILABLE = 'UNAVAILABLE'
}

export enum Verdict {
  MET = 'MET',
  UNKNOWN = 'UNKNOWN',
  NOT_MET = 'NOT_MET'
}

export interface CriAvailabilityResult {
  cri: CriConfig;
  availability: CriAvailability;
  reason?: string;
  questions: CapabilityQuestion[];
  blockedBy: CapabilityQuestion[];
}

const documentsVerdict = (
  requirements: CriRequirements,
  capabilities: UserCapabilities
): Verdict => {
  const required = requirements.documents ?? [];
  if (required.some(document => capabilities.documents[document] === false)) {
    return Verdict.NOT_MET;
  }
  if (required.some(document => capabilities.documents[document] === undefined)) {
    return Verdict.UNKNOWN;
  }
  return Verdict.MET;
};

const excludedDocumentsVerdict = (
  requirements: CriRequirements,
  capabilities: UserCapabilities
): Verdict => {
  const excluded = requirements.excludedDocuments ?? [];
  if (excluded.some(document => capabilities.documents[document] === true)) {
    return Verdict.NOT_MET;
  }
  if (excluded.some(document => capabilities.documents[document] === undefined)) {
    return Verdict.UNKNOWN;
  }
  return Verdict.MET;
};

const documentTypesVerdict = (
  requirements: CriRequirements,
  capabilities: UserCapabilities
): Verdict => {
  const accepted = requirements.documentTypes;
  if (!accepted || accepted.length === 0) {
    return Verdict.MET;
  }
  if (accepted.some(document => capabilities.documentTypes[document] === true)) {
    return Verdict.MET;
  }
  if (accepted.every(document => capabilities.documentTypes[document] === false)) {
    return Verdict.NOT_MET;
  }
  return Verdict.UNKNOWN;
};

const residencyVerdict = (
  requirements: CriRequirements,
  capabilities: UserCapabilities
): Verdict => {
  if (!requirements.residency) return Verdict.MET;
  if (capabilities.residency === undefined) return Verdict.UNKNOWN;
  return requirements.residency.includes(capabilities.residency)
    ? Verdict.MET
    : Verdict.NOT_MET;
};

const deviceVerdict = (
  requirements: CriRequirements,
  capabilities: UserCapabilities
): Verdict => {
  if (!requirements.device) return Verdict.MET;
  if (capabilities.device === undefined) return Verdict.UNKNOWN;
  return requirements.device.includes(capabilities.device) ? Verdict.MET : Verdict.NOT_MET;
};

export const requirementsVerdict = (
  requirements: CriRequirements | undefined,
  capabilities: UserCapabilities
): Verdict => {
  if (!requirements) return Verdict.MET;

  const verdicts = [
    documentsVerdict(requirements, capabilities),
    excludedDocumentsVerdict(requirements, capabilities),
    documentTypesVerdict(requirements, capabilities),
    residencyVerdict(requirements, capabilities),
    deviceVerdict(requirements, capabilities)
  ];

  if (verdicts.includes(Verdict.NOT_MET)) return Verdict.NOT_MET;
  if (verdicts.includes(Verdict.UNKNOWN)) return Verdict.UNKNOWN;
  return Verdict.MET;
};

export const openQuestions = (
  requirements: CriRequirements | undefined,
  capabilities: UserCapabilities
): CapabilityQuestion[] => {
  if (!requirements) return [];

  const questions: CapabilityQuestion[] = [];

  for (const documentAccess of requirements.documents ?? []) {
    if (capabilities.documents[documentAccess] === undefined) {
      questions.push({ kind: CapabilityQuestionKind.DOCUMENT_ACCESS, documentAccess });
    }
  }

  for (const documentAccess of requirements.excludedDocuments ?? []) {
    if (capabilities.documents[documentAccess] === undefined) {
      questions.push({ kind: CapabilityQuestionKind.DOCUMENT_ACCESS, documentAccess });
    }
  }

  if (documentTypesVerdict(requirements, capabilities) === Verdict.UNKNOWN) {
    for (const documentType of requirements.documentTypes ?? []) {
      if (capabilities.documentTypes[documentType] === undefined) {
        questions.push({ kind: CapabilityQuestionKind.DOCUMENT_TYPE, documentType });
      }
    }
  }

  if (deviceVerdict(requirements, capabilities) === Verdict.UNKNOWN) {
    questions.push({ kind: CapabilityQuestionKind.DEVICE });
  }

  return questions;
};

export const blockingQuestions = (
  requirements: CriRequirements | undefined,
  capabilities: UserCapabilities
): CapabilityQuestion[] => {
  if (!requirements) return [];

  const questions: CapabilityQuestion[] = [];

  for (const documentAccess of requirements.documents ?? []) {
    if (capabilities.documents[documentAccess] === false) {
      questions.push({ kind: CapabilityQuestionKind.DOCUMENT_ACCESS, documentAccess });
    }
  }

  if (documentTypesVerdict(requirements, capabilities) === Verdict.NOT_MET) {
    for (const documentType of requirements.documentTypes ?? []) {
      questions.push({ kind: CapabilityQuestionKind.DOCUMENT_TYPE, documentType });
    }
  }

  if (deviceVerdict(requirements, capabilities) === Verdict.NOT_MET) {
    questions.push({ kind: CapabilityQuestionKind.DEVICE });
  }

  return questions;
};

export const describeRequirements = (requirements?: CriRequirements): string => {
  if (!requirements) return 'no requirements';
  return [
    ...(requirements.documents ?? []),
    ...(requirements.excludedDocuments ?? []).map(d => `not ${d}`),
    ...(requirements.documentTypes ?? []),
    ...(requirements.residency ?? []),
    ...(requirements.device ?? [])
  ].join(' + ');
};

const isForced = (cri: CriConfig, capabilities: UserCapabilities): boolean =>
  cri.enabled &&
  cri.forcedWhen !== undefined &&
  requirementsVerdict(cri.forcedWhen, capabilities) === Verdict.MET;

const withAdditionalQuestion = (
  result: CriAvailabilityResult,
  capabilities: UserCapabilities
): CriAvailabilityResult => {
  const { cri } = result;
  if (!cri.askQuestions) return result;

  const answer = capabilities.additionalAnswers[cri.id];

  if (answer === undefined) {
    return {
      ...result,
      availability: CriAvailability.NEEDS_ANSWER,
      reason: cri.askQuestions.question
    };
  }

  if (answer !== 0) {
    return {
      ...result,
      availability: CriAvailability.UNAVAILABLE,
      reason: `answered "${cri.askQuestions.answers[answer] ?? answer}"`,
      blockedBy: []
    };
  }

  return result;
};

const secondChanceQuestions = (
  blockedBy: CapabilityQuestion[],
  capabilities: UserCapabilities
): CapabilityQuestion[] => {
  const isType = (question: CapabilityQuestion) =>
    question.kind === CapabilityQuestionKind.DOCUMENT_TYPE;
  const final = (question: CapabilityQuestion) => isFinalAnswer(capabilities, question);
  const types = blockedBy.filter(isType);

  if (blockedBy.some(question => !isType(question) && final(question))) return [];
  if (types.length > 0 && types.every(final)) return [];

  return blockedBy.filter(question => !final(question));
};

const withSecondChance = (
  result: CriAvailabilityResult,
  capabilities: UserCapabilities
): CriAvailabilityResult => {
  if (result.availability !== CriAvailability.UNAVAILABLE || result.blockedBy.length === 0) {
    return result;
  }

  const questions = secondChanceQuestions(result.blockedBy, capabilities);

  if (questions.length === 0) {
    return { ...result, reason: `${result.reason} — confirmed no` };
  }

  return { ...result, availability: CriAvailability.RECONSIDER, blockedBy: questions };
};

export const resolveCriAvailability = (
  capabilities: UserCapabilities,
  attempted: CriId[] = []
): CriAvailabilityResult[] => {
  const forcedGroups = new Map(
    CRI_CONFIG.filter(cri => isForced(cri, capabilities)).map(cri => [cri.group, cri.id])
  );

  const results: CriAvailabilityResult[] = CRI_CONFIG.map(cri => {
    if (!cri.enabled) {
      return {
        cri,
        availability: CriAvailability.UNAVAILABLE,
        reason: 'disabled in config',
        questions: [],
        blockedBy: []
      };
    }

    if (forcedGroups.get(cri.group) === cri.id) {
      const forcedVerdict = requirementsVerdict(cri.requirements, capabilities);

      if (forcedVerdict === Verdict.NOT_MET) {
        return {
          cri,
          availability: CriAvailability.UNAVAILABLE,
          reason: `forced, but needs ${describeRequirements(cri.requirements)}`,
          questions: [],
          blockedBy: blockingQuestions(cri.requirements, capabilities)
        };
      }

      if (forcedVerdict === Verdict.UNKNOWN) {
        return {
          cri,
          availability: CriAvailability.UNKNOWN,
          reason: `forced, but needs ${describeRequirements(cri.requirements)}`,
          questions: openQuestions(cri.requirements, capabilities),
          blockedBy: []
        };
      }

      return withAdditionalQuestion(
        {
          cri,
          availability: CriAvailability.FORCED,
          reason: describeRequirements(cri.forcedWhen),
          questions: [],
          blockedBy: []
        },
        capabilities
      );
    }

    const forcedSibling = forcedGroups.get(cri.group);
    if (forcedSibling) {
      return {
        cri,
        availability: CriAvailability.UNAVAILABLE,
        reason: `${forcedSibling} is forced for this user`,
        questions: [],
        blockedBy: []
      };
    }

    const verdict = requirementsVerdict(cri.requirements, capabilities);

    if (verdict === Verdict.NOT_MET) {
      return {
        cri,
        availability: CriAvailability.UNAVAILABLE,
        reason: describeRequirements(cri.requirements),
        questions: [],
        blockedBy: blockingQuestions(cri.requirements, capabilities)
      };
    }

    if (verdict === Verdict.UNKNOWN) {
      return {
        cri,
        availability: CriAvailability.UNKNOWN,
        reason: 'not asked yet',
        questions: openQuestions(cri.requirements, capabilities),
        blockedBy: []
      };
    }

    return withAdditionalQuestion(
      {
        cri,
        availability: CriAvailability.AVAILABLE,
        questions: [],
        blockedBy: []
      },
      capabilities
    );
  });

  return results.map(result => withSecondChance(result, capabilities));
};
