"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, GraduationCap, LogOut, PanelLeftClose, PanelLeftOpen, Calendar, FileText, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useLocalStorage } from "@/hooks/useLocalStorage";

const navigation = [
  { name: "Tổng quan", href: "/dashboard/admin", icon: LayoutDashboard },
  { name: "Kỳ thực tập", href: "/dashboard/admin/periods", icon: Calendar },
  { name: "Sinh viên", href: "/dashboard/admin/students", icon: GraduationCap },
  { name: "Giảng viên", href: "/dashboard/admin/lecturers", icon: Users },
  { name: "Báo cáo tuần", href: "/dashboard/admin/weekly-reports", icon: FileText },
  { name: "Yêu cầu đăng ký lại", href: "/dashboard/admin/retake-requests", icon: RefreshCcw },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed, mounted] = useLocalStorage('admin-nav-collapsed', false);

  // Prevent hydration mismatch by not rendering until client-side
  if (!mounted) {
    return (
      <div className="flex h-screen bg-gray-50">
        <aside className="w-64 bg-white border-r border-gray-200 flex flex-col transition-all duration-200">
          <div className="border-b border-gray-200 p-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
              <p className="text-sm text-gray-500 mt-1">Quản trị hệ thống</p>
            </div>
          </div>
          <nav className="p-4 flex-1" />
        </aside>
        <main className="flex-1 overflow-auto">
          <div className="p-4 lg:p-8">{children}</div>
        </main>
      </div>
    );
  }

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Lỗi đăng xuất");
    } else {
      toast.success("Đăng xuất thành công");
      router.push("/login");
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside suppressHydrationWarning className={`${collapsed ? "w-16" : "w-64"} bg-white border-r border-gray-200 flex flex-col transition-all duration-200`}> 
        <div className={`border-b border-gray-200 ${collapsed ? "p-4" : "p-6"} flex items-center justify-between`}>
          {!collapsed && (
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
              <p className="text-sm text-gray-500 mt-1">Quản trị hệ thống</p>
            </div>
          )}
          <Button variant="ghost" size="icon" aria-label={collapsed ? "Mở menu" : "Thu gọn menu"} onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </Button>
        </div>

        <nav className={`${collapsed ? "p-2" : "p-4"} flex-1 space-y-1`}>
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center ${collapsed ? "justify-center" : "gap-3"} px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-600 font-medium"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Icon className="w-5 h-5" />
                {!collapsed && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        <div className={`${collapsed ? "p-2" : "p-4"} border-t border-gray-200`}>
          <Button
            onClick={handleLogout}
            variant="outline"
            className={`w-full ${collapsed ? "justify-center" : "justify-start gap-3"}`}
          >
            <LogOut className="w-5 h-5" />
            {!collapsed && "Đăng xuất"}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-4 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
