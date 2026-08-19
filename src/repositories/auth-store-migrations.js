export const AUTH_USER_SCHEMA_VERSION = 2;

function migrateUser(user) {
  if (!user || typeof user !== "object") return user;
  return {
    ...user,
    settings: {
      ...(user.settings && typeof user.settings === "object" ? user.settings : {}),
      personalIntelligence: user.settings?.personalIntelligence === true,
    },
  };
}

export function migrateAuthUserStore(input) {
  if (Array.isArray(input)) {
    return { schemaVersion: AUTH_USER_SCHEMA_VERSION, users: input.map(migrateUser) };
  }

  if (!input || typeof input !== "object") {
    return { schemaVersion: AUTH_USER_SCHEMA_VERSION, users: [] };
  }

  const users = Array.isArray(input.users) ? input.users.map(migrateUser) : [];
  return { schemaVersion: AUTH_USER_SCHEMA_VERSION, users };
}
