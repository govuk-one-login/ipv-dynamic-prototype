import {
  DeviceAccess,
  DocumentAccess,
  DocumentType,
  Residency,
  UserCapabilities
} from '../shared/types';
import {
  CANNOT_PROVE_IDENTITY,
  haveAccessToAlternativePhotoId,
  haveAccessToCompatiblePhone,
  haveAccessToPhotoId,
  haveBiometricPassport,
  havePassportOrDrivingLicence,
  liveInUk,
  needBiometricPassport,
  Question
} from './questions';

export enum PhotoIdType {
  DRIVING_LICENCE = 'DRIVING_LICENCE',
  PASSPORT = 'PASSPORT'
}

export interface TriageAnswers {
  livesInUk?: boolean;
  hasBiometricPassport?: boolean;
  useBiometricPassport?: boolean;
  hasPhotoId?: boolean;
  hasAlternativePhotoId?: boolean;
  hasCompatiblePhone?: boolean;
  photoIdType?: PhotoIdType;
}

type AnswerKey = keyof TriageAnswers;

export interface TriageOption<K extends AnswerKey> {
  label: string;
  value: NonNullable<TriageAnswers[K]>;
}

export interface TriageStep<K extends AnswerKey> {
  id: K;
  prompt: string;
  options: ReadonlyArray<TriageOption<K>>;
  askWhen: (answers: TriageAnswers) => boolean;
}

export type AnyTriageStep = { [K in AnswerKey]-?: TriageStep<K> }[AnswerKey];

const yesNo = <K extends AnswerKey>(question: Question): ReadonlyArray<TriageOption<K>> => [
  { label: question.answers[0], value: true as NonNullable<TriageAnswers[K]> },
  { label: question.answers[1], value: false as NonNullable<TriageAnswers[K]> }
];

const livesInUk = (a: TriageAnswers) => a.livesInUk === true;
const livesAbroad = (a: TriageAnswers) => a.livesInUk === false;

// Someone abroad who says they have no biometric passport is shown a page telling them
// one is required, where they can either say they will use one after all or give up. So
// anyone abroad still in the journey has a biometric passport.
const hasBiometricPassport = (a: TriageAnswers) =>
  a.hasBiometricPassport === true || a.useBiometricPassport === true;

export const TRIAGE_FLOW: AnyTriageStep[] = [
  {
    id: 'livesInUk',
    prompt: liveInUk.question,
    options: [
      { label: liveInUk.answers[0], value: true },
      { label: liveInUk.answers[1], value: false }
    ],
    askWhen: () => true
  },
  {
    id: 'hasBiometricPassport',
    prompt: haveBiometricPassport.question,
    options: yesNo(haveBiometricPassport),
    askWhen: livesAbroad
  },
  {
    id: 'useBiometricPassport',
    prompt: needBiometricPassport.question,
    options: yesNo(needBiometricPassport),
    askWhen: a => livesAbroad(a) && a.hasBiometricPassport === false
  },
  {
    id: 'hasPhotoId',
    prompt: haveAccessToPhotoId.question,
    options: yesNo(haveAccessToPhotoId),
    askWhen: livesInUk
  },
  {
    id: 'hasAlternativePhotoId',
    prompt: haveAccessToAlternativePhotoId.question,
    options: yesNo(haveAccessToAlternativePhotoId),
    askWhen: a => livesInUk(a) && a.hasPhotoId === false
  },
  {
    id: 'hasCompatiblePhone',
    prompt: haveAccessToCompatiblePhone.question,
    options: yesNo(haveAccessToCompatiblePhone),
    askWhen: a =>
      (livesInUk(a) && a.hasPhotoId === true) ||
      (livesAbroad(a) && hasBiometricPassport(a))
  },
  {
    id: 'photoIdType',
    prompt: havePassportOrDrivingLicence.question,
    options: [
      { label: havePassportOrDrivingLicence.answers[0], value: PhotoIdType.DRIVING_LICENCE },
      { label: havePassportOrDrivingLicence.answers[1], value: PhotoIdType.PASSPORT }
    ],
    askWhen: a => livesInUk(a) && a.hasPhotoId === true && a.hasCompatiblePhone === false
  }
];

export const nextTriageStep = (answers: TriageAnswers): AnyTriageStep | undefined =>
  TRIAGE_FLOW.find(step => step.askWhen(answers) && answers[step.id] === undefined);

export const triageFailure = (answers: TriageAnswers): string | undefined =>
  answers.useBiometricPassport === false ? CANNOT_PROVE_IDENTITY : undefined;

export const applyAnswer = (
  answers: TriageAnswers,
  step: AnyTriageStep,
  optionIndex: number
): TriageAnswers => {
  const option = step.options[optionIndex];
  if (!option) return answers;
  return { ...answers, [step.id]: option.value } as TriageAnswers;
};

export const toCapabilities = (answers: TriageAnswers): UserCapabilities => {
  const documents: Partial<Record<DocumentAccess, boolean>> = {};
  const documentTypes: Partial<Record<DocumentType, boolean>> = {};

  if (answers.hasPhotoId !== undefined) {
    documents[DocumentAccess.PHOTO_ID] = answers.hasPhotoId;
  }
  if (answers.hasAlternativePhotoId !== undefined) {
    documents[DocumentAccess.ALTERNATIVE_PHOTO_ID] = answers.hasAlternativePhotoId;
  }
  if (answers.hasBiometricPassport !== undefined || answers.useBiometricPassport !== undefined) {
    const held = hasBiometricPassport(answers);
    documents[DocumentAccess.BIOMETRIC_PASSPORT] = held;

    if (held) {
      documents[DocumentAccess.PHOTO_ID] = true;
      documentTypes[DocumentType.NON_UK_PASSPORT_WITH_BIOMETRIC_CHIP] = true;
    }
  }
  if (answers.photoIdType !== undefined) {
    documentTypes[DocumentType.UK_PASSPORT] = answers.photoIdType === PhotoIdType.PASSPORT;
    documentTypes[DocumentType.UK_DRIVING_LICENCE] =
      answers.photoIdType === PhotoIdType.DRIVING_LICENCE;
  }

  return {
    residency:
      answers.livesInUk === undefined
        ? undefined
        : answers.livesInUk
          ? Residency.UK
          : Residency.INTERNATIONAL,
    device:
      answers.hasCompatiblePhone === undefined
        ? undefined
        : answers.hasCompatiblePhone
          ? DeviceAccess.COMPATIBLE_PHONE
          : DeviceAccess.NO_COMPATIBLE_PHONE,
    documents,
    documentTypes,
    additionalAnswers: {},
    finalAnswers: []
  };
};
