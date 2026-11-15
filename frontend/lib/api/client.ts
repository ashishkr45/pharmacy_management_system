import { clearSession, getToken, notifyUnauthorized } from "@/lib/auth/session";
import type {
  ApiErrorBody,
  ApiErrorCode,
  PaginatedResponse,
} from "@/lib/api/types";

/**
 * The backend base URL includes the version prefix, e.g.
 * `http://localhost:4000/api/v1`.
 */
const API_URL = (
  process.env.PUBLIC_API_URL ?? "http://localhost:4000/api/v1"
).replace(/\/+$/, "");

export type ClientErrorCode = ApiErrorCode | "NETWORK_ERROR";

export class ApiError extends Error {
  readonly code: ClientErrorCode;
  readonly status: number;
  readonly details: Record<string, unknown>;

  constructor(
    code: ClientErrorCode,
    message: string,
    status: number,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export interface ApiRequestOptions
  extends Omit<RequestInit, "body" | "headers"> {
  body?: unknown;
  auth?: boolean;
  headers?: HeadersInit;
}

function fallbackCode(status: number): ApiErrorCode {
  switch (status) {
    case 400:
      return "VALIDATION_ERROR";
    case 401:
      return "UNAUTHENTICATED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 429:
      return "RATE_LIMITED";
    default:
      return "INTERNAL_ERROR";
  }
}

function isErrorBody(value: unknown): value is ApiErrorBody {
  if (!value || typeof value !== "object" || !("error" in value)) {
    return false;
  }

  const error = (value as { error?: unknown }).error;
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      "message" in error &&
      typeof (error as { code?: unknown }).code === "string" &&
      typeof (error as { message?: unknown }).message === "string",
  );
}

async function parsePayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

async function request(
  path: string,
  options: ApiRequestOptions = {},
): Promise<unknown> {
  const { body, auth = true, headers, ...init } = options;
  const token = auth ? getToken() : null;
  const requestHeaders = new Headers(headers);

  requestHeaders.set("Accept", "application/json");
  if (body !== undefined) {
    requestHeaders.set("Content-Type", "application/json");
  }
  if (token) {
    requestHeaders.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      "NETWORK_ERROR",
      "Cannot reach the server. Check that the API is running and NEXT_PUBLIC_API_URL is correct.",
      0,
    );
  }

  const payload = await parsePayload(response);

  if (!response.ok) {
    const errorBody = isErrorBody(payload) ? payload : undefined;
    const code = errorBody?.error.code ?? fallbackCode(response.status);
    const message =
      errorBody?.error.message ??
      `The request failed with status ${response.status}.`;

    // A stale or missing token should drop the local session immediately.
    // Login uses `auth: false`, so a wrong password never clears an existing
    // session.
    if (response.status === 401 && auth) {
      clearSession();
      notifyUnauthorized();
    }

    throw new ApiError(
      code,
      message,
      response.status,
      errorBody?.error.details ?? {},
    );
  }

  return payload;
}

/** For endpoints shaped `{ data: T }`, resolves to `T`. */
export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const payload = await request(path, options);

  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data: T }).data;
  }

  return payload as T;
}

/** For list endpoints shaped `{ data: T[], meta: ... }`. */
export async function apiRequestPage<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<PaginatedResponse<T>> {
  return (await request(path, options)) as PaginatedResponse<T>;
}

/** Builds a query string, skipping empty values. */
export function buildQuery(
  params: Record<string, string | number | boolean | null | undefined>,
): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  }

  const query = search.toString();
  return query ? `?${query}` : "";
}
