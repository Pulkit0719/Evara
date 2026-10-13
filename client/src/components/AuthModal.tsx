import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { Loader2, LockKeyhole, Sparkles } from "lucide-react";

export function AuthModal() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"login" | "register" | "legacy">("login");
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [legacyOpenId, setLegacyOpenId] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Listen to open-auth-modal custom event
  useEffect(() => {
    const handleOpen = () => {
      setErrorMsg(null);
      setOpen(true);
    };
    window.addEventListener("open-auth-modal", handleOpen);
    return () => window.removeEventListener("open-auth-modal", handleOpen);
  }, []);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      toast.success("Welcome back!");
      utils.auth.me.setData(undefined, data.user as any);
      utils.auth.me.invalidate();
      setOpen(false);
      resetForm();
      setLocation("/app");
    },
    onError: (err) => {
      setErrorMsg(err.message);
    },
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: (data) => {
      toast.success("Account created successfully!");
      utils.auth.me.setData(undefined, data.user as any);
      utils.auth.me.invalidate();
      setOpen(false);
      resetForm();
      setLocation("/onboarding");
    },
    onError: (err) => {
      setErrorMsg(err.message);
    },
  });

  const claimMutation = trpc.auth.claimLegacyAccount.useMutation({
    onSuccess: (data) => {
      toast.success("Legacy account linked successfully! Your records are preserved.");
      utils.auth.me.setData(undefined, data.user as any);
      utils.auth.me.invalidate();
      setOpen(false);
      resetForm();
      setLocation("/app");
    },
    onError: (err) => {
      setErrorMsg(err.message);
    },
  });

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setName("");
    setLegacyOpenId("");
    setErrorMsg(null);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    loginMutation.mutate({ email, password });
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    registerMutation.mutate({ email, password, name: name || undefined });
  };

  const handleClaim = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    claimMutation.mutate({ email, newPassword: password, verificationToken: legacyOpenId });
  };

  const isPending =
    loginMutation.isPending || registerMutation.isPending || claimMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[425px] bg-[#faf6f3] border-[#e8ded7] text-[#402c38]">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-full bg-[#f4ebe6] text-[#8f5261]">
              <LockKeyhole className="h-4 w-4" />
            </span>
            <DialogTitle className="font-display text-xl text-[#402c38]">
              Your Private Wellness Space
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-[#75656e]">
            Self-hosted, independent, and confidential. Your health records never leave your control.
          </DialogDescription>
        </DialogHeader>

        {errorMsg && (
          <div className="p-3 text-xs rounded-md bg-[#fae8e8] text-[#852a2a] border border-[#f0c4c4]">
            {errorMsg}
          </div>
        )}

        <Tabs value={tab} onValueChange={(val) => { setTab(val as any); setErrorMsg(null); }} className="w-full mt-2">
          <TabsList className="grid w-full grid-cols-3 bg-[#ede3dc]">
            <TabsTrigger value="login" className="text-xs">Sign In</TabsTrigger>
            <TabsTrigger value="register" className="text-xs">Register</TabsTrigger>
            <TabsTrigger value="legacy" className="text-xs">Migrate</TabsTrigger>
          </TabsList>

          {/* SIGN IN */}
          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="login-email" className="text-xs text-[#523d4a]">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-white/80 border-[#d9ccc3] text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="login-password" className="text-xs text-[#523d4a]">Password</Label>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-white/80 border-[#d9ccc3] text-sm"
                />
              </div>

              <Button
                type="submit"
                disabled={isPending}
                className="w-full bg-[#8f5261] hover:bg-[#7b4452] text-white"
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          </TabsContent>

          {/* REGISTER */}
          <TabsContent value="register">
            <form onSubmit={handleRegister} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="reg-name" className="text-xs text-[#523d4a]">Name (optional)</Label>
                <Input
                  id="reg-name"
                  type="text"
                  placeholder="Your preferred name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-white/80 border-[#d9ccc3] text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reg-email" className="text-xs text-[#523d4a]">Email</Label>
                <Input
                  id="reg-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-white/80 border-[#d9ccc3] text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reg-password" className="text-xs text-[#523d4a]">Password (min 8 chars)</Label>
                <Input
                  id="reg-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                  className="bg-white/80 border-[#d9ccc3] text-sm"
                />
              </div>

              <Button
                type="submit"
                disabled={isPending}
                className="w-full bg-[#8f5261] hover:bg-[#7b4452] text-white"
              >
                {registerMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating Account…
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>
          </TabsContent>

          {/* LEGACY MIGRATION */}
          <TabsContent value="legacy">
            <form onSubmit={handleClaim} className="space-y-3 pt-2">
              <div className="p-2.5 rounded bg-[#f3ebe4] border border-[#e4d7ce] text-[11px] leading-relaxed text-[#6d5a65]">
                <Sparkles className="inline h-3.5 w-3.5 mr-1 text-[#8f5261]" />
                <strong>Existing Account?</strong> Link your previous account by verifying your account ownership key. All your logged cycles, symptoms, and wellness history will remain intact.
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="legacy-email" className="text-xs text-[#523d4a]">Registered Email</Label>
                <Input
                  id="legacy-email"
                  type="email"
                  placeholder="The email from your previous account"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-white/80 border-[#d9ccc3] text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="legacy-password" className="text-xs text-[#523d4a]">Set New Password</Label>
                <Input
                  id="legacy-password"
                  type="password"
                  placeholder="Minimum 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                  className="bg-white/80 border-[#d9ccc3] text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="legacy-openid" className="text-xs text-[#523d4a]">Account Verification Key *</Label>
                <Input
                  id="legacy-openid"
                  type="text"
                  placeholder="Legacy verification token or OpenID"
                  value={legacyOpenId}
                  onChange={(e) => setLegacyOpenId(e.target.value)}
                  required
                  className="bg-white/80 border-[#d9ccc3] text-sm"
                />
              </div>

              <Button
                type="submit"
                disabled={isPending}
                className="w-full bg-[#8f5261] hover:bg-[#7b4452] text-white"
              >
                {claimMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Linking Account…
                  </>
                ) : (
                  "Claim & Set Password"
                )}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
