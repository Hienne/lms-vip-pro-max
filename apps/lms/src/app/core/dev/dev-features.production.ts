import type { DevFeatures } from './dev-features.model';

/** Replaces `dev-features.ts` in the production build: nothing for the team ships to users. */
export const DEV_FEATURES: DevFeatures = {
  routes: [],
  toolbar: null,
  interceptors: [],
};
