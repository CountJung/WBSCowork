// Install the TypeScript loader first, then finish mock registration before the
// test module's static graph is linked (Node 26 + tsx synchronous hooks).
await import("tsx");
if (process.execArgv.includes("--experimental-test-module-mocks")) {
  await import("./bootstrap.ts");
}
