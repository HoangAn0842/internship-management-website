"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff } from "lucide-react";

type Role = "student" | "lecturer" | "admin";

export default function LoginPage() {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [showPassword, setShowPassword] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!email || !password) return;
		setLoading(true);
		try {
			const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
				email,
				password,
			});
			if (authError) throw authError;
			if (!authData.user) throw new Error("Không thể đăng nhập, vui lòng thử lại.");

			const { data: profile, error: profileError } = await supabase
				.from("profiles")
				.select("role")
				.eq("id", authData.user.id)
				.single();
			if (profileError) throw profileError;
			if (!profile) throw new Error("Không tìm thấy vai trò người dùng.");

			const role = profile.role as Role;
			const destination = `/dashboard/${role}`;
			toast.success("Đăng nhập thành công", { description: `Chuyển hướng đến ${role} dashboard` });
			router.replace(destination);
		} catch (err) {
			const message = err instanceof Error ? err.message : "Đăng nhập thất bại";
			toast.error("Lỗi đăng nhập", { description: message });
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-linear-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
			<Card className="w-full max-w-md shadow-sm">
				<CardHeader>
					<CardTitle className="text-2xl font-bold">Đăng nhập</CardTitle>
					<CardDescription>Truy cập hệ thống quản lý thực tập</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-4" aria-label="Login form">
						<div className="space-y-2">
							<Label htmlFor="email">Email</Label>
							<Input
								id="email"
								type="email"
								inputMode="email"
								autoComplete="email"
								placeholder="you@example.com"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
								disabled={loading}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="password">Mật khẩu</Label>
							<div className="relative">
								<Input
									id="password"
									type={showPassword ? "text" : "password"}
									autoComplete="current-password"
									placeholder="••••••••"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									required
									disabled={loading}
								/>
								<button
									type="button"
									onClick={() => setShowPassword((v) => !v)}
									aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
									className="absolute inset-y-0 right-3 my-auto inline-flex h-8 w-8 items-center justify-center text-muted-foreground hover:text-foreground"
									tabIndex={-1}
								>
									{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
								</button>
							</div>
						</div>
						<Button type="submit" className="w-full" disabled={loading} aria-disabled={loading}>
							{loading ? (
								<span className="flex items-center justify-center">
									<Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang đăng nhập...
								</span>
							) : (
								"Đăng nhập"
							)}
						</Button>
					</form>
					<p className="mt-4 text-center text-sm text-muted-foreground">
						Chưa có tài khoản? <a href="/register" className="font-medium text-primary hover:underline">Đăng ký</a>
					</p>
				</CardContent>
			</Card>
		</div>
	);
}

