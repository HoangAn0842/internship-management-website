"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { 
  FileText, 
  Users, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  ArrowLeft,
  Eye,
  Calendar,
  UserCheck
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type InternshipPeriod = {
  id: string;
  semester: string;
  academic_year: string;
  is_active: boolean;
  start_date: string;
  end_date: string;
};

type WeekStats = {
  week_number: number;
  start_date: string;
  end_date: string;
  total_students: number;
  submitted: number;
  late_submitted: number;
  approved: number;
  needs_revision: number;
  rejected: number;
  not_submitted: number;
  pending_review: number;
  completion_rate: number;
};

type StudentWeekDetail = {
  registration_id: string;
  student_name: string;
  student_email: string;
  lecturer_name: string;
  status: string;
  submission_date: string | null;
  report_title: string | null;
  grade: number | null;
};

type DashboardStats = {
  totalStudents: number;
  totalLecturers: number;
  totalWeeks: number;
  totalSubmitted: number;
  pendingReview: number;
  averageCompletion: number;
};

export default function AdminWeeklyReportsPage() {
  const router = useRouter();
  const [periods, setPeriods] = useState<InternshipPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
  const [weekStats, setWeekStats] = useState<WeekStats[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalLecturers: 0,
    totalWeeks: 13,
    totalSubmitted: 0,
    pendingReview: 0,
    averageCompletion: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  
  // Dialog for week details
  const [showWeekDialog, setShowWeekDialog] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<WeekStats | null>(null);
  const [weekStudents, setWeekStudents] = useState<StudentWeekDetail[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);

  // Load all periods
  const loadPeriods = useCallback(async () => {
    try {
      const { data: periodsData } = await supabase
        .from("internship_periods")
        .select("*")
        .order("start_date", { ascending: false });

      if (periodsData) {
        setPeriods(periodsData);
        
        // Auto-select active period or most recent
        const activePeriod = periodsData.find(p => p.is_active);
        if (activePeriod) {
          setSelectedPeriodId(activePeriod.id);
        } else if (periodsData.length > 0) {
          setSelectedPeriodId(periodsData[0].id);
        }
      }
    } catch (error) {
      console.error("Error loading periods:", error);
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!selectedPeriodId) return;
    
    try {
      setIsLoading(true);

      // Load all students in the selected period
      const { data: registrations } = await supabase
        .from("student_registrations")
        .select(`
          id,
          student:student_id(full_name, email),
          lecturer:assigned_lecturer_id(full_name),
          period_id
        `)
        .eq("period_id", selectedPeriodId)
        .in("status", ["company_submitted", "pending_approval", "approved", "in_progress", "completed"]);

      if (!registrations || registrations.length === 0) {
        setIsLoading(false);
        setStats({
          totalStudents: 0,
          totalLecturers: 0,
          totalWeeks: 13,
          totalSubmitted: 0,
          pendingReview: 0,
          averageCompletion: 0,
        });
        return;
      }

      const registrationIds = registrations.map(r => r.id);
      const totalStudents = registrations.length;

      // Count unique lecturers
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const uniqueLecturers = new Set(registrations.map((r: any) => r.lecturer?.full_name).filter(Boolean));
      const totalLecturers = uniqueLecturers.size;

      // Load all weekly reports
      const { data: allReports } = await supabase
        .from("weekly_reports")
        .select("*")
        .in("registration_id", registrationIds)
        .order("week_number", { ascending: true });

      // Group reports by week and calculate statistics
      const weekStatsMap = new Map<number, WeekStats>();
      let totalSubmitted = 0;
      let totalPending = 0;

      for (let weekNum = 1; weekNum <= 13; weekNum++) {
        const weekReports = allReports?.filter(r => r.week_number === weekNum) || [];
        
        const submitted_count = weekReports.filter(r =>
          ["submitted", "late_submitted", "resubmitted", "late_resubmitted", "approved", "rejected", "needs_revision"].includes(r.status)
        ).length;
        const late_submitted = weekReports.filter(r => ["late_submitted", "late_resubmitted"].includes(r.status)).length;
        const approved = weekReports.filter(r => r.status === "approved").length;
        const needs_revision = weekReports.filter(r => r.status === "needs_revision").length;
        const rejected = weekReports.filter(r => r.status === "rejected").length;
        const not_submitted = weekReports.filter(r => r.status === "not_submitted").length;
        const pending_review = weekReports.filter(r =>
          ["submitted", "late_submitted", "resubmitted", "late_resubmitted"].includes(r.status)
        ).length;

        totalSubmitted += submitted_count;
        totalPending += pending_review;

        // Get date range from first report or estimate
        let startDate: string;
        let endDate: string;
        
        if (weekReports.length > 0) {
          const firstReport = weekReports[0];
          startDate = firstReport.start_date;
          endDate = firstReport.end_date;
        } else {
          const today = new Date();
          const weekStart = new Date(today);
          weekStart.setDate(today.getDate() + (weekNum - 1) * 7);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          startDate = weekStart.toISOString().split('T')[0];
          endDate = weekEnd.toISOString().split('T')[0];
        }

        weekStatsMap.set(weekNum, {
          week_number: weekNum,
          start_date: startDate,
          end_date: endDate,
          total_students: totalStudents,
          submitted: submitted_count,
          late_submitted,
          approved,
          needs_revision,
          rejected,
          not_submitted,
          pending_review,
          completion_rate: totalStudents > 0 ? (submitted_count / totalStudents) * 100 : 0,
        });
      }

      const weekStatsArray = Array.from(weekStatsMap.values());
      setWeekStats(weekStatsArray);

      const averageCompletion = weekStatsArray.length > 0
        ? weekStatsArray.reduce((sum, week) => sum + week.completion_rate, 0) / weekStatsArray.length
        : 0;

      setStats({
        totalStudents,
        totalLecturers,
        totalWeeks: 13,
        totalSubmitted,
        pendingReview: totalPending,
        averageCompletion,
      });
    } catch (error) {
      console.error("Error loading weekly reports data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedPeriodId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      await loadPeriods();
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [loadPeriods]);

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

  const handleViewWeekDetails = async (week: WeekStats) => {
    if (!selectedPeriodId) return;
    
    setSelectedWeek(week);
    setShowWeekDialog(true);
    setIsLoadingStudents(true);

    try {
      // Load students for the selected period
      const { data: registrations } = await supabase
        .from("student_registrations")
        .select(`
          id,
          student:student_id(full_name, email),
          lecturer:assigned_lecturer_id(full_name)
        `)
        .eq("period_id", selectedPeriodId)
        .in("status", ["company_submitted", "pending_approval", "approved", "in_progress", "completed"]);

      if (!registrations) return;

      const registrationIds = registrations.map(r => r.id);

      // Load reports for this specific week
      const { data: reports } = await supabase
        .from("weekly_reports")
        .select("*")
        .in("registration_id", registrationIds)
        .eq("week_number", week.week_number);

      if (!reports) return;

      // Map students with their report status
      const studentDetails: StudentWeekDetail[] = registrations.map(reg => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const regData = reg as any;
        const report = reports.find(r => r.registration_id === reg.id);

        return {
          registration_id: reg.id,
          student_name: regData.student?.full_name || "Unknown",
          student_email: regData.student?.email || "",
          lecturer_name: regData.lecturer?.full_name || "Chưa phân công",
          status: report?.status || "not_submitted",
          submission_date: report?.submission_date || null,
          report_title: report?.report_title || null,
          grade: report?.grade || null,
        };
      });

      // Sort: submitted first, then by name
      studentDetails.sort((a, b) => {
        if (a.status === "not_submitted" && b.status !== "not_submitted") return 1;
        if (a.status !== "not_submitted" && b.status === "not_submitted") return -1;
        return a.student_name.localeCompare(b.student_name);
      });

      setWeekStudents(studentDetails);
    } catch (error) {
      console.error("Error loading week details:", error);
    } finally {
      setIsLoadingStudents(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      not_submitted: { label: "Chưa nộp", variant: "secondary" as const, color: "bg-gray-100 text-gray-800" },
      submitted: { label: "Đã nộp", variant: "secondary" as const, color: "bg-blue-100 text-blue-800" },
      late_submitted: { label: "Nộp trễ", variant: "destructive" as const, color: "bg-red-100 text-red-800" },
      resubmitted: { label: "Đã nộp lại", variant: "secondary" as const, color: "bg-blue-200 text-blue-900" },
      late_resubmitted: { label: "Nộp lại trễ", variant: "destructive" as const, color: "bg-red-200 text-red-900" },
      approved: { label: "Đã duyệt", variant: "secondary" as const, color: "bg-green-100 text-green-800" },
      needs_revision: { label: "Cần sửa", variant: "secondary" as const, color: "bg-yellow-100 text-yellow-800" },
      rejected: { label: "Từ chối", variant: "destructive" as const, color: "bg-red-100 text-red-800" },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.not_submitted;
    return <Badge variant={config.variant} className={config.color}>{config.label}</Badge>;
  };

  const getCompletionColor = (rate: number) => {
    if (rate >= 80) return "text-green-600";
    if (rate >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  const StatCard = ({ 
    title, 
    value, 
    icon: Icon, 
    description, 
    color = "blue" 
  }: { 
    title: string; 
    value: number | string; 
    icon: React.ElementType; 
    description: string;
    color?: "blue" | "green" | "yellow" | "red" | "purple";
  }) => {
    const colorClasses = {
      blue: "bg-blue-50 text-blue-600 border-blue-200",
      green: "bg-green-50 text-green-600 border-green-200",
      yellow: "bg-yellow-50 text-yellow-600 border-yellow-200",
      red: "bg-red-50 text-red-600 border-red-200",
      purple: "bg-purple-50 text-purple-600 border-purple-200",
    };

    return (
      <Card className={`border-2 ${colorClasses[color]}`}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
              <p className="text-3xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500 mt-2">{description}</p>
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
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push("/dashboard/admin")}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">Quản lý báo cáo tuần</h1>
            <p className="text-gray-500 mt-1">Theo dõi và quản lý báo cáo của tất cả sinh viên theo timeline</p>
          </div>
          
          {/* Period Selector */}
          {periods.length > 0 && (
            <div className="min-w-[280px]">
              <label className="text-sm text-gray-600 block mb-2">Chọn kỳ thực tập</label>
              <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
                <SelectTrigger className="bg-white border-gray-300">
                  <SelectValue placeholder="Chọn kỳ..." />
                </SelectTrigger>
                <SelectContent>
                  {periods.map((period) => (
                    <SelectItem key={period.id} value={period.id}>
                      <div className="flex items-center gap-2">
                        <span>
                          {period.semester} - {period.academic_year}
                        </span>
                        {period.is_active && (
                          <Badge className="bg-green-600 text-xs ml-2">Đang hoạt động</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Quick Navigation */}
        <div className="flex gap-2">
          <Button
            variant="default"
            onClick={() => router.push("/dashboard/admin/weekly-reports")}
          >
            <Calendar className="w-4 h-4 mr-2" />
            Timeline
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/admin/weekly-reports/lecturers")}
          >
            <UserCheck className="w-4 h-4 mr-2" />
            Theo giảng viên
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/admin/weekly-reports/students")}
          >
            <Users className="w-4 h-4 mr-2" />
            Theo sinh viên
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-24 animate-pulse mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-16 animate-pulse mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-32 animate-pulse"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : periods.length === 0 ? (
        <Card className="border-2 border-yellow-200">
          <CardContent className="p-12 text-center">
            <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Chưa có kỳ thực tập nào
            </h3>
            <p className="text-gray-600">
              Hãy tạo kỳ thực tập để bắt đầu quản lý báo cáo.
            </p>
          </CardContent>
        </Card>
      ) : !selectedPeriodId ? (
        <Card className="border-2 border-blue-200">
          <CardContent className="p-12 text-center">
            <Calendar className="w-12 h-12 text-blue-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Vui lòng chọn kỳ thực tập
            </h3>
            <p className="text-gray-600">
              Chọn kỳ thực tập ở trên để xem báo cáo của sinh viên.
            </p>
          </CardContent>
        </Card>
      ) : stats.totalStudents === 0 ? (
        <Card className="border-2 border-gray-200">
          <CardContent className="p-12 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Không có sinh viên
            </h3>
            <p className="text-gray-600">
              Kỳ thực tập này chưa có sinh viên nào đăng ký.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard
              title="Tổng sinh viên"
              value={stats.totalStudents}
              icon={Users}
              description="Đang thực tập"
              color="blue"
            />
            <StatCard
              title="Giảng viên"
              value={stats.totalLecturers}
              icon={UserCheck}
              description="Đang hướng dẫn"
              color="purple"
            />
            <StatCard
              title="Tổng tuần"
              value={stats.totalWeeks}
              icon={Calendar}
              description="Thời gian thực tập"
              color="green"
            />
            <StatCard
              title="Đã nộp"
              value={stats.totalSubmitted}
              icon={FileText}
              description="Tổng số báo cáo"
              color="green"
            />
            <StatCard
              title="Chờ duyệt"
              value={stats.pendingReview}
              icon={Clock}
              description="Cần review"
              color="yellow"
            />
          </div>

          {/* Weekly Timeline Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-500" />
                    Timeline 13 tuần thực tập
                  </CardTitle>
                  <CardDescription>
                    Click vào mỗi tuần để xem danh sách sinh viên chi tiết
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {weekStats.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Chưa có dữ liệu báo cáo tuần</p>
                  <p className="text-sm text-gray-400 mt-2">
                    Hệ thống sẽ tự động tạo báo cáo khi sinh viên được phê duyệt
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">Tuần</TableHead>
                        <TableHead>Thời gian</TableHead>
                        <TableHead className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <CheckCircle className="w-4 h-4" />
                            Đã nộp
                          </div>
                        </TableHead>
                        <TableHead className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <AlertTriangle className="w-4 h-4" />
                            Nộp trễ
                          </div>
                        </TableHead>
                        <TableHead className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <CheckCircle className="w-4 h-4" />
                            Đã duyệt
                          </div>
                        </TableHead>
                        <TableHead className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Clock className="w-4 h-4" />
                            Chờ duyệt
                          </div>
                        </TableHead>
                        <TableHead className="text-center">Tỷ lệ hoàn thành</TableHead>
                        <TableHead className="text-right">Hành động</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {weekStats.map((week) => (
                        <TableRow key={week.week_number} className="hover:bg-gray-50">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center">
                                {week.week_number}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-gray-400" />
                              <div className="text-sm">
                                <div className="font-medium">
                                  {new Date(week.start_date).toLocaleDateString("vi-VN")}
                                </div>
                                <div className="text-gray-500">
                                  đến {new Date(week.end_date).toLocaleDateString("vi-VN")}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                              {week.submitted}/{week.total_students}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {week.late_submitted > 0 ? (
                              <Badge variant="destructive">
                                {week.late_submitted}
                              </Badge>
                            ) : (
                              <span className="text-gray-400">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {week.approved > 0 ? (
                              <Badge className="bg-green-600">
                                {week.approved}
                              </Badge>
                            ) : (
                              <span className="text-gray-400">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {week.pending_review > 0 ? (
                              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                                {week.pending_review}
                              </Badge>
                            ) : (
                              <span className="text-gray-400">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`font-bold ${getCompletionColor(week.completion_rate)}`}>
                              {week.completion_rate.toFixed(0)}%
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewWeekDetails(week)}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Xem chi tiết
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Help Section */}
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="text-2xl">💡</span>
                Hướng dẫn quản lý
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <div className="w-1.5 bg-blue-500 rounded-full shrink-0"></div>
                <p className="text-sm text-gray-700">
                  Click <strong>Xem chi tiết</strong> để xem danh sách sinh viên và giảng viên hướng dẫn
                </p>
              </div>
              <div className="flex gap-2">
                <div className="w-1.5 bg-blue-500 rounded-full shrink-0"></div>
                <p className="text-sm text-gray-700">
                  Dùng tab <strong>Theo giảng viên</strong> để xem thống kê theo từng giảng viên
                </p>
              </div>
              <div className="flex gap-2">
                <div className="w-1.5 bg-blue-500 rounded-full shrink-0"></div>
                <p className="text-sm text-gray-700">
                  Dùng tab <strong>Theo sinh viên</strong> để tìm kiếm và xem chi tiết từng sinh viên
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Week Details Dialog */}
      <Dialog open={showWeekDialog} onOpenChange={setShowWeekDialog}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedWeek && (
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-lg">
                    {selectedWeek.week_number}
                  </div>
                  <div>
                    <div className="text-xl font-bold">
                      Tuần {selectedWeek.week_number}
                    </div>
                    <div className="text-sm font-normal text-gray-500">
                      {new Date(selectedWeek.start_date).toLocaleDateString("vi-VN")} - 
                      {new Date(selectedWeek.end_date).toLocaleDateString("vi-VN")}
                    </div>
                  </div>
                </div>
              )}
            </DialogTitle>
            <DialogDescription>
              Danh sách sinh viên và trạng thái nộp báo cáo
            </DialogDescription>
          </DialogHeader>

          {isLoadingStudents ? (
            <div className="py-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-500 mt-4">Đang tải dữ liệu...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary */}
              {selectedWeek && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card className="border-green-200 bg-green-50">
                    <CardContent className="p-4">
                      <div className="text-sm text-gray-600">Đã nộp</div>
                      <div className="text-2xl font-bold text-green-700">
                        {selectedWeek.submitted}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-yellow-200 bg-yellow-50">
                    <CardContent className="p-4">
                      <div className="text-sm text-gray-600">Chờ duyệt</div>
                      <div className="text-2xl font-bold text-yellow-700">
                        {selectedWeek.pending_review}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-gray-200 bg-gray-50">
                    <CardContent className="p-4">
                      <div className="text-sm text-gray-600">Chưa nộp</div>
                      <div className="text-2xl font-bold text-gray-700">
                        {selectedWeek.not_submitted}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-blue-200 bg-blue-50">
                    <CardContent className="p-4">
                      <div className="text-sm text-gray-600">Tỷ lệ</div>
                      <div className={`text-2xl font-bold ${getCompletionColor(selectedWeek.completion_rate)}`}>
                        {selectedWeek.completion_rate.toFixed(0)}%
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Students List */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sinh viên</TableHead>
                    <TableHead>Giảng viên HD</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Ngày nộp</TableHead>
                    <TableHead>Tiêu đề</TableHead>
                    <TableHead className="text-center">Điểm</TableHead>
                    <TableHead className="text-right">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {weekStudents.map((student) => (
                    <TableRow key={student.registration_id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{student.student_name}</p>
                          <p className="text-sm text-gray-500">{student.student_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{student.lecturer_name}</span>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(student.status)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {student.submission_date ? (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-gray-400" />
                            {new Date(student.submission_date).toLocaleDateString("vi-VN")}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm max-w-xs truncate">
                        {student.report_title || <span className="text-gray-400">—</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        {student.grade !== null ? (
                          <span className="font-medium">{student.grade.toFixed(1)}</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {student.status !== "not_submitted" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setShowWeekDialog(false);
                              router.push(`/dashboard/admin/weekly-reports/${student.registration_id}`);
                            }}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Chi tiết
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
