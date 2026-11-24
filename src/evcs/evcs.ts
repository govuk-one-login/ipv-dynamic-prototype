import { CredentialStore, VerifiableCredential } from '../shared/types';

export const createEvcs = (): CredentialStore => {
  const credentials = new Map<string, VerifiableCredential[]>();

  return {
    store: (userId, credential) => {
      credentials.set(userId, [...(credentials.get(userId) ?? []), credential]);
    },
    fetch: userId => [...(credentials.get(userId) ?? [])]
  };
};
