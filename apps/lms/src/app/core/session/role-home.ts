import type { Role } from '@lms/contracts';

/** Where each role lands: the mockup's `HOME` map in `pages/auth.js`. */
export const HOME: Readonly<Record<Role, string>> = {
  learner: '/learn',
  instructor: '/instructor',
  admin: '/admin',
  viewer: '/reports',
};
