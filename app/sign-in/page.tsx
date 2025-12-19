"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLogin } from "@/hooks/auth";

export default function SignInPage() {
  const router = useRouter();
  const login = useLogin();
  const [code, setCode] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!code.trim()) {
      toast.error("Please enter an access code");
      return;
    }

    login.mutate(code, {
      onSuccess: () => {
        toast.success("Welcome!");
        router.push("/");
        router.refresh();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Lock className="h-6 w-6" />
          </div>
          <CardTitle>Enter Access Code</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="password"
              placeholder="Access code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={login.isPending}
              autoFocus
            />
            <Button
              type="submit"
              className="w-full"
              disabled={login.isPending || !code.trim()}
            >
              {login.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
