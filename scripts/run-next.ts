import { spawn } from "node:child_process";
import { loadEnvConfig } from "@next/env";
import { getRuntimeEnv } from "../lib/env";

type NextCommand = "build" | "dev" | "start";

function getRequestedCommand(): NextCommand {
  const command = process.argv[2];

  if (command === "build" || command === "dev" || command === "start") {
    return command;
  }

  throw new Error("지원되는 명령은 build, dev 또는 start 뿐입니다.");
}

loadEnvConfig(process.cwd());

const command = getRequestedCommand();
const extraArgs = process.argv.slice(3);
const runtimeEnv = getRuntimeEnv();
const appPort = String(runtimeEnv.appPort);
const nextBinPath = require.resolve("next/dist/bin/next");
const nextArgs = [nextBinPath, command];

process.env.PORT = appPort;

if (command === "dev" || command === "start") {
  nextArgs.push("-p", appPort);
}

if (extraArgs.length > 0) {
  nextArgs.push(...extraArgs);
}

console.log(`next ${command} using APP_PORT=${appPort}`);

const child = spawn(process.execPath, nextArgs, {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

child.on("exit", (code) => {
  process.exitCode = code ?? 0;
});