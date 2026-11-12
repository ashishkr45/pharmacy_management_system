import { ApiError } from "@/lib/api/client";

export type FieldErrors = Record<string, string>;

interface ParsedFormError {
  message: string;
  fields: FieldErrors;
}

interface ValidationIssue {
  path?: unknown;
  message?: unknown;
}

function readIssues(details: Record<string, unknown>): FieldErrors {
  const fields: FieldErrors = {};
  const issues = details.issues;

  if (Array.isArray(issues)) {
    for (const issue of issues as ValidationIssue[]) {
      if (
        issue &&
        typeof issue.path === "string" &&
        issue.path.length > 0 &&
        typeof issue.message === "string"
      ) {
        fields[issue.path] = issue.message;
      }
    }
  }

  // Service-level field details (e.g. `{ categoryId: "Unknown category" }`).
  for (const [field, value] of Object.entries(details)) {
    if (field !== "issues" && typeof value === "string") {
      fields[field] = value;
    }
  }

  return fields;
}

/** Converts the standard API error shape into a message plus field errors. */
export function readApiFormError(
  error: unknown,
  fallbackMessage: string,
): ParsedFormError {
  if (error instanceof ApiError) {
    return {
      message: error.message,
      fields: readIssues(error.details),
    };
  }

  return { message: fallbackMessage, fields: {} };
}
