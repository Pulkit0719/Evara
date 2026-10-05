export { COOKIE_NAME, ONE_YEAR_MS } from '@shared/const';

/**
 * Triggers the application-controlled authentication modal.
 */
export const startLogin = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("open-auth-modal"));
  }
};
