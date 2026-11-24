import { CRI_CHECKS } from '../shared/checks';
import {
  AdditionalQuestion,
  CriCheck,
  CriGroup,
  CriId,
  DeviceAccess,
  DocumentAccess,
  DocumentType,
  IdentityData,
  Residency
} from '../shared/types';

export interface CriRequirements {
  documents?: DocumentAccess[];
  excludedDocuments?: DocumentAccess[];
  documentTypes?: DocumentType[];
  residency?: Residency[];
  device?: DeviceAccess[];
}

export interface CriConfig {
  id: CriId;
  enabled: boolean;
  group: CriGroup; // used when CRI is forced - example: forced APP CRI - exclude other CRIs in group
  weight: number; // orders checks within a route, and breaks ties between routes
  lastResort?: boolean;
  provides: CriCheck[]; // (max) scores this CRI provides
  requires: IdentityData[]; // prerequisite identity data this CRI needs to perform its check
  collects: IdentityData[]; // identity data this CRI collects
  requirements?: CriRequirements;
  forcedWhen?: CriRequirements;
  // A question only this CRI cares about. It does not affect routing — the CRI is still
  // chosen on its weight — but core front must ask it before sending the user there, and
  // an answer other than the first rules the CRI out so the next one is offered instead.
  askQuestions?: AdditionalQuestion;
}

export const CRI_CONFIG: CriConfig[] = [
  {
    id: CriId.CLAIMED_IDENTITY,
    enabled: true,
    group: CriGroup.IDENTITY,
    weight: 10,
    provides: CRI_CHECKS[CriId.CLAIMED_IDENTITY].successful,
    requires: [],
    collects: CRI_CHECKS[CriId.CLAIMED_IDENTITY].collects
  },
  {
    id: CriId.APP,
    enabled: true,
    group: CriGroup.DOCUMENT,
    weight: 10,
    provides: CRI_CHECKS[CriId.APP].successful,
    requires: [],
    collects: CRI_CHECKS[CriId.APP].collects,
    requirements: {
      documents: [DocumentAccess.PHOTO_ID],
      device: [DeviceAccess.COMPATIBLE_PHONE]
    },
    forcedWhen: {
      residency: [Residency.INTERNATIONAL]
    }
  },
  {
    id: CriId.WEB_PASSPORT,
    enabled: true,
    group: CriGroup.DOCUMENT,
    weight: 20,
    provides: CRI_CHECKS[CriId.WEB_PASSPORT].successful,
    requires: [],
    collects: CRI_CHECKS[CriId.WEB_PASSPORT].collects,
    requirements: {
      documents: [DocumentAccess.PHOTO_ID],
      documentTypes: [DocumentType.UK_PASSPORT]
    }
  },
  {
    id: CriId.WEB_DL,
    enabled: true,
    group: CriGroup.DOCUMENT,
    weight: 30,
    provides: CRI_CHECKS[CriId.WEB_DL].successful,
    requires: [],
    collects: CRI_CHECKS[CriId.WEB_DL].collects,
    requirements: {
      documents: [DocumentAccess.PHOTO_ID],
      documentTypes: [DocumentType.UK_DRIVING_LICENCE]
    }
  },
  {
    id: CriId.OPEN_BANKING,
    enabled: true,
    group: CriGroup.DOCUMENT,
    weight: 40,
    provides: CRI_CHECKS[CriId.OPEN_BANKING].successful,
    requires: [IdentityData.NAME, IdentityData.DOB, IdentityData.ADDRESS],
    collects: CRI_CHECKS[CriId.OPEN_BANKING].collects,
    requirements: {
      documentTypes: [DocumentType.ONLINE_BANKING]
    }
  },
  {
    id: CriId.BAV,
    enabled: true,
    group: CriGroup.DOCUMENT,
    weight: 50,
    provides: CRI_CHECKS[CriId.BAV].successful,
    requires: [IdentityData.NAME, IdentityData.DOB, IdentityData.ADDRESS],
    collects: CRI_CHECKS[CriId.BAV].collects,
    requirements: {
      documentTypes: [DocumentType.BANK_ACCOUNT]
    }
  },
  {
    id: CriId.NINO,
    enabled: true,
    group: CriGroup.DOCUMENT,
    weight: 60,
    provides: CRI_CHECKS[CriId.NINO].successful,
    requires: [IdentityData.NAME, IdentityData.DOB, IdentityData.ADDRESS],
    collects: CRI_CHECKS[CriId.NINO].collects,
    requirements: {
      documentTypes: [DocumentType.NATIONAL_INSURANCE_NUMBER]
    }
  },
  {
    id: CriId.F2F,
    enabled: true,
    group: CriGroup.DOCUMENT,
    weight: 100,
    lastResort: true,
    provides: CRI_CHECKS[CriId.F2F].successful,
    requires: [IdentityData.NAME, IdentityData.DOB, IdentityData.ADDRESS],
    collects: CRI_CHECKS[CriId.F2F].collects,
    requirements: {
      documents: [DocumentAccess.ALTERNATIVE_PHOTO_ID]
    }
  },
  {
    id: CriId.ADDRESS,
    enabled: true,
    group: CriGroup.ADDRESS,
    weight: 10,
    provides: CRI_CHECKS[CriId.ADDRESS].successful, // no scores
    requires: [IdentityData.NAME, IdentityData.DOB],
    collects: CRI_CHECKS[CriId.ADDRESS].collects
  },
  {
    id: CriId.FRAUD,
    enabled: true,
    group: CriGroup.FRAUD,
    weight: 10,
    provides: CRI_CHECKS[CriId.FRAUD].successful,
    requires: [IdentityData.NAME, IdentityData.DOB, IdentityData.ADDRESS],
    collects: CRI_CHECKS[CriId.FRAUD].collects
  },
  {
    id: CriId.DWP_KBV,
    enabled: true,
    group: CriGroup.VERIFICATION,
    weight: 10,
    provides: CRI_CHECKS[CriId.DWP_KBV].successful,
    requires: [IdentityData.NAME, IdentityData.DOB, IdentityData.ADDRESS],
    collects: CRI_CHECKS[CriId.DWP_KBV].collects,
    askQuestions: {
      question: 'Do you get Universal Credit or Personal Independence Payment (PIP)?',
      answers: ['Yes', 'No']
    }
  },
  {
    id: CriId.KBV,
    enabled: true,
    group: CriGroup.VERIFICATION,
    weight: 20,
    provides: CRI_CHECKS[CriId.KBV].successful,
    requires: [IdentityData.NAME, IdentityData.DOB, IdentityData.ADDRESS],
    collects: CRI_CHECKS[CriId.KBV].collects
  }
];

export const findCri = (criId: CriId): CriConfig =>
  CRI_CONFIG.find(cri => cri.id === criId)!;
