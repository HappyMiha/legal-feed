import { env } from "cloudflare:workers";
import AIxApp from "@/src/app";
export default function Home() {
  const runtime = env as unknown as Record<string, string | undefined>;
  const value = (name: string) => runtime[name] || process.env[name];
  return (
    <AIxApp
      config={{
        publicDisclosure: value("AIX_PUBLIC_DISCLOSURE") !== "false",
        operatorControls: value("AIX_OPERATOR_CONTROLS") !== "false",
        processingModel: value("AIX_PROCESSING_MODEL") || "No model connected",
        deployment: value("AIX_DEPLOYMENT_TYPE") || "Not configured",
        hostingLocation: value("AIX_HOSTING_LOCATION") || "Not configured",
      }}
    />
  );
}
