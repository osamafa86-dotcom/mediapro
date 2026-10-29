/** Required secrets come from the environment only (never Git, never logs). Fail loudly at first use. */
function req(name: string): string {
  const v = process.env[name];
  if (!v || v.length < 32) {
    throw new Error(`${name} must be set to at least 32 random characters (see docs/deploy.md). Generate one with: openssl rand -base64 48`);
  }
  return v;
}

export const env = {
  get sessionSecret() { return req('SESSION_SECRET'); },
  get linkSecret() { return req('LINK_SIGNING_SECRET'); },
  get appOrigin() { return process.env.APP_ORIGIN ?? 'http://localhost:3000'; },
  /** Secure cookies whenever the public origin is https (always in production). */
  get secureCookies() { return (process.env.APP_ORIGIN ?? '').startsWith('https://'); },
  get ssoEnabled() { return process.env.EMDATRA_SSO_ENABLED === 'true'; },
};
