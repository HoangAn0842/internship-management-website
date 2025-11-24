"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, LogOut, PanelLeftClose, PanelLeftOpen, Calendar, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";

const navigation = [
  { name: "Dashboard", href: "/dashboard/lecturer", icon: LayoutDashboard },
  { name: "Báo cáo tuần - Timeline", href: "/dashboard/lecturer/weekly-reports", icon: Calendar },
  { name: "Báo cáo tuần - Sinh viên", href: "/dashboard/lecturer/weekly-reports/students", icon: Users },
  { name: "Tin nhắn", href: "/dashboard/lecturer/chat", icon: MessageSquare },
];

export default function LecturerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed, mounted] = useLocalStorage('lecturer-nav-collapsed', false);
  const { unreadCount } = useUnreadMessages("lecturer");

  // Prevent hydration mismatch by not rendering until client-side
  if (!mounted) {
    return (
      <div className="flex h-screen bg-gray-50">
        <aside className="w-64 bg-white border-r border-gray-200 flex flex-col transition-all duration-200">
          <div className="border-b border-gray-200 p-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Lecturer</h1>
              <p className="text-sm text-gray-500 mt-1">Trang giảng viên</p>
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
              <h1 className="text-2xl font-bold text-gray-900">Giảng viên</h1>
              <p className="text-sm text-gray-500 mt-1">Quản lý sinh viên</p>
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
                className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                } ${collapsed ? "justify-center" : ""} relative`}
                title={collapsed ? item.name : undefined}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {!collapsed && <span>{item.name}</span>}
                {item.href === "/dashboard/lecturer/chat" && unreadCount > 0 && (
                  <span className={`${collapsed ? "absolute -top-1 -right-1" : "ml-auto"} flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full`}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className={`border-t border-gray-200 ${collapsed ? "p-2" : "p-4"}`}>
          <Button
            variant="ghost"
            className={`w-full ${collapsed ? "justify-center px-0" : "justify-start"} text-gray-700 hover:text-gray-900 hover:bg-gray-100`}
            onClick={handleLogout}
            title={collapsed ? "Đăng xuất" : undefined}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!collapsed && <span className="ml-3">Đăng xuất</span>}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
