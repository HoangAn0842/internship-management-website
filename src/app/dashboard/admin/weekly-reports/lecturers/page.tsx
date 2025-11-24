"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Users, 
  ArrowLeft,
  Eye,
  Search,
  CheckCircle,
  Clock,
  AlertTriangle,
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

type LecturerReport = {
  lecturer_id: string;
  lecturer_name: string;
  lecturer_email: string;
  total_students: number;
  total_reports: number;
  submitted: number;
  approved: number;
  pending: number;
  not_submitted: number;
  completion_rate: number;
  average_grade: number | null;
};

export default function AdminLecturersReportsPage() {
  const router = useRouter();
  const [periods, setPeriods] = useState<InternshipPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
  const [lecturers, setLecturers] = useState<LecturerReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Load all periods
  const loadPeriods = useCallback(async () => {
    try {
      const { data: periodsData } = await supabase
        .from("internship_periods")
        .select("*")
        .order("start_date", { ascending: false });

      if (periodsData) {
        setPeriods(periodsData);
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

      // Load all lecturers
      const { data: allLecturers } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("role", "lecturer");

      if (!allLecturers || allLecturers.length === 0) {
        setLecturers([]);
        setIsLoading(false);
        return;
      }

      // Load registrations for the selected period
      const { data: registrations } = await supabase
        .from("student_registrations")
        .select("id, assigned_lecturer_id")
        .eq("period_id", selectedPeriodId)
        .in("status", ["company_submitted", "pending_approval", "approved", "in_progress", "completed"])
        .not("assigned_lecturer_id", "is", null);

      if (!registrations || registrations.length === 0) {
        setLecturers([]);
        setIsLoading(false);
        return;
      }

      const registrationIds = registrations.map(r => r.id);

      // Load all weekly reports
      const { data: allReports } = await supabase
        .from("weekly_reports")
        .select("*")
        .in("registration_id", registrationIds);

      // Group by lecturer
      const lecturerMap = new Map<string, LecturerReport>();

      allLecturers.forEach(lecturer => {
        // Find registrations for this lecturer
        const lecturerRegs = registrations.filter(r => r.assigned_lecturer_id === lecturer.id);
        
        if (lecturerRegs.length === 0) return; // Skip lecturers with no students in this period

        const lecturerRegIds = lecturerRegs.map(r => r.id);
        const reports = allReports?.filter(r => lecturerRegIds.includes(r.registration_id)) || [];

        const submitted = reports.filter(r =>
          ["submitted", "late_submitted", "resubmitted", "late_resubmitted", "approved", "rejected", "needs_revision"].includes(r.status)
        ).length;
        const approved = reports.filter(r => r.status === "approved").length;
        const pending = reports.filter(r =>
          ["submitted", "late_submitted", "resubmitted", "late_resubmitted"].includes(r.status)
        ).length;
        const not_submitted = reports.filter(r => r.status === "not_submitted").length;

        // Calculate average grade
        const gradedReports = reports.filter(r => r.grade !== null && r.grade !== undefined);
        const average_grade = gradedReports.length > 0
          ? gradedReports.reduce((sum, r) => sum + r.grade, 0) / gradedReports.length
          : null;

        lecturerMap.set(lecturer.id, {
          lecturer_id: lecturer.id,
          lecturer_name: lecturer.full_name,
          lecturer_email: lecturer.email,
          total_students: lecturerRegs.length,
          total_reports: reports.length,
          submitted,
          approved,
          pending,
          not_submitted,
          completion_rate: reports.length > 0 ? (submitted / reports.length) * 100 : 0,
          average_grade,
        });
      });

      const lecturerStats = Array.from(lecturerMap.values());
      
      // Sort by pending review count (descending) to show lecturers needing attention first
      lecturerStats.sort((a, b) => b.pending - a.pending);

      setLecturers(lecturerStats);
    } catch (error) {
      console.error("Error loading lecturers data:", error);
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

  const filteredLecturers = lecturers.filter(lecturer => {
    const query = searchQuery.toLowerCase();
    return (
      lecturer.lecturer_name.toLowerCase().includes(query) ||
      lecturer.lecturer_email.toLowerCase().includes(query)
    );
  });

  const getCompletionColor = (rate: number) => {
    if (rate >= 80) return "text-green-600";
    if (rate >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  const totalStudents = lecturers.reduce((sum, l) => sum + l.total_students, 0);
  const totalPending = lecturers.reduce((sum, l) => sum + l.pending, 0);

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
            <p className="text-gray-500 mt-1">Thống kê theo giảng viên hướng dẫn</p>
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
            variant="outline"
            onClick={() => router.push("/dashboard/admin/weekly-reports")}
          >
            <Calendar className="w-4 h-4 mr-2" />
            Timeline
          </Button>
          <Button
            variant="default"
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
        <Card>
          <CardContent className="p-12">
            <div className="text-center">
              <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3 animate-spin" />
              <p className="text-gray-500">Đang tải dữ liệu...</p>
            </div>
          </CardContent>
        </Card>
      ) : periods.length === 0 ? (
        <Card className="border-2 border-yellow-200">
          <CardContent className="p-12 text-center">
            <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Chưa có kỳ thực tập nào</h3>
            <p className="text-gray-600">Hãy tạo kỳ thực tập để bắt đầu quản lý báo cáo.</p>
          </CardContent>
        </Card>
      ) : !selectedPeriodId ? (
        <Card className="border-2 border-blue-200">
          <CardContent className="p-12 text-center">
            <Calendar className="w-12 h-12 text-blue-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Vui lòng chọn kỳ thực tập</h3>
            <p className="text-gray-600">Chọn kỳ thực tập ở trên để xem thống kê giảng viên.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-2 border-purple-200 bg-purple-50">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <UserCheck className="w-8 h-8 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-purple-900">{lecturers.length}</p>
                    <p className="text-sm text-purple-700">Giảng viên đang hướng dẫn</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-2 border-blue-200 bg-blue-50">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <Users className="w-8 h-8 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-blue-900">{totalStudents}</p>
                    <p className="text-sm text-blue-700">Tổng số sinh viên</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-2 border-yellow-200 bg-yellow-50">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-yellow-100 rounded-lg">
                    <Clock className="w-8 h-8 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-yellow-900">{totalPending}</p>
                    <p className="text-sm text-yellow-700">Báo cáo chờ duyệt</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Lecturers Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-purple-500" />
                  Danh sách giảng viên
                </CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Tìm kiếm theo tên, email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 w-80"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {lecturers.length === 0 ? (
                <div className="text-center py-12">
                  <UserCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Chưa có giảng viên nào được phân công</p>
                  <p className="text-sm text-gray-400 mt-2">
                    Giảng viên sẽ xuất hiện khi có sinh viên được phân công
                  </p>
                </div>
              ) : filteredLecturers.length === 0 ? (
                <div className="text-center py-12">
                  <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Không tìm thấy giảng viên</p>
                  <p className="text-sm text-gray-400 mt-2">
                    Thử tìm kiếm với từ khóa khác
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Giảng viên</TableHead>
                        <TableHead className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Users className="w-4 h-4" />
                            Sinh viên
                          </div>
                        </TableHead>
                        <TableHead className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <CheckCircle className="w-4 h-4" />
                            Đã nộp
                          </div>
                        </TableHead>
                        <TableHead className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Clock className="w-4 h-4" />
                            Chờ duyệt
                          </div>
                        </TableHead>
                        <TableHead className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <CheckCircle className="w-4 h-4" />
                            Đã duyệt
                          </div>
                        </TableHead>
                        <TableHead className="text-center">Tỷ lệ hoàn thành</TableHead>
                        <TableHead className="text-center">Điểm TB</TableHead>
                        <TableHead className="text-right">Hành động</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLecturers.map((lecturer) => (
                        <TableRow key={lecturer.lecturer_id} className="hover:bg-gray-50">
                          <TableCell>
                            <div>
                              <p className="font-medium text-gray-900">{lecturer.lecturer_name}</p>
                              <p className="text-sm text-gray-500">{lecturer.lecturer_email}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                              {lecturer.total_students}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                              {lecturer.submitted}/{lecturer.total_reports}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {lecturer.pending > 0 ? (
                              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                                {lecturer.pending}
                              </Badge>
                            ) : (
                              <span className="text-gray-400">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {lecturer.approved > 0 ? (
                              <Badge className="bg-green-600">
                                {lecturer.approved}
                              </Badge>
                            ) : (
                              <span className="text-gray-400">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span className={`font-bold ${getCompletionColor(lecturer.completion_rate)}`}>
                                {lecturer.completion_rate.toFixed(0)}%
                              </span>
                              {lecturer.completion_rate < 62 && (
                                <AlertTriangle className="w-4 h-4 text-red-500" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {lecturer.average_grade !== null ? (
                              <span className="font-medium">{lecturer.average_grade.toFixed(1)}</span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // Navigate to filtered students view for this lecturer
                                router.push(`/dashboard/admin/weekly-reports/students?lecturer=${lecturer.lecturer_id}`);
                              }}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Xem sinh viên
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
        </>
      )}
    </div>
  );
}
