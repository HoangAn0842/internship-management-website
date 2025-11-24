"use client";

import { useEffect, useState, useCallback } from "react";
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
  FileText, 
  Calendar, 
  Clock,
  CheckCircle,
  AlertTriangle,
  Upload,
  Eye,
  ArrowLeft,
  Award
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

type InternshipInfo = {
  registration_id: string;
  semester: string;
  academic_year: string;
  company_name: string | null;
  lecturer_name: string | null;
};

export default function StudentWeeklyReportsPage() {
  const router = useRouter();
  const [internshipInfo, setInternshipInfo] = useState<InternshipInfo | null>(null);
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Submit dialog
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [selectedReport, setSelectedReport] = useState<WeeklyReport | null>(null);
  const [submitForm, setSubmitForm] = useState({
    title: "",
    content: "",
    file: null as File | null,
  });
  const [isUploading, setIsUploading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load active internship registration
      const { data: regData } = await supabase
        .from("student_registrations")
        .select(`
          id,
          period:period_id(semester, academic_year),
          company_name,
          lecturer:assigned_lecturer_id(full_name)
        `)
        .eq("student_id", user.id)
        .in("status", ["company_submitted", "pending_approval", "approved", "in_progress", "completed"])
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (regData) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const reg = regData as any;
        setInternshipInfo({
          registration_id: reg.id,
          semester: reg.period?.semester || "",
          academic_year: reg.period?.academic_year || "",
          company_name: reg.company_name,
          lecturer_name: reg.lecturer?.full_name || null,
        });

        // Load weekly reports
        const { data: reportsData } = await supabase
          .from("weekly_reports")
          .select("*")
          .eq("registration_id", reg.id)
          .order("week_number", { ascending: true });

        if (reportsData) {
          setReports(reportsData);
        }
      }
    } catch (error) {
      console.error("Error loading data:", error);
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

  const handleOpenSubmit = (report: WeeklyReport) => {
    setSelectedReport(report);
    setSubmitForm({
      title: report.report_title || "",
      content: report.report_content || "",
      file: null,
    });
    setShowSubmitDialog(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File không được vượt quá 10MB");
        return;
      }
      setSubmitForm({ ...submitForm, file });
    }
  };

  const handleSubmitReport = async () => {
    if (!selectedReport || !internshipInfo) return;

    // Validate
    if (!submitForm.title.trim()) {
      toast.error("Vui lòng nhập tiêu đề báo cáo");
      return;
    }

    if (!submitForm.file && !selectedReport.report_file_url) {
      toast.error("Vui lòng chọn file báo cáo");
      return;
    }

    try {
      setIsUploading(true);
      let fileUrl = selectedReport.report_file_url;

      // Upload file if new file selected
      if (submitForm.file) {
        // Sanitize filename - remove special characters and spaces
        const sanitizedFileName = submitForm.file.name
          .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace special chars with underscore
          .replace(/\s+/g, '_'); // Replace spaces with underscore
        
        const fileName = `${internshipInfo.registration_id}_week${selectedReport.week_number}_${Date.now()}_${sanitizedFileName}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("weekly-reports")
          .upload(fileName, submitForm.file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error("Upload error:", uploadError);
          throw new Error(`Lỗi upload file: ${uploadError.message}`);
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from("weekly-reports")
          .getPublicUrl(uploadData.path);

        fileUrl = urlData.publicUrl;
      }

      // Update report
      const { error } = await supabase
        .from("weekly_reports")
        .update({
          report_title: submitForm.title.trim(),
          report_content: submitForm.content.trim() || null,
          report_file_url: fileUrl,
          submission_date: new Date().toISOString(),
          // Status will be auto-updated by trigger (submitted or late_submitted)
        })
        .eq("id", selectedReport.id);

      if (error) throw error;

      toast.success("Đã nộp báo cáo thành công");
      setShowSubmitDialog(false);
      await loadData();
    } catch (error) {
      console.error("Error submitting report:", error);
      toast.error("Lỗi khi nộp báo cáo");
    } finally {
      setIsUploading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive"; icon: React.ElementType }> = {
      not_submitted: { label: "Chưa nộp", variant: "secondary", icon: Clock },
      submitted: { label: "Đã nộp", variant: "default", icon: CheckCircle },
      late_submitted: { label: "Nộp trễ", variant: "destructive", icon: AlertTriangle },
      resubmitted: { label: "Đã nộp lại", variant: "default", icon: CheckCircle },
      late_resubmitted: { label: "Nộp lại trễ", variant: "destructive", icon: AlertTriangle },
      approved: { label: "Đã duyệt", variant: "default", icon: CheckCircle },
      rejected: { label: "Từ chối", variant: "destructive", icon: AlertTriangle },
      needs_revision: { label: "Cần sửa", variant: "secondary", icon: AlertTriangle },
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
    approved: reports.filter(r => r.status === "approved").length,
    needsRevision: reports.filter(r => r.status === "needs_revision").length,
    avgGrade: reports.filter(r => r.grade !== null).length > 0
      ? (reports.filter(r => r.grade !== null).reduce((sum, r) => sum + (r.grade || 0), 0) / reports.filter(r => r.grade !== null).length).toFixed(1)
      : null,
  };

  const progress = stats.total > 0 ? (stats.submitted / stats.total) * 100 : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Đang tải...</p>
      </div>
    );
  }

  if (!internshipInfo) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-2">Bạn chưa có kỳ thực tập nào đang hoạt động</p>
          <p className="text-sm text-gray-400 mb-4">
            Vui lòng đăng ký thực tập và được duyệt trước khi nộp báo cáo
          </p>
          <Button onClick={() => router.push("/dashboard/student/registration")}>
            Đi đến đăng ký thực tập
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
          onClick={() => router.push("/dashboard/student")}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">Báo cáo tuần thực tập</h1>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
            <span>{internshipInfo.semester} - {internshipInfo.academic_year}</span>
            {internshipInfo.company_name && (
              <>
                <span>•</span>
                <span>{internshipInfo.company_name}</span>
              </>
            )}
            {internshipInfo.lecturer_name && (
              <>
                <span>•</span>
                <span>GV: {internshipInfo.lecturer_name}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Progress Overview */}
      <Card className="border-2 border-blue-200 bg-linear-to-br from-blue-50 to-indigo-50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Tiến độ nộp báo cáo</h3>
              <p className="text-sm text-gray-600">
                Đã nộp {stats.submitted}/{stats.total} tuần ({progress.toFixed(0)}%)
              </p>
            </div>
            <div className="text-right">
              {stats.avgGrade ? (
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-yellow-600" />
                  <span className="text-2xl font-bold text-gray-900">{stats.avgGrade}/10</span>
                </div>
              ) : (
                <span className="text-gray-400">Chưa có điểm</span>
              )}
              <p className="text-xs text-gray-600 mt-1">Điểm trung bình</p>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                progress >= 62 ? "bg-green-500" : progress >= 38 ? "bg-yellow-500" : "bg-red-500"
              }`}
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{stats.submitted}</p>
              <p className="text-xs text-gray-600">Đã nộp</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
              <p className="text-xs text-gray-600">Đã duyệt</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">{stats.needsRevision}</p>
              <p className="text-xs text-gray-600">Cần sửa</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-600">{stats.total - stats.submitted}</p>
              <p className="text-xs text-gray-600">Chưa nộp</p>
            </div>
          </div>

          {stats.submitted < 8 && (
            <div className="mt-4 p-3 bg-orange-100 border border-orange-300 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-orange-900">
                  Bạn cần nộp tối thiểu 8/13 tuần để hoàn thành thực tập
                </p>
                <p className="text-orange-700 mt-1">
                  Hiện tại còn thiếu {8 - stats.submitted} tuần
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weekly Reports List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-500" />
            13 tuần thực tập
          </CardTitle>
          <CardDescription>
            Click vào nút Nộp báo cáo để upload file báo cáo cho mỗi tuần
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {reports.map((report) => {
              const now = new Date();
              const startDate = new Date(report.start_date);
              const endDate = new Date(report.end_date);
              
              const isPast = endDate < now;
              const isOpen = startDate <= now && endDate >= now;
              const isFuture = startDate > now;
              
              // Can submit if:
              // 1. Week has started (not future) AND not approved
              // 2. OR needs revision (can resubmit anytime)
              const canSubmit = (!isFuture && report.status !== "approved") || report.status === "needs_revision";
              const isLate = isPast && report.status === "not_submitted";

              return (
                <div
                  key={report.id}
                  className={`border rounded-lg p-4 transition-all ${
                    report.status === "approved" 
                      ? "border-green-300 bg-green-50" 
                      : report.status === "needs_revision"
                      ? "border-orange-300 bg-orange-50"
                      : canSubmit
                      ? "border-blue-300 bg-blue-50"
                      : isLate
                      ? "border-red-200 bg-red-50"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg">Tuần {report.week_number}</h3>
                        {getStatusBadge(report.status)}
                        {isOpen && report.status === "not_submitted" && (
                          <Badge className="bg-blue-600">Đang mở</Badge>
                        )}
                        {isLate && (
                          <Badge variant="destructive">Quá hạn</Badge>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm text-gray-600 mb-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>{formatDate(report.start_date)} - {formatDate(report.end_date)}</span>
                        </div>
                        
                        {report.submission_date && (
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            <span>Nộp: {formatDate(report.submission_date)}</span>
                          </div>
                        )}
                        
                        {report.grade !== null && (
                          <div className="flex items-center gap-2">
                            <Award className="w-4 h-4 text-yellow-600" />
                            <span className="font-medium">Điểm: {report.grade}/10</span>
                          </div>
                        )}
                      </div>

                      {report.report_title && (
                        <div className="mb-2">
                          <p className="text-sm font-medium text-gray-700">
                            {report.report_title}
                          </p>
                        </div>
                      )}

                      {report.lecturer_feedback && (
                        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                          <p className="text-xs font-medium text-yellow-800 mb-1">
                            Nhận xét từ giảng viên:
                          </p>
                          <p className="text-sm text-gray-700">{report.lecturer_feedback}</p>
                        </div>
                      )}

                      {report.status === "needs_revision" && (
                        <div className="mt-2 p-2 bg-orange-100 border border-orange-300 rounded text-sm text-orange-900">
                          <AlertTriangle className="w-4 h-4 inline mr-1" />
                          Báo cáo cần chỉnh sửa. Vui lòng xem nhận xét và nộp lại.
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
                          <Eye className="w-4 h-4 mr-1" />
                          Xem file
                        </Button>
                      )}
                      
                      {canSubmit && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleOpenSubmit(report)}
                        >
                          <Upload className="w-4 h-4 mr-1" />
                          {report.report_file_url ? "Nộp lại" : "Nộp báo cáo"}
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

      {/* Submit Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nộp báo cáo tuần {selectedReport?.week_number}</DialogTitle>
            <DialogDescription>
              Upload file báo cáo thực tập của bạn (PDF, DOC, DOCX - tối đa 10MB)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedReport && (
              <div className="p-3 bg-blue-50 rounded-lg text-sm">
                <p className="text-gray-600">
                  Thời gian: {formatDate(selectedReport.start_date)} - {formatDate(selectedReport.end_date)}
                </p>
                {new Date() > new Date(selectedReport.end_date) && (
                  <p className="text-orange-600 font-medium mt-1">
                    <AlertTriangle className="w-4 h-4 inline mr-1" />
                    Lưu ý: Bạn đang nộp sau deadline
                  </p>
                )}
              </div>
            )}

            <div>
              <Label htmlFor="title">Tiêu đề báo cáo <span className="text-red-500">*</span></Label>
              <Input
                id="title"
                value={submitForm.title}
                onChange={(e) => setSubmitForm({ ...submitForm, title: e.target.value })}
                placeholder="VD: Báo cáo tuần 1 - Tìm hiểu công ty và quy trình làm việc"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="content">Mô tả ngắn (tùy chọn)</Label>
              <textarea
                id="content"
                value={submitForm.content}
                onChange={(e) => setSubmitForm({ ...submitForm, content: e.target.value })}
                placeholder="Mô tả ngắn gọn nội dung báo cáo..."
                className="w-full mt-1 p-2 border rounded-md min-h-20"
              />
            </div>

            <div>
              <Label htmlFor="file">File báo cáo <span className="text-red-500">*</span></Label>
              <Input
                id="file"
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleFileChange}
                className="mt-1"
              />
              {submitForm.file && (
                <p className="text-sm text-gray-600 mt-2">
                  Đã chọn: {submitForm.file.name} ({(submitForm.file.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
              {!submitForm.file && selectedReport?.report_file_url && (
                <p className="text-sm text-green-600 mt-2">
                  <CheckCircle className="w-4 h-4 inline mr-1" />
                  Đã có file. Chọn file mới nếu muốn thay đổi.
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)} disabled={isUploading}>
              Hủy
            </Button>
            <Button onClick={handleSubmitReport} disabled={isUploading}>
              {isUploading ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Đang upload...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Nộp báo cáo
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Help Section */}
      <Card className="bg-linear-to-br from-green-50 to-teal-50 border-green-200">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <span className="text-2xl">📚</span>
            Hướng dẫn nộp báo cáo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <div className="w-1.5 bg-green-500 rounded-full shrink-0"></div>
            <p className="text-sm text-gray-700">
              Mỗi tuần sẽ mở từ ngày bắt đầu và đóng sau 7 ngày (cuối tuần)
            </p>
          </div>
          <div className="flex gap-2">
            <div className="w-1.5 bg-green-500 rounded-full shrink-0"></div>
            <p className="text-sm text-gray-700">
              Bạn có thể nộp báo cáo sau deadline nhưng sẽ bị đánh dấu <Badge variant="destructive" className="text-xs">Nộp trễ</Badge>
            </p>
          </div>
          <div className="flex gap-2">
            <div className="w-1.5 bg-green-500 rounded-full shrink-0"></div>
            <p className="text-sm text-gray-700">
              Cần nộp tối thiểu <strong>8/13 tuần</strong> để hoàn thành thực tập
            </p>
          </div>
          <div className="flex gap-2">
            <div className="w-1.5 bg-green-500 rounded-full shrink-0"></div>
            <p className="text-sm text-gray-700">
              File được chấp nhận: PDF, DOC, DOCX (tối đa 10MB)
            </p>
          </div>
          <div className="flex gap-2">
            <div className="w-1.5 bg-green-500 rounded-full shrink-0"></div>
            <p className="text-sm text-gray-700">
              Nếu giảng viên yêu cầu <Badge className="text-xs bg-orange-500">Cần sửa</Badge>, bạn có thể nộp lại bất cứ lúc nào
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
