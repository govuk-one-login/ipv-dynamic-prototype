import { CriId } from '../shared/types';

export const CRI_NAMES: Record<CriId, string> = {
  [CriId.CLAIMED_IDENTITY]: 'the name and date of birth form',
  [CriId.APP]: 'the GOV.UK One Login app',
  [CriId.F2F]: 'the Post Office',
  [CriId.WEB_PASSPORT]: 'the passport check',
  [CriId.WEB_DL]: 'the driving licence check',
  [CriId.ADDRESS]: 'the address check',
  [CriId.FRAUD]: 'the fraud check',
  [CriId.OPEN_BANKING]: 'online banking',
  [CriId.KBV]: 'the security questions',
  [CriId.DWP_KBV]: 'the DWP security questions',
  [CriId.BAV]: 'the bank account check',
  [CriId.NINO]: 'the National Insurance number check'
};

export const CRI_LABELS: Record<CriId, string> = {
  [CriId.CLAIMED_IDENTITY]: 'Enter your name and date of birth',
  [CriId.APP]: 'Enter passport or driving licence or biometric residence permit details',
  [CriId.F2F]: 'Enter F2F details',
  [CriId.WEB_PASSPORT]: 'Enter passport details',
  [CriId.WEB_DL]: 'Enter driving licence details',
  [CriId.ADDRESS]: 'Enter address',
  [CriId.FRAUD]: 'Complete a fraud check',
  [CriId.OPEN_BANKING]: 'Sign in to online banking',
  [CriId.KBV]: 'Answer security questions',
  [CriId.DWP_KBV]: 'Answer DWP security questions',
  [CriId.BAV]: 'Enter bank account details',
  [CriId.NINO]: 'Enter your National Insurance number'
};
