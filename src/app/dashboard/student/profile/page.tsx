"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  User,
  Mail,
  Phone,
  Calendar,
  Building2,
  GraduationCap,
  MapPin,
  Edit,
  Save,
  X,
  Briefcase,
  Award,
  Clock,
} from "lucide-react";

type Profile = {
  id: string;
  full_name?: string;
  email?: string;
  phone?: string;
  student_id?: string;
  department?: string;
  academic_year?: string;
  class_name?: string;
  internship_status?: string;
  address?: string;
  date_of_birth?: string;
  gender?: string;
  created_at?: string;
  updated_at?: string;
};

type InternshipHistory = {
  id: string;
  period_id: string;
  status: string;
  company_name?: string;
  company_address?: string;
  company_supervisor?: string;
  company_supervisor_phone?: string;
  assigned_lecturer_name?: string | null;
  created_at: string;
  semester?: string;
  academic_year?: string;
};

type RegistrationData = {
  id: string;
  period_id: string;
  status: string;
  company_name?: string;
  company_address?: string;
  company_supervisor?: string;
  company_supervisor_phone?: string;
  assigned_lecturer_id?: string | null;
  created_at: string;
};

type LecturerData = {
  id: string;
  full_name: string;
};

export default function StudentProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [internshipHistory, setInternshipHistory] = useState<InternshipHistory[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editedProfile, setEditedProfile] = useState<Partial<Profile>>({});

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      setIsLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Vui lòng đăng nhập");
        return;
      }

      // Load profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData as Profile);
      setEditedProfile(profileData as Profile);

      // Load internship history
      const { data: registrations, error: regError } = await supabase
        .from("student_registrations")
        .select(
          `
          id,
          period_id,
          status,
          company_name,
          company_address,
          company_supervisor,
          company_supervisor_phone,
          assigned_lecturer_id,
          created_at
        `
        )
        .eq("student_id", user.id)
        .order("created_at", { ascending: false });

      if (regError) {
        console.error("Registration query error:", regError);
        throw regError;
      }

      // Get unique period IDs and lecturer IDs
      const periodIds = [...new Set(
        (registrations || []).map((r) => r.period_id)
      )];

      const lecturerIds = [...new Set(
        (registrations as unknown as RegistrationData[])
          ?.map((r) => r.assigned_lecturer_id)
          .filter((id): id is string => id !== null) || []
      )];

      // Fetch period information
      let periodMap: Record<string, { semester: string; academic_year: string }> = {};
      if (periodIds.length > 0) {
        const { data: periods, error: periodError } = await supabase
          .from("internship_periods")
          .select("id, semester, academic_year")
          .in("id", periodIds);

        if (periodError) {
          console.error("Period query error:", periodError);
        } else {
          periodMap = (periods || []).reduce((acc, period) => {
            acc[period.id] = {
              semester: period.semester,
              academic_year: period.academic_year,
            };
            return acc;
          }, {} as Record<string, { semester: string; academic_year: string }>);
        }
      }

      // Fetch lecturer names
      let lecturerMap: Record<string, string> = {};
      if (lecturerIds.length > 0) {
        const { data: lecturers, error: lecturerError } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", lecturerIds);

        if (lecturerError) {
          console.error("Lecturer query error:", lecturerError);
        } else {
          lecturerMap = (lecturers as LecturerData[] || []).reduce((acc, lecturer) => {
            acc[lecturer.id] = lecturer.full_name;
            return acc;
          }, {} as Record<string, string>);
        }
      }

      const formattedHistory = ((registrations as unknown as RegistrationData[]) || []).map((reg) => ({
        id: reg.id,
        period_id: reg.period_id,
        status: reg.status,
        company_name: reg.company_name,
        company_address: reg.company_address,
        company_supervisor: reg.company_supervisor,
        company_supervisor_phone: reg.company_supervisor_phone,
        assigned_lecturer_name: reg.assigned_lecturer_id 
          ? lecturerMap[reg.assigned_lecturer_id] || null
          : null,
        created_at: reg.created_at,
        semester: periodMap[reg.period_id]?.semester,
        academic_year: periodMap[reg.period_id]?.academic_year,
      }));

      setInternshipHistory(formattedHistory);
    } catch (error) {
      console.error(error);
      toast.error("Lỗi tải dữ liệu hồ sơ");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: editedProfile.full_name,
          phone: editedProfile.phone,
          address: editedProfile.address,
          date_of_birth: editedProfile.date_of_birth,
          gender: editedProfile.gender,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;

      setProfile({ ...profile, ...editedProfile } as Profile);
      setIsEditing(false);
      toast.success("Cập nhật hồ sơ thành công");
    } catch (error) {
      console.error(error);
      toast.error("Lỗi cập nhật hồ sơ");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedProfile(profile || {});
    setIsEditing(false);
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<
      string,
      { label: string; variant: "default" | "secondary" | "destructive" }
    > = {
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

  const getInternshipStatusBadge = (status?: string) => {
    const statusMap: Record<
      string,
      { label: string; variant: "default" | "secondary" | "destructive" }
    > = {
      not_started: { label: "Chưa bắt đầu", variant: "secondary" },
      registered: { label: "Đã đăng ký", variant: "secondary" },
      searching: { label: "Đang tìm công ty", variant: "secondary" },
      company_submitted: { label: "Đã có công ty", variant: "default" },
      pending_approval: { label: "Chờ duyệt", variant: "secondary" },
      waiting_lecturer: { label: "Chờ giảng viên", variant: "secondary" },
      lecturer_confirmed: { label: "GV đã xác nhận", variant: "default" },
      approved: { label: "Đã duyệt", variant: "default" },
      in_progress: { label: "Đang thực tập", variant: "default" },
      completed: { label: "Đã hoàn thành", variant: "default" },
      rejected: { label: "Từ chối", variant: "destructive" },
      assigned_to_project: { label: "Được phân công", variant: "default" },
    };
    const info = statusMap[status || "not_started"] || {
      label: status || "Chưa xác định",
      variant: "secondary" as const,
    };
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
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-linear-to-r from-purple-600 to-purple-700 text-white rounded-lg p-8 shadow-lg">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">Hồ sơ cá nhân</h1>
            <p className="text-purple-100 mt-2">
              Quản lý thông tin và lịch sử thực tập của bạn
            </p>
          </div>
          <div className="flex gap-2">
            {!isEditing ? (
              <Button
                onClick={() => setIsEditing(true)}
                variant="secondary"
                className="bg-white/20 hover:bg-white/30 text-white border-white/30"
              >
                <Edit className="w-4 h-4 mr-2" />
                Chỉnh sửa
              </Button>
            ) : (
              <>
                <Button
                  onClick={handleCancel}
                  variant="secondary"
                  className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                >
                  <X className="w-4 h-4 mr-2" />
                  Hủy
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-white text-purple-600 hover:bg-white/90"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? "Đang lưu..." : "Lưu"}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Personal Information */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-purple-600" />
              Thông tin cá nhân
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Full Name */}
              <div>
                <Label htmlFor="full_name" className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-gray-500" />
                  Họ và tên
                </Label>
                {isEditing ? (
                  <Input
                    id="full_name"
                    value={editedProfile.full_name || ""}
                    onChange={(e) =>
                      setEditedProfile({ ...editedProfile, full_name: e.target.value })
                    }
                  />
                ) : (
                  <p className="text-gray-900 font-medium">
                    {profile?.full_name || "Chưa cập nhật"}
                  </p>
                )}
              </div>

              {/* Email */}
              <div>
                <Label className="flex items-center gap-2 mb-2">
                  <Mail className="w-4 h-4 text-gray-500" />
                  Email
                </Label>
                <p className="text-gray-900 font-medium">{profile?.email || "Chưa cập nhật"}</p>
                <p className="text-xs text-gray-500 mt-1">Không thể chỉnh sửa</p>
              </div>

              {/* Phone */}
              <div>
                <Label htmlFor="phone" className="flex items-center gap-2 mb-2">
                  <Phone className="w-4 h-4 text-gray-500" />
                  Số điện thoại
                </Label>
                {isEditing ? (
                  <Input
                    id="phone"
                    value={editedProfile.phone || ""}
                    onChange={(e) =>
                      setEditedProfile({ ...editedProfile, phone: e.target.value })
                    }
                  />
                ) : (
                  <p className="text-gray-900 font-medium">
                    {profile?.phone || "Chưa cập nhật"}
                  </p>
                )}
              </div>

              {/* Date of Birth */}
              <div>
                <Label htmlFor="date_of_birth" className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  Ngày sinh
                </Label>
                {isEditing ? (
                  <Input
                    id="date_of_birth"
                    type="date"
                    value={editedProfile.date_of_birth || ""}
                    onChange={(e) =>
                      setEditedProfile({ ...editedProfile, date_of_birth: e.target.value })
                    }
                  />
                ) : (
                  <p className="text-gray-900 font-medium">
                    {profile?.date_of_birth
                      ? new Date(profile.date_of_birth).toLocaleDateString("vi-VN")
                      : "Chưa cập nhật"}
                  </p>
                )}
              </div>

              {/* Gender */}
              <div>
                <Label htmlFor="gender" className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-gray-500" />
                  Giới tính
                </Label>
                {isEditing ? (
                  <select
                    id="gender"
                    aria-label="Chọn giới tính"
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    value={editedProfile.gender || ""}
                    onChange={(e) =>
                      setEditedProfile({ ...editedProfile, gender: e.target.value })
                    }
                  >
                    <option value="">Chọn giới tính</option>
                    <option value="male">Nam</option>
                    <option value="female">Nữ</option>
                    <option value="other">Khác</option>
                  </select>
                ) : (
                  <p className="text-gray-900 font-medium">
                    {profile?.gender === "male"
                      ? "Nam"
                      : profile?.gender === "female"
                      ? "Nữ"
                      : profile?.gender === "other"
                      ? "Khác"
                      : "Chưa cập nhật"}
                  </p>
                )}
              </div>

              {/* Address */}
              <div className="md:col-span-2">
                <Label htmlFor="address" className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-gray-500" />
                  Địa chỉ
                </Label>
                {isEditing ? (
                  <Input
                    id="address"
                    value={editedProfile.address || ""}
                    onChange={(e) =>
                      setEditedProfile({ ...editedProfile, address: e.target.value })
                    }
                  />
                ) : (
                  <p className="text-gray-900 font-medium">
                    {profile?.address || "Chưa cập nhật"}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Academic Information */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-blue-600" />
                Thông tin học vấn
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm text-gray-600">Mã sinh viên</Label>
                <p className="text-gray-900 font-medium mt-1">
                  {profile?.student_id || "Chưa cập nhật"}
                </p>
              </div>
              <div>
                <Label className="text-sm text-gray-600">Khoa/Ngành</Label>
                <p className="text-gray-900 font-medium mt-1">
                  {profile?.department || "Chưa cập nhật"}
                </p>
              </div>
              <div>
                <Label className="text-sm text-gray-600">Lớp</Label>
                <p className="text-gray-900 font-medium mt-1">
                  {profile?.class_name || "Chưa cập nhật"}
                </p>
              </div>
              <div>
                <Label className="text-sm text-gray-600">Niên khóa</Label>
                <p className="text-gray-900 font-medium mt-1">
                  {profile?.academic_year || "Chưa cập nhật"}
                </p>
              </div>
              <div>
                <Label className="text-sm text-gray-600">Trạng thái thực tập</Label>
                <div className="mt-1">{getInternshipStatusBadge(profile?.internship_status)}</div>
              </div>
            </CardContent>
          </Card>

          {/* Account Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-gray-600" />
                Thông tin tài khoản
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-sm text-gray-600">Ngày tạo tài khoản</Label>
                <p className="text-gray-900 text-sm mt-1">
                  {profile?.created_at
                    ? new Date(profile.created_at).toLocaleDateString("vi-VN")
                    : "N/A"}
                </p>
              </div>
              <div>
                <Label className="text-sm text-gray-600">Cập nhật lần cuối</Label>
                <p className="text-gray-900 text-sm mt-1">
                  {profile?.updated_at
                    ? new Date(profile.updated_at).toLocaleString("vi-VN")
                    : "Chưa cập nhật"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Internship History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5 text-orange-600" />
            Lịch sử đăng ký thực tập
          </CardTitle>
        </CardHeader>
        <CardContent>
          {internshipHistory.length > 0 ? (
            <div className="space-y-4">
              {internshipHistory.map((history) => (
                <div
                  key={history.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {history.semester} - {history.academic_year}
                      </h3>
                      <p className="text-sm text-gray-500">
                        Đăng ký: {new Date(history.created_at).toLocaleDateString("vi-VN")}
                      </p>
                    </div>
                    {getStatusBadge(history.status)}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    {history.company_name && (
                      <div className="flex items-start gap-2">
                        <Building2 className="w-4 h-4 text-blue-600 mt-1" />
                        <div>
                          <p className="text-xs text-gray-600">Công ty</p>
                          <p className="text-sm font-medium text-gray-900">
                            {history.company_name}
                          </p>
                          {history.company_address && (
                            <p className="text-xs text-gray-500">{history.company_address}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {history.company_supervisor && (
                      <div className="flex items-start gap-2">
                        <User className="w-4 h-4 text-green-600 mt-1" />
                        <div>
                          <p className="text-xs text-gray-600">Người hướng dẫn</p>
                          <p className="text-sm font-medium text-gray-900">
                            {history.company_supervisor}
                          </p>
                          {history.company_supervisor_phone && (
                            <p className="text-xs text-gray-500">{history.company_supervisor_phone}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {history.assigned_lecturer_name && (
                      <div className="flex items-start gap-2">
                        <GraduationCap className="w-4 h-4 text-purple-600 mt-1" />
                        <div>
                          <p className="text-xs text-gray-600">Giảng viên hướng dẫn</p>
                          <p className="text-sm font-medium text-gray-900">
                            {history.assigned_lecturer_name}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Briefcase className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">Chưa có lịch sử đăng ký thực tập</p>
              <p className="text-sm text-gray-500 mt-1">
                Hãy đăng ký kỳ thực tập để bắt đầu
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
