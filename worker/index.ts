import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";
import { shouldNoIndex } from "../lib/seo";
import { requestSecurity, requestRejection, secureResponse, httpsRedirect } from "../lib/security-headers";

const worker = {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    const production = !import.meta.env.DEV;
    const pathname = new URL(request.url).pathname;
    const security = requestSecurity(request, production);
    const rejected = httpsRedirect(security.request, production) ?? requestRejection(security.request);
    if (rejected) return secureResponse(rejected, pathname, production, security.csp, shouldNoIndex(pathname));
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    try {
      const response = await runWithConnectorBinding(binding, () => handler.fetch(security.request, env, ctx));
      return secureResponse(response, pathname, production, security.csp, shouldNoIndex(pathname));
    } catch (error) {
      // Keep exception details and credentials out of visitor responses.
      console.error('Application request failed', { name: error instanceof Error ? error.name : 'Error' });
      const response = Response.json({ error: 'request_failed', message: 'The request could not be completed. Please try again.' }, { status: 500 });
      return secureResponse(response, pathname, production, security.csp, shouldNoIndex(pathname));
    }
  },
};

export default worker;
