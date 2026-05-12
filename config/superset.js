import dotenv from "dotenv";

dotenv.config();

const requiredEnvVars = [
  "SUPERSET_BASE_URL",
  "SUPERSET_USERNAME",
  "SUPERSET_PASSWORD",
  "SUPERSET_DASHBOARD_UUID",
];

export function getMissingSupersetEnvVars() {
  return requiredEnvVars.filter((envVar) => !process.env[envVar]);
}

export function getSupersetConfig() {
  const missingEnvVars = getMissingSupersetEnvVars();

  if (missingEnvVars.length > 0) {
    const error = new Error(
      `Missing required Superset environment variables: ${missingEnvVars.join(", ")}`,
    );
    error.statusCode = 500;
    throw error;
  }

  return {
    baseUrl: process.env.SUPERSET_BASE_URL.replace(/\/$/, ""),
    username: process.env.SUPERSET_USERNAME,
    password: process.env.SUPERSET_PASSWORD,
    provider: process.env.SUPERSET_PROVIDER || "db",
    dashboardUuid: process.env.SUPERSET_DASHBOARD_UUID,
    guestUser: {
      username: process.env.SUPERSET_GUEST_USERNAME || "embedded_user",
      firstName: process.env.SUPERSET_GUEST_FIRST_NAME || "Embedded",
      lastName: process.env.SUPERSET_GUEST_LAST_NAME || "User",
    },
  };
}
