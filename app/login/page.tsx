"use client";

import { useState, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Wallet, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { loginAdmin } from "@/lib/admin-auth";
import { useAdminAuth } from "@/lib/admin-auth-context";

// Login content component that safely uses hooks inside Suspense
function LoginContent() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-4">
          <div className="animate-spin mr-2">Loading...</div>
        </div>
      }
    >
      <LoginUI />
    </Suspense>
  );
}

function LoginUI() {
  const router = useRouter();
  const { setUser } = useAdminAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const result = await loginAdmin(username, password);
      
      if (result.success && result.data) {
        // Update the auth context directly with the user data
        setUser(result.data.user);
        
        // Small delay to ensure the auth context is updated before navigation
        setTimeout(() => {
          router.push("/");
        }, 100);
      } else {
        setError(result.error || "Login gagal. Periksa username dan password Anda.");
      }
    } catch (err) {
      setError("Terjadi kesalahan saat login. Silakan coba lagi.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };


  
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <div className="flex justify-center">
            <Wallet className="h-12 w-12" />
          </div>
          <CardTitle className="text-2xl font-bold">Control Panel</CardTitle>
          <CardDescription>Masuk ke panel admin untuk mengelola sistem koperasi</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input 
                id="username" 
                placeholder="Masukkan username" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Memproses..." : "Masuk"}
            </Button>
          </CardContent>
        </form>
        <CardFooter className="flex flex-col space-y-4">
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            onClick={() => window.open('https://expo.dev/accounts/bmtfatihulbarokah/projects/koperasi-fatihul-barokah-mobile-apps/builds/9e2644bd-6b62-4329-bf8d-e4fee18e810e', '_blank')}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download Mobile App
          </Button>
          <div className="text-center text-sm text-muted-foreground">
            <span>Login sesuai dengan peran Anda: Ketua, Admin, Sekretaris, atau Bendahara</span>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

// Main login page component with Suspense boundary
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-2 text-center">
            <div className="flex justify-center">
              <Wallet className="h-12 w-12" />
            </div>
            <CardTitle className="text-2xl font-bold">Control Panel</CardTitle>
            <CardDescription>Masuk ke panel admin untuk mengelola sistem koperasi</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="h-8 w-full bg-muted animate-pulse rounded"></div>
            </div>
            <div className="space-y-2">
              <div className="h-8 w-full bg-muted animate-pulse rounded"></div>
            </div>
            <div className="h-10 w-full bg-muted animate-pulse rounded"></div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <div className="text-center text-sm text-muted-foreground">
              <span>Login sesuai dengan peran Anda</span>
            </div>
          </CardFooter>
        </Card>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
