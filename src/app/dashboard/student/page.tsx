"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { 
  Calendar, 
  Briefcase, 
  User, 
  FileText, 
  CheckCircle, 
  AlertTriangle,
  Building2,
  GraduationCap,
  MessageSquare
} from "lucide-react";

type InternshipPeriod = {
  id: string;
  semester: string;
  academic_year: string;
  registration_start: string;
  registration_end: string;
  lecturer_selection_end: string;
  search_deadline: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
};

type StudentRegistration = {
  id: string;
  period_id: string;
  student_id: string;
  status: string;
};

type Profile = {
  id: string;
  full_name?: string;
  email?: string;
  department?: string;
  student_id?: string;
  [key: string]: unknown;
};

type WeeklyReportStats = {
  total: number;
  submitted: number;
  approved: number;
  needs_revision: number;
};

type CurrentWeekReport = {
  id: string;
  week_number: number;
  start_date: string;
  end_date: string;
  status: string;
  submission_date: string | null;
  report_title: string | null;
  report_file_url: string | null;
  grade: number | null;
  lecturer_feedback: string | null;
  reviewed_date: string | null;
};

export default function StudentDashboardPage() {
  const [myRegistration, setMyRegistration] = useState<StudentRegistration | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const { unreadCount } = useUnreadMessages("student");
  const [weeklyReportStats, setWeeklyReportStats] = useState<WeeklyReportStats>({
    total: 0,
    submitted: 0,
    approved: 0,
    needs_revision: 0,
  });
  const [currentWeekReport, setCurrentWeekReport] = useState<CurrentWeekReport | null>(null);
  const [companyName, setCompanyName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      try {
        setIsLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch student profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (profileData) {
          setProfile(profileData as Profile);
        }

        const { data: period } = await supabase
          .from("internship_periods")
          .select("*")
          .eq("is_active", true)
          .single();

        // Check if period exists and student meets criteria
        if (period && profileData) {
          let meetsAllCriteria = true;

          // Check department criteria
          const targetDepartments = (period as InternshipPeriod & { target_departments?: string[] }).target_departments;
          if (targetDepartments && targetDepartments.length > 0) {
            if (!profileData.department || !targetDepartments.includes(profileData.department)) {
              meetsAllCriteria = false;
            }
          }

          // Check academic year criteria
          const targetAcademicYears = (period as InternshipPeriod & { target_academic_years?: string[] }).target_academic_years;
          const studentAcademicYear = (profileData as Profile & { academic_year?: string }).academic_year;
          if (targetAcademicYears && targetAcademicYears.length > 0) {
            if (!studentAcademicYear || !targetAcademicYears.includes(studentAcademicYear)) {
              meetsAllCriteria = false;
            }
          }

          // Check internship status criteria
          const targetInternshipStatuses = (period as InternshipPeriod & { target_internship_statuses?: string[] }).target_internship_statuses;
          const studentInternshipStatus = (profileData as Profile & { internship_status?: string }).internship_status;
          if (targetInternshipStatuses && targetInternshipStatuses.length > 0) {
            if (!studentInternshipStatus || !targetInternshipStatuses.includes(studentInternshipStatus)) {
              meetsAllCriteria = false;
            }
          }

          // Only set period if student meets all criteria
          if (meetsAllCriteria) {
            // Period meets criteria
          } else {
            // Period doesn't meet criteria
          }
        } else {
          // No criteria check needed
        }

        if (period) {
          const { data: registration } = await supabase
            .from("student_registrations")
            .select("*")
            .eq("period_id", period.id)
            .eq("student_id", user.id)
            .single();
          
          if (registration) {
            setMyRegistration(registration as StudentRegistration);
            setCompanyName((registration as StudentRegistration & { company_name?: string }).company_name || "");

            // Load weekly reports statistics
            const { data: reports } = await supabase
              .from("weekly_reports")
              .select("*")
              .eq("registration_id", registration.id)
              .order("week_number", { ascending: true });

            if (reports) {
              setWeeklyReportStats({
                total: reports.length,
                submitted: reports.filter(r => 
                  ["submitted", "late_submitted", "resubmitted", "late_resubmitted", "approved", "rejected", "needs_revision"].includes(r.status)
                ).length,
                approved: reports.filter(r => r.status === "approved").length,
                needs_revision: reports.filter(r => r.status === "needs_revision").length,
              });

              // Find current week report
              const today = new Date();
              const currentReport = reports.find(r => {
                const startDate = new Date(r.start_date);
                const endDate = new Date(r.end_date);
                return today >= startDate && today <= endDate;
              });

              if (currentReport) {
                setCurrentWeekReport(currentReport as CurrentWeekReport);
              }
            }
          }
        }
      } catch (err) {
        console.error(err);
        toast.error("Lỗi tải dữ liệu");
      } finally {
        setIsLoading(false);
      }
    };
    const id = setTimeout(run, 0);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, []);

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
    const info = statusMap[status] || { label: status, variant: "secondary" as const };
    return <Badge variant={info.variant}>{info.label}</Badge>;
  };

  const getReportStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive"; color: string }> = {
      not_submitted: { label: "Chưa nộp", variant: "secondary", color: "gray" },
      submitted: { label: "Đã nộp", variant: "default", color: "blue" },
      late_submitted: { label: "Nộp trễ", variant: "destructive", color: "red" },
      resubmitted: { label: "Đã nộp lại", variant: "default", color: "blue" },
      late_resubmitted: { label: "Nộp lại trễ", variant: "destructive", color: "red" },
      approved: { label: "Đã duyệt", variant: "default", color: "green" },
      rejected: { label: "Từ chối", variant: "destructive", color: "red" },
      needs_revision: { label: "Cần sửa", variant: "secondary", color: "yellow" },
    };
    const info = statusMap[status] || { label: status, variant: "secondary" as const, color: "gray" };
    return <Badge variant={info.variant}>{info.label}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-linear-to-r from-blue-600 to-blue-700 text-white rounded-lg p-8 shadow-lg">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">Chào mừng trở lại! 👋</h1>
            <p className="text-blue-100 mt-2">
              {profile?.full_name && `${profile.full_name} - `}
              {profile?.student_id && `MSSV: ${profile.student_id}`}
            </p>
            {profile?.department && (
              <p className="text-blue-100 text-sm mt-1">
                <GraduationCap className="w-4 h-4 inline mr-1" />
                {profile.department}
              </p>
            )}
          </div>
          <div>
            <Link href="/dashboard/student/profile">
              <Button variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-white/30">
                <User className="w-4 h-4 mr-2" />
                Xem hồ sơ
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Current Week Report */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Báo cáo tuần hiện tại
            </CardTitle>
            <CardDescription>
              Tuần thực tập đang diễn ra
            </CardDescription>
          </CardHeader>
          <CardContent>
            {currentWeekReport ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">
                      Tuần {currentWeekReport.week_number}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {new Date(currentWeekReport.start_date).toLocaleDateString("vi-VN")} -{" "}
                      {new Date(currentWeekReport.end_date).toLocaleDateString("vi-VN")}
                    </p>
                  </div>
                  <div>
                    {getReportStatusBadge(currentWeekReport.status)}
                  </div>
                </div>

                {currentWeekReport.status === "not_submitted" && (
                  <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-6 h-6 text-yellow-600 mt-0.5" />
                      <div>
                        <p className="font-semibold text-yellow-900">Chưa nộp báo cáo</p>
                        <p className="text-sm text-yellow-700 mt-1">
                          Bạn cần nộp báo cáo trước ngày{" "}
                          {new Date(currentWeekReport.end_date).toLocaleDateString("vi-VN")}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <Link href="/dashboard/student/weekly-reports">
                        <Button className="w-full bg-yellow-600 hover:bg-yellow-700">
                          <FileText className="w-4 h-4 mr-2" />
                          Nộp báo cáo ngay
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}

                {currentWeekReport.status === "needs_revision" && currentWeekReport.lecturer_feedback && (
                  <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-6 h-6 text-orange-600 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-semibold text-orange-900">Cần sửa lại</p>
                        <div className="mt-2 p-3 bg-white rounded border border-orange-200">
                          <p className="text-xs font-medium text-orange-800 mb-1">
                            Nhận xét từ giảng viên:
                          </p>
                          <p className="text-sm text-gray-700">
                            {currentWeekReport.lecturer_feedback}
                          </p>
                        </div>
                        {currentWeekReport.grade !== null && (
                          <p className="text-sm text-gray-600 mt-2">
                            Điểm: {currentWeekReport.grade}/10
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-3">
                      <Link href="/dashboard/student/weekly-reports">
                        <Button className="w-full bg-orange-600 hover:bg-orange-700">
                          <FileText className="w-4 h-4 mr-2" />
                          Nộp lại báo cáo
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}

                {["submitted", "late_submitted", "resubmitted", "late_resubmitted"].includes(currentWeekReport.status) && (
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-6 h-6 text-blue-600 mt-0.5" />
                      <div>
                        <p className="font-semibold text-blue-900">Đã nộp báo cáo</p>
                        <p className="text-sm text-blue-700 mt-1">
                          {currentWeekReport.report_title && `Tiêu đề: ${currentWeekReport.report_title}`}
                        </p>
                        {currentWeekReport.submission_date && (
                          <p className="text-sm text-blue-600 mt-1">
                            Nộp lúc: {new Date(currentWeekReport.submission_date).toLocaleString("vi-VN")}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {currentWeekReport.status === "approved" && (
                  <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-6 h-6 text-green-600 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-semibold text-green-900">Đã được duyệt</p>
                        {currentWeekReport.grade !== null && (
                          <p className="text-lg font-bold text-green-700 mt-1">
                            Điểm: {currentWeekReport.grade}/10
                          </p>
                        )}
                        {currentWeekReport.lecturer_feedback && (
                          <div className="mt-2 p-3 bg-white rounded border border-green-200">
                            <p className="text-xs font-medium text-green-800 mb-1">
                              Nhận xét từ giảng viên:
                            </p>
                            <p className="text-sm text-gray-700">
                              {currentWeekReport.lecturer_feedback}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t">
                  <Link href="/dashboard/student/weekly-reports">
                    <Button variant="outline" className="w-full">
                      Xem tất cả báo cáo tuần
                    </Button>
                  </Link>
                </div>
              </div>
            ) : myRegistration ? (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">Chưa có tuần nào đang diễn ra</p>
                <p className="text-sm text-gray-500 mt-1">
                  Kỳ thực tập chưa bắt đầu hoặc đã kết thúc
                </p>
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
                <p className="text-gray-600">Bạn chưa đăng ký thực tập</p>
                <div className="mt-4">
                  <Link href="/dashboard/student/registration">
                    <Button>
                      <Calendar className="w-4 h-4 mr-2" />
                      Đăng ký ngay
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Registration Status & Company */}
        <div className="space-y-6">
          {/* Messages Notification */}
          {unreadCount > 0 && (
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-blue-600" />
                  Tin nhắn mới
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full">
                      <span className="text-2xl font-bold text-blue-600">{unreadCount}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {unreadCount} tin nhắn chưa đọc
                      </p>
                      <p className="text-sm text-gray-600">
                        Từ giảng viên hướng dẫn
                      </p>
                    </div>
                  </div>
                  <Link href="/dashboard/student/chat">
                    <Button className="w-full" variant="outline">
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Xem tin nhắn
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-orange-600" />
                Trạng thái đăng ký
              </CardTitle>
            </CardHeader>
            <CardContent>
              {myRegistration ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">Trạng thái hiện tại</p>
                    <div className="mt-1">{getStatusBadge(myRegistration.status)}</div>
                  </div>

                  {companyName && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Building2 className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div>
                          <p className="text-sm text-gray-600">Công ty</p>
                          <p className="font-medium text-gray-900">{companyName}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-4">
                    <Link href="/dashboard/student/registration">
                      <Button variant="outline" className="w-full">
                        Xem chi tiết
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <AlertTriangle className="w-10 h-10 text-yellow-500 mx-auto mb-2" />
                  <p className="text-sm text-gray-600 mb-3">Bạn chưa đăng ký thực tập</p>
                  <Link href="/dashboard/student/registration">
                    <Button className="w-full">
                      <Calendar className="w-4 h-4 mr-2" />
                      Đăng ký ngay
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Weekly Reports Stats */}
          {myRegistration && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-green-600" />
                  Báo cáo tuần
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Tổng số tuần</span>
                    <span className="font-semibold">{weeklyReportStats.total}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Đã nộp</span>
                    <span className="font-semibold text-blue-600">
                      {weeklyReportStats.submitted}/{weeklyReportStats.total}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Đã duyệt</span>
                    <span className="font-semibold text-green-600">
                      <CheckCircle className="w-4 h-4 inline mr-1" />
                      {weeklyReportStats.approved}
                    </span>
                  </div>
                  {weeklyReportStats.needs_revision > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Cần sửa</span>
                      <span className="font-semibold text-yellow-600">
                        <AlertTriangle className="w-4 h-4 inline mr-1" />
                        {weeklyReportStats.needs_revision}
                      </span>
                    </div>
                  )}

                  <div className="mt-4 pt-3 border-t">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">Tiến độ</span>
                      <span className="text-sm font-medium">
                        {weeklyReportStats.total > 0
                          ? ((weeklyReportStats.submitted / weeklyReportStats.total) * 100).toFixed(0)
                          : 0}
                        %
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{
                          width: `${
                            weeklyReportStats.total > 0
                              ? (weeklyReportStats.submitted / weeklyReportStats.total) * 100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Cần tối thiểu 8/13 tuần để hoàn thành
                    </p>
                  </div>

                  <div className="mt-4">
                    <Link href="/dashboard/student/weekly-reports">
                      <Button variant="outline" className="w-full">
                        <FileText className="w-4 h-4 mr-2" />
                        Xem báo cáo
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
