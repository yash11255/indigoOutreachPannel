"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const initialState: SignInState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm gap-0 overflow-hidden rounded-none py-0">
        <div className="h-1.5 bg-[#0f62fe]" />
        <CardHeader className="pt-6">
          <CardTitle className="text-lg font-semibold">Indigo GWF Outreach</CardTitle>
          <CardDescription>Sign in with the account your admin created for you.</CardDescription>
        </CardHeader>
        <CardContent className="pb-6">
          <form action={formAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
              />
            </div>
            {state.error && <p className="text-sm text-[#da1e28]">{state.error}</p>}
            <Button type="submit" disabled={pending} className="mt-2">
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
