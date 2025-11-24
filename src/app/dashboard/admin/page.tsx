"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Users, 
  GraduationCap, 
  Briefcase, 
  Calendar,
  TrendingUp,
  Building2,
  CheckCircle,
  Clock,
  AlertCircle,
  Settings,
  FileText,
  BarChart3,
  Shield,
  Bell,
  Database,
  Activity
} from "lucide-react";

type DashboardStats = {
  totalStudents: number;
  totalLecturers: number;
  totalPeriods: number;
  activePeriods: number;
  totalRegistrations: number;
  studentsWithCompany: number;
  studentsSearching: number;
  completedInternships: number;
  pendingApprovals: number;
  systemHealth: string;
};

type InternshipPeriod = {
  id: string;
  semester: string;
  academic_year: string;
  is_active: boolean;
  registration_count: number;
};

export default function AdminOverview() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalLecturers: 0,
    totalPeriods: 0,
    activePeriods: 0,
    totalRegistrations: 0,
    studentsWithCompany: 0,
    studentsSearching: 0,
    completedInternships: 0,
    pendingApprovals: 0,
    systemHealth: "Tốt",
  });
  const [recentPeriods, setRecentPeriods] = useState<InternshipPeriod[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Load all statistics in parallel
      const [
        studentsResult,
        lecturersResult,
        periodsResult,
        activePeriodsResult,
        registrationsResult,
        recentPeriodsResult,
      ] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact" }).eq("role", "student"),
        supabase.from("profiles").select("id", { count: "exact" }).eq("role", "lecturer"),
        supabase.from("internship_periods").select("id", { count: "exact" }),
        supabase.from("internship_periods").select("id", { count: "exact" }).eq("is_active", true),
        supabase
          .from("student_registrations")
          .select("id, status, company_name", { count: "exact" }),
        supabase
          .from("internship_periods")
          .select("id, semester, academic_year, is_active")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      const registrations = registrationsResult.data || [];
      const studentsWithCompany = registrations.filter(r => r.company_name).length;
      const studentsSearching = registrations.filter(r => r.status === "searching").length;
      const completedInternships = registrations.filter(r => r.status === "completed").length;
      const pendingApprovals = registrations.filter(r => r.status === "pending_approval").length;

      // Count registrations per period for recent periods
      const periodsWithCounts: InternshipPeriod[] = [];
      if (recentPeriodsResult.data) {
        for (const period of recentPeriodsResult.data) {
          const { count } = await supabase
            .from("student_registrations")
            .select("id", { count: "exact" })
            .eq("period_id", period.id);
          
          periodsWithCounts.push({
            ...period,
            registration_count: count || 0,
          });
        }
      }

      setStats({
        totalStudents: studentsResult.count || 0,
        totalLecturers: lecturersResult.count || 0,
        totalPeriods: periodsResult.count || 0,
        activePeriods: activePeriodsResult.count || 0,
        totalRegistrations: registrationsResult.count || 0,
        studentsWithCompany,
        studentsSearching,
        completedInternships,
        pendingApprovals,
        systemHealth: "Tốt",
      });

      setRecentPeriods(periodsWithCounts);
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      await loadData();
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [loadData]);

  const StatCard = ({ 
    title, 
    value, 
    icon: Icon, 
    description, 
    trend,
    color = "blue",
    badge,
    onClick,
  }: { 
    title: string; 
    value: number | string; 
    icon: React.ElementType; 
    description: string;
    trend?: string;
    color?: "blue" | "green" | "yellow" | "red" | "purple" | "orange" | "indigo" | "teal";
    badge?: string;
    onClick?: () => void;
  }) => {
    const colorClasses = {
      blue: "bg-blue-50 text-blue-600 border-blue-200",
      green: "bg-green-50 text-green-600 border-green-200",
      yellow: "bg-yellow-50 text-yellow-600 border-yellow-200",
      red: "bg-red-50 text-red-600 border-red-200",
      purple: "bg-purple-50 text-purple-600 border-purple-200",
      orange: "bg-orange-50 text-orange-600 border-orange-200",
      indigo: "bg-indigo-50 text-indigo-600 border-indigo-200",
      teal: "bg-teal-50 text-teal-600 border-teal-200",
    };

    return (
      <Card 
        className={`border-2 ${colorClasses[color]} ${onClick ? "cursor-pointer hover:shadow-lg transition-shadow" : ""}`}
        onClick={onClick}
      >
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold text-gray-900">{value}</p>
                {badge && (
                  <Badge variant="secondary" className="text-xs">
                    {badge}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2">{description}</p>
              {trend && (
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  {trend}
                </p>
              )}
            </div>
            <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
              <Icon className="w-6 h-6" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Quản trị</h1>
          <p className="text-gray-500 mt-1">Tổng quan hệ thống quản lý thực tập</p>
        </div>
        <Button variant="outline" className="gap-2">
          <Bell className="w-4 h-4" />
          Thông báo
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-24 animate-pulse mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-16 animate-pulse mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-32 animate-pulse"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* Main Statistics - Row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Tổng sinh viên"
              value={stats.totalStudents}
              icon={GraduationCap}
              description="Sinh viên trong hệ thống"
              color="blue"
              onClick={() => router.push("/dashboard/admin/students")}
            />
            <StatCard
              title="Tổng giảng viên"
              value={stats.totalLecturers}
              icon={Users}
              description="Giảng viên hướng dẫn"
              color="green"
              onClick={() => router.push("/dashboard/admin/lecturers")}
            />
            <StatCard
              title="Kỳ thực tập"
              value={stats.totalPeriods}
              icon={Calendar}
              description={`${stats.activePeriods} kỳ đang hoạt động`}
              color="purple"
              onClick={() => router.push("/dashboard/admin/periods")}
            />
            <StatCard
              title="Đăng ký thực tập"
              value={stats.totalRegistrations}
              icon={Briefcase}
              description="Tổng số đăng ký"
              color="indigo"
            />
          </div>

          {/* Secondary Statistics - Row 2 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Đã có công ty"
              value={stats.studentsWithCompany}
              icon={Building2}
              description={`${stats.totalRegistrations > 0 ? Math.round((stats.studentsWithCompany / stats.totalRegistrations) * 100) : 0}% sinh viên`}
              color="green"
            />
            <StatCard
              title="Đang tìm công ty"
              value={stats.studentsSearching}
              icon={AlertCircle}
              description="Cần hỗ trợ"
              color="yellow"
            />
            <StatCard
              title="Hoàn thành"
              value={stats.completedInternships}
              icon={CheckCircle}
              description="Đã hoàn thành thực tập"
              color="teal"
            />
            <StatCard
              title="Sức khỏe hệ thống"
              value={stats.systemHealth}
              icon={Activity}
              description="Trạng thái hoạt động"
              color="green"
            />
          </div>

          {/* Recent Periods & Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Recent Periods */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-purple-500" />
                      Kỳ thực tập gần đây
                    </CardTitle>
                    <CardDescription>
                      {stats.totalPeriods} kỳ trong hệ thống
                    </CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => router.push("/dashboard/admin/periods")}
                  >
                    Xem tất cả
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {recentPeriods.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">Chưa có kỳ thực tập nào</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-4"
                      onClick={() => router.push("/dashboard/admin/periods")}
                    >
                      Tạo kỳ thực tập mới
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Học kỳ</TableHead>
                        <TableHead>Năm học</TableHead>
                        <TableHead>Đăng ký</TableHead>
                        <TableHead>Trạng thái</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentPeriods.map((period) => (
                        <TableRow 
                          key={period.id}
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => router.push(`/dashboard/admin/periods/${period.id}`)}
                        >
                          <TableCell className="font-medium">{period.semester}</TableCell>
                          <TableCell>{period.academic_year}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {period.registration_count} SV
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={period.is_active ? "default" : "secondary"}>
                              {period.is_active ? "Đang hoạt động" : "Đã đóng"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Thao tác nhanh</CardTitle>
                <CardDescription>Các chức năng quản trị thường dùng</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2"
                  onClick={() => router.push("/dashboard/admin/students")}
                >
                  <GraduationCap className="w-4 h-4" />
                  Quản lý Sinh viên
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2"
                  onClick={() => router.push("/dashboard/admin/lecturers")}
                >
                  <Users className="w-4 h-4" />
                  Quản lý Giảng viên
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2"
                  onClick={() => router.push("/dashboard/admin/periods")}
                >
                  <Calendar className="w-4 h-4" />
                  Quản lý Kỳ thực tập
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2"
                  disabled
                >
                  <BarChart3 className="w-4 h-4" />
                  Báo cáo & Thống kê <Badge variant="secondary" className="ml-auto">Sắp có</Badge>
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2"
                  disabled
                >
                  <Settings className="w-4 h-4" />
                  Cài đặt hệ thống <Badge variant="secondary" className="ml-auto">Sắp có</Badge>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* System Info & Suggestions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* System Health */}
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="w-5 h-5 text-green-600" />
                  Trạng thái hệ thống
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Database</span>
                  <Badge variant="default" className="bg-green-600">Hoạt động tốt</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">API</span>
                  <Badge variant="default" className="bg-green-600">Hoạt động tốt</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Storage</span>
                  <Badge variant="default" className="bg-green-600">Hoạt động tốt</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Tips */}
            <Card className="lg:col-span-2 bg-linear-to-br from-blue-50 to-indigo-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="text-2xl">💡</span>
                  Gợi ý quản trị
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <div className="w-1.5 bg-blue-500 rounded-full shrink-0"></div>
                  <p className="text-sm text-gray-700">
                    Thường xuyên kiểm tra số lượng sinh viên đang tìm công ty để hỗ trợ kịp thời
                  </p>
                </div>
                <div className="flex gap-2">
                  <div className="w-1.5 bg-blue-500 rounded-full shrink-0"></div>
                  <p className="text-sm text-gray-700">
                    Đảm bảo đủ giảng viên hướng dẫn cho mỗi kỳ thực tập trước khi mở đăng ký
                  </p>
                </div>
                <div className="flex gap-2">
                  <div className="w-1.5 bg-blue-500 rounded-full shrink-0"></div>
                  <p className="text-sm text-gray-700">
                    Sắp có: Hệ thống báo cáo tự động, phân tích xu hướng, và quản lý tài liệu
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Future Features Preview */}
          <Card className="border-2 border-dashed border-gray-300 bg-gray-50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-gray-500" />
                Tính năng sắp ra mắt
              </CardTitle>
              <CardDescription>
                Những tính năng đang được phát triển để cải thiện trải nghiệm quản trị
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="flex items-start gap-3 p-3 bg-white rounded-lg border">
                  <BarChart3 className="w-5 h-5 text-purple-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Báo cáo & Thống kê</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Biểu đồ trực quan, xuất báo cáo, phân tích xu hướng
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-white rounded-lg border">
                  <FileText className="w-5 h-5 text-blue-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Quản lý Tài liệu</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Lưu trữ, phê duyệt và quản lý báo cáo thực tập
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-white rounded-lg border">
                  <Bell className="w-5 h-5 text-orange-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Hệ thống Thông báo</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Gửi email, SMS, thông báo deadline tự động
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-white rounded-lg border">
                  <Database className="w-5 h-5 text-green-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Quản lý Công ty</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Database công ty đối tác, đánh giá, lịch sử hợp tác
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-white rounded-lg border">
                  <CheckCircle className="w-5 h-5 text-teal-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Quy trình Phê duyệt</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Phê duyệt công ty, báo cáo, điểm số tự động
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-white rounded-lg border">
                  <Settings className="w-5 h-5 text-gray-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Cài đặt Nâng cao</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Tùy chỉnh quy trình, mẫu email, quyền hạn
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
