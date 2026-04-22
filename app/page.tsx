import StageOverview from "@/components/StageOverview";
import { authProvidersConfigured } from "@/lib/auth";

export default function Home() {
  return <StageOverview authProvidersConfigured={authProvidersConfigured} />;
}
