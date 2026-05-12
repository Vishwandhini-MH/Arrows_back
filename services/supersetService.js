import axios from "axios";

import { getSupersetConfig } from "../config/superset.js";

function createSupersetApi(supersetConfig) {
  return axios.create({
    baseURL: supersetConfig.baseUrl,
    timeout: 10000,
    withCredentials: true,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });
}

function extractCookieHeader(setCookieHeaders = []) {
  if (!Array.isArray(setCookieHeaders)) {
    return "";
  }

  return setCookieHeaders
    .map((cookie) => cookie.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

function mergeCookieHeaders(...cookieHeaders) {
  const cookieMap = new Map();

  cookieHeaders
    .filter(Boolean)
    .flatMap((cookieHeader) => cookieHeader.split(";"))
    .map((cookie) => cookie.trim())
    .filter(Boolean)
    .forEach((cookie) => {
      const [name] = cookie.split("=");
      cookieMap.set(name, cookie);
    });

  return Array.from(cookieMap.values()).join("; ");
}

function normalizeSupersetError(error, fallbackMessage) {
  const message =
    error.response?.data?.message ||
    error.response?.data?.errors?.[0]?.message ||
    error.message ||
    fallbackMessage;

  const normalizedError = new Error(message);
  normalizedError.statusCode = error.response?.status || 500;
  normalizedError.details = error.response?.data;

  return normalizedError;
}

async function getSupersetSession(supersetApi, supersetConfig) {
  try {
    const response = await supersetApi.post("/api/v1/security/login", {
      username: supersetConfig.username,
      password: supersetConfig.password,
      provider: supersetConfig.provider,
      refresh: true,
    });

    const accessToken = response.data?.access_token;

    if (!accessToken) {
      throw new Error("Superset login succeeded but no access_token was returned.");
    }

    return {
      accessToken,
      cookieHeader: extractCookieHeader(response.headers["set-cookie"]),
    };
  } catch (error) {
    throw normalizeSupersetError(error, "Failed to log in to Superset.");
  }
}

async function getSupersetCsrfToken(supersetApi, accessToken, cookieHeader) {
  try {
    const response = await supersetApi.get("/api/v1/security/csrf_token/", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
    });

    const csrfToken = response.data?.result;

    if (!csrfToken) {
      throw new Error("Superset CSRF request succeeded but no token was returned.");
    }

    return {
      csrfToken,
      cookieHeader: mergeCookieHeaders(
        cookieHeader,
        extractCookieHeader(response.headers["set-cookie"]),
      ),
    };
  } catch (error) {
    throw normalizeSupersetError(error, "Failed to fetch Superset CSRF token.");
  }
}

export async function generateGuestToken(options = {}) {
  const supersetConfig = getSupersetConfig();
  const supersetApi = createSupersetApi(supersetConfig);
  const session = await getSupersetSession(supersetApi, supersetConfig);
  const csrfSession = await getSupersetCsrfToken(
    supersetApi,
    session.accessToken,
    session.cookieHeader,
  );
  const dashboardId = options.dashboardUuid || supersetConfig.dashboardUuid;
  const guestUser = options.user || supersetConfig.guestUser;

  try {
    const response = await supersetApi.post(
      "/api/v1/security/guest_token/",
      {
        resources: [
          {
            type: "dashboard",
            id: dashboardId,
          },
        ],
        rls: options.rls || [],
        user: {
          username: guestUser.username,
          first_name: guestUser.firstName,
          last_name: guestUser.lastName,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "X-CSRFToken": csrfSession.csrfToken,
          ...(csrfSession.cookieHeader ? { Cookie: csrfSession.cookieHeader } : {}),
        },
      },
    );

    const token =
      response.data?.token || response.data?.result?.token || response.data?.result;

    if (!token) {
      throw new Error("Superset guest token response did not include a token.");
    }

    return {
      token,
      dashboardUuid: dashboardId,
      supersetDomain: supersetConfig.baseUrl,
    };
  } catch (error) {
    throw normalizeSupersetError(error, "Failed to generate Superset guest token.");
  }
}
