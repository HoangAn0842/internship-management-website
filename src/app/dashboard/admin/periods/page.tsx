"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { MultiSelect } from "@/components/ui/multi-select";
import { toast } from "sonner";
import { Calendar, Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

export default function PeriodsPage() {
  const router = useRouter();
  const [periods, setPeriods] = useState<InternshipPeriod[]>([]);
  const [filteredPeriods, setFilteredPeriods] = useState<InternshipPeriod[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<InternshipPeriod | null>(null);
  
  // Filter states
  const [filterSemester, setFilterSemester] = useState<string>("all");
  const [filterAcademicYear, setFilterAcademicYear] = useState<string>("all");
  const [filterDepartment, setFilterDepartment] = useState<string>("all");
  const [filterCohortYear, setFilterCohortYear] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  
  // Auto-calculate semester and academic year based on current date
  const getDefaultSemesterAndYear = () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    
    let semester = "HK1";
    let academicYear = "";
    
    if (month >= 9 && month <= 12) {
      semester = "HK1";
      academicYear = `${year}-${year + 1}`;
    } else if (month >= 1 && month <= 4) {
      semester = "HK2";
      academicYear = `${year - 1}-${year}`;
    } else {
      semester = "HK3";
      academicYear = `${year - 1}-${year}`;
    }
    
    return { semester, academicYear };
  };
  
  const { semester: defaultSemester, academicYear: defaultAcademicYear } = getDefaultSemesterAndYear();
  
  const [form, setForm] = useState({
    semester: defaultSemester,
    academic_year: defaultAcademicYear,
    registration_start: "",
    registration_end: "",
    lecturer_selection_end: "",
    search_deadline: "",
    start_date: "",
    end_date: "",
    target_departments: [] as string[],
    target_academic_years: [] as string[],
    target_internship_statuses: ["not_started"] as string[],
  });

  // Auto-calculate dates based on registration_start
  const handleRegistrationStartChange = (dateStr: string) => {
    if (!dateStr) {
      setForm({ ...form, registration_start: dateStr });
      return;
    }

    const regStart = new Date(dateStr);
    
    // Registration end: +6 days (1 week)
    const regEnd = new Date(regStart);
    regEnd.setDate(regEnd.getDate() + 6);
    
    // Lecturer selection end: +13 days from reg_start (1 week after reg_end)
    const lecturerEnd = new Date(regStart);
    lecturerEnd.setDate(lecturerEnd.getDate() + 13);
    
    // Start date: +21 days from registration_start
    const startDate = new Date(regStart);
    startDate.setDate(startDate.getDate() + 21);
    
    // Search deadline: start_date + 27 days (4 weeks)
    const searchDeadline = new Date(startDate);
    searchDeadline.setDate(searchDeadline.getDate() + 27);
    
    // End date: start_date + 90 days (13 weeks)
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 90);
    
    setForm({
      ...form,
      registration_start: dateStr,
      registration_end: regEnd.toISOString().split('T')[0],
      lecturer_selection_end: lecturerEnd.toISOString().split('T')[0],
      start_date: startDate.toISOString().split('T')[0],
      search_deadline: searchDeadline.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
    });
  };

  const loadPeriods = async () => {
    const { data, error } = await supabase
      .from("internship_periods")
      .select("*")
      .order("academic_year", { ascending: false })
      .order("semester", { ascending: false });
    
    if (error) {
      toast.error("Lỗi tải danh sách kỳ thực tập");
    } else {
      setPeriods(data || []);
    }
  };

  const applyFilters = () => {
    let filtered = [...periods];

    // Filter by semester
    if (filterSemester !== "all") {
      filtered = filtered.filter(p => p.semester === filterSemester);
    }

    // Filter by academic year
    if (filterAcademicYear !== "all") {
      filtered = filtered.filter(p => p.academic_year === filterAcademicYear);
    }

    // Filter by department
    if (filterDepartment !== "all") {
      filtered = filtered.filter(p => 
        p.target_departments && p.target_departments.includes(filterDepartment)
      );
    }

    // Filter by cohort year
    if (filterCohortYear !== "all") {
      filtered = filtered.filter(p => 
        p.target_academic_years && p.target_academic_years.includes(filterCohortYear)
      );
    }

    // Filter by status
    if (filterStatus !== "all") {
      filtered = filtered.filter(p => 
        filterStatus === "active" ? p.is_active : !p.is_active
      );
    }

    setFilteredPeriods(filtered);
  };

  useEffect(() => {
    void loadPeriods();
  }, []);

  // Apply filters whenever periods or filter values change
  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periods, filterSemester, filterAcademicYear, filterDepartment, filterCohortYear, filterStatus]);

  const handleAdd = async () => {
    if (!form.semester || !form.academic_year || !form.registration_start || 
        !form.registration_end || !form.start_date || !form.end_date ||
        !form.lecturer_selection_end || !form.search_deadline) {
      toast.error("Vui lòng điền đầy đủ thông tin");
      return;
    }
    
    const { error } = await supabase.from("internship_periods").insert({
      semester: form.semester,
      academic_year: form.academic_year,
      registration_start: form.registration_start,
      registration_end: form.registration_end,
      lecturer_selection_end: form.lecturer_selection_end,
      search_deadline: form.search_deadline,
      start_date: form.start_date,
      end_date: form.end_date,
      is_active: false,
      target_departments: form.target_departments.length > 0 ? form.target_departments : null,
      target_academic_years: form.target_academic_years.length > 0 ? form.target_academic_years : null,
      target_internship_statuses: ["not_started"],
    });
    
    if (error) {
      toast.error("Lỗi tạo kỳ thực tập: " + error.message);
    } else {
      toast.success("Tạo kỳ thực tập thành công");
      setShowDialog(false);
      resetForm();
      void loadPeriods();
    }
  };

  const handleUpdate = async () => {
    if (!editingPeriod) return;
    
    if (!form.semester || !form.academic_year || !form.registration_start || 
        !form.registration_end || !form.start_date || !form.end_date ||
        !form.lecturer_selection_end || !form.search_deadline) {
      toast.error("Vui lòng điền đầy đủ thông tin");
      return;
    }
    
    const { error } = await supabase
      .from("internship_periods")
      .update({
        semester: form.semester,
        academic_year: form.academic_year,
        registration_start: form.registration_start,
        registration_end: form.registration_end,
        lecturer_selection_end: form.lecturer_selection_end,
        search_deadline: form.search_deadline,
        start_date: form.start_date,
        end_date: form.end_date,
        target_departments: form.target_departments.length > 0 ? form.target_departments : null,
        target_academic_years: form.target_academic_years.length > 0 ? form.target_academic_years : null,
        target_internship_statuses: ["not_started"],
      })
      .eq("id", editingPeriod.id);
    
    if (error) {
      toast.error("Lỗi cập nhật: " + error.message);
    } else {
      toast.success("Cập nhật thành công");
      setShowDialog(false);
      setEditingPeriod(null);
      resetForm();
      void loadPeriods();
    }
  };

  const handleToggleActive = async (period: InternshipPeriod) => {
    const { error } = await supabase
      .from("internship_periods")
      .update({ is_active: !period.is_active })
      .eq("id", period.id);
    
    if (error) {
      toast.error("Lỗi cập nhật trạng thái");
    } else {
      toast.success(period.is_active ? "Đã đóng kỳ thực tập" : "Đã mở kỳ thực tập");
      void loadPeriods();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Xóa kỳ thực tập này?")) return;
    
    const { error } = await supabase
      .from("internship_periods")
      .delete()
      .eq("id", id);
    
    if (error) {
      toast.error("Lỗi xóa kỳ thực tập");
    } else {
      toast.success("Xóa thành công");
      void loadPeriods();
    }
  };

  const resetForm = () => {
    const { semester, academicYear } = getDefaultSemesterAndYear();
    setForm({
      semester,
      academic_year: academicYear,
      registration_start: "",
      registration_end: "",
      lecturer_selection_end: "",
      search_deadline: "",
      start_date: "",
      end_date: "",
      target_departments: [],
      target_academic_years: [],
      target_internship_statuses: ["not_started"],
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("vi-VN");
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Quản lý Kỳ thực tập</h1>
          <p className="text-gray-500 mt-1">Thiết lập thời gian đăng ký và thực tập cho từng học kỳ</p>
        </div>
        <Button
          onClick={() => {
            setEditingPeriod(null);
            resetForm();
            setShowDialog(true);
          }}
        >
          <Calendar className="w-4 h-4 mr-2" />
          Tạo kỳ thực tập
        </Button>
      </div>

      {/* Filter Section */}
      <div className="bg-white rounded-lg border p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <Label>Học kỳ</Label>
            <Select value={filterSemester} onValueChange={setFilterSemester}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="HK1">HK1</SelectItem>
                <SelectItem value="HK2">HK2</SelectItem>
                <SelectItem value="HK3">HK3</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Năm học</Label>
            <Select value={filterAcademicYear} onValueChange={setFilterAcademicYear}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="2024-2025">2024-2025</SelectItem>
                <SelectItem value="2025-2026">2025-2026</SelectItem>
                <SelectItem value="2026-2027">2026-2027</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Khoa</Label>
            <Select value={filterDepartment} onValueChange={setFilterDepartment}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="Ngoại ngữ">Ngoại ngữ</SelectItem>
                <SelectItem value="Công nghệ Thông tin">Công nghệ Thông tin</SelectItem>
                <SelectItem value="Ngôn ngữ và Văn hóa phương Đông">Ngôn ngữ và Văn hóa phương Đông</SelectItem>
                <SelectItem value="Quản trị kinh doanh">Quản trị kinh doanh</SelectItem>
                <SelectItem value="Quan hệ Quốc tế">Quan hệ Quốc tế</SelectItem>
                <SelectItem value="Du lịch - Khách sạn">Du lịch - Khách sạn</SelectItem>
                <SelectItem value="Kinh tế - Tài chính">Kinh tế - Tài chính</SelectItem>
                <SelectItem value="Luật">Luật</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Niên khóa</Label>
            <Select value={filterCohortYear} onValueChange={setFilterCohortYear}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="2020-2024">2020-2024</SelectItem>
                <SelectItem value="2021-2025">2021-2025</SelectItem>
                <SelectItem value="2022-2026">2022-2026</SelectItem>
                <SelectItem value="2023-2027">2023-2027</SelectItem>
                <SelectItem value="2024-2028">2024-2028</SelectItem>
                <SelectItem value="2025-2029">2025-2029</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Trạng thái</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="active">Đang mở</SelectItem>
                <SelectItem value="inactive">Đã đóng</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Học kỳ</TableHead>
              <TableHead>Năm học</TableHead>
              <TableHead>Tiêu chí SV</TableHead>
              <TableHead>Đăng ký</TableHead>
              <TableHead>Thời gian thực tập</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPeriods.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-500">
                  {filterSemester !== "all" || filterAcademicYear !== "all" || filterDepartment !== "all" || filterCohortYear !== "all" || filterStatus !== "all"
                    ? "Không tìm thấy kỳ thực tập phù hợp" 
                    : "Chưa có kỳ thực tập nào"}
                </TableCell>
              </TableRow>
            ) : (
              filteredPeriods.map((period) => (
                <TableRow key={period.id}>
                  <TableCell className="font-medium">{period.semester}</TableCell>
                  <TableCell>{period.academic_year}</TableCell>
                  <TableCell className="text-sm">
                    {period.target_departments?.length || period.target_academic_years?.length || period.target_internship_statuses?.length ? (
                      <div className="space-y-1">
                        {period.target_departments && period.target_departments.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap">
                            {period.target_departments.map((dept) => (
                              <Badge key={dept} variant="outline" className="text-xs">
                                {dept}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {period.target_academic_years && period.target_academic_years.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap">
                            {period.target_academic_years.map((year) => (
                              <Badge key={year} variant="outline" className="text-xs">
                                {year}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">Tất cả</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(period.registration_start)}<br/>
                    → {formatDate(period.registration_end)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(period.start_date)}<br/>
                    → {formatDate(period.end_date)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={period.is_active ? "default" : "secondary"}>
                      {period.is_active ? "Đang mở" : "Đóng"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/dashboard/admin/periods/${period.id}`)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Chi tiết
                      </Button>
                      <Button
                        variant={period.is_active ? "destructive" : "default"}
                        size="sm"
                        onClick={() => handleToggleActive(period)}
                      >
                        {period.is_active ? "Đóng" : "Mở"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingPeriod(period);
                          setForm({
                            semester: period.semester,
                            academic_year: period.academic_year,
                            registration_start: period.registration_start,
                            registration_end: period.registration_end,
                            lecturer_selection_end: period.lecturer_selection_end,
                            search_deadline: period.search_deadline,
                            start_date: period.start_date,
                            end_date: period.end_date,
                            target_departments: period.target_departments || [],
                            target_academic_years: period.target_academic_years || [],
                            target_internship_statuses: period.target_internship_statuses || [],
                          });
                          setShowDialog(true);
                        }}
                      >
                        Sửa
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(period.id)}
                      >
                        Xóa
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPeriod ? "Cập nhật Kỳ thực tập" : "Tạo Kỳ thực tập mới"}</DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Học kỳ *</Label>
                <select
                  className="w-full border rounded-md p-2"
                  value={form.semester}
                  onChange={(e) => setForm({ ...form, semester: e.target.value })}
                  aria-label="Chọn học kỳ"
                >
                  <option value="HK1">HK1</option>
                  <option value="HK2">HK2</option>
                  <option value="HK3">HK3</option>
                </select>
              </div>
              <div>
                <Label>Năm học *</Label>
                <Input
                  placeholder="VD: 2024-2025"
                  value={form.academic_year}
                  onChange={(e) => setForm({ ...form, academic_year: e.target.value })}
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">Thời gian đăng ký & chọn giảng viên</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Bắt đầu đăng ký *</Label>
                  <Input
                    type="date"
                    value={form.registration_start}
                    onChange={(e) => handleRegistrationStartChange(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Kết thúc đăng ký *</Label>
                  <Input
                    type="date"
                    value={form.registration_end}
                    onChange={(e) => setForm({ ...form, registration_end: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Hạn chọn GV *</Label>
                  <Input
                    type="date"
                    value={form.lecturer_selection_end}
                    onChange={(e) => setForm({ ...form, lecturer_selection_end: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Hạn tìm công ty *</Label>
                  <Input
                    type="date"
                    value={form.search_deadline}
                    onChange={(e) => setForm({ ...form, search_deadline: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">Thời gian thực tập</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Ngày bắt đầu *</Label>
                  <Input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Ngày kết thúc *</Label>
                  <Input
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">Tiêu chí sinh viên đủ điều kiện (tùy chọn)</h3>
              <div className="space-y-3">
                <div>
                  <Label>Khoa</Label>
                  <MultiSelect
                    options={[
                      { value: "Ngoại ngữ", label: "Ngoại ngữ" },
                      { value: "Công nghệ Thông tin", label: "Công nghệ Thông tin" },
                      { value: "Ngôn ngữ và Văn hóa phương Đông", label: "Ngôn ngữ và Văn hóa phương Đông" },
                      { value: "Quản trị kinh doanh", label: "Quản trị kinh doanh" },
                      { value: "Quan hệ Quốc tế", label: "Quan hệ Quốc tế" },
                      { value: "Du lịch - Khách sạn", label: "Du lịch - Khách sạn" },
                      { value: "Kinh tế - Tài chính", label: "Kinh tế - Tài chính" },
                      { value: "Luật", label: "Luật" },
                    ]}
                    selected={form.target_departments}
                    onChange={(values) => setForm({ ...form, target_departments: values })}
                    placeholder="Chọn khoa (để trống = tất cả)"
                  />
                </div>
                <div>
                  <Label>Niên khóa</Label>
                  <MultiSelect
                    options={[
                      { value: "2020-2024", label: "2020-2024" },
                      { value: "2021-2025", label: "2021-2025" },
                      { value: "2022-2026", label: "2022-2026" },
                      { value: "2023-2027", label: "2023-2027" },
                      { value: "2024-2028", label: "2024-2028" },
                      { value: "2025-2029", label: "2025-2029" },
                    ]}
                    selected={form.target_academic_years}
                    onChange={(values) => setForm({ ...form, target_academic_years: values })}
                    placeholder="Chọn niên khóa (để trống = tất cả)"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Hủy
            </Button>
            <Button onClick={editingPeriod ? handleUpdate : handleAdd}>
              {editingPeriod ? "Cập nhật" : "Tạo mới"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
