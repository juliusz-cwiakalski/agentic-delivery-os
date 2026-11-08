/**
 * Transport error classification (GH-238 F-5; C-3).
 *
 * A transport that cannot open is a declared degradation, never a silent
 * fallback. A permission refusal keeps the delivered state identity.
 */
export const classifyTransportError = (
  error: unknown,
): { readonly code: string; readonly detail: string } => {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (code === "EACCES" || code === "EPERM") {
      return { code: "state.permission.denied", detail: "permission" };
    }
    if (typeof code === "string") return { code: "daemon.socket-unreachable", detail: code };
  }
  return { code: "daemon.socket-unreachable", detail: "transport-open-failed" };
};
