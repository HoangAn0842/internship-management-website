"use client";

import { use, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Users, GraduationCap, UserPlus, Trash2, Wand2, Calendar } from "lucide-react";
import { useRouter } from "next/navigation";

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
  target_departments?: string[];
  target_academic_years?: string[];
  target_internship_statuses?: string[];
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

type Profile = {
  id: string;
  email: string;
  full_name: string;
  department?: string;
  student_id?: string;
  academic_year?: string;
};

type StudentRegistration = {
  id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  lecturer_id: string | null;
  lecturer_name: string | null;
  registration_status: string;
  created_at: string;
  company_name?: string;
  company_address?: string;
  company_supervisor?: string;
  company_supervisor_phone?: string;
  internship_position?: string;
  prefer_own_lecturer?: boolean;
  requested_lecturer_id?: string;
  student_department?: string;
  student_academic_year?: string;
  student_student_id?: string;
  lecturer_email?: string;
};

export default function PeriodDetailPage({
  params,
}: {
  params: Promise<{ periodId: string }>;
}) {
  const router = useRouter();
  const { periodId } = use(params);
  
  const [period, setPeriod] = useState<InternshipPeriod | null>(null);
  const [activeTab, setActiveTab] = useState<"lecturers" | "students">("lecturers");
  
  // Lecturer states
  const [periodLecturers, setPeriodLecturers] = useState<LecturerAvailability[]>([]);
  const [allLecturers, setAllLecturers] = useState<Profile[]>([]);
  const [showAddLecturerDialog, setShowAddLecturerDialog] = useState(false);
  const [selectedLecturersToAdd, setSelectedLecturersToAdd] = useState<string[]>([]);
  const [selectedLecturersToRemove, setSelectedLecturersToRemove] = useState<string[]>([]);
  const [searchAddedLecturers, setSearchAddedLecturers] = useState("");
  const [searchAvailableLecturers, setSearchAvailableLecturers] = useState("");
  
  // Lecturer-Student management states
  const [showLecturerStudentsDialog, setShowLecturerStudentsDialog] = useState(false);
  const [selectedLecturer, setSelectedLecturer] = useState<LecturerAvailability | null>(null);
  const [lecturerStudents, setLecturerStudents] = useState<StudentRegistration[]>([]);
  const [availableStudents, setAvailableStudents] = useState<StudentRegistration[]>([]);
  const [selectedStudentsToAssign, setSelectedStudentsToAssign] = useState<string[]>([]);
  const [selectedStudentsToUnassign, setSelectedStudentsToUnassign] = useState<string[]>([]);
  const [searchLecturerStudents, setSearchLecturerStudents] = useState("");
  const [searchAvailableStudents, setSearchAvailableStudents] = useState("");
  
  // Student states
  const [students, setStudents] = useState<StudentRegistration[]>([]);
  const [searchStudents, setSearchStudents] = useState("");
  
  // Student detail dialog
  const [showStudentDetailDialog, setShowStudentDetailDialog] = useState(false);
  const [selectedStudentDetail, setSelectedStudentDetail] = useState<StudentRegistration | null>(null);
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [companyForm, setCompanyForm] = useState({
    company_name: "",
    internship_position: "",
    company_address: "",
    company_supervisor: "",
    company_supervisor_phone: "",
  });
  
  // Period edit dialog
  const [showEditPeriodDialog, setShowEditPeriodDialog] = useState(false);
  const [periodForm, setPeriodForm] = useState<InternshipPeriod | null>(null);

  useEffect(() => {
    void loadPeriod();
    void loadAllLecturers();
    void loadPeriodLecturers();
    void loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodId]);

  const loadPeriod = async () => {
    const { data } = await supabase
      .from("internship_periods")
      .select("*")
      .eq("id", periodId)
      .single();
    
    if (data) {
      setPeriod(data);
    } else {
      toast.error("Không tìm thấy kỳ thực tập");
      router.push("/dashboard/admin/periods");
    }
  };

  const loadAllLecturers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "lecturer")
      .order("full_name");
    
    if (data) {
      setAllLecturers(data);
    }
  };

  const loadPeriodLecturers = async () => {
    try {
      const response = await fetch(`/api/admin/periods/${periodId}/lecturers`);
      if (response.ok) {
        const data = await response.json();
        setPeriodLecturers(data);
      }
    } catch (error) {
      console.error("Error loading period lecturers:", error);
    }
  };

  const loadStudents = async () => {
    const { data } = await supabase
      .from("student_registrations")
      .select(`
        id,
        student_id,
        assigned_lecturer_id,
        status,
        created_at,
        students:profiles!student_registrations_student_id_fkey(full_name, email),
        lecturers:profiles!student_registrations_assigned_lecturer_id_fkey(full_name)
      `)
      .eq("period_id", periodId);
    
    if (data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const formatted = data.map((reg: any) => ({
        id: reg.id,
        student_id: reg.student_id,
        student_name: reg.students?.full_name || "",
        student_email: reg.students?.email || "",
        lecturer_id: reg.assigned_lecturer_id,
        lecturer_name: reg.lecturers?.full_name || null,
        registration_status: reg.status,
        created_at: reg.created_at,
      }));
      setStudents(formatted);
    }
  };

  const loadLecturerStudents = async (lecturerId: string) => {
    const { data } = await supabase
      .from("student_registrations")
      .select(`
        id,
        student_id,
        assigned_lecturer_id,
        status,
        created_at,
        students:profiles!student_registrations_student_id_fkey(full_name, email)
      `)
      .eq("period_id", periodId)
      .eq("assigned_lecturer_id", lecturerId);
    
    if (data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const formatted = data.map((reg: any) => ({
        id: reg.id,
        student_id: reg.student_id,
        student_name: reg.students?.full_name || "",
        student_email: reg.students?.email || "",
        lecturer_id: reg.assigned_lecturer_id,
        lecturer_name: null,
        registration_status: reg.status,
        created_at: reg.created_at,
      }));
      setLecturerStudents(formatted);
    }
  };

  const loadAvailableStudents = async () => {
    const { data } = await supabase
      .from("student_registrations")
      .select(`
        id,
        student_id,
        assigned_lecturer_id,
        status,
        created_at,
        students:profiles!student_registrations_student_id_fkey(full_name, email, department, student_id)
      `)
      .eq("period_id", periodId)
      .is("assigned_lecturer_id", null);
    
    if (data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const formatted = data.map((reg: any) => ({
        id: reg.id,
        student_id: reg.student_id,
        student_name: reg.students?.full_name || "",
        student_email: reg.students?.email || "",
        student_department: reg.students?.department || "",
        student_student_id: reg.students?.student_id || "",
        lecturer_id: null,
        lecturer_name: null,
        registration_status: reg.status,
        created_at: reg.created_at,
      }));
      setAvailableStudents(formatted);
    }
  };

  const handleViewLecturerStudents = async (lecturer: LecturerAvailability) => {
    setSelectedLecturer(lecturer);
    setShowLecturerStudentsDialog(true);
    setSelectedStudentsToAssign([]);
    setSelectedStudentsToUnassign([]);
    await loadLecturerStudents(lecturer.lecturer_id);
    await loadAvailableStudents();
  };

  const handleAssignStudents = async () => {
    if (!selectedLecturer || selectedStudentsToAssign.length === 0) {
      toast.error("Vui lòng chọn ít nhất một sinh viên");
      return;
    }

    try {
      // Update each selected student to assign the lecturer
      for (const studentId of selectedStudentsToAssign) {
        const { error } = await supabase
          .from("student_registrations")
          .update({ 
            assigned_lecturer_id: selectedLecturer.lecturer_id,
            status: "searching" // Change status to searching when assigned by admin
          })
          .eq("id", studentId);
        
        if (error) throw error;
      }

      toast.success(`Đã phân công ${selectedStudentsToAssign.length} sinh viên cho giảng viên`);
      setSelectedStudentsToAssign([]);
      await loadLecturerStudents(selectedLecturer.lecturer_id);
      await loadAvailableStudents();
      await loadPeriodLecturers();
      await loadStudents();
    } catch (error) {
      console.error("Error assigning students:", error);
      toast.error("Lỗi khi phân công sinh viên");
    }
  };

  const handleUnassignStudents = async () => {
    if (!selectedLecturer || selectedStudentsToUnassign.length === 0) {
      toast.error("Vui lòng chọn ít nhất một sinh viên");
      return;
    }

    if (!confirm(`Xóa ${selectedStudentsToUnassign.length} sinh viên khỏi giảng viên này?`)) {
      return;
    }

    try {
      // Update each selected student to remove the lecturer assignment
      for (const studentId of selectedStudentsToUnassign) {
        const { error } = await supabase
          .from("student_registrations")
          .update({ 
            assigned_lecturer_id: null,
            status: "registered" // Reset status to registered when unassigned
          })
          .eq("id", studentId);
        
        if (error) throw error;
      }

      toast.success(`Đã xóa ${selectedStudentsToUnassign.length} sinh viên khỏi giảng viên`);
      setSelectedStudentsToUnassign([]);
      await loadLecturerStudents(selectedLecturer.lecturer_id);
      await loadAvailableStudents();
      await loadPeriodLecturers();
      await loadStudents();
    } catch (error) {
      console.error("Error unassigning students:", error);
      toast.error("Lỗi khi xóa sinh viên");
    }
  };

  const handleViewStudentDetail = async (student: StudentRegistration) => {
    // Load full student registration details
    const { data } = await supabase
      .from("student_registrations")
      .select(`
        *,
        students:profiles!student_registrations_student_id_fkey(full_name, email, student_id, department, academic_year),
        lecturers:profiles!student_registrations_assigned_lecturer_id_fkey(full_name, email)
      `)
      .eq("id", student.id)
      .single();
    
    if (data) {
      const fullStudent: StudentRegistration = {
        ...student,
        company_name: data.company_name,
        company_address: data.company_address,
        company_supervisor: data.company_supervisor,
        company_supervisor_phone: data.company_supervisor_phone,
        internship_position: data.internship_position,
        prefer_own_lecturer: data.prefer_own_lecturer,
        requested_lecturer_id: data.requested_lecturer_id,
        student_department: data.students?.department,
        student_academic_year: data.students?.academic_year,
        student_student_id: data.students?.student_id,
        lecturer_name: data.lecturers?.full_name,
        lecturer_email: data.lecturers?.email,
      };
      setSelectedStudentDetail(fullStudent);
      setCompanyForm({
        company_name: data.company_name || "",
        internship_position: data.internship_position || "",
        company_address: data.company_address || "",
        company_supervisor: data.company_supervisor || "",
        company_supervisor_phone: data.company_supervisor_phone || "",
      });
      setIsEditingCompany(false);
      setShowStudentDetailDialog(true);
    }
  };

  const handleUpdateCompany = async () => {
    if (!selectedStudentDetail) return;

    try {
      // Check if student previously had no company info (status was "searching")
      const hasCompanyInfo = companyForm.company_name.trim() !== "";
      const shouldUpdateStatus = hasCompanyInfo && selectedStudentDetail.registration_status === "searching";

      const updateData: {
        company_name: string;
        internship_position: string;
        company_address: string;
        company_supervisor: string;
        company_supervisor_phone: string;
        status?: string;
      } = {
        company_name: companyForm.company_name,
        internship_position: companyForm.internship_position,
        company_address: companyForm.company_address,
        company_supervisor: companyForm.company_supervisor,
        company_supervisor_phone: companyForm.company_supervisor_phone,
      };

      // If student was "searching" and now has company info, change status to "company_submitted"
      if (shouldUpdateStatus) {
        updateData.status = "company_submitted";
      }

      const { error } = await supabase
        .from("student_registrations")
        .update(updateData)
        .eq("id", selectedStudentDetail.id);

      if (error) throw error;

      toast.success("Đã cập nhật thông tin công ty");
      setIsEditingCompany(false);
      // Reload student detail
      await handleViewStudentDetail(selectedStudentDetail);
      await loadStudents();
    } catch (error) {
      console.error("Error updating company:", error);
      toast.error("Lỗi khi cập nhật thông tin công ty");
    }
  };

  const handleEditPeriod = () => {
    if (period) {
      setPeriodForm({ ...period });
      setShowEditPeriodDialog(true);
    }
  };

  const handleUpdatePeriod = async () => {
    if (!periodForm) return;

    try {
      const { error } = await supabase
        .from("internship_periods")
        .update({
          semester: periodForm.semester,
          academic_year: periodForm.academic_year,
          registration_start: periodForm.registration_start,
          registration_end: periodForm.registration_end,
          lecturer_selection_end: periodForm.lecturer_selection_end,
          search_deadline: periodForm.search_deadline,
          start_date: periodForm.start_date,
          end_date: periodForm.end_date,
          is_active: periodForm.is_active,
        })
        .eq("id", periodForm.id);

      if (error) throw error;

      toast.success("Đã cập nhật thông tin kỳ thực tập");
      setShowEditPeriodDialog(false);
      await loadPeriod();
    } catch (error) {
      console.error("Error updating period:", error);
      toast.error("Lỗi khi cập nhật kỳ thực tập");
    }
  };

  const handleAddLecturers = async () => {
    if (selectedLecturersToAdd.length === 0) {
      toast.error("Vui lòng chọn ít nhất một giảng viên");
      return;
    }

    try {
      const response = await fetch(`/api/admin/periods/${periodId}/lecturers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lecturer_ids: selectedLecturersToAdd,
          max_students: 20,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to add lecturers");
      }

      toast.success(`Đã thêm ${selectedLecturersToAdd.length} giảng viên vào kỳ thực tập`);
      setSelectedLecturersToAdd([]);
      setSearchAvailableLecturers("");
      setShowAddLecturerDialog(false);
      void loadPeriodLecturers();
    } catch (error) {
      console.error("Error adding lecturers:", error);
      toast.error("Lỗi khi thêm giảng viên");
    }
  };

  const handleRemoveLecturers = async () => {
    if (selectedLecturersToRemove.length === 0) {
      toast.error("Vui lòng chọn ít nhất một giảng viên");
      return;
    }

    if (!confirm(`Xóa ${selectedLecturersToRemove.length} giảng viên khỏi kỳ thực tập này?`)) return;

    try {
      for (const lecturerId of selectedLecturersToRemove) {
        const response = await fetch(
          `/api/admin/periods/${periodId}/lecturers?lecturer_id=${lecturerId}`,
          { method: "DELETE" }
        );
        
        if (!response.ok) {
          throw new Error(`Failed to remove lecturer ${lecturerId}`);
        }
      }

      toast.success(`Đã xóa ${selectedLecturersToRemove.length} giảng viên`);
      setSelectedLecturersToRemove([]);
      void loadPeriodLecturers();
    } catch (error) {
      console.error("Error removing lecturers:", error);
      toast.error("Lỗi khi xóa giảng viên");
    }
  };

  const handleAutoAssign = async () => {
    if (!confirm("Tự động phân công giảng viên cho sinh viên chưa chọn?")) return;

    try {
      const response = await fetch(`/api/admin/periods/${periodId}/auto-assign`, {
        method: "POST",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Auto-assign failed");
      }

      toast.success(`Đã phân công ${result.assigned_count} sinh viên`);
      void loadStudents();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Lỗi khi tự động phân công";
      toast.error(errorMessage);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("vi-VN");
  };

  const availableLecturers = allLecturers.filter((lec) => {
    // Exclude lecturers already added to this period
    if (periodLecturers.some((pl) => pl.lecturer_id === lec.id)) {
      return false;
    }

    // If period has target_departments filter, only show lecturers from those departments
    if (period?.target_departments && period.target_departments.length > 0) {
      return lec.department && period.target_departments.includes(lec.department);
    }

    // If no department filter, show all available lecturers
    return true;
  });

  const filteredAvailableLecturers = availableLecturers.filter((lec) => {
    const query = searchAvailableLecturers.toLowerCase();
    return (
      lec.full_name.toLowerCase().includes(query) ||
      lec.email.toLowerCase().includes(query)
    );
  });

  const filteredAddedLecturers = periodLecturers.filter((lec) => {
    const query = searchAddedLecturers.toLowerCase();
    return (
      lec.lecturer_name.toLowerCase().includes(query) ||
      lec.lecturer_email.toLowerCase().includes(query)
    );
  });

  const filteredStudents = students.filter((student) => {
    const query = searchStudents.toLowerCase();
    return (
      student.student_name.toLowerCase().includes(query) ||
      student.student_email.toLowerCase().includes(query)
    );
  });

  if (!period) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Đang tải...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push("/dashboard/admin/periods")}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Quay lại danh sách
        </Button>
        
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {period.semester} - {period.academic_year}
            </h1>
            <p className="text-gray-500 mt-1">Chi tiết kỳ thực tập</p>
            <div className="flex gap-2 mt-3">
              <Badge variant={period.is_active ? "default" : "secondary"}>
                {period.is_active ? "Đang mở" : "Đã đóng"}
              </Badge>
            </div>
          </div>
          <Button variant="outline" onClick={handleEditPeriod}>
            <Calendar className="w-4 h-4 mr-2" />
            Chỉnh sửa
          </Button>
        </div>

        {/* Period Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-sm text-gray-500">Đăng ký</div>
            <div className="text-sm font-medium mt-1">
              {formatDate(period.registration_start)} → {formatDate(period.registration_end)}
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-sm text-gray-500">Hạn chọn GV</div>
            <div className="text-sm font-medium mt-1">
              {formatDate(period.lecturer_selection_end)}
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-sm text-gray-500">Hạn tìm công ty</div>
            <div className="text-sm font-medium mt-1">
              {formatDate(period.search_deadline)}
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-sm text-gray-500">Thời gian thực tập</div>
            <div className="text-sm font-medium mt-1">
              {formatDate(period.start_date)} → {formatDate(period.end_date)}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b mb-6">
        <nav className="flex gap-6">
          <button
            onClick={() => setActiveTab("lecturers")}
            className={`pb-4 px-1 border-b-2 transition-colors ${
              activeTab === "lecturers"
                ? "border-blue-600 text-blue-600 font-medium"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            Quản lý Giảng viên
          </button>
          <button
            onClick={() => setActiveTab("students")}
            className={`pb-4 px-1 border-b-2 transition-colors ${
              activeTab === "students"
                ? "border-blue-600 text-blue-600 font-medium"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <GraduationCap className="w-4 h-4 inline mr-2" />
            Quản lý Sinh viên
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "lecturers" && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">
              Danh sách Giảng viên ({periodLecturers.length})
            </h2>
            <div className="flex gap-2">
              {selectedLecturersToRemove.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleRemoveLecturers}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Xóa ({selectedLecturersToRemove.length})
                </Button>
              )}
              <Button onClick={() => setShowAddLecturerDialog(true)}>
                <UserPlus className="w-4 h-4 mr-2" />
                Thêm giảng viên
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-lg border">
            <div className="p-4 border-b">
              <Input
                placeholder="Tìm kiếm theo tên, email..."
                value={searchAddedLecturers}
                onChange={(e) => setSearchAddedLecturers(e.target.value)}
              />
            </div>
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      aria-label="Chọn tất cả giảng viên để xóa"
                      checked={
                        selectedLecturersToRemove.length > 0 &&
                        selectedLecturersToRemove.length === filteredAddedLecturers.filter(lec => lec.assigned_count === 0).length
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedLecturersToRemove(
                            filteredAddedLecturers
                              .filter(lec => lec.assigned_count === 0)
                              .map((lec) => lec.lecturer_id)
                          );
                        } else {
                          setSelectedLecturersToRemove([]);
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead>Họ tên</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Khoa</TableHead>
                  <TableHead>Số slot</TableHead>
                  <TableHead>Đã nhận</TableHead>
                  <TableHead>Còn lại</TableHead>
                  <TableHead>Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAddedLecturers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-gray-500">
                      {searchAddedLecturers
                        ? "Không tìm thấy giảng viên"
                        : "Chưa có giảng viên nào"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAddedLecturers.map((lec) => {
                    const hasStudents = lec.assigned_count > 0;
                    return (
                      <TableRow key={lec.id}>
                        <TableCell>
                          <input
                            type="checkbox"
                            aria-label={`Chọn giảng viên ${lec.lecturer_name}`}
                            disabled={hasStudents}
                            checked={selectedLecturersToRemove.includes(lec.lecturer_id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedLecturersToRemove([
                                  ...selectedLecturersToRemove,
                                  lec.lecturer_id,
                                ]);
                              } else {
                                setSelectedLecturersToRemove(
                                  selectedLecturersToRemove.filter((id) => id !== lec.lecturer_id)
                                );
                              }
                            }}
                            title={
                              hasStudents
                                ? "Không thể xóa giảng viên đã có sinh viên đăng ký"
                                : ""
                            }
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {lec.lecturer_name}
                          {hasStudents && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              Có SV
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{lec.lecturer_email}</TableCell>
                        <TableCell>{lec.lecturer_department || "—"}</TableCell>
                        <TableCell>{lec.max_students}</TableCell>
                        <TableCell>{lec.assigned_count}</TableCell>
                        <TableCell>
                          <Badge
                            variant={lec.slots_remaining > 0 ? "default" : "secondary"}
                          >
                            {lec.slots_remaining}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewLecturerStudents(lec)}
                          >
                            <Users className="w-4 h-4 mr-1" />
                            Xem SV ({lec.assigned_count})
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {activeTab === "students" && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">
              Danh sách Sinh viên ({students.length})
            </h2>
            <Button onClick={handleAutoAssign}>
              <Wand2 className="w-4 h-4 mr-2" />
              Auto-assign
            </Button>
          </div>

          <div className="bg-white rounded-lg border">
            <div className="p-4 border-b">
              <Input
                placeholder="Tìm kiếm theo tên, email..."
                value={searchStudents}
                onChange={(e) => setSearchStudents(e.target.value)}
              />
            </div>
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Họ tên</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Giảng viên hướng dẫn</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Ngày đăng ký</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-500">
                      {searchStudents
                        ? "Không tìm thấy sinh viên"
                        : "Chưa có sinh viên đăng ký"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStudents.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">
                        <button
                          onClick={() => handleViewStudentDetail(student)}
                          className="text-blue-600 hover:text-blue-800 hover:underline text-left"
                        >
                          {student.student_name}
                        </button>
                      </TableCell>
                      <TableCell>{student.student_email}</TableCell>
                      <TableCell>
                        {student.lecturer_name || (
                          <span className="text-gray-400">Chưa chọn</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            student.registration_status === "completed"
                              ? "default"
                              : student.registration_status === "in_progress"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {student.registration_status === "registered" && "Đã đăng ký"}
                          {student.registration_status === "searching" && "Đang tìm công ty"}
                          {student.registration_status === "in_progress" && "Đang thực tập"}
                          {student.registration_status === "completed" && "Hoàn thành"}
                          {student.registration_status === "company_submitted" && "Đã tìm công ty"}
                          {student.registration_status === "pending" && "Chờ duyệt"}
                          {student.registration_status === "approved" && "Đã duyệt"}
                          {student.registration_status === "rejected" && "Từ chối"}
                          {!["registered", "searching", "in_progress", "completed", "pending", "approved", "rejected", "company_submitted"].includes(student.registration_status) && student.registration_status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(student.created_at)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Add Lecturer Dialog */}
      <Dialog open={showAddLecturerDialog} onOpenChange={setShowAddLecturerDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Thêm Giảng viên vào kỳ thực tập</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Input
                placeholder="Tìm kiếm theo tên, email..."
                value={searchAvailableLecturers}
                onChange={(e) => setSearchAvailableLecturers(e.target.value)}
              />
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      aria-label="Chọn tất cả giảng viên có sẵn để thêm"
                      checked={
                        selectedLecturersToAdd.length > 0 &&
                        selectedLecturersToAdd.length === filteredAvailableLecturers.length
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedLecturersToAdd(
                            filteredAvailableLecturers.map((lec) => lec.id)
                          );
                        } else {
                          setSelectedLecturersToAdd([]);
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead>Họ tên</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Khoa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAvailableLecturers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-gray-500">
                      {searchAvailableLecturers
                        ? "Không tìm thấy giảng viên"
                        : "Tất cả giảng viên đã được thêm"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAvailableLecturers.map((lec) => (
                    <TableRow key={lec.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          aria-label={`Chọn giảng viên ${lec.full_name}`}
                          checked={selectedLecturersToAdd.includes(lec.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedLecturersToAdd([
                                ...selectedLecturersToAdd,
                                lec.id,
                              ]);
                            } else {
                              setSelectedLecturersToAdd(
                                selectedLecturersToAdd.filter((id) => id !== lec.id)
                              );
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{lec.full_name}</TableCell>
                      <TableCell>{lec.email}</TableCell>
                      <TableCell>{lec.department || "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddLecturerDialog(false);
                setSelectedLecturersToAdd([]);
                setSearchAvailableLecturers("");
              }}
            >
              Hủy
            </Button>
            <Button onClick={handleAddLecturers} disabled={selectedLecturersToAdd.length === 0}>
              Thêm ({selectedLecturersToAdd.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lecturer Students Management Dialog */}
      <Dialog open={showLecturerStudentsDialog} onOpenChange={setShowLecturerStudentsDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Quản lý Sinh viên - {selectedLecturer?.lecturer_name}
            </DialogTitle>
            <DialogDescription>
              Xem và quản lý sinh viên được phân công cho giảng viên này
            </DialogDescription>
            <p className="text-sm text-gray-500 mt-2">
              Đã nhận: {selectedLecturer?.assigned_count}/{selectedLecturer?.max_students} • 
              Còn lại: <span className="font-semibold">{selectedLecturer?.slots_remaining} slot</span>
            </p>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-6">
            {/* Left: Current Students */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold">Sinh viên đã đăng ký ({lecturerStudents.length})</h3>
                {selectedStudentsToUnassign.length > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleUnassignStudents}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Xóa ({selectedStudentsToUnassign.length})
                  </Button>
                )}
              </div>
              <Input
                placeholder="Tìm kiếm sinh viên..."
                value={searchLecturerStudents}
                onChange={(e) => setSearchLecturerStudents(e.target.value)}
                className="mb-3"
              />
              <div className="border rounded-lg max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <input
                          type="checkbox"
                          aria-label="Chọn tất cả sinh viên"
                          checked={
                            lecturerStudents.length > 0 &&
                            selectedStudentsToUnassign.length === lecturerStudents.length
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedStudentsToUnassign(lecturerStudents.map((s) => s.id));
                            } else {
                              setSelectedStudentsToUnassign([]);
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Họ tên</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Trạng thái</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lecturerStudents
                      .filter((s) => {
                        const query = searchLecturerStudents.toLowerCase();
                        return (
                          s.student_name.toLowerCase().includes(query) ||
                          s.student_email.toLowerCase().includes(query)
                        );
                      })
                      .map((student) => (
                        <TableRow key={student.id}>
                          <TableCell>
                            <input
                              type="checkbox"
                              aria-label={`Chọn ${student.student_name}`}
                              checked={selectedStudentsToUnassign.includes(student.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedStudentsToUnassign([...selectedStudentsToUnassign, student.id]);
                                } else {
                                  setSelectedStudentsToUnassign(
                                    selectedStudentsToUnassign.filter((id) => id !== student.id)
                                  );
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            <button
                              onClick={() => handleViewStudentDetail(student)}
                              className="text-blue-600 hover:text-blue-800 hover:underline text-left"
                            >
                              {student.student_name}
                            </button>
                          </TableCell>
                          <TableCell className="text-sm">{student.student_email}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {student.registration_status === "registered" && "Đã đăng ký"}
                              {student.registration_status === "searching" && "Tìm công ty"}
                              {student.registration_status === "company_submitted" && "Đã tìm công ty"}
                              {student.registration_status === "in_progress" && "Đang TT"}
                              {student.registration_status === "completed" && "Hoàn thành"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    {lecturerStudents.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-gray-500">
                          Chưa có sinh viên nào
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Right: Available Students to Assign */}
            <div>
              <h3 className="font-semibold mb-3">
                Thêm sinh viên ({selectedStudentsToAssign.length}/{selectedLecturer?.slots_remaining || 0})
              </h3>
              <Input
                placeholder="Tìm kiếm sinh viên..."
                value={searchAvailableStudents}
                onChange={(e) => setSearchAvailableStudents(e.target.value)}
                className="mb-3"
              />
              <div className="border rounded-lg max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>MSSV</TableHead>
                      <TableHead>Họ tên</TableHead>
                      <TableHead>Khoa</TableHead>
                      <TableHead>Email</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {availableStudents
                      .filter((s) => {
                        // Filter by lecturer's department - only show students from same department
                        if (selectedLecturer && s.student_department !== selectedLecturer.lecturer_department) {
                          return false;
                        }
                        
                        // Filter by search query
                        const query = searchAvailableStudents.toLowerCase();
                        if (!query) return true;
                        
                        return (
                          s.student_name.toLowerCase().includes(query) ||
                          s.student_email.toLowerCase().includes(query) ||
                          (s.student_student_id && s.student_student_id.toLowerCase().includes(query)) ||
                          (s.student_department && s.student_department.toLowerCase().includes(query))
                        );
                      })
                      .map((student) => {
                        const isSelected = selectedStudentsToAssign.includes(student.id);
                        const wouldExceedLimit = 
                          !isSelected && 
                          selectedStudentsToAssign.length >= (selectedLecturer?.slots_remaining || 0);
                        
                        return (
                          <TableRow key={student.id}>
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={wouldExceedLimit}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    if (selectedStudentsToAssign.length >= (selectedLecturer?.slots_remaining || 0)) {
                                      toast.error(
                                        `Chỉ còn ${selectedLecturer?.slots_remaining} slot! Không thể chọn thêm sinh viên.`
                                      );
                                      return;
                                    }
                                    setSelectedStudentsToAssign([...selectedStudentsToAssign, student.id]);
                                  } else {
                                    setSelectedStudentsToAssign(
                                      selectedStudentsToAssign.filter((id) => id !== student.id)
                                    );
                                  }
                                }}
                                aria-label={`Chọn ${student.student_name}`}
                              />
                            </TableCell>
                            <TableCell className="text-sm font-mono">{student.student_student_id || "—"}</TableCell>
                            <TableCell className="font-medium">{student.student_name}</TableCell>
                            <TableCell className="text-sm">{student.student_department || "—"}</TableCell>
                            <TableCell className="text-sm">{student.student_email}</TableCell>
                          </TableRow>
                        );
                      })}
                    {availableStudents.filter((s) => {
                      if (selectedLecturer && s.student_department !== selectedLecturer.lecturer_department) {
                        return false;
                      }
                      const query = searchAvailableStudents.toLowerCase();
                      if (!query) return true;
                      return (
                        s.student_name.toLowerCase().includes(query) ||
                        s.student_email.toLowerCase().includes(query) ||
                        (s.student_student_id && s.student_student_id.toLowerCase().includes(query)) ||
                        (s.student_department && s.student_department.toLowerCase().includes(query))
                      );
                    }).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-gray-500">
                          {selectedLecturer ? (
                            <>
                              Không có sinh viên khoa <strong>{selectedLecturer.lecturer_department}</strong> chưa được phân công
                            </>
                          ) : (
                            "Không có sinh viên chưa được phân công"
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {selectedStudentsToAssign.length > 0 && (
                <Button
                  className="w-full mt-3"
                  onClick={handleAssignStudents}
                >
                  Phân công {selectedStudentsToAssign.length} sinh viên
                </Button>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowLecturerStudentsDialog(false);
                setSelectedLecturer(null);
                setSelectedStudentsToAssign([]);
                setSelectedStudentsToUnassign([]);
                setSearchLecturerStudents("");
                setSearchAvailableStudents("");
              }}
            >
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Student Detail Dialog */}
      <Dialog open={showStudentDetailDialog} onOpenChange={setShowStudentDetailDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Thông tin Chi tiết Sinh viên</DialogTitle>
            <DialogDescription>
              Xem thông tin đăng ký thực tập và công ty của sinh viên
            </DialogDescription>
          </DialogHeader>

          {selectedStudentDetail && (
            <div className="space-y-6">
              {/* Student Basic Info */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold mb-3 text-lg">Thông tin Sinh viên</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-600">Họ tên</Label>
                    <p className="font-medium">{selectedStudentDetail.student_name}</p>
                  </div>
                  <div>
                    <Label className="text-gray-600">Email</Label>
                    <p className="font-medium">{selectedStudentDetail.student_email}</p>
                  </div>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(selectedStudentDetail as any).student_student_id && (
                    <div>
                      <Label className="text-gray-600">MSSV</Label>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <p className="font-medium">{(selectedStudentDetail as any).student_student_id}</p>
                    </div>
                  )}
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(selectedStudentDetail as any).student_department && (
                    <div>
                      <Label className="text-gray-600">Khoa</Label>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <p className="font-medium">{(selectedStudentDetail as any).student_department}</p>
                    </div>
                  )}
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(selectedStudentDetail as any).student_academic_year && (
                    <div>
                      <Label className="text-gray-600">Niên khóa</Label>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <p className="font-medium">{(selectedStudentDetail as any).student_academic_year}</p>
                    </div>
                  )}
                  <div>
                    <Label className="text-gray-600">Trạng thái</Label>
                    <div className="mt-1">
                      <Badge
                        variant={
                          selectedStudentDetail.registration_status === "completed" ||
                          selectedStudentDetail.registration_status === "in_progress"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {selectedStudentDetail.registration_status === "registered" && "Đã đăng ký"}
                        {selectedStudentDetail.registration_status === "searching" && "Đang tìm công ty"}
                        {selectedStudentDetail.registration_status === "company_submitted" && "Đã tìm công ty"}
                        {selectedStudentDetail.registration_status === "in_progress" && "Đang thực tập"}
                        {selectedStudentDetail.registration_status === "completed" && "Hoàn thành"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lecturer Info */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold mb-3 text-lg">Giảng viên Hướng dẫn</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-600">Họ tên GV</Label>
                    <p className="font-medium">
                      {selectedStudentDetail.lecturer_name || (
                        <span className="text-gray-400">Chưa có giảng viên</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Company Info */}
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-lg">Thông tin Công ty Thực tập</h3>
                  {!isEditingCompany && (
                    <Button variant="outline" size="sm" onClick={() => setIsEditingCompany(true)}>
                      Chỉnh sửa
                    </Button>
                  )}
                </div>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(selectedStudentDetail as any).company_name || isEditingCompany ? (
                  <div className="space-y-3">
                    {isEditingCompany ? (
                      <>
                        <div>
                          <Label htmlFor="edit-company-name">Tên công ty <span className="text-red-500">*</span></Label>
                          <Input
                            id="edit-company-name"
                            value={companyForm.company_name}
                            onChange={(e) => setCompanyForm({...companyForm, company_name: e.target.value})}
                            placeholder="VD: Công ty TNHH ABC"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-internship-position">Vị trí thực tập <span className="text-red-500">*</span></Label>
                          <Input
                            id="edit-internship-position"
                            value={companyForm.internship_position}
                            onChange={(e) => setCompanyForm({...companyForm, internship_position: e.target.value})}
                            placeholder="VD: Thực tập sinh Lập trình viên"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-company-address">Địa chỉ <span className="text-red-500">*</span></Label>
                          <Input
                            id="edit-company-address"
                            value={companyForm.company_address}
                            onChange={(e) => setCompanyForm({...companyForm, company_address: e.target.value})}
                            placeholder="Địa chỉ công ty"
                            className="mt-1"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="edit-company-supervisor">Người giám sát <span className="text-red-500">*</span></Label>
                            <Input
                              id="edit-company-supervisor"
                              value={companyForm.company_supervisor}
                              onChange={(e) => setCompanyForm({...companyForm, company_supervisor: e.target.value})}
                              placeholder="Tên người giám sát"
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor="edit-company-phone">Số điện thoại <span className="text-red-500">*</span></Label>
                            <Input
                              id="edit-company-phone"
                              value={companyForm.company_supervisor_phone}
                              onChange={(e) => setCompanyForm({...companyForm, company_supervisor_phone: e.target.value})}
                              placeholder="Số điện thoại"
                              className="mt-1"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <Button onClick={handleUpdateCompany} size="sm">
                            Lưu thay đổi
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => {
                              setIsEditingCompany(false);
                              // Reset form to original values
                              setCompanyForm({
                                company_name: selectedStudentDetail?.company_name || "",
                                internship_position: selectedStudentDetail?.internship_position || "",
                                company_address: selectedStudentDetail?.company_address || "",
                                company_supervisor: selectedStudentDetail?.company_supervisor || "",
                                company_supervisor_phone: selectedStudentDetail?.company_supervisor_phone || "",
                              });
                            }}
                          >
                            Hủy
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <Label className="text-gray-600">Tên công ty</Label>
                          <p className="font-medium">{selectedStudentDetail?.company_name}</p>
                        </div>
                        {selectedStudentDetail?.internship_position && (
                          <div>
                            <Label className="text-gray-600">Vị trí thực tập</Label>
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            <p className="font-medium">{(selectedStudentDetail as any).internship_position}</p>
                          </div>
                        )}
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {(selectedStudentDetail as any).company_address && (
                          <div>
                            <Label className="text-gray-600">Địa chỉ</Label>
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            <p className="font-medium">{(selectedStudentDetail as any).company_address}</p>
                          </div>
                        )}
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {(selectedStudentDetail as any).company_supervisor && (
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-gray-600">Người giám sát</Label>
                              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                              <p className="font-medium">{(selectedStudentDetail as any).company_supervisor}</p>
                            </div>
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {(selectedStudentDetail as any).company_supervisor_phone && (
                              <div>
                                <Label className="text-gray-600">Số điện thoại</Label>
                                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                <p className="font-medium">{(selectedStudentDetail as any).company_supervisor_phone}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 italic">Sinh viên chưa đăng ký thông tin công ty</p>
                )}
              </div>

              {/* Registration Date */}
              <div className="text-sm text-gray-500">
                <Label className="text-gray-600">Ngày đăng ký</Label>
                <p>{formatDate(selectedStudentDetail.created_at)}</p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowStudentDetailDialog(false);
                setSelectedStudentDetail(null);
                setIsEditingCompany(false);
              }}
            >
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Period Dialog */}
      <Dialog open={showEditPeriodDialog} onOpenChange={setShowEditPeriodDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa Kỳ Thực tập</DialogTitle>
          </DialogHeader>

          {periodForm && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-semester">Học kỳ <span className="text-red-500">*</span></Label>
                  <Input
                    id="edit-semester"
                    value={periodForm.semester}
                    onChange={(e) => setPeriodForm({...periodForm, semester: e.target.value})}
                    placeholder="VD: HK1"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-academic-year">Năm học <span className="text-red-500">*</span></Label>
                  <Input
                    id="edit-academic-year"
                    value={periodForm.academic_year}
                    onChange={(e) => setPeriodForm({...periodForm, academic_year: e.target.value})}
                    placeholder="VD: 2024-2025"
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-registration-start">Ngày mở đăng ký <span className="text-red-500">*</span></Label>
                  <Input
                    id="edit-registration-start"
                    type="date"
                    value={periodForm.registration_start}
                    onChange={(e) => setPeriodForm({...periodForm, registration_start: e.target.value})}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-registration-end">Ngày đóng đăng ký <span className="text-red-500">*</span></Label>
                  <Input
                    id="edit-registration-end"
                    type="date"
                    value={periodForm.registration_end}
                    onChange={(e) => setPeriodForm({...periodForm, registration_end: e.target.value})}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-lecturer-selection-end">Hạn chọn giảng viên <span className="text-red-500">*</span></Label>
                  <Input
                    id="edit-lecturer-selection-end"
                    type="date"
                    value={periodForm.lecturer_selection_end}
                    onChange={(e) => setPeriodForm({...periodForm, lecturer_selection_end: e.target.value})}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-search-deadline">Hạn tìm công ty <span className="text-red-500">*</span></Label>
                  <Input
                    id="edit-search-deadline"
                    type="date"
                    value={periodForm.search_deadline}
                    onChange={(e) => setPeriodForm({...periodForm, search_deadline: e.target.value})}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-start-date">Ngày bắt đầu thực tập <span className="text-red-500">*</span></Label>
                  <Input
                    id="edit-start-date"
                    type="date"
                    value={periodForm.start_date}
                    onChange={(e) => setPeriodForm({...periodForm, start_date: e.target.value})}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-end-date">Ngày kết thúc thực tập <span className="text-red-500">*</span></Label>
                  <Input
                    id="edit-end-date"
                    type="date"
                    value={periodForm.end_date}
                    onChange={(e) => setPeriodForm({...periodForm, end_date: e.target.value})}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="edit-is-active"
                  type="checkbox"
                  checked={periodForm.is_active}
                  onChange={(e) => setPeriodForm({...periodForm, is_active: e.target.checked})}
                  aria-label="Kỳ đang mở đăng ký"
                />
                <Label htmlFor="edit-is-active">Kỳ đang mở đăng ký</Label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowEditPeriodDialog(false);
                setPeriodForm(null);
              }}
            >
              Hủy
            </Button>
            <Button onClick={handleUpdatePeriod}>
              Lưu thay đổi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
