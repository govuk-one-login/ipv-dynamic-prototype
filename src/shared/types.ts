export enum IdentityData {
  NAME = 'NAME',
  DOB = 'DOB',
  ADDRESS = 'ADDRESS'
}

export enum ScoreType {
  STRENGTH = 'strength',
  VALIDITY = 'validity',
  FRAUD = 'fraud',
  ACTIVITY = 'activity',
  VERIFICATION = 'verification'
}

export enum LevelOfConfidence {
  LOW = 'P1',
  MEDIUM = 'P2',
  HIGH = 'P3'
}

export enum DocumentType {
  UK_PASSPORT = "UK passport",
  NON_UK_PASSPORT_WITH_BIOMETRIC_CHIP = "Non UK passport with biometric chip",
  NON_UK_PASSPORT = "Non UK passport",
  UK_DRIVING_LICENCE = "UK driving licence",
  EU_DRIVING_LICENCE = "EU driving licence",
  UK_BRP = "UK Biometric residence permit",
  UK_BRC = "UK Biometric residence card",
  UK_FWP = "UK Frontier worker permit",
  NATIONAL_IDENTITY_CARD = "National Identity Card",
  BANK_ACCOUNT = "UK bank account",
  ONLINE_BANKING = "Online banking",
  NATIONAL_INSURANCE_NUMBER = "National Insurance number"
}

export enum Residency {
  UK = 'UK',
  INTERNATIONAL = 'INTERNATIONAL'
}

export enum DeviceAccess {
  COMPATIBLE_PHONE = 'COMPATIBLE_PHONE',
  NO_COMPATIBLE_PHONE = 'NO_COMPATIBLE_PHONE'
}

export enum DocumentAccess {
  PHOTO_ID = 'PHOTO_ID',
  ALTERNATIVE_PHOTO_ID = 'ALTERNATIVE_PHOTO_ID',
  BIOMETRIC_PASSPORT = 'BIOMETRIC_PASSPORT'
}

export interface UserCapabilities {
  residency?: Residency;
  device?: DeviceAccess;
  documents: Partial<Record<DocumentAccess, boolean>>;
  documentTypes: Partial<Record<DocumentType, boolean>>;
  // The answer index the user gave to a CRI's own additional question. 0 is the first
  // answer, which is the one that keeps the CRI in play.
  additionalAnswers: Partial<Record<CriId, number>>;
  finalAnswers: CapabilityQuestion[];
}

export enum CapabilityQuestionKind {
  DOCUMENT_ACCESS = 'DOCUMENT_ACCESS',
  DOCUMENT_TYPE = 'DOCUMENT_TYPE',
  DEVICE = 'DEVICE'
}

export type CapabilityQuestion =
  | { kind: CapabilityQuestionKind.DOCUMENT_ACCESS; documentAccess: DocumentAccess }
  | { kind: CapabilityQuestionKind.DOCUMENT_TYPE; documentType: DocumentType }
  | { kind: CapabilityQuestionKind.DEVICE };

// A question a CRI needs answered before it runs, which does not change whether the CRI
// is the best choice — only whether this user ends up taking it. Answering with the first
// option keeps the CRI; any other answer rules it out and the next option is tried.
export interface AdditionalQuestion {
  question: string;
  answers: string[];
}

export interface CriOption {
  criId: CriId;
  document?: DocumentType;
  question?: AdditionalQuestion;
}

export interface RouteQuestion {
  question: CapabilityQuestion;
  criId: CriId;
  document?: DocumentType;
  achieves: string;
  scores: Partial<Record<ScoreType, number>>;
  retry?: boolean;
  onYes?: CriOption[];
}

export type AskOutcome = { options: CriOption[] } | { message: string };

export enum CriGroup {
  IDENTITY = 'IDENTITY',
  DOCUMENT = 'DOCUMENT',
  ADDRESS = 'ADDRESS',
  FRAUD = 'FRAUD',
  VERIFICATION = 'VERIFICATION'
}

export enum CriId {
  CLAIMED_IDENTITY = 'claimed-identity',
  APP = "app",
  F2F = "F2F",
  WEB_PASSPORT = 'web-passport',
  WEB_DL = 'web-dl',
  ADDRESS = 'address',
  FRAUD = 'fraud',
  KBV = 'kbv',
  DWP_KBV = 'dwp-kbv',
  BAV = 'bav',
  NINO = 'nino',
  OPEN_BANKING = 'open-banking'
}

export interface Evidence {
  strength: number;
  validity: number;
}

export interface Gpg45Scores {
  evidences: Evidence[];
  activity: number;
  fraud: number;
  verification: number;
}

export type TargetProfiles = Record<string, Gpg45Scores>;

export interface CriCheck {
  label: string;
  document?: DocumentType;
  scores: Partial<Record<ScoreType, number>>;
  biometricVerificationProcessLevel?: number;
  nonFatalFraudFailure?: boolean;
}

export interface CriChecks {
  collects: IdentityData[];
  successful: CriCheck[];
  failed: CriCheck[];
}

export interface VerifiableCredential {
  cri: CriId;
  check: string;
  successful: boolean;
  document?: DocumentType;
  scores: Partial<Record<ScoreType, number>>;
  biometricVerificationProcessLevel?: number;
  nonFatalFraudFailure?: boolean;
  collected: IdentityData[];
  contraIndicators: string[];
}

export interface CredentialStore {
  store: (userId: string, credential: VerifiableCredential) => void;
  fetch: (userId: string) => VerifiableCredential[];
}

export interface EngineRequest {
  userId: string;
  capabilities: UserCapabilities;
  requiredLevelOfConfidence: LevelOfConfidence;
  attempted: CriId[];
}

export interface AchievedIdentity {
  levelOfConfidence: LevelOfConfidence;
  profile: string;
  scores: Gpg45Scores;
  credentials: VerifiableCredential[];
}

export enum Action {
  COMPLETE = 'COMPLETE',
  REDIRECT = 'REDIRECT',
  ASK = 'ASK',
  STOP = 'STOP'
}

export type EngineResult =
  | { action: Action.COMPLETE; message: string; identity: AchievedIdentity }
  | { action: Action.REDIRECT; options: CriOption[] }
  | { action: Action.ASK; questions: RouteQuestion[]; otherwise: AskOutcome }
  | { action: Action.STOP; message: string };

export interface Engine {
  processRequest: (request: EngineRequest) => EngineResult;
}
