// Two ways to consume the manifest are shown here.
// (a) Generated module — preferred, no runtime dep.
// (b) Runtime defineEnv — when you don't want a generation step.

// (a) Generated:
//   $ npm run envm:generate
//   import { env } from "./env.generated.js"
//
// (b) Runtime — what we use here:

import { defineEnv } from "@envmanifest/node";

const env = defineEnv({
  required: ["API_TOKEN"] as const,
  optional: ["GREETING_NAME", "LOG_LEVEL"],
  project: "node-cli-example",
});

const greetingName = env["GREETING_NAME"] ?? "world";
const logLevel = env["LOG_LEVEL"] ?? "info";

if (logLevel === "debug") {
  console.log(`[debug] starting with API_TOKEN=${env.API_TOKEN.slice(0, 6)}***`);
}

console.log(`hello, ${greetingName}!`);
