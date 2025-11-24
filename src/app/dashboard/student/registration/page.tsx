"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Calendar,
  Clock,
  Building,
  Users,
  CheckCircle2,
  AlertCircle,
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

type Profile = {
  id: string;
  email: string;
  full_name: string;
  department?: string;
};

type LecturerAvailability = {
  id: string;
  period_id: string;
  lecturer_id: string;
  lecturer_name: string;
  lecturer_email: string;
  lecturer_department: string;
  max_students: number;
  assigned_count: number;
  slots_remaining: number;
};

type StudentRegistration = {
  id: string;
  period_id: string;
  student_id: string;
  prefer_own_lecturer: boolean;
  requested_lecturer_id?: string;
  assigned_lecturer_id?: string;
  company_name?: string;
  company_address?: string;
  company_supervisor?: string;
  company_supervisor_phone?: string;
  internship_position?: string;
  status: string;
  created_at: string;
};

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as unknown as { message?: string }).message);
  }
  return "Unknown error";
}

export default function StudentRegistrationPage() {
  const [activePeriod, setActivePeriod] = useState<InternshipPeriod | null>(
    null
  );
  const [myRegistration, setMyRegistration] =
    useState<StudentRegistration | null>(null);
  const [lecturers, setLecturers] = useState<Profile[]>([]);
  const [availableLecturers, setAvailableLecturers] = useState<
    LecturerAvailability[]
  >([]);
  const [studentProfile, setStudentProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [showLecturerDialog, setShowLecturerDialog] = useState(false);
  const [showCompanyDialog, setShowCompanyDialog] = useState(false);
  const [selectedLecturer, setSelectedLecturer] = useState("");
  const [searchLecturer, setSearchLecturer] = useState("");
  const [hasApprovedRetake, setHasApprovedRetake] = useState(false);
  const [companyForm, setCompanyForm] = useState({
    company_name: "",
    company_address: "",
    company_supervisor: "",
    company_supervisor_phone: "",
    internship_position: "",
  });

  const handleSelectLecturer = async () => {
    if (!myRegistration) return;

    try {
      if (selectedLecturer) {
        // Chọn trực tiếp giảng viên (không cần chờ xác nhận)
        const { error } = await supabase
          .from("student_registrations")
          .update({
            prefer_own_lecturer: true,
            requested_lecturer_id: selectedLecturer,
            assigned_lecturer_id: selectedLecturer, // Gán luôn, không cần chờ xác nhận
            status: "searching", // Chuyển thẳng sang tìm công ty
          })
          .eq("id", myRegistration.id);
        if (error) throw error;
        toast.success("Đã chọn giảng viên hướng dẫn");
      } else {
        // Để hệ thống auto-assign
        const { error } = await supabase
          .from("student_registrations")
          .update({
            prefer_own_lecturer: false,
            status: "registered",
          })
          .eq("id", myRegistration.id);
        if (error) throw error;
        toast.success("Hệ thống sẽ tự động phân công giảng viên");
      }

      setShowLecturerDialog(false);
      setSelectedLecturer("");
      await loadData();
    } catch (err) {
      toast.error("Lỗi chọn giảng viên: " + getErrorMessage(err));
    }
  };

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profile) {
        setStudentProfile(profile);
      }

      // Check if student has approved retake request
      const { data: approvedRetake } = await supabase
        .from("retake_requests")
        .select("id")
        .eq("student_id", user.id)
        .eq("status", "approved")
        .maybeSingle();
      
      setHasApprovedRetake(!!approvedRetake);

      const { data: period } = await supabase
        .from("internship_periods")
        .select("*")
        .eq("is_active", true)
        .single();

      // Check if student already has registration for this period
      let existingRegistration = null;
      if (period) {
        const { data: registration } = await supabase
          .from("student_registrations")
          .select("*")
          .eq("student_id", user.id)
          .eq("period_id", period.id)
          .maybeSingle();
        
        existingRegistration = registration;
      }

      // Check if period exists and student meets criteria
      if (period && profile) {
        // If student already registered, always show the period
        if (existingRegistration) {
          setActivePeriod(period);
        } else {
          // Only check criteria for new registration
          let meetsAllCriteria = true;
          const allowRetake = (period as InternshipPeriod & { allow_retake?: boolean }).allow_retake;

          // If student has approved retake: only check Department + allow_retake
          if (approvedRetake && allowRetake) {
            // Check department criteria only
            const targetDepartments = (period as InternshipPeriod & { target_departments?: string[] }).target_departments;
            if (targetDepartments && targetDepartments.length > 0) {
              if (!profile.department || !targetDepartments.includes(profile.department)) {
                meetsAllCriteria = false;
              }
            }
            // Skip academic year and internship status check for retake students
          } else {
            // Normal students: check all criteria
            
            // Check department criteria
            const targetDepartments = (period as InternshipPeriod & { target_departments?: string[] }).target_departments;
            if (targetDepartments && targetDepartments.length > 0) {
              if (!profile.department || !targetDepartments.includes(profile.department)) {
                meetsAllCriteria = false;
              }
            }

            // Check academic year criteria
            const targetAcademicYears = (period as InternshipPeriod & { target_academic_years?: string[] }).target_academic_years;
            const studentAcademicYear = (profile as Profile & { academic_year?: string }).academic_year;
            if (targetAcademicYears && targetAcademicYears.length > 0) {
              if (!studentAcademicYear || !targetAcademicYears.includes(studentAcademicYear)) {
                meetsAllCriteria = false;
              }
            }

            // Check internship status criteria
            const targetInternshipStatuses = (period as InternshipPeriod & { target_internship_statuses?: string[] }).target_internship_statuses;
            const studentInternshipStatus = (profile as Profile & { internship_status?: string }).internship_status;
            if (targetInternshipStatuses && targetInternshipStatuses.length > 0) {
              if (!studentInternshipStatus || !targetInternshipStatuses.includes(studentInternshipStatus)) {
                meetsAllCriteria = false;
              }
            }
          }

          // Only set period if student meets all criteria
          if (meetsAllCriteria) {
            setActivePeriod(period);
          } else {
            setActivePeriod(null); // Hide period from student
          }
        }
      } else {
        setActivePeriod(period || null);
      }

      // Load registration data
      if (existingRegistration) {
        setMyRegistration(existingRegistration);
        // Pre-fill company form if exists
        if (existingRegistration.company_name) {
          setCompanyForm({
            company_name: existingRegistration.company_name || "",
            company_address: existingRegistration.company_address || "",
            company_supervisor: existingRegistration.company_supervisor || "",
            company_supervisor_phone:
              existingRegistration.company_supervisor_phone || "",
            internship_position: existingRegistration.internship_position || "",
          });
        }
      }

      const { data: lecturerList } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "lecturer");

      if (lecturerList) {
        setLecturers(lecturerList);
      }

      // Load available lecturers with slot info if period exists
      if (period) {
        try {
          const response = await fetch(
            `/api/periods/${period.id}/available-lecturers`
          );
          if (response.ok) {
            const data = await response.json();
            setAvailableLecturers(data);
          }
        } catch (err) {
          console.error("Failed to load available lecturers:", err);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      void loadData();
    };
    const id = setTimeout(run, 0);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [loadData]);

  const getStatusBadge = (status: string) => {
    const statusMap: Record<
      string,
      { label: string; variant: "default" | "secondary" | "destructive" }
    > = {
      not_started: { label: "Chưa bắt đầu", variant: "secondary" },
      registered: { label: "Chưa chọn GV", variant: "secondary" },
      searching: { label: "Đang tìm công ty", variant: "secondary" },
      company_submitted: { label: "Đã có công ty", variant: "default" },
      pending_approval: { label: "Chờ duyệt", variant: "secondary" },
      waiting_lecturer: { label: "Chờ giảng viên", variant: "secondary" },
      lecturer_confirmed: { label: "GV đã xác nhận", variant: "default" },
      approved: { label: "Đã duyệt", variant: "default" },
      in_progress: { label: "Đang thực tập", variant: "default" },
      completed: { label: "Hoàn thành", variant: "default" },
      rejected: { label: "Bị từ chối", variant: "destructive" },
      assigned_to_project: { label: "Làm đồ án", variant: "secondary" },
    };
    const info = statusMap[status] || { label: status, variant: "secondary" };
    return <Badge variant={info.variant}>{info.label}</Badge>;
  };

  const canRegister = () => {
    if (!activePeriod || !studentProfile) return false;
    
    // Check time range
    const now = new Date();
    const regStart = new Date(activePeriod.registration_start);
    const regEnd = new Date(activePeriod.registration_end);
    if (!(now >= regStart && now <= regEnd)) return false;
    
    // Check if already registered
    if (myRegistration) return false;
    
    const allowRetake = (activePeriod as InternshipPeriod & { allow_retake?: boolean }).allow_retake;
    
    // If student has approved retake: only check Department + allow_retake
    if (hasApprovedRetake && allowRetake) {
      // Check department criteria only
      const targetDepartments = (activePeriod as InternshipPeriod & { target_departments?: string[] }).target_departments;
      if (targetDepartments && targetDepartments.length > 0) {
        if (!studentProfile.department || !targetDepartments.includes(studentProfile.department)) {
          return false;
        }
      }
      // Retake students skip academic year and internship status check
      return true;
    }
    
    // Normal students: check all criteria
    
    // Check department criteria
    const targetDepartments = (activePeriod as InternshipPeriod & { target_departments?: string[] }).target_departments;
    if (targetDepartments && targetDepartments.length > 0) {
      if (!studentProfile.department || !targetDepartments.includes(studentProfile.department)) {
        return false;
      }
    }
    
    // Check academic year criteria
    const targetAcademicYears = (activePeriod as InternshipPeriod & { target_academic_years?: string[] }).target_academic_years;
    const studentAcademicYear = (studentProfile as Profile & { academic_year?: string }).academic_year;
    if (targetAcademicYears && targetAcademicYears.length > 0) {
      if (!studentAcademicYear || !targetAcademicYears.includes(studentAcademicYear)) {
        return false;
      }
    }
    
    // Check internship status criteria
    const targetInternshipStatuses = (activePeriod as InternshipPeriod & { target_internship_statuses?: string[] }).target_internship_statuses;
    const studentInternshipStatus = (studentProfile as Profile & { internship_status?: string }).internship_status;
    if (targetInternshipStatuses && targetInternshipStatuses.length > 0) {
      if (!studentInternshipStatus || !targetInternshipStatuses.includes(studentInternshipStatus)) {
        return false;
      }
    }
    
    return true;
  };

  const canSelectLecturer = () => {
    if (!activePeriod || !myRegistration) return false;
    if (myRegistration.status !== "registered") return false;
    const now = new Date();
    const regEnd = new Date(activePeriod.registration_end);
    const lecturerEnd = new Date(activePeriod.lecturer_selection_end);
    return now > regEnd && now <= lecturerEnd;
  };

  const canSubmitCompany = () => {
    if (!activePeriod || !myRegistration) return false;
    if (
      !myRegistration.assigned_lecturer_id ||
      myRegistration.status === "registered"
    )
      return false;
    const now = new Date();
    const startDate = new Date(activePeriod.start_date);
    const searchDeadline = new Date(activePeriod.search_deadline);
    return now >= startDate && now <= searchDeadline;
  };

  if (isLoading) {
    return (
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-linear-to-r from-blue-600 to-blue-700 text-white rounded-lg p-6 sm:p-8 mb-6 shadow-lg animate-pulse">
          <div className="h-8 bg-blue-500 rounded w-48 mb-2"></div>
          <div className="h-6 bg-blue-500 rounded w-64"></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-md">
              <CardHeader>
                <div className="h-6 bg-gray-200 rounded w-40 animate-pulse"></div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
              </CardContent>
            </Card>
          </div>
          <div className="space-y-6">
            <Card className="shadow-md">
              <CardHeader>
                <div className="h-6 bg-gray-200 rounded w-32 animate-pulse"></div>
              </CardHeader>
              <CardContent>
                <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!activePeriod) {
    return (
      <div className="flex items-center justify-center h-96 w-full p-4">
        <Card className="max-w-xs sm:max-w-md w-full">
          <CardHeader className="text-center">
            <CardTitle className="flex flex-col items-center gap-2 text-center">
              <AlertCircle className="w-6 h-6 text-orange-500 mb-1" />
              Chưa mở đăng ký
            </CardTitle>
            <CardDescription className="text-center leading-relaxed">
              Hiện tại chưa có kỳ thực tập nào đang mở đăng ký. Vui lòng liên hệ
              phòng đào tạo.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
      {/* Header with Semester Info */}
      <div className="bg-linear-to-r from-blue-600 to-blue-700 text-white rounded-lg p-6 sm:p-8 mb-6 shadow-lg">
        <h1 className="text-2xl sm:text-3xl font-bold">Đăng ký Thực tập</h1>
        <p className="text-blue-100 mt-2 text-base sm:text-lg">
          {activePeriod.semester} - Năm học {activePeriod.academic_year}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Timeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* Timeline Card */}
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Calendar className="w-5 h-5 text-blue-600" />
                Lịch trình thực tập
              </CardTitle>
              <CardDescription>
                Các mốc thời gian quan trọng bạn cần lưu ý
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <div className="relative space-y-6 sm:space-y-8">
                {/* Step 1 */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <Clock className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="w-0.5 h-full bg-gray-200 mt-2"></div>
                  </div>
                  <div className="pb-6">
                    <h3 className="font-semibold text-gray-900 mb-1">
                      Bước 1: Đăng ký thực tập
                    </h3>
                    <p className="text-sm text-gray-600 mb-2">
                      {new Date(
                        activePeriod.registration_start
                      ).toLocaleDateString("vi-VN")}{" "}
                      -{" "}
                      {new Date(
                        activePeriod.registration_end
                      ).toLocaleDateString("vi-VN")}
                    </p>
                    <p className="text-sm text-gray-500">
                      Xác nhận tham gia thực tập trong kỳ này
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                      <Users className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="w-0.5 h-full bg-gray-200 mt-2"></div>
                  </div>
                  <div className="pb-6">
                    <h3 className="font-semibold text-gray-900 mb-1">
                      Bước 2: Chọn giảng viên hướng dẫn
                    </h3>
                    <p className="text-sm text-gray-600 mb-2">
                      Đến{" "}
                      {new Date(
                        activePeriod.lecturer_selection_end
                      ).toLocaleDateString("vi-VN")}
                    </p>
                    <p className="text-sm text-gray-500">
                      Tự chọn hoặc để hệ thống tự động phân công
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                      <Building className="w-5 h-5 text-orange-600" />
                    </div>
                    <div className="w-0.5 h-full bg-gray-200 mt-2"></div>
                  </div>
                  <div className="pb-6">
                    <h3 className="font-semibold text-gray-900 mb-1">
                      Bước 3: Tìm công ty thực tập
                    </h3>
                    <p className="text-sm text-gray-600 mb-2">
                      {new Date(activePeriod.start_date).toLocaleDateString(
                        "vi-VN"
                      )}{" "}
                      -{" "}
                      {new Date(
                        activePeriod.search_deadline
                      ).toLocaleDateString("vi-VN")}
                    </p>
                    <p className="text-sm text-gray-500">
                      4 tuần để tìm và cập nhật thông tin công ty
                    </p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                      <Calendar className="w-5 h-5 text-purple-600" />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">
                      Bước 4: Thực tập
                    </h3>
                    <p className="text-sm text-gray-600 mb-2">
                      {new Date(activePeriod.start_date).toLocaleDateString(
                        "vi-VN"
                      )}{" "}
                      -{" "}
                      {new Date(activePeriod.end_date).toLocaleDateString(
                        "vi-VN"
                      )}
                    </p>
                    <p className="text-sm text-gray-500">
                      Thời gian thực tập 13 tuần
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          {(canRegister() || canSelectLecturer() || canSubmitCompany()) && (
            <Card className="border-2 border-blue-200 bg-blue-50 shadow-md">
              <CardHeader>
                <CardTitle className="text-blue-900 text-lg sm:text-xl">
                  Hành động cần thực hiện
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col sm:flex-row flex-wrap gap-3">
                {canRegister() && (
                  <Button
                    size="lg"
                    className="w-full sm:flex-1 sm:min-w-[200px]"
                    disabled={!canRegister() || isRegistering}
                    onClick={async () => {
                      // quick register without dialog
                      if (!canRegister() || !activePeriod) return;
                      setIsRegistering(true);
                      try {
                        const {
                          data: { user },
                        } = await supabase.auth.getUser();
                        if (!user) throw new Error("Chưa đăng nhập");
                        const { error } = await supabase
                          .from("student_registrations")
                          .insert([
                            {
                              period_id: activePeriod.id,
                              student_id: user.id,
                              prefer_own_lecturer: false,
                              status: "registered",
                            },
                          ]);
                        if (error) {
                          console.error("Supabase INSERT error:", error);
                          throw error;
                        }
                        toast.success("Đăng ký thực tập thành công");
                        await loadData();
                      } catch (err) {
                        console.error("Registration error details:", err);
                        const error = err as { message?: string; hint?: string; details?: string };
                        const errorMsg = error?.message || error?.hint || error?.details || String(err);
                        toast.error("Lỗi đăng ký: " + errorMsg);
                      } finally {
                        setIsRegistering(false);
                      }
                    }}
                  >
                    <CheckCircle2 className="w-5 h-5 mr-2" />
                    Đăng ký tham gia thực tập
                  </Button>
                )}
                {canSelectLecturer() && (
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full sm:flex-1 sm:min-w-[200px] border-blue-600 text-blue-700 hover:bg-blue-100"
                    onClick={() => {
                      setShowLecturerDialog(true);
                    }}
                  >
                    <Users className="w-5 h-5 mr-2" />
                    Chọn giảng viên hướng dẫn
                  </Button>
                )}
                {canSubmitCompany() && (
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full sm:flex-1 sm:min-w-[200px] border-blue-600 text-blue-700 hover:bg-blue-100"
                    onClick={() => {
                      setShowCompanyDialog(true);
                    }}
                  >
                    <Building className="w-5 h-5 mr-2" />
                    Cập nhật thông tin công ty
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Lecturer choose dialog */}
        <Dialog open={showLecturerDialog} onOpenChange={setShowLecturerDialog}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Chọn giảng viên hướng dẫn</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {availableLecturers.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-amber-600 font-medium">
                    Chưa có giảng viên nào cùng khoa được thêm vào kỳ thực tập
                    này.
                  </p>
                  <p className="text-sm text-gray-600 mt-2">
                    Vui lòng liên hệ admin hoặc để hệ thống tự động phân công.
                  </p>
                </div>
              ) : (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                    <p className="text-sm text-blue-800">
                      <strong>Lưu ý:</strong> Chọn 1 giảng viên. Bạn
                      có thể thay đổi lựa chọn trong thời hạn chọn GV.
                    </p>
                  </div>

                  <Input
                    placeholder="Tìm kiếm giảng viên theo tên hoặc email..."
                    value={searchLecturer}
                    onChange={(e) => setSearchLecturer(e.target.value)}
                    className="mb-3"
                  />

                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12"></TableHead>
                          <TableHead>Họ tên</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead className="text-right">Còn lại</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {availableLecturers
                          .filter(lec => 
                            lec.lecturer_name.toLowerCase().includes(searchLecturer.toLowerCase()) ||
                            lec.lecturer_email.toLowerCase().includes(searchLecturer.toLowerCase())
                          )
                          .map((lec) => {
                            const isSelected = selectedLecturer === lec.lecturer_id;
                            const isFull = lec.slots_remaining === 0;

                            return (
                              <TableRow
                                key={lec.lecturer_id}
                                className={`${
                                  isFull
                                    ? "opacity-50 cursor-not-allowed"
                                    : "cursor-pointer hover:bg-gray-50"
                                } ${
                                  isSelected
                                    ? "bg-blue-50"
                                    : ""
                                }`}
                                onClick={() => {
                                  if (!isFull) {
                                    setSelectedLecturer(lec.lecturer_id);
                                  }
                                }}
                              >
                                <TableCell>
                                  <input
                                    type="radio"
                                    checked={isSelected}
                                    disabled={isFull}
                                    aria-label={`Chọn giảng viên ${lec.lecturer_name}`}
                                    onChange={() => {
                                      if (!isFull) {
                                        setSelectedLecturer(lec.lecturer_id);
                                      }
                                    }}
                                    className="w-4 h-4 text-blue-600 cursor-pointer disabled:cursor-not-allowed"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </TableCell>
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-2">
                                    {lec.lecturer_name}
                                    {isFull && (
                                      <Badge variant="destructive" className="text-xs">
                                        ĐẦY
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm text-gray-600">
                                  {lec.lecturer_email}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Badge
                                    variant={lec.slots_remaining === 0 ? "destructive" : lec.slots_remaining <= 3 ? "secondary" : "default"}
                                  >
                                    {lec.slots_remaining}/{lec.max_students}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        {availableLecturers.filter(lec => 
                          lec.lecturer_name.toLowerCase().includes(searchLecturer.toLowerCase()) ||
                          lec.lecturer_email.toLowerCase().includes(searchLecturer.toLowerCase())
                        ).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                              Không tìm thấy giảng viên
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {!selectedLecturer && (
                    <p className="text-sm text-gray-500 italic">
                      Hoặc bỏ qua để hệ thống tự động phân công giảng viên có slot.
                    </p>
                  )}
                </>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowLecturerDialog(false);
                    setSelectedLecturer("");
                  }}
                >
                  Hủy
                </Button>
                <Button
                  onClick={handleSelectLecturer}
                  disabled={!selectedLecturer && availableLecturers.length > 0}
                >
                  {selectedLecturer
                    ? "Xác nhận chọn GV"
                    : "Để hệ thống tự động"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Company information dialog */}
        <Dialog open={showCompanyDialog} onOpenChange={setShowCompanyDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Cập nhật thông tin công ty thực tập</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="company-name">
                  Tên công ty <span className="text-red-500">*</span>
                </Label>
                <input
                  id="company-name"
                  type="text"
                  value={companyForm.company_name}
                  onChange={(e) =>
                    setCompanyForm({
                      ...companyForm,
                      company_name: e.target.value,
                    })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 mt-1"
                  placeholder="VD: Công ty TNHH ABC"
                  required
                />
              </div>

              <div>
                <Label htmlFor="internship-position">
                  Vị trí thực tập <span className="text-red-500">*</span>
                </Label>
                <input
                  id="internship-position"
                  type="text"
                  value={companyForm.internship_position}
                  onChange={(e) =>
                    setCompanyForm({
                      ...companyForm,
                      internship_position: e.target.value,
                    })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 mt-1"
                  placeholder="VD: Thực tập sinh Lập trình viên, Thực tập sinh Marketing"
                  required
                />
              </div>

              <div>
                <Label htmlFor="company-address">
                  Địa chỉ công ty <span className="text-red-500">*</span>
                </Label>
                <input
                  id="company-address"
                  type="text"
                  value={companyForm.company_address}
                  onChange={(e) =>
                    setCompanyForm({
                      ...companyForm,
                      company_address: e.target.value,
                    })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 mt-1"
                  placeholder="VD: 123 Đường ABC, Phường XYZ, TP.HCM"
                  required
                />
              </div>

              <div>
                <Label htmlFor="company-supervisor">
                  Người hướng dẫn tại công ty{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <input
                  id="company-supervisor"
                  type="text"
                  value={companyForm.company_supervisor}
                  onChange={(e) =>
                    setCompanyForm({
                      ...companyForm,
                      company_supervisor: e.target.value,
                    })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 mt-1"
                  placeholder="VD: Nguyễn Văn A"
                  required
                />
              </div>

              <div>
                <Label htmlFor="company-supervisor-phone">
                  Số điện thoại người hướng dẫn{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <input
                  id="company-supervisor-phone"
                  type="tel"
                  value={companyForm.company_supervisor_phone}
                  onChange={(e) =>
                    setCompanyForm({
                      ...companyForm,
                      company_supervisor_phone: e.target.value,
                    })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 mt-1"
                  placeholder="VD: 0912345678"
                  required
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <p className="text-sm text-blue-800">
                  <strong>Lưu ý:</strong> Thông tin công ty sẽ được gửi đến
                  giảng viên hướng dẫn và phòng đào tạo để phê duyệt.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCompanyDialog(false);
                  }}
                >
                  Hủy
                </Button>
                <Button
                  onClick={async () => {
                    if (!myRegistration) return;

                    // Validation
                    if (
                      !companyForm.company_name ||
                      !companyForm.internship_position ||
                      !companyForm.company_address ||
                      !companyForm.company_supervisor ||
                      !companyForm.company_supervisor_phone
                    ) {
                      toast.error("Vui lòng điền đầy đủ thông tin công ty");
                      return;
                    }

                    try {
                      const { error } = await supabase
                        .from("student_registrations")
                        .update({
                          company_name: companyForm.company_name,
                          internship_position: companyForm.internship_position,
                          company_address: companyForm.company_address,
                          company_supervisor: companyForm.company_supervisor,
                          company_supervisor_phone:
                            companyForm.company_supervisor_phone,
                          status: "company_submitted",
                        })
                        .eq("id", myRegistration.id);

                      if (error) throw error;

                      toast.success("Cập nhật thông tin công ty thành công!");
                      setShowCompanyDialog(false);
                      await loadData();
                    } catch (err) {
                      toast.error(
                        "Lỗi cập nhật công ty: " + getErrorMessage(err)
                      );
                    }
                  }}
                  disabled={
                    !companyForm.company_name ||
                    !companyForm.internship_position ||
                    !companyForm.company_address ||
                    !companyForm.company_supervisor ||
                    !companyForm.company_supervisor_phone
                  }
                >
                  Xác nhận
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Right Column - Status */}
        <div className="space-y-6">
          {/* Registration Status */}
          {myRegistration ? (
            <Card className="border-2 border-green-200 shadow-md">
              <CardHeader className="bg-green-50">
                <CardTitle className="flex items-center gap-2 text-green-900 text-lg">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  Trạng thái
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="text-center pb-4 border-b">
                  {getStatusBadge(myRegistration.status)}
                </div>

                {myRegistration.assigned_lecturer_id && (
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <Label className="text-xs text-blue-700">
                      Giảng viên hướng dẫn
                    </Label>
                    <p className="text-sm font-semibold text-blue-900 mt-1">
                      {lecturers.find(
                        (l) => l.id === myRegistration.assigned_lecturer_id
                      )?.full_name || "Đang tải..."}
                    </p>
                  </div>
                )}

                {myRegistration.company_name && (
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <Label className="text-xs text-blue-700">
                      Công ty thực tập
                    </Label>
                    <p className="text-sm font-semibold text-blue-900 mt-1">
                      {myRegistration.company_name}
                    </p>
                    {myRegistration.internship_position && (
                      <p className="text-xs text-blue-600 mt-1 italic">
                        Vị trí: {myRegistration.internship_position}
                      </p>
                    )}
                    <p className="text-xs text-gray-600 mt-1">
                      {myRegistration.company_address}
                    </p>
                    {myRegistration.company_supervisor && (
                      <div className="mt-2 pt-2 border-t border-blue-200">
                        <p className="text-xs text-gray-600">Người hướng dẫn</p>
                        <p className="text-sm font-medium text-gray-900">
                          {myRegistration.company_supervisor}
                        </p>
                        <p className="text-xs text-gray-600">
                          {myRegistration.company_supervisor_phone}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-2 border-yellow-200 shadow-md">
              <CardHeader className="bg-yellow-50">
                <CardTitle className="flex items-center gap-2 text-yellow-900 text-lg">
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                  Chưa đăng ký
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-600 text-center">
                  Bạn chưa đăng ký tham gia thực tập kỳ này
                </p>
              </CardContent>
            </Card>
          )}

          {/* Info Card */}
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="text-base">Thông tin sinh viên</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <Label className="text-xs text-gray-600">Họ tên</Label>
                <p className="font-medium">{studentProfile?.full_name}</p>
              </div>
              <div>
                <Label className="text-xs text-gray-600">Email</Label>
                <p className="text-sm">{studentProfile?.email}</p>
              </div>
              <div>
                <Label className="text-xs text-gray-600">Khoa</Label>
                <p className="font-medium">{studentProfile?.department}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialogs omitted for brevity (kept in original component) */}
    </div>
  );
}
