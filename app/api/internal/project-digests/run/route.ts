import { renderProjectReport } from "@/src/features/project-report-export/index.server";
import { assertDigestMachineRequest, boundedReportJson, reportHttpError, reportJson, triggerProjectDigest } from "@/src/features/project-digest-generate/index.server";
export async function POST(request: Request) {
  try { assertDigestMachineRequest(request); const result = await triggerProjectDigest(await boundedReportJson(request), renderProjectReport);
    return reportJson(result, result.deduplicated ? 200 : 202);
  } catch (error) { return reportHttpError(error); }
}
