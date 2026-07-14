import { defineEnvVars } from '@sveltejs/kit/hooks';

// No env vars needed — the store is in-memory. Kept as a placeholder so
// the explicitEnvironmentVariables feature stays wired if we add one later.
export const variables = defineEnvVars({});
