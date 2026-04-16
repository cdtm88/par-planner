import type { DurableObjectNamespace } from "@cloudflare/workers-types";

declare global {
  namespace App {
    interface Platform {
      env: {
        GameRoom: DurableObjectNamespace;
      };
    }
  }
}

export {};
