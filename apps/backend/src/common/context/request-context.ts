import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestContextData {
  userId?: string;
}

const storage = new AsyncLocalStorage<RequestContextData>();

export const RequestContextStore = {
  runWithUserContext<T>(userId: string | undefined, fn: () => T): T {
    return storage.run({ userId }, fn);
  },

  getCurrentUserId(): string | undefined {
    return storage.getStore()?.userId;
  },
};
