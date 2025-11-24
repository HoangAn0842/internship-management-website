"use client";

import { use, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  FileText, 
  Calendar, 
  Clock,
  CheckCircle,
  AlertTriangle,
  Download,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Edit,
  User
} from "lucide-react";

type WeeklyReport = {
  id: string;
  registration_id: string;
  week_number: number;
  start_date: string;
  end_date: string;
  report_file_url: string | null;
  report_title: string | null;
  report_content: string | null;
  submission_date: string | null;
  status: string;
  lecturer_feedback: string | null;
  grade: number | null;
  reviewed_date: string | null;
};

type StudentInfo = {
  registration_id: string;
  student_name: string;
  student_email: string;
  student_id: string;
  department: string;
  semester: string;
  academic_year: string;
  company_name: string | null;
};

export default function WeeklyReportDetailPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const router = useRouter();
  const { studentId } = use(params);
  
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Review dialog
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [selectedReport, setSelectedReport] = useState<WeeklyReport | null>(null);
  const [reviewForm, setReviewForm] = useState({
    grade: "",
    feedback: "",
    status: "approved" as "approved" | "rejected" | "needs_revision",
  });

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Load student info
      const { data: regData } = await supabase
        .from("student_registrations")
        .select(`
          id,
          student_id,
          company_name,
          student:student_id(full_name, email, student_id, department),
          period:period_id(semester, academic_year)
        `)
        .eq("id", studentId)
        .single();

      if (regData) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const reg = regData as any;
        setStudentInfo({
          registration_id: reg.id,
          student_name: reg.student?.full_name || "",
          student_email: reg.student?.email || "",
          student_id: reg.student?.student_id || "",
          department: reg.student?.department || "",
          semester: reg.period?.semester || "",
          academic_year: reg.period?.academic_year || "",
          company_name: reg.company_name,
        });
      }

      // Load weekly reports
      const { data: reportsData } = await supabase
        .from("weekly_reports")
        .select("*")
        .eq("registration_id", studentId)
        .order("week_number", { ascending: true });

      if (reportsData) {
        setReports(reportsData);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Lỗi khi tải dữ liệu");
    } finally {
      setIsLoading(false);
    }
  }, [studentId]);

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

  const handleOpenReview = (report: WeeklyReport) => {
    setSelectedReport(report);
    setReviewForm({
      grade: report.grade?.toString() || "",
      feedback: report.lecturer_feedback || "",
      status: report.status === "approved" || report.status === "rejected" || report.status === "needs_revision"
        ? report.status
        : "approved",
    });
    setShowReviewDialog(true);
  };

  const handleSubmitReview = async () => {
    if (!selectedReport) return;

    // Validate grade
    const gradeNum = parseFloat(reviewForm.grade);
    if (isNaN(gradeNum) || gradeNum < 0 || gradeNum > 10) {
      toast.error("Điểm phải từ 0 đến 10");
      return;
    }

    try {
      const { error } = await supabase
        .from("weekly_reports")
        .update({
          grade: gradeNum,
          lecturer_feedback: reviewForm.feedback.trim() || null,
          status: reviewForm.status,
          reviewed_date: new Date().toISOString(),
        })
        .eq("id", selectedReport.id);

      if (error) throw error;

      toast.success("Đã lưu đánh giá");
      setShowReviewDialog(false);
      await loadData();
    } catch (error) {
      console.error("Error submitting review:", error);
      toast.error("Lỗi khi lưu đánh giá");
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive"; icon: React.ElementType }> = {
      not_submitted: { label: "Chưa nộp", variant: "secondary", icon: Clock },
      submitted: { label: "Đã nộp", variant: "default", icon: CheckCircle },
      late_submitted: { label: "Nộp trễ", variant: "destructive", icon: AlertTriangle },
      resubmitted: { label: "Đã nộp lại", variant: "default", icon: CheckCircle },
      late_resubmitted: { label: "Nộp lại trễ", variant: "destructive", icon: AlertTriangle },
      approved: { label: "Đã duyệt", variant: "default", icon: ThumbsUp },
      rejected: { label: "Từ chối", variant: "destructive", icon: ThumbsDown },
      needs_revision: { label: "Cần sửa", variant: "secondary", icon: Edit },
    };
    
    const info = statusMap[status] || { label: status, variant: "secondary", icon: FileText };
    const Icon = info.icon;
    
    return (
      <Badge variant={info.variant} className="flex items-center gap-1 w-fit">
        <Icon className="w-3 h-3" />
        {info.label}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const stats = {
    total: reports.length,
    submitted: reports.filter(r => ["submitted", "late_submitted", "resubmitted", "late_resubmitted", "approved", "rejected", "needs_revision"].includes(r.status)).length,
    pending: reports.filter(r => ["submitted", "late_submitted", "resubmitted", "late_resubmitted"].includes(r.status)).length,
    approved: reports.filter(r => r.status === "approved").length,
    late: reports.filter(r => ["late_submitted", "late_resubmitted"].includes(r.status)).length,
    avgGrade: reports.filter(r => r.grade !== null).length > 0
      ? (reports.filter(r => r.grade !== null).reduce((sum, r) => sum + (r.grade || 0), 0) / reports.filter(r => r.grade !== null).length).toFixed(1)
      : null,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Đang tải...</p>
      </div>
    );
  }

  if (!studentInfo) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Không tìm thấy thông tin sinh viên</p>
          <Button onClick={() => router.push("/dashboard/lecturer/weekly-reports")}>
            Quay lại
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => router.push("/dashboard/lecturer/weekly-reports")}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">Báo cáo tuần - {studentInfo.student_name}</h1>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <User className="w-4 h-4" />
              {studentInfo.student_id}
            </span>
            <span>•</span>
            <span>{studentInfo.department}</span>
            <span>•</span>
            <span>{studentInfo.semester} - {studentInfo.academic_year}</span>
            {studentInfo.company_name && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <FileText className="w-4 h-4" />
                  {studentInfo.company_name}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Tổng tuần</p>
            <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-green-200 bg-green-50">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Đã nộp</p>
            <p className="text-2xl font-bold text-green-600">{stats.submitted}/{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Chờ duyệt</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-teal-200 bg-teal-50">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Đã duyệt</p>
            <p className="text-2xl font-bold text-teal-600">{stats.approved}</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-red-200 bg-red-50">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Nộp trễ</p>
            <p className="text-2xl font-bold text-red-600">{stats.late}</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-purple-200 bg-purple-50">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Điểm TB</p>
            <p className="text-2xl font-bold text-purple-600">
              {stats.avgGrade || "—"}{stats.avgGrade ? "/10" : ""}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Reports Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-500" />
            Timeline 13 tuần thực tập
          </CardTitle>
          <CardDescription>
            Sinh viên cần nộp tối thiểu 8/13 tuần để hoàn thành thực tập
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {reports.map((report) => {
              const isPast = new Date(report.end_date) < new Date();
              const isOpen = !isPast && new Date(report.start_date) <= new Date();
              const canReview = ["submitted", "late_submitted", "resubmitted", "late_resubmitted"].includes(report.status);
              // Detect resubmission: trạng thái là resubmitted hoặc late_resubmitted
              const isResubmitted = ["resubmitted", "late_resubmitted"].includes(report.status);

              return (
                <div
                  key={report.id}
                  className={`border rounded-lg p-4 ${
                    isResubmitted
                      ? "border-blue-500 bg-blue-100 border-2 shadow-md"
                      : report.status === "approved" 
                      ? "border-green-300 bg-green-50" 
                      : report.status === "rejected"
                      ? "border-red-300 bg-red-50"
                      : canReview
                      ? "border-yellow-300 bg-yellow-50"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg">
                          Tuần {report.week_number}
                        </h3>
                        {getStatusBadge(report.status)}
                        {isOpen && report.status === "not_submitted" && (
                          <Badge className="bg-blue-600">Đang mở</Badge>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm text-gray-600 mb-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {formatDate(report.start_date)} - {formatDate(report.end_date)}
                          </span>
                        </div>
                        
                        {report.submission_date && (
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            <span>Nộp: {formatDate(report.submission_date)}</span>
                          </div>
                        )}
                        
                        {report.grade !== null && (
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="font-medium">Điểm: {report.grade}/10</span>
                          </div>
                        )}
                        
                        {report.reviewed_date && (
                          <div className="flex items-center gap-2">
                            <Eye className="w-4 h-4" />
                            <span>Duyệt: {formatDate(report.reviewed_date)}</span>
                          </div>
                        )}
                      </div>

                      {report.report_title && (
                        <div className="mb-2">
                          <p className="text-sm font-medium text-gray-700">
                            Tiêu đề: {report.report_title}
                          </p>
                        </div>
                      )}

                      {report.lecturer_feedback && (
                        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                          <p className="text-xs font-medium text-blue-800 mb-1">Nhận xét của bạn:</p>
                          <p className="text-sm text-gray-700">{report.lecturer_feedback}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 ml-4">
                      {report.report_file_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(report.report_file_url!, "_blank")}
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Tải file
                        </Button>
                      )}
                      
                      {(canReview || report.status === "approved" || report.status === "rejected" || report.status === "needs_revision") && (
                        <Button
                          variant={canReview ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleOpenReview(report)}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          {report.grade !== null ? "Sửa đánh giá" : "Đánh giá"}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Đánh giá báo cáo tuần {selectedReport?.week_number}</DialogTitle>
            <DialogDescription>
              Cho điểm và để lại nhận xét cho báo cáo của sinh viên
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedReport && (
              <div className="p-3 bg-gray-50 rounded-lg text-sm">
                <p className="text-gray-600">
                  Thời gian: {formatDate(selectedReport.start_date)} - {formatDate(selectedReport.end_date)}
                </p>
                {selectedReport.submission_date && (
                  <p className="text-gray-600">
                    Nộp: {formatDate(selectedReport.submission_date)}
                    {new Date(selectedReport.submission_date) > new Date(selectedReport.end_date) && (
                      <Badge variant="destructive" className="ml-2 text-xs">Nộp trễ</Badge>
                    )}
                  </p>
                )}
              </div>
            )}

            <div>
              <Label htmlFor="grade">Điểm (0-10) <span className="text-red-500">*</span></Label>
              <Input
                id="grade"
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={reviewForm.grade}
                onChange={(e) => setReviewForm({ ...reviewForm, grade: e.target.value })}
                placeholder="VD: 8.5"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="feedback">Nhận xét</Label>
              <textarea
                id="feedback"
                value={reviewForm.feedback}
                onChange={(e) => setReviewForm({ ...reviewForm, feedback: e.target.value })}
                placeholder="Nhập nhận xét của bạn về báo cáo..."
                className="w-full mt-1 p-2 border rounded-md min-h-[120px]"
              />
            </div>

            <div>
              <Label>Trạng thái</Label>
              <div className="flex gap-2 mt-2">
                <Button
                  variant={reviewForm.status === "approved" ? "default" : "outline"}
                  onClick={() => setReviewForm({ ...reviewForm, status: "approved" })}
                  className="flex-1"
                >
                  <ThumbsUp className="w-4 h-4 mr-2" />
                  Duyệt
                </Button>
                <Button
                  variant={reviewForm.status === "needs_revision" ? "default" : "outline"}
                  onClick={() => setReviewForm({ ...reviewForm, status: "needs_revision" })}
                  className="flex-1"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Cần sửa
                </Button>
                <Button
                  variant={reviewForm.status === "rejected" ? "destructive" : "outline"}
                  onClick={() => setReviewForm({ ...reviewForm, status: "rejected" })}
                  className="flex-1"
                >
                  <ThumbsDown className="w-4 h-4 mr-2" />
                  Từ chối
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReviewDialog(false)}>
              Hủy
            </Button>
            <Button onClick={handleSubmitReview}>
              Lưu đánh giá
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Warning if not enough reports */}
      {stats.submitted < 8 && (
        <Card className="border-2 border-orange-300 bg-orange-50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-orange-600" />
            <div>
              <p className="font-medium text-orange-900">
                Cảnh báo: Sinh viên mới nộp {stats.submitted}/13 tuần
              </p>
              <p className="text-sm text-orange-700">
                Cần tối thiểu 8 tuần để hoàn thành thực tập (còn thiếu {8 - stats.submitted} tuần)
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
