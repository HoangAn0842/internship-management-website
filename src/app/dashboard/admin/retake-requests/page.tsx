"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { 
  RefreshCcw, 
  CheckCircle, 
  XCircle, 
  Clock,
  Eye,
  Filter
} from "lucide-react";

interface RetakeRequest {
  id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  student_mssv: string;
  student_department: string;
  student_academic_year: string;
  previous_registration_id: string | null;
  previous_company: string | null;
  previous_semester: string | null;
  previous_period_year: string | null;
  reason: string;
  previous_grade: number | null;
  status: string;
  admin_note: string | null;
  reviewer_name: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export default function AdminRetakeRequestsPage() {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<RetakeRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<RetakeRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedRequest, setSelectedRequest] = useState<RetakeRequest | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [adminNote, setAdminNote] = useState("");

  useEffect(() => {
    loadRequests();
  }, []);

  useEffect(() => {
    // Filter requests based on status
    if (statusFilter === "all") {
      setFilteredRequests(requests);
    } else {
      setFilteredRequests(requests.filter(r => r.status === statusFilter));
    }
  }, [statusFilter, requests]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("v_retake_requests_detail")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading requests:", error);
        toast.error("Lỗi tải dữ liệu");
        return;
      }

      setRequests(data || []);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;

    try {
      setProcessing(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Vui lòng đăng nhập");
        return;
      }

      const { error } = await supabase.rpc("approve_retake_request", {
        p_request_id: selectedRequest.id,
        p_admin_id: user.id,
        p_admin_note: adminNote || null,
      });

      if (error) {
        console.error("Error approving:", error);
        toast.error("Lỗi phê duyệt: " + error.message);
        return;
      }

      toast.success("Đã phê duyệt yêu cầu!");
      setShowDialog(false);
      setAdminNote("");
      loadRequests();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Có lỗi xảy ra");
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;

    if (!adminNote.trim()) {
      toast.error("Vui lòng nhập lý do từ chối");
      return;
    }

    try {
      setProcessing(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Vui lòng đăng nhập");
        return;
      }

      const { error } = await supabase.rpc("reject_retake_request", {
        p_request_id: selectedRequest.id,
        p_admin_id: user.id,
        p_admin_note: adminNote,
      });

      if (error) {
        console.error("Error rejecting:", error);
        toast.error("Lỗi từ chối: " + error.message);
        return;
      }

      toast.success("Đã từ chối yêu cầu");
      setShowDialog(false);
      setAdminNote("");
      loadRequests();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Có lỗi xảy ra");
    } finally {
      setProcessing(false);
    }
  };

