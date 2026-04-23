import { spawn } from "node:child_process";
import { loadEnvConfig } from "@next/env";
import { getRuntimeEnv } from "../lib/env";

type NextCommand = "build" | "start";

function getRequestedCommand(): NextCommand {
  const command = process.argv[2];

  if (command === "build" || command === "start") {
    return command;
  }

  throw new Error("지원되는 명령은 build 또는 start 뿐입니다.");
}

loadEnvConfig(process.cwd());

const command = getRequestedCommand();
const runtimeEnv = getRuntimeEnv();
const appPort = String(runtimeEnv.appPort);
const nextBinPath = require.resolve("next/dist/bin/next");
const nextArgs = [nextBinPath, command];

process.env.PORT = appPort;

if (command === "start") {
  nextArgs.push("-p", appPort);
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