"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Eye, EyeOff, Upload, FileSpreadsheet, Users } from "lucide-react";
import * as XLSX from 'xlsx';

// Constants for departments and academic years
const DEPARTMENTS = [
  "Ngoại ngữ",
  "Công nghệ Thông tin",
  "Ngôn ngữ và Văn hóa phương Đông",
  "Quản trị kinh doanh",
  "Quan hệ Quốc tế",
  "Du lịch - Khách sạn",
  "Kinh tế - Tài chính",
  "Luật",
] as const;

const ACADEMIC_YEARS = [
  "2020-2024",
  "2021-2025",
  "2022-2026",
  "2023-2027",
  "2024-2028",
  "2025-2029",
] as const;

type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  student_id?: string;
  department?: string;
  academic_year?: string;
  internship_status?: string;
};

type BulkStudent = {
  email: string;
  password: string;
  full_name: string;
  student_id: string;
  department: string;
  academic_year: string;
};

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String(err.message);
  }
  return 'Unknown error';
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Profile[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Profile[]>([]);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [studentDepartmentFilter, setStudentDepartmentFilter] = useState('all');
  const [studentAcademicYearFilter, setStudentAcademicYearFilter] = useState('all');
  const [studentInternshipStatusFilter, setStudentInternshipStatusFilter] = useState('all');
  const [showStudentDialog, setShowStudentDialog] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Profile | null>(null);
  const [studentForm, setStudentForm] = useState({
    email: "",
    password: "",
    full_name: "",
    student_id: "",
    department: "",
    academic_year: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [bulkStudents, setBulkStudents] = useState<BulkStudent[]>([]);
  const [bulkMode, setBulkMode] = useState<'manual' | 'excel'>('manual');
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "student")
      .order("student_id", { ascending: true });
    if (error) {
      toast.error("Lỗi tải danh sách sinh viên");
    } else {
      setStudents(data || []);
      setFilteredStudents(data || []);
    }
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

        const students: BulkStudent[] = data.map((row) => ({
          email: String(row['Email'] || '').trim(),
          password: String(row['Mật khẩu'] || row['Password'] || '').trim(),
          full_name: String(row['Họ tên'] || row['Full Name'] || '').trim(),
          student_id: String(row['MSSV'] || row['Student ID'] || '').trim(),
          department: String(row['Khoa'] || row['Department'] || '').trim(),
          academic_year: String(row['Niên khóa'] || row['Academic Year'] || '').trim(),
        }));

        setBulkStudents(students);
        toast.success(`Đã đọc ${students.length} sinh viên từ file Excel`);
      } catch (error) {
        toast.error("Lỗi đọc file Excel: " + getErrorMessage(error));
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleBulkImport = async () => {
    if (bulkStudents.length === 0) {
      toast.error("Không có sinh viên nào để nhập");
      return;
    }

    setIsImporting(true);
    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (const student of bulkStudents) {
      try {
        const response = await fetch('/api/admin/students', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(student),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Lỗi tạo sinh viên');
        }
        successCount++;
      } catch (error) {
        failCount++;
        errors.push(`${student.student_id}: ${getErrorMessage(error)}`);
      }
    }

    setIsImporting(false);
    
    if (successCount > 0) {
      toast.success(`Đã thêm thành công ${successCount} sinh viên`);
      loadStudents();
    }
    
    if (failCount > 0) {
      toast.error(`${failCount} sinh viên thất bại:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? '\n...' : ''}`);
    }

    setShowBulkDialog(false);
    setBulkStudents([]);
  };

  const addManualBulkStudent = () => {
    setBulkStudents([...bulkStudents, {
      email: '',
      password: '',
      full_name: '',
      student_id: '',
      department: '',
      academic_year: '',
    }]);
  };

  const removeManualBulkStudent = (index: number) => {
    setBulkStudents(bulkStudents.filter((_, i) => i !== index));
  };

  const updateManualBulkStudent = (index: number, field: keyof BulkStudent, value: string) => {
    const updated = [...bulkStudents];
    updated[index] = { ...updated[index], [field]: value };
    setBulkStudents(updated);
  };

  const downloadExcelTemplate = () => {
    const template = [
      {
        'Email': 'sinhvien1@example.com',
        'Mật khẩu': 'password123',
        'Họ tên': 'Nguyễn Văn A',
        'MSSV': '22DH123456',
        'Khoa': 'Công nghệ Thông tin',
        'Niên khóa': '2022-2026',
      },
      {
        'Email': 'sinhvien2@example.com',
        'Mật khẩu': 'password456',
        'Họ tên': 'Trần Thị B',
        'MSSV': '22DH123457',
        'Khoa': 'Khoa học Máy tính',
        'Niên khóa': '2022-2026',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sinh viên');
    XLSX.writeFile(wb, 'Mau_Danh_Sach_Sinh_Vien.xlsx');
  };

  const handleAddStudent = async () => {
    // Basic validation - backend sẽ validate chi tiết
    if (!studentForm.email || !studentForm.password || !studentForm.full_name || !studentForm.student_id || !studentForm.department || !studentForm.academic_year) {
      toast.error("Vui lòng điền đầy đủ thông tin bắt buộc");
      return;
    }
    
    try {
      const response = await fetch('/api/admin/students', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: studentForm.email,
          password: studentForm.password,
          full_name: studentForm.full_name,
          student_id: studentForm.student_id,
          department: studentForm.department,
          academic_year: studentForm.academic_year,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Lỗi tạo sinh viên');
      }

      toast.success("Thêm sinh viên thành công");
      setShowStudentDialog(false);
      setStudentForm({ email: "", password: "", full_name: "", student_id: "", department: "", academic_year: "" });
      loadStudents();
    } catch (err) {
      toast.error("Lỗi thêm sinh viên: " + getErrorMessage(err));
    }
  };

  const handleUpdateStudent = async () => {
    if (!editingStudent) return;
    
    try {
      const response = await fetch('/api/admin/students', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: editingStudent.id,
          full_name: studentForm.full_name,
          student_id: studentForm.student_id,
          department: studentForm.department,
          academic_year: studentForm.academic_year,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update student');
      }

      toast.success("Cập nhật sinh viên thành công");
      setShowStudentDialog(false);
      setEditingStudent(null);
      setStudentForm({ email: "", password: "", full_name: "", student_id: "", department: "", academic_year: "" });
      loadStudents();
    } catch (err) {
      toast.error("Lỗi cập nhật sinh viên: " + getErrorMessage(err));
    }
  };

  const handleDeleteStudent = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa sinh viên này?")) return;
    
    try {
      const response = await fetch(`/api/admin/students?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete student');
      }
      
      setStudents((prev) => prev.filter((s) => s.id !== id));
      toast.success("Xóa sinh viên thành công");
    } catch (err) {
      toast.error("Lỗi xóa sinh viên: " + getErrorMessage(err));
    }
  };

  useEffect(() => {
    let result = students;
    if (studentDepartmentFilter !== 'all') {
      result = result.filter((s) => s.department === studentDepartmentFilter);
    }
    if (studentAcademicYearFilter !== 'all') {
      result = result.filter((s) => s.academic_year === studentAcademicYearFilter);
    }
    if (studentInternshipStatusFilter !== 'all') {
      result = result.filter((s) => s.internship_status === studentInternshipStatusFilter);
    }
    if (studentSearchQuery) {
      const query = studentSearchQuery.toLowerCase();
      result = result.filter((s) =>
        s.student_id?.toLowerCase().includes(query) ||
        s.full_name.toLowerCase().includes(query) ||
        s.email.toLowerCase().includes(query)
      );
    }
    setFilteredStudents(result);
  }, [students, studentSearchQuery, studentDepartmentFilter, studentAcademicYearFilter, studentInternshipStatusFilter]);

  const studentDepartments = Array.from(new Set(students.map(s => s.department).filter(Boolean)));
  const studentAcademicYears = Array.from(new Set(students.map(s => s.academic_year).filter(Boolean)));
  //const studentInternshipStatuses = Array.from(new Set(students.map(s => s.internship_status).filter(Boolean)));

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Quản lý Sinh viên</h1>
          <p className="text-gray-500 mt-1">Thêm, sửa, xóa thông tin sinh viên</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setBulkMode('manual');
              setBulkStudents([]);
              setShowBulkDialog(true);
            }}
          >
            <Users className="h-4 w-4 mr-2" />
            Thêm sinh viên
          </Button>
        </div>
      </div>

      <div className="space-y-4 mb-6">
        <Input
          placeholder="Tìm kiếm theo MSSV, tên, email..."
          value={studentSearchQuery}
          onChange={(e) => setStudentSearchQuery(e.target.value)}
          className="max-w-md"
        />
        <div className="flex gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Label htmlFor="student-department-filter">Khoa:</Label>
            <select
              id="student-department-filter"
              value={studentDepartmentFilter}
              onChange={(e) => setStudentDepartmentFilter(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2"
              aria-label="Lọc theo khoa"
            >
              <option value="all">Tất cả</option>
              {studentDepartments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="student-academic-year-filter">Niên khóa:</Label>
            <select
              id="student-academic-year-filter"
              value={studentAcademicYearFilter}
              onChange={(e) => setStudentAcademicYearFilter(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2"
              aria-label="Lọc theo niên khóa"
            >
              <option value="all">Tất cả</option>
              {studentAcademicYears.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="student-status-filter">Trạng thái TT:</Label>
            <select
              id="student-status-filter"
              value={studentInternshipStatusFilter}
              onChange={(e) => setStudentInternshipStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2"
              aria-label="Lọc theo trạng thái thực tập"
            >
              <option value="all">Tất cả</option>
              <option value="not_started">Chưa thực tập</option>
              <option value="in_progress">Đang thực tập</option>
              <option value="completed">Đã hoàn thành</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>MSSV</TableHead>
              <TableHead>Họ tên</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Khoa</TableHead>
              <TableHead>Niên khoá</TableHead>
              <TableHead>Trạng thái TT</TableHead>
              <TableHead>Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStudents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-500">
                  Không có sinh viên nào
                </TableCell>
              </TableRow>
            ) : (
              filteredStudents.map((student) => (
                <TableRow key={student.id}>
                  <TableCell>{student.student_id}</TableCell>
                  <TableCell>{student.full_name}</TableCell>
                  <TableCell>{student.email}</TableCell>
                  <TableCell>{student.department}</TableCell>
                  <TableCell>{student.academic_year || <span className="text-gray-400">Chưa cập nhật</span>}</TableCell>
                  <TableCell>
                    {student.internship_status === 'completed' && <span className="text-green-600 font-medium">Hoàn thành</span>}
                    {student.internship_status === 'in_progress' && <span className="text-blue-600 font-medium">Đang thực tập</span>}
                    {student.internship_status === 'approved' && <span className="text-blue-500 font-medium">Đã duyệt</span>}
                    {student.internship_status === 'company_submitted' && <span className="text-indigo-600 font-medium">Đã có công ty</span>}
                    {student.internship_status === 'searching' && <span className="text-yellow-600">Đang tìm công ty</span>}
                    {student.internship_status === 'registered' && <span className="text-gray-600">Đã đăng ký</span>}
                    {student.internship_status === 'pending_approval' && <span className="text-orange-600">Chờ duyệt</span>}
                    {student.internship_status === 'waiting_lecturer' && <span className="text-purple-600">Chờ giảng viên</span>}
                    {student.internship_status === 'lecturer_confirmed' && <span className="text-teal-600">GV đã xác nhận</span>}
                    {student.internship_status === 'rejected' && <span className="text-red-600 font-medium">Từ chối</span>}
                    {student.internship_status === 'assigned_to_project' && <span className="text-cyan-600">Được phân công</span>}
                    {student.internship_status === 'not_started' && <span className="text-gray-500">Chưa bắt đầu</span>}
                    {!student.internship_status && <span className="text-gray-400">-</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingStudent(student);
                          setStudentForm({
                            email: student.email,
                            password: "",
                            full_name: student.full_name,
                            student_id: student.student_id || "",
                            department: student.department || "",
                            academic_year: student.academic_year || "",
                          });
                          setShowStudentDialog(true);
                        }}
                      >
                        Sửa
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteStudent(student.id)}
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

      {/* Student Dialog */}
      <Dialog open={showStudentDialog} onOpenChange={setShowStudentDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingStudent ? "Sửa Sinh viên" : "Thêm Sinh viên"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email<span className="text-red-500">*</span></Label>
              <Input
                id="email"
                type="email"
                value={studentForm.email}
                onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                disabled={!!editingStudent}
              />
            </div>
            {!editingStudent && (
              <div>
                <Label htmlFor="password">Mật khẩu<span className="text-red-500">*</span></Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={studentForm.password}
                    onChange={(e) => setStudentForm({ ...studentForm, password: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            )}
            <div>
              <Label htmlFor="full_name">Họ tên<span className="text-red-500">*</span></Label>
              <Input
                id="full_name"
                value={studentForm.full_name}
                onChange={(e) => setStudentForm({ ...studentForm, full_name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="student_id">MSSV<span className="text-red-500">*</span></Label>
              <Input
                id="student_id"
                value={studentForm.student_id}
                onChange={(e) => setStudentForm({ ...studentForm, student_id: e.target.value })}
                placeholder="VD: 22DH123456"
              />
            </div>
            <div>
              <Label htmlFor="academic_year">Niên khoá<span className="text-red-500">*</span></Label>
              <Select
                value={studentForm.academic_year}
                onValueChange={(value) => setStudentForm({ ...studentForm, academic_year: value })}
              >
                <SelectTrigger id="academic_year">
                  <SelectValue placeholder="Chọn niên khoá" />
                </SelectTrigger>
                <SelectContent>
                  {ACADEMIC_YEARS.map((year) => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="department">Khoa<span className="text-red-500">*</span></Label>
              <Select
                value={studentForm.department}
                onValueChange={(value) => setStudentForm({ ...studentForm, department: value })}
              >
                <SelectTrigger id="department">
                  <SelectValue placeholder="Chọn khoa" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((dept) => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStudentDialog(false)}>
              Hủy
            </Button>
            <Button onClick={editingStudent ? handleUpdateStudent : handleAddStudent}>
              {editingStudent ? "Cập nhật" : "Thêm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Import Dialog */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Thêm nhiều sinh viên</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex gap-2 border-b pb-4">
              <Button
                variant={bulkMode === 'manual' ? 'default' : 'outline'}
                onClick={() => {
                  setBulkMode('manual');
                  setBulkStudents([]);
                }}
              >
                Nhập thủ công
              </Button>
              <Button
                variant={bulkMode === 'excel' ? 'default' : 'outline'}
                onClick={() => setBulkMode('excel')}
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Nhập từ Excel
              </Button>
            </div>

            {bulkMode === 'excel' ? (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label htmlFor="excel-upload">Chọn file Excel</Label>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={downloadExcelTemplate}
                      className="text-blue-600"
                    >
                      <Upload className="h-4 w-4 mr-1" />
                      Tải file mẫu
                    </Button>
                  </div>
                  <Input
                    id="excel-upload"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleExcelUpload}
                    className="mt-2"
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    File Excel cần có các cột: Email, Mật khẩu, Họ tên, MSSV, Khoa, Niên khóa
                  </p>
                </div>

                {bulkStudents.length > 0 && (
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-2">Xem trước ({bulkStudents.length} sinh viên)</h3>
                    <div className="max-h-60 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>MSSV</TableHead>
                            <TableHead>Họ tên</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Khoa</TableHead>
                            <TableHead>Niên khóa</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bulkStudents.slice(0, 10).map((student, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{student.student_id}</TableCell>
                              <TableCell>{student.full_name}</TableCell>
                              <TableCell>{student.email}</TableCell>
                              <TableCell>{student.department}</TableCell>
                              <TableCell>{student.academic_year}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {bulkStudents.length > 10 && (
                        <p className="text-sm text-gray-500 mt-2 text-center">
                          ... và {bulkStudents.length - 10} sinh viên khác
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <Button onClick={addManualBulkStudent} variant="outline" size="sm">
                  + Thêm sinh viên
                </Button>

                {bulkStudents.map((student, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3 relative">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => removeManualBulkStudent(index)}
                    >
                      ✕
                    </Button>
                    <h4 className="font-medium">Sinh viên {index + 1}</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Email</Label>
                        <Input
                          value={student.email}
                          onChange={(e) => updateManualBulkStudent(index, 'email', e.target.value)}
                          placeholder="email@example.com"
                        />
                      </div>
                      <div>
                        <Label>Mật khẩu</Label>
                        <Input
                          type="password"
                          value={student.password}
                          onChange={(e) => updateManualBulkStudent(index, 'password', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Họ tên</Label>
                        <Input
                          value={student.full_name}
                          onChange={(e) => updateManualBulkStudent(index, 'full_name', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>MSSV</Label>
                        <Input
                          value={student.student_id}
                          onChange={(e) => updateManualBulkStudent(index, 'student_id', e.target.value)}
                          placeholder="22DH123456"
                        />
                      </div>
                      <div>
                        <Label>Khoa</Label>
                        <Select
                          value={student.department}
                          onValueChange={(value) => updateManualBulkStudent(index, 'department', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Chọn khoa" />
                          </SelectTrigger>
                          <SelectContent>
                            {DEPARTMENTS.map((dept) => (
                              <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Niên khóa</Label>
                        <Select
                          value={student.academic_year}
                          onValueChange={(value) => updateManualBulkStudent(index, 'academic_year', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Chọn niên khóa" />
                          </SelectTrigger>
                          <SelectContent>
                            {ACADEMIC_YEARS.map((year) => (
                              <SelectItem key={year} value={year}>{year}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}

                {bulkStudents.length === 0 && (
                  <p className="text-center text-gray-500 py-8">
                    Chưa có sinh viên nào. Nhấn &ldquo;Thêm sinh viên&rdquo; để bắt đầu.
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowBulkDialog(false);
              setBulkStudents([]);
            }}>
              Hủy
            </Button>
            <Button 
              onClick={handleBulkImport}
              disabled={bulkStudents.length === 0 || isImporting}
            >
              {isImporting ? 'Đang nhập...' : `Nhập ${bulkStudents.length} sinh viên`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
