export const googleEnabled = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
export const appOrigin = (reqOrigin: string) => (process.env.APP_URL ?? reqOrigin).replace(/\/$/, "");
export const redirectUri = (reqOrigin: string) => `${appOrigin(reqOrigin)}/api/auth/google/callback`;
