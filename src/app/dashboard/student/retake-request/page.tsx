"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  RefreshCcw, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  FileText,
  Send
} from "lucide-react";

interface RetakeRequest {
  id: string;
  student_id: string;
  previous_registration_id: string | null;
  reason: string;
  previous_grade: number | null;
  status: string;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  previous_company: string | null;
  previous_semester: string | null;
  previous_period_year: string | null;
  reviewer_name: string | null;
}

interface PreviousRegistration {
  id: string;
  company_name: string;
  status: string;
  period: {
    semester: string;
    academic_year: string;
  };
}

export default function StudentRetakeRequestPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [canRequest, setCanRequest] = useState(false);
  const [internshipStatus, setInternshipStatus] = useState("");
  const [requests, setRequests] = useState<RetakeRequest[]>([]);
  const [previousRegistrations, setPreviousRegistrations] = useState<PreviousRegistration[]>([]);
  
  const [formData, setFormData] = useState({
    previous_registration_id: "",
    reason: "",
    previous_grade: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Vui lòng đăng nhập");
        return;
      }

      // Lấy thông tin profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("internship_status")
        .eq("id", user.id)
        .single();

      if (profile) {
        setInternshipStatus(profile.internship_status);
      }

      // Kiểm tra điều kiện
      const { data: canRequestData } = await supabase
        .rpc("can_student_request_retake", { p_student_id: user.id });
      
      setCanRequest(canRequestData || false);

      // Lấy danh sách requests của sinh viên
      const { data: requestsData, error: requestsError } = await supabase
        .from("v_retake_requests_detail")
        .select("*")
        .eq("student_id", user.id)
        .order("created_at", { ascending: false });

      if (requestsError) {
        console.error("Error loading requests:", requestsError);
      } else {
        setRequests(requestsData || []);
      }

      // Lấy danh sách registrations đã hoàn thành
      const { data: regsData, error: regsError } = await supabase
        .from("student_registrations")
        .select(`
          id,
          company_name,
          status,
          period:period_id(semester, academic_year)
        `)
        .eq("student_id", user.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false });

      if (regsError) {
        console.error("Error loading registrations:", regsError);
      } else {
        setPreviousRegistrations(regsData as unknown as PreviousRegistration[] || []);
      }

    } catch (error) {
      console.error("Error:", error);
      toast.error("Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.reason.trim()) {
      toast.error("Vui lòng nhập lý do");
      return;
    }

    try {
      setSubmitting(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Vui lòng đăng nhập");
        return;
      }

      const { error } = await supabase
        .from("retake_requests")
        .insert({
          student_id: user.id,
          previous_registration_id: formData.previous_registration_id || null,
          reason: formData.reason,
          previous_grade: formData.previous_grade ? parseFloat(formData.previous_grade) : null,
        });

      if (error) {
        console.error("Error submitting request:", error);
        toast.error("Lỗi gửi yêu cầu: " + error.message);
        return;
      }

      toast.success("Đã gửi yêu cầu đăng ký lại thành công!");
      setFormData({
        previous_registration_id: "",
        reason: "",
        previous_grade: "",
      });
      loadData();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Có lỗi xảy ra");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive"; icon: React.ElementType }> = {
      pending: { label: "Chờ xét duyệt", variant: "secondary", icon: Clock },
      approved: { label: "Đã duyệt", variant: "default", icon: CheckCircle },
      rejected: { label: "Từ chối", variant: "destructive", icon: XCircle },
    };
    const info = statusMap[status] || { label: status, variant: "secondary" as const, icon: Clock };
    const Icon = info.icon;
    return (
      <Badge variant={info.variant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {info.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-linear-to-r from-indigo-600 to-purple-700 text-white rounded-lg p-8 shadow-lg">
        <div className="flex items-center gap-3">
          <RefreshCcw className="w-10 h-10" />
          <div>
            <h1 className="text-3xl font-bold">Đăng Ký Thực Tập Lại</h1>
            <p className="text-indigo-100 mt-2">
              Dành cho sinh viên đã hoàn thành thực tập muốn cải thiện kết quả
            </p>
          </div>
        </div>
      </div>

      {/* Thông báo trạng thái */}
      {internshipStatus !== "completed" && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-yellow-600 mt-0.5" />
              <div>
                <p className="font-semibold text-yellow-900">Chưa đủ điều kiện</p>
                <p className="text-sm text-yellow-700 mt-1">
                  Bạn cần hoàn thành ít nhất một kỳ thực tập trước khi có thể đăng ký lại.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {internshipStatus === "completed" && !canRequest && requests.some(r => r.status === "pending") && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Clock className="w-6 h-6 text-blue-600 mt-0.5" />
              <div>
                <p className="font-semibold text-blue-900">Đang chờ xét duyệt</p>
                <p className="text-sm text-blue-700 mt-1">
                  Bạn đã có yêu cầu đang chờ xét duyệt. Vui lòng đợi admin phê duyệt trước khi gửi yêu cầu mới.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form gửi yêu cầu */}
      {canRequest && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              Gửi Yêu Cầu Đăng Ký Lại
            </CardTitle>
            <CardDescription>
              Điền thông tin để gửi yêu cầu đến admin
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {previousRegistrations.length > 0 && (
                <div>
                  <Label htmlFor="previous_registration">Kỳ thực tập trước (không bắt buộc)</Label>
                  <select
                    id="previous_registration"
                    aria-label="Chọn kỳ thực tập trước"
                    value={formData.previous_registration_id}
                    onChange={(e) => setFormData({ ...formData, previous_registration_id: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Chọn kỳ (nếu có) --</option>
                    {previousRegistrations.map((reg) => (
                      <option key={reg.id} value={reg.id}>
                        {reg.period.semester} {reg.period.academic_year} - {reg.company_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <Label htmlFor="previous_grade">Điểm kỳ trước (không bắt buộc)</Label>
                <Input
                  id="previous_grade"
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  placeholder="Ví dụ: 6.5"
                  value={formData.previous_grade}
                  onChange={(e) => setFormData({ ...formData, previous_grade: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="reason">Lý do muốn thực tập lại *</Label>
                <textarea
                  id="reason"
                  required
                  rows={4}
                  placeholder="Ví dụ: Muốn cải thiện điểm số, học thêm kỹ năng mới..."
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Giải thích rõ lý do bạn muốn thực tập lại
                </p>
              </div>

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? "Đang gửi..." : "Gửi Yêu Cầu"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Danh sách requests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Lịch Sử Yêu Cầu
          </CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Chưa có yêu cầu nào</p>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <div key={request.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm text-gray-500">
                        Ngày gửi: {new Date(request.created_at).toLocaleDateString("vi-VN")}
                      </p>
                      {request.previous_company && (
                        <p className="text-sm text-gray-600 mt-1">
                          Kỳ trước: {request.previous_semester} {request.previous_period_year} - {request.previous_company}
                        </p>
                      )}
                      {request.previous_grade && (
                        <p className="text-sm text-gray-600">
                          Điểm: {request.previous_grade}/10
                        </p>
                      )}
                    </div>
                    {getStatusBadge(request.status)}
                  </div>

                  <div className="bg-gray-50 rounded p-3 mb-3">
                    <p className="text-sm font-medium text-gray-700 mb-1">Lý do:</p>
                    <p className="text-sm text-gray-600">{request.reason}</p>
                  </div>

                  {request.status === "approved" && (
                    <div className="bg-green-50 border border-green-200 rounded p-3">
                      <div className="flex items-start gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-green-900">Đã được phê duyệt</p>
                          {request.reviewed_at && (
                            <p className="text-xs text-green-700 mt-1">
                              Duyệt lúc: {new Date(request.reviewed_at).toLocaleString("vi-VN")}
                            </p>
                          )}
                          {request.reviewer_name && (
                            <p className="text-xs text-green-700">
                              Người duyệt: {request.reviewer_name}
                            </p>
                          )}
                          {request.admin_note && (
                            <p className="text-sm text-green-800 mt-2 italic">&ldquo;{request.admin_note}&rdquo;</p>
                          )}
                          <p className="text-sm text-green-900 mt-2 font-medium">
                            ✅ Bạn đã có thể đăng ký kỳ thực tập mới!
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {request.status === "rejected" && request.admin_note && (
                    <div className="bg-red-50 border border-red-200 rounded p-3">
                      <div className="flex items-start gap-2">
                        <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-red-900">Từ chối</p>
                          {request.reviewed_at && (
                            <p className="text-xs text-red-700 mt-1">
                              Từ chối lúc: {new Date(request.reviewed_at).toLocaleString("vi-VN")}
                            </p>
                          )}
                          {request.reviewer_name && (
                            <p className="text-xs text-red-700">
                              Người xét: {request.reviewer_name}
                            </p>
                          )}
                          <p className="text-sm text-red-800 mt-2 italic">&ldquo;{request.admin_note}&rdquo;</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
