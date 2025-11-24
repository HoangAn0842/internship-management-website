"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  MessageSquare, 
  FileText, 
  Calendar,
  TrendingUp,
  Building2,
  CheckCircle,
  AlertCircle,
  Bell
} from "lucide-react";

type StudentRegistration = {
  id: string;
  period_id: string;
  student_id: string;
  prefer_own_lecturer: boolean;
  requested_lecturer_id?: string;
  assigned_lecturer_id?: string;
  company_name?: string;
  status: string;
  created_at: string;
  student?: {
    id: string;
    full_name: string;
    email: string;
    student_id?: string;
    department?: string;
  };
  period?: {
    semester: string;
    academic_year: string;
    start_date: string;
    end_date: string;
  };
};

type DashboardStats = {
  totalStudents: number;
  studentsWithCompany: number;
  studentsSearching: number;
  newMessages: number;
  weeklyReports: number;
  pendingApprovals: number;
  upcomingDeadlines: number;
};

export default function LecturerDashboard() {
  const router = useRouter();
  const { unreadCount } = useUnreadMessages("lecturer");
  const [confirmedStudents, setConfirmedStudents] = useState<StudentRegistration[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    studentsWithCompany: 0,
    studentsSearching: 0,
    newMessages: 0,
    weeklyReports: 0,
    pendingApprovals: 0,
    upcomingDeadlines: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load students assigned to this lecturer
      const { data: confirmed, error: confirmedError } = await supabase
        .from("student_registrations")
        .select(`
          *,
          student:student_id(id, full_name, email, student_id, department),
          period:period_id(semester, academic_year, start_date, end_date)
        `)
        .eq("assigned_lecturer_id", user.id)
        .in("status", ["searching", "company_submitted", "pending_approval", "approved", "in_progress", "completed"]);
      
      if (confirmedError) {
        console.error("Error loading confirmed students:", confirmedError);
      } else if (confirmed) {
        const students = confirmed as unknown as StudentRegistration[];
        setConfirmedStudents(students);
        
        // Calculate statistics
        const totalStudents = students.length;
        const studentsWithCompany = students.filter(s => s.company_name).length;
        const studentsSearching = students.filter(s => s.status === "searching").length;
        
        // Load weekly reports stats
        let weeklyReportsCount = 0;
        if (students.length > 0) {
          const studentIds = students.map(s => s.id);
          const { count } = await supabase
            .from("weekly_reports")
            .select("id", { count: "exact" })
            .in("registration_id", studentIds)
            .in("status", ["submitted", "late_submitted"]);
          weeklyReportsCount = count || 0;
        }
        
        // TODO: Replace with actual data from messages and deadlines tables when implemented
        const newMessages = 0; // Placeholder
        const upcomingDeadlines = 0; // Placeholder
        
        setStats({
          totalStudents,
          studentsWithCompany,
          studentsSearching,
          newMessages,
          weeklyReports: weeklyReportsCount,
          pendingApprovals: 0,
          upcomingDeadlines,
        });
      }
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

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
      not_started: { label: "Chưa bắt đầu", variant: "secondary" },
      registered: { label: "Đã đăng ký", variant: "secondary" },
      searching: { label: "Đang tìm công ty", variant: "secondary" },
      company_submitted: { label: "Đã có công ty", variant: "default" },
      pending_approval: { label: "Chờ duyệt", variant: "secondary" },
      waiting_lecturer: { label: "Chờ giảng viên", variant: "secondary" },
      lecturer_confirmed: { label: "GV đã xác nhận", variant: "default" },
      approved: { label: "Đã duyệt", variant: "default" },
      in_progress: { label: "Đang thực tập", variant: "default" },
      completed: { label: "Hoàn thành", variant: "default" },
      rejected: { label: "Từ chối", variant: "destructive" },
      assigned_to_project: { label: "Được phân công", variant: "default" },
    };
    const info = statusMap[status] || { label: status, variant: "secondary" };
    return <Badge variant={info.variant}>{info.label}</Badge>;
  };

  const StatCard = ({ 
    title, 
    value, 
    icon: Icon, 
    description, 
    trend,
    color = "blue",
    badge,
    onClick
  }: { 
    title: string; 
    value: number | string; 
    icon: React.ElementType; 
    description: string;
    trend?: string;
    color?: "blue" | "green" | "yellow" | "red" | "purple" | "orange";
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
    };

    return (
      <Card 
        className={`border-2 ${colorClasses[color]} ${onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}`}
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
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Giảng viên</h1>
          <p className="text-gray-500 mt-1">Tổng quan hoạt động hướng dẫn thực tập</p>
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
          {/* Statistics Cards - Row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              title="Tổng sinh viên"
              value={stats.totalStudents}
              icon={Users}
              description="Đang hướng dẫn"
              color="blue"
            />
            <StatCard
              title="Đã có công ty"
              value={stats.studentsWithCompany}
              icon={Building2}
              description={`${stats.totalStudents > 0 ? Math.round((stats.studentsWithCompany / stats.totalStudents) * 100) : 0}% tổng số SV`}
              color="green"
            />
            <StatCard
              title="Đang tìm công ty"
              value={stats.studentsSearching}
              icon={AlertCircle}
              description="Cần hỗ trợ"
              color="yellow"
            />
            
          </div>

          {/* Statistics Cards - Row 2 (Coming Soon Features) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Tin nhắn mới"
              value={unreadCount}
              icon={MessageSquare}
              description="Từ sinh viên"
              color="purple"
              onClick={() => router.push("/dashboard/lecturer/chat")}
            />
            <StatCard
              title="Báo cáo tuần mới"
              value={stats.weeklyReports}
              icon={FileText}
              description="Chờ duyệt"
              color="blue"
              onClick={() => router.push("/dashboard/lecturer/weekly-reports")}
            />
            <StatCard
              title="Deadline sắp tới"
              value={stats.upcomingDeadlines}
              icon={Calendar}
              description="Trong 7 ngày tới"
              color="red"
              badge="Sắp có"
            />
            <StatCard
              title="Hoàn thành"
              value={confirmedStudents.filter(s => s.status === "completed").length}
              icon={CheckCircle}
              description="Đã hoàn thành thực tập"
              color="green"
            />
          </div>

          {/* Recent Students List */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-500" />
                    Sinh viên gần đây
                  </CardTitle>
                  <CardDescription>
                    {stats.totalStudents} sinh viên đang hướng dẫn
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm">
                  Xem tất cả
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {confirmedStudents.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Chưa có sinh viên nào</p>
                  <p className="text-sm text-gray-400 mt-1">Sinh viên sẽ xuất hiện ở đây khi họ chọn bạn làm giảng viên hướng dẫn</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>MSSV</TableHead>
                        <TableHead>Họ tên</TableHead>
                        <TableHead>Khoa</TableHead>
                        <TableHead>Học kỳ</TableHead>
                        <TableHead>Công ty</TableHead>
                        <TableHead>Trạng thái</TableHead>
                        <TableHead className="text-right">Hành động</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {confirmedStudents.slice(0, 5).map((reg) => (
                        <TableRow key={reg.id}>
                          <TableCell className="font-medium">{reg.student?.student_id}</TableCell>
                          <TableCell>{reg.student?.full_name}</TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-600">{reg.student?.department}</span>
                          </TableCell>
                          <TableCell className="text-sm">
                            {reg.period?.semester} - {reg.period?.academic_year}
                          </TableCell>
                          <TableCell>
                            {reg.company_name ? (
                              <div className="flex items-center gap-1">
                                <Building2 className="w-3 h-3 text-green-600" />
                                <span className="text-sm">{reg.company_name}</span>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-sm">Chưa có</span>
                            )}
                          </TableCell>
                          <TableCell>{getStatusBadge(reg.status)}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm">
                              Chi tiết
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {confirmedStudents.length > 5 && (
                    <div className="mt-4 text-center">
                      <Button variant="link" size="sm">
                        Xem thêm {confirmedStudents.length - 5} sinh viên
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions & Tips */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Thao tác nhanh</CardTitle>
                <CardDescription>Các tác vụ thường dùng</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start gap-2" disabled>
                  <MessageSquare className="w-4 h-4" />
                  Gửi tin nhắn cho sinh viên <Badge variant="secondary" className="ml-auto">Sắp có</Badge>
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2" disabled>
                  <FileText className="w-4 h-4" />
                  Xem báo cáo tuần <Badge variant="secondary" className="ml-auto">Sắp có</Badge>
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2" disabled>
                  <Calendar className="w-4 h-4" />
                  Lên lịch meeting <Badge variant="secondary" className="ml-auto">Sắp có</Badge>
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2" disabled>
                  <CheckCircle className="w-4 h-4" />
                  Phê duyệt công ty <Badge variant="secondary" className="ml-auto">Sắp có</Badge>
                </Button>
              </CardContent>
            </Card>

            {/* Tips */}
            <Card className="bg-linear-to-br from-blue-50 to-indigo-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="text-2xl">💡</span>
                  Gợi ý hữu ích
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <div className="w-1.5 bg-blue-500 rounded-full shrink-0"></div>
                  <p className="text-sm text-gray-700">
                    Kiểm tra thông tin công ty của sinh viên trước khi phê duyệt
                  </p>
                </div>
                <div className="flex gap-2">
                  <div className="w-1.5 bg-blue-500 rounded-full shrink-0"></div>
                  <p className="text-sm text-gray-700">
                    Hỗ trợ sinh viên đang tìm công ty bằng cách giới thiệu đối tác
                  </p>
                </div>
                <div className="flex gap-2">
                  <div className="w-1.5 bg-blue-500 rounded-full shrink-0"></div>
                  <p className="text-sm text-gray-700">
                    Sắp có: Chức năng chat trực tiếp và theo dõi báo cáo tuần
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
