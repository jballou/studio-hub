import { Suspense } from "react";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { SignInCard } from "@/components/auth/SignInCard";

const MESSAGES: Record<string, string> = {
  AccessDenied: "That account can't use this app. Sign in with your @surveymonkey.com Atlassian account.",
  Configuration: "Sign-in isn't set up correctly yet. Ask the Brand Creative team to check the Atlassian app settings.",
  OAuthCallbackError: "Atlassian didn't complete the sign-in. Try again.",
  WrongDomain: "Use your @surveymonkey.com email address.",
};

/** Only same-site paths, so a crafted link can't bounce someone to another host after sign-in. */
const safePath = (p: string | undefined) => (p && p.startsWith("/") && !p.startsWith("//") ? p : "/my-day");

async function SignIn({ searchParams }: { searchParams: PageProps<"/signin">["searchParams"] }) {
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : undefined;
  const callbackUrl = safePath(typeof sp.callbackUrl === "string" ? sp.callbackUrl : undefined);

  return (
    <SignInCard
      error={error ? MESSAGES[error] ?? "Something went wrong signing in. Try again." : undefined}
      callbackUrl={callbackUrl}
      action={async (formData: FormData) => {
        "use server";
        const email = String(formData.get("email") ?? "").trim().toLowerCase();
        const to = safePath(String(formData.get("callbackUrl") ?? ""));
        // Checked again on the server; the page's own check is only a convenience.
        if (!email.endsWith("@surveymonkey.com")) redirect(`/signin?error=WrongDomain&callbackUrl=${encodeURIComponent(to)}`);
        // First visit goes through a short "connect your tools" step, which sends people on to where they were headed.
        await signIn("atlassian", { redirectTo: `/welcome?next=${encodeURIComponent(to)}` });
      }}
    />
  );
}

export default function SignInPage({ searchParams }: PageProps<"/signin">) {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-muted">Loading…</p>}>
      <SignIn searchParams={searchParams} />
    </Suspense>
  );
}
