export const AUTH_USER_SCHEMA_VERSION = 1;

export function migrateAuthUserStore(input) {
  if (Array.isArray(input)) {
    return { schemaVersion: AUTH_USER_SCHEMA_VERSION, users: input };
  }

  if (!input || typeof input !== "object") {
    return { schemaVersion: AUTH_USER_SCHEMA_VERSION, users: [] };
  }

  const users = Array.isArray(input.users) ? input.users : [];
  return { schemaVersion: AUTH_USER_SCHEMA_VERSION, users };
}
