import { Suspense } from "react";
import { signIn } from "@/auth";

const MESSAGES: Record<string, string> = {
  AccessDenied: "That account can't use this app. Sign in with your @surveymonkey.com Atlassian account.",
  Configuration: "Sign-in isn't set up correctly yet. Ask the Brand Creative team to check the Atlassian app settings.",
  OAuthCallbackError: "Atlassian didn't complete the sign-in. Try again.",
};

/** Only same-site paths, so a crafted link can't bounce someone to another host after sign-in. */
const safePath = (p: string | undefined) => (p && p.startsWith("/") && !p.startsWith("//") ? p : "/projects");

async function SignIn({ searchParams }: { searchParams: PageProps<"/signin">["searchParams"] }) {
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : undefined;
  const callbackUrl = safePath(typeof sp.callbackUrl === "string" ? sp.callbackUrl : undefined);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center p-8">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-lg font-bold text-n-50">BC</span>
      <h1 className="text-2xl font-bold">Brand Creative Hub</h1>
      <p className="mb-6 mt-1 text-sm text-muted">Sign in with your SurveyMonkey Atlassian account to see your projects and feedback requests.</p>
      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-bad-line bg-bad-bg px-3 py-2 text-sm text-bad-fg">
          {MESSAGES[error] ?? "Something went wrong signing in. Try again."}
        </p>
      )}
      <form
        action={async () => {
          "use server";
          await signIn("atlassian", { redirectTo: callbackUrl });
        }}
      >
        <button className="w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-n-50 hover:bg-brand-dark">Sign in with Atlassian</button>
      </form>
    </main>
  );
}

export default function SignInPage({ searchParams }: PageProps<"/signin">) {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-muted">Loading…</p>}>
      <SignIn searchParams={searchParams} />
    </Suspense>
  );
}
