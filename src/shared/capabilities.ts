import {
  CapabilityQuestion,
  CapabilityQuestionKind,
  DeviceAccess,
  UserCapabilities
} from './types';

const sameQuestion = (a: CapabilityQuestion, b: CapabilityQuestion): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

export const isFinalAnswer = (
  capabilities: UserCapabilities,
  question: CapabilityQuestion
): boolean => capabilities.finalAnswers.some(answered => sameQuestion(answered, question));

export const markFinalAnswer = (
  capabilities: UserCapabilities,
  question: CapabilityQuestion
): UserCapabilities =>
  isFinalAnswer(capabilities, question)
    ? capabilities
    : { ...capabilities, finalAnswers: [...capabilities.finalAnswers, question] };

export const answerCapabilityQuestion = (
  capabilities: UserCapabilities,
  question: CapabilityQuestion,
  held: boolean
): UserCapabilities => {
  switch (question.kind) {
    case CapabilityQuestionKind.DOCUMENT_ACCESS:
      return {
        ...capabilities,
        documents: { ...capabilities.documents, [question.documentAccess]: held }
      };
    case CapabilityQuestionKind.DOCUMENT_TYPE:
      return {
        ...capabilities,
        documentTypes: { ...capabilities.documentTypes, [question.documentType]: held }
      };
    case CapabilityQuestionKind.DEVICE:
      return {
        ...capabilities,
        device: held ? DeviceAccess.COMPATIBLE_PHONE : DeviceAccess.NO_COMPATIBLE_PHONE
      };
  }
};
