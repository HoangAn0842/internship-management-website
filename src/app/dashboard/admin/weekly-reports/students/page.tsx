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

type StudentReport = {
  registration_id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  student_student_id: string;
  lecturer_name: string | null;
  company_name: string | null;
  total_weeks: number;
  submitted: number;
  approved: number;
  pending: number;
  not_submitted: number;
  completion_rate: number;
};

export default function AdminStudentsListPage() {
  const router = useRouter();
  const [periods, setPeriods] = useState<InternshipPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
  const [students, setStudents] = useState<StudentReport[]>([]);
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

      // Load all students in the selected period
      const { data: registrations } = await supabase
        .from("student_registrations")
        .select(`
          id,
          student_id,
          company_name,
          students:student_id(full_name, email, student_id),
          lecturer:assigned_lecturer_id(full_name)
        `)
        .eq("period_id", selectedPeriodId)
        .in("status", ["company_submitted", "pending_approval", "approved", "in_progress", "completed"]);

      if (!registrations || registrations.length === 0) {
        setStudents([]);
        setIsLoading(false);
        return;
      }

      const registrationIds = registrations.map(r => r.id);

      // Load all weekly reports
      const { data: allReports } = await supabase
        .from("weekly_reports")
        .select("*")
        .in("registration_id", registrationIds);

      // Calculate statistics for each student
      const studentStats: StudentReport[] = registrations.map(reg => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const regData = reg as any;
        const reports = allReports?.filter(r => r.registration_id === reg.id) || [];
        
        const submitted = reports.filter(r => 
          ["submitted", "late_submitted", "resubmitted", "late_resubmitted", "approved", "rejected", "needs_revision"].includes(r.status)
        ).length;
        const approved = reports.filter(r => r.status === "approved").length;
        const pending = reports.filter(r => 
          ["submitted", "late_submitted", "resubmitted", "late_resubmitted"].includes(r.status)
        ).length;
        const not_submitted = reports.filter(r => r.status === "not_submitted").length;

        return {
          registration_id: reg.id,
          student_id: regData.student_id,
          student_name: regData.students?.full_name || "Unknown",
          student_email: regData.students?.email || "",
          student_student_id: regData.students?.student_id || "",
          lecturer_name: regData.lecturer?.full_name || null,
          company_name: reg.company_name,
          total_weeks: reports.length,
          submitted,
          approved,
          pending,
          not_submitted,
          completion_rate: reports.length > 0 ? (submitted / reports.length) * 100 : 0,
        };
      });

      // Sort by completion rate (ascending) to show students needing attention first
      studentStats.sort((a, b) => a.completion_rate - b.completion_rate);

      setStudents(studentStats);
    } catch (error) {
      console.error("Error loading students data:", error);
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

  const filteredStudents = students.filter(student => {
    const query = searchQuery.toLowerCase();
    return (
      student.student_name.toLowerCase().includes(query) ||
      student.student_email.toLowerCase().includes(query) ||
      student.student_student_id.toLowerCase().includes(query) ||
      student.lecturer_name?.toLowerCase().includes(query) ||
      student.company_name?.toLowerCase().includes(query)
    );
  });

  const getCompletionColor = (rate: number) => {
    if (rate >= 80) return "text-green-600";
    if (rate >= 50) return "text-yellow-600";
    return "text-red-600";
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
            <p className="text-gray-500 mt-1">Danh sách tất cả sinh viên và tiến độ nộp báo cáo</p>
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
            variant="outline"
            onClick={() => router.push("/dashboard/admin/weekly-reports/lecturers")}
          >
            <UserCheck className="w-4 h-4 mr-2" />
            Theo giảng viên
          </Button>
          <Button
            variant="default"
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
            <p className="text-gray-600">Chọn kỳ thực tập ở trên để xem danh sách sinh viên.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Card */}
          <Card className="border-2 border-blue-200 bg-blue-50">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Users className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-blue-900">{students.length}</p>
                  <p className="text-sm text-blue-700">Tổng số sinh viên trong kỳ</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Students Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-500" />
                  Danh sách sinh viên
                </CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Tìm kiếm theo tên, email, MSSV, giảng viên, công ty..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 w-96"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {students.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Chưa có sinh viên nào trong kỳ này</p>
                  <p className="text-sm text-gray-400 mt-2">
                    Sinh viên sẽ xuất hiện khi được phê duyệt
                  </p>
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="text-center py-12">
                  <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Không tìm thấy sinh viên</p>
                  <p className="text-sm text-gray-400 mt-2">
                    Thử tìm kiếm với từ khóa khác
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sinh viên</TableHead>
                        <TableHead>MSSV</TableHead>
                        <TableHead>Giảng viên HD</TableHead>
                        <TableHead>Công ty</TableHead>
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
                        <TableHead className="text-right">Hành động</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStudents.map((student) => (
                        <TableRow key={student.registration_id} className="hover:bg-gray-50">
                          <TableCell>
                            <div>
                              <p className="font-medium text-gray-900">{student.student_name}</p>
                              <p className="text-sm text-gray-500">{student.student_email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-sm">{student.student_student_id}</span>
                          </TableCell>
                          <TableCell>
                            {student.lecturer_name ? (
                              <span className="text-sm">{student.lecturer_name}</span>
                            ) : (
                              <span className="text-gray-400 text-sm">Chưa phân công</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {student.company_name ? (
                              <span className="text-sm">{student.company_name}</span>
                            ) : (
                              <span className="text-gray-400 text-sm">Chưa có</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                              {student.submitted}/{student.total_weeks}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {student.pending > 0 ? (
                              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                                {student.pending}
                              </Badge>
                            ) : (
                              <span className="text-gray-400">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {student.approved > 0 ? (
                              <Badge className="bg-green-600">
                                {student.approved}
                              </Badge>
                            ) : (
                              <span className="text-gray-400">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span className={`font-bold ${getCompletionColor(student.completion_rate)}`}>
                                {student.completion_rate.toFixed(0)}%
                              </span>
                              {student.completion_rate < 62 && (
                                <AlertTriangle className="w-4 h-4 text-red-500" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/dashboard/admin/weekly-reports/${student.registration_id}`)}
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
        </>
      )}
    </div>
  );
}
