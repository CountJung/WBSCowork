import type { ExecutionContext } from "@cloudflare/workers-types";
import handler from "vinext/server/fetch-handler";
import { runWithHostedBindings, type HostedBindings } from "../src/shared/server/hosted-runtime/index.server";
const worker = {
  fetch(request: Request, env: HostedBindings, ctx: ExecutionContext) {
    return runWithHostedBindings(env, () => handler.fetch(request, env, ctx));
  },
};

export default worker;
