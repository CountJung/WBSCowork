import StageOverview from "@/components/StageOverview";
import { getRuntimeEnv } from "@/lib/env";

export default function Home() {
  const runtimeEnv = getRuntimeEnv();

  return (
    <StageOverview
      appName={runtimeEnv.appName}
      authProvidersConfigured={runtimeEnv.auth.googleProviderConfigured}
      databaseConfigured={runtimeEnv.database.configured}
      superuserConfigured={runtimeEnv.auth.superuserConfigured}
    />
  );
}
