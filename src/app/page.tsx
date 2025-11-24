"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export default function Home() {
  const router = useRouter();
  const { profile, loading } = useAuth();

  useEffect(() => {
    // Wait for auth to load
    if (loading) return;

    // Redirect based on role from profile
    if (profile?.role === 'admin') {
      router.push('/dashboard/admin');
    } else if (profile?.role === 'lecturer') {
      router.push('/dashboard/lecturer');
    } else if (profile?.role === 'student') {
      router.push('/dashboard/student');
    } else {
      // No valid role or not logged in, redirect to login
      router.push('/login');
    }
  }, [profile, loading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p className="text-gray-600">Đang chuyển hướng...</p>
      </div>
    </div>
  );
}