  const openDialog = (request: RetakeRequest) => {
    setSelectedRequest(request);
    setAdminNote(request.admin_note || "");
    setShowDialog(true);
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
      pending: { label: "Chờ xét", variant: "secondary" },
      approved: { label: "Đã duyệt", variant: "default" },
      rejected: { label: "Từ chối", variant: "destructive" },
    };
    const info = statusMap[status] || { label: status, variant: "secondary" as const };
    return <Badge variant={info.variant}>{info.label}</Badge>;
  };

  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === "pending").length,
    approved: requests.filter(r => r.status === "approved").length,
    rejected: requests.filter(r => r.status === "rejected").length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-linear-to-r from-indigo-600 to-purple-700 text-white rounded-lg p-8 shadow-lg">
        <div className="flex items-center gap-3">
          <RefreshCcw className="w-10 h-10" />
          <div>
            <h1 className="text-3xl font-bold">Quản Lý Yêu Cầu Đăng Ký Lại</h1>
            <p className="text-indigo-100 mt-2">
              Xét duyệt yêu cầu thực tập lại của sinh viên
            </p>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-sm text-gray-600 mt-1">Tổng yêu cầu</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-yellow-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
              <p className="text-sm text-gray-600 mt-1">Chờ xét duyệt</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">{stats.approved}</p>
              <p className="text-sm text-gray-600 mt-1">Đã duyệt</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-red-600">{stats.rejected}</p>
              <p className="text-sm text-gray-600 mt-1">Từ chối</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Bộ lọc
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              variant={statusFilter === "all" ? "default" : "outline"}
              onClick={() => setStatusFilter("all")}
            >
              Tất cả ({stats.total})
            </Button>
            <Button
              variant={statusFilter === "pending" ? "default" : "outline"}
              onClick={() => setStatusFilter("pending")}
            >
              <Clock className="w-4 h-4 mr-2" />
              Chờ xét ({stats.pending})
            </Button>
            <Button
              variant={statusFilter === "approved" ? "default" : "outline"}
              onClick={() => setStatusFilter("approved")}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Đã duyệt ({stats.approved})
            </Button>
            <Button
              variant={statusFilter === "rejected" ? "default" : "outline"}
              onClick={() => setStatusFilter("rejected")}
            >
              <XCircle className="w-4 h-4 mr-2" />
              Từ chối ({stats.rejected})
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Danh Sách Yêu Cầu</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredRequests.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Không có yêu cầu nào</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>MSSV</TableHead>
                  <TableHead>Họ tên</TableHead>
                  <TableHead>Khoa</TableHead>
                  <TableHead>Kỳ trước</TableHead>
                  <TableHead>Điểm</TableHead>
                  <TableHead>Ngày gửi</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">{request.student_mssv}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{request.student_name}</p>
                        <p className="text-xs text-gray-500">{request.student_email}</p>
                      </div>
                    </TableCell>
                    <TableCell>{request.student_department}</TableCell>
                    <TableCell>
                      {request.previous_company ? (
                        <div className="text-sm">
                          <p>{request.previous_semester} {request.previous_period_year}</p>
                          <p className="text-gray-500">{request.previous_company}</p>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {request.previous_grade ? (
                        <span className="font-medium">{request.previous_grade}/10</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>{new Date(request.created_at).toLocaleDateString("vi-VN")}</TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDialog(request)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Xem
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog chi tiết */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Chi Tiết Yêu Cầu</DialogTitle>
            <DialogDescription>
              Xem thông tin và xét duyệt yêu cầu đăng ký lại
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              {/* Thông tin sinh viên */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Thông tin sinh viên</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-600">MSSV:</p>
                    <p className="font-medium">{selectedRequest.student_mssv}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Họ tên:</p>
                    <p className="font-medium">{selectedRequest.student_name}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Email:</p>
                    <p className="font-medium">{selectedRequest.student_email}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Khoa:</p>
                    <p className="font-medium">{selectedRequest.student_department}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Niên khóa:</p>
                    <p className="font-medium">{selectedRequest.student_academic_year}</p>
                  </div>
                </div>
              </div>

              {/* Thông tin kỳ trước */}
              {selectedRequest.previous_company && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Kỳ thực tập trước</h3>
                  <div className="space-y-2 text-sm">
                    <p>
                      <span className="text-gray-600">Kỳ:</span>{" "}
                      <span className="font-medium">
                        {selectedRequest.previous_semester} {selectedRequest.previous_period_year}
                      </span>
                    </p>
                    <p>
                      <span className="text-gray-600">Công ty:</span>{" "}
                      <span className="font-medium">{selectedRequest.previous_company}</span>
                    </p>
                    {selectedRequest.previous_grade && (
                      <p>
                        <span className="text-gray-600">Điểm:</span>{" "}
                        <span className="font-medium">{selectedRequest.previous_grade}/10</span>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Lý do */}
              <div>
                <Label>Lý do muốn thực tập lại</Label>
                <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-700">{selectedRequest.reason}</p>
                </div>
              </div>

              {/* Trạng thái hiện tại */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Trạng thái</Label>
                  <div className="mt-2">{getStatusBadge(selectedRequest.status)}</div>
                </div>
                <div className="text-sm text-gray-500">
                  Gửi lúc: {new Date(selectedRequest.created_at).toLocaleString("vi-VN")}
                </div>
              </div>

              {/* Ghi chú admin */}
              {selectedRequest.status === "pending" && (
                <div>
                  <Label htmlFor="admin_note">Ghi chú (không bắt buộc cho duyệt, bắt buộc cho từ chối)</Label>
                  <textarea
                    id="admin_note"
                    rows={3}
                    placeholder="Nhập ghi chú cho sinh viên..."
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              {/* Thông tin đã xét duyệt */}
              {selectedRequest.status !== "pending" && (
                <div className={`p-4 rounded-lg ${selectedRequest.status === "approved" ? "bg-green-50" : "bg-red-50"}`}>
                  <p className="font-semibold mb-2">
                    {selectedRequest.status === "approved" ? "Đã phê duyệt" : "Đã từ chối"}
                  </p>
                  {selectedRequest.reviewed_at && (
                    <p className="text-sm text-gray-600">
                      Lúc: {new Date(selectedRequest.reviewed_at).toLocaleString("vi-VN")}
                    </p>
                  )}
                  {selectedRequest.reviewer_name && (
                    <p className="text-sm text-gray-600">
                      Người xét: {selectedRequest.reviewer_name}
                    </p>
                  )}
                  {selectedRequest.admin_note && (
                    <div className="mt-2 p-2 bg-white rounded">
                      <p className="text-sm italic">&ldquo;{selectedRequest.admin_note}&rdquo;</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {selectedRequest?.status === "pending" && (
              <>
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  disabled={processing}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Từ chối
                </Button>
                <Button
                  onClick={handleApprove}
                  disabled={processing}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Phê duyệt
                </Button>
              </>
            )}
            {selectedRequest?.status !== "pending" && (
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Đóng
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
