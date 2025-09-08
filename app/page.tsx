import { FormProvider } from "@/components/form-context";
import { FormRenderer } from "@/components/form-renderer";
import { checkEnvs, restoreSessionFromServer } from "@/lib/actions";

export default async function Home() {
  // Pre-load session data on the server
  let preloadedSession;
  let hasAllEnvs = false;

  try {
    const envs = await checkEnvs()
    hasAllEnvs = envs.allValid
    preloadedSession = await restoreSessionFromServer();
  } catch (error) {
    console.error("Error restoring session:", error);
    preloadedSession = null;
  }

  return (
    <FormProvider initialSessionData={preloadedSession}>
      <main className="relative w-full overflow-clip min-h-svh flex flex-col justify-center bg-background">
        <FormRenderer setupCompleted={hasAllEnvs} />
      </main>
    </FormProvider>
  );
}
