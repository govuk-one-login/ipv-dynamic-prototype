import { DocumentType } from '../shared/types';

export { DocumentType };

export type Question = {
    question: string;
    answers: readonly string[];
};

export const liveInUk: Question = {
    question: "Do you live in the UK?",
    answers: ["UK", "Another country"]
}

export const haveBiometricPassport: Question = {
    question: "Do you have access to biometric passport?",
    answers: ["Yes", "No"]
}

export const haveAccessToPhotoId: Question = {
    question: `Tell us if you have one of the following types of photo ID. ${DocumentType.UK_PASSPORT}, ${DocumentType.NON_UK_PASSPORT_WITH_BIOMETRIC_CHIP}, ${DocumentType.UK_DRIVING_LICENCE}, ${DocumentType.UK_BRP}.`,
    answers: ["Yes", "No"]
}

export const haveAccessToAlternativePhotoId: Question = {
    question: `Prove your identity at Post Office. Do you have any of these types of photo ID? ${DocumentType.EU_DRIVING_LICENCE}, ${DocumentType.NON_UK_PASSPORT}, ${DocumentType.NATIONAL_IDENTITY_CARD}`,
    answers: ["Yes", "No"]
}

export const haveAccessToCompatiblePhone: Question = {
    question: "Do you have access to compatible phone?",
    answers: ["Yes", "No"]
}

export const needBiometricPassport: Question = {
    question: "You need biometric passport to prove your identity.",
    answers: ["Use passport with biometric chip", "Fail"]
}

export const CANNOT_PROVE_IDENTITY =
    "Sorry, you cannot prove your identity without a passport with a biometric chip.";

export const havePassportOrDrivingLicence: Question = {
    question: "Do you have a passport or a driving licence?",
    answers: ["Driving licence", "Passport"]
}
