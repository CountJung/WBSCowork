/** Independently accepts the explicitly disclosed text-guide intermediate release. Never bypasses strict image acceptance. */
import assert from "node:assert/strict";
import {runWorkerGuideQa,verifyGuideText} from "./test-user-guide-http.mjs";
assert(process.argv.slice(2).every(argument=>argument==="--native")&&process.argv.slice(2).length<=1,"Only --native selects the separate Native runtime.");
if(process.argv.includes("--native")){
 const {runNativeGuideQa}=await import("./test-user-guide-native-http.mjs");
 process.exitCode=await runNativeGuideQa({verify:verifyGuideText,outputDirectory:"user-guide-text-native-http"});
}else{
 await runWorkerGuideQa({verify:verifyGuideText,outputDirectory:"user-guide-text-http"});
}
