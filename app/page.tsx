import StageOverview from "@/components/StageOverview";
import { authProvidersConfigured } from "@/lib/auth";
import { getRuntimeEnv } from "@/lib/env";

export default function Home() {
  const runtimeEnv = getRuntimeEnv();

  return (
    <StageOverview
      appName={runtimeEnv.appName}
      authProvidersConfigured={authProvidersConfigured}
      databaseConfigured={runtimeEnv.database.configured}
      superuserConfigured={runtimeEnv.auth.superuserConfigured}
    />
  );
}
