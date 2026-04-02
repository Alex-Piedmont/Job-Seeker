"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Providers } from "@/components/providers";

function SignInContent() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) {
      router.replace("/dashboard");
    }
  }, [session, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#002060] via-[#4a0e6b] to-[#cc0099] px-4">
      <Card className="w-full max-w-sm shadow-2xl border-0">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Job Seeker</CardTitle>
          <CardDescription>
            Track applications, build resumes, land jobs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            className="w-full"
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          >
            Sign in with Google
          </Button>
          {process.env.NODE_ENV !== "production" && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() =>
                signIn("dev-login", { callbackUrl: "/dashboard" })
              }
            >
              Dev Sign In
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Providers>
      <SignInContent />
    </Providers>
  );
}
