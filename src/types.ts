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

export enum CriId {
  WEB_PASSPORT = 'web-passport',
  WEB_DL = 'web-dl',
  ADDRESS = 'address',
  FRAUD = 'fraud',
  KBV = 'kbv',
  OPEN_BANKING = 'open-banking'
}

export enum CheckType {
  WEB_PASSPORT = 'Enter passport details',
  WEB_DL = 'Enter driving licence details',
  ADDRESS = 'Enter address',
  FRAUD = 'Complete a fraud check',
  OPEN_BANKING = 'Sign in to online banking',
  KBV = 'Answer security questions'
}

export enum CriOutcome {
  SUCCESS = 'SUCCESS',
  FAIL_NO_CI = 'FAIL_NO_CI',
  FAIL_WITH_CI = 'FAIL_WITH_CI'
}

export type Scores = Record<ScoreType, number>;

export type TargetProfiles = Record<string, Scores>;

export enum Action {
  COMPLETE = 'COMPLETE',
  REDIRECT = 'REDIRECT',
  CHOOSE = 'CHOOSE',
  STOP = 'STOP'
}

export type EngineResult =
  | { action: Action.COMPLETE; message: string }
  | { action: Action.REDIRECT; criId: CriId }
  | { action: Action.CHOOSE; options: { id: CriId; checkType: CheckType }[] }
  | { action: Action.STOP; message: string };

export interface UserState {
  attempted: CriId[];
  succeeded: CriId[];
  hasData: Record<IdentityData, boolean>;
  scores: Scores;
  cis: string[];
}
