"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  student_id?: string;
  department?: string;
};

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String(err.message);
  }
  return 'Unknown error';
}

export default function LecturersPage() {
  const [lecturers, setLecturers] = useState<Profile[]>([]);
  const [filteredLecturers, setFilteredLecturers] = useState<Profile[]>([]);
  const [lecturerSearchQuery, setLecturerSearchQuery] = useState('');
  const [lecturerDepartmentFilter, setLecturerDepartmentFilter] = useState('all');
  const [showLecturerDialog, setShowLecturerDialog] = useState(false);
  const [editingLecturer, setEditingLecturer] = useState<Profile | null>(null);
  const [lecturerForm, setLecturerForm] = useState({
    email: "",
    password: "",
    full_name: "",
    department: "",
  });
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    loadLecturers();
  }, []);

  const loadLecturers = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "lecturer")
      .order("full_name", { ascending: true });
    if (error) {
      toast.error("Lỗi tải danh sách giảng viên");
    } else {
      setLecturers(data || []);
      setFilteredLecturers(data || []);
    }
  };

  const handleAddLecturer = async () => {
    if (!lecturerForm.email || !lecturerForm.password || !lecturerForm.full_name || !lecturerForm.department) {
      toast.error("Vui lòng điền đầy đủ thông tin");
      return;
    }
    try {
      const response = await fetch('/api/admin/lecturers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: lecturerForm.email,
          password: lecturerForm.password,
          full_name: lecturerForm.full_name,
          department: lecturerForm.department,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create lecturer');
      }

      toast.success("Thêm giảng viên thành công");
      setShowLecturerDialog(false);
      setLecturerForm({ email: "", password: "", full_name: "", department: "" });
      loadLecturers();
    } catch (err) {
      toast.error("Lỗi thêm giảng viên: " + getErrorMessage(err));
    }
  };

  const handleUpdateLecturer = async () => {
    if (!editingLecturer) return;
    
    try {
      const response = await fetch('/api/admin/lecturers', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: editingLecturer.id,
          full_name: lecturerForm.full_name,
          department: lecturerForm.department,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update lecturer');
      }

      toast.success("Cập nhật giảng viên thành công");
      setShowLecturerDialog(false);
      setEditingLecturer(null);
      setLecturerForm({ email: "", password: "", full_name: "", department: "" });
      loadLecturers();
    } catch (err) {
      toast.error("Lỗi cập nhật giảng viên: " + getErrorMessage(err));
    }
  };

  const handleDeleteLecturer = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa giảng viên này?")) return;
    
    try {
      const response = await fetch(`/api/admin/lecturers?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete lecturer');
      }
      
      setLecturers((prev) => prev.filter((l) => l.id !== id));
      toast.success("Xóa giảng viên thành công");
    } catch (err) {
      toast.error("Lỗi xóa giảng viên: " + getErrorMessage(err));
    }
  };

  useEffect(() => {
    let result = lecturers;
    if (lecturerDepartmentFilter !== 'all') {
      result = result.filter((l) => l.department === lecturerDepartmentFilter);
    }
    if (lecturerSearchQuery) {
      const query = lecturerSearchQuery.toLowerCase();
      result = result.filter((l) =>
        l.full_name.toLowerCase().includes(query) ||
        l.email.toLowerCase().includes(query)
      );
    }
    setFilteredLecturers(result);
  }, [lecturers, lecturerSearchQuery, lecturerDepartmentFilter]);

  const lecturerDepartments = Array.from(new Set(lecturers.map(l => l.department).filter(Boolean)));

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Quản lý Giảng viên</h1>
          <p className="text-gray-500 mt-1">Thêm, sửa, xóa thông tin giảng viên</p>
        </div>
        <Button
          onClick={() => {
            setEditingLecturer(null);
            setLecturerForm({ email: "", password: "", full_name: "", department: "" });
            setShowLecturerDialog(true);
          }}
        >
          Thêm Giảng viên
        </Button>
      </div>

      <div className="flex gap-4 mb-6">
        <Input
          placeholder="Tìm kiếm theo tên, email..."
          value={lecturerSearchQuery}
          onChange={(e) => setLecturerSearchQuery(e.target.value)}
          className="max-w-md"
        />
        <div className="flex items-center gap-2">
          <Label htmlFor="lecturer-department-filter">Khoa:</Label>
          <select
            id="lecturer-department-filter"
            value={lecturerDepartmentFilter}
            onChange={(e) => setLecturerDepartmentFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2"
            aria-label="Lọc theo khoa"
          >
            <option value="all">Tất cả</option>
            {lecturerDepartments.map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Họ tên</TableHead>
              <TableHead>Mail</TableHead>
              <TableHead>Khoa</TableHead>
              <TableHead>Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLecturers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-gray-500">
                  Không tìm thấy giảng viên nào
                </TableCell>
              </TableRow>
            ) : (
              filteredLecturers.map((lecturer) => (
                <TableRow key={lecturer.id}>
                  <TableCell>{lecturer.full_name}</TableCell>
                  <TableCell>{lecturer.email}</TableCell>
                  <TableCell>{lecturer.department}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingLecturer(lecturer);
                          setLecturerForm({
                            email: lecturer.email,
                            password: "",
                            full_name: lecturer.full_name,
                            department: lecturer.department || "",
                          });
                          setShowLecturerDialog(true);
                        }}
                      >
                        Sửa
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteLecturer(lecturer.id)}
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

      {/* Lecturer Dialog */}
      <Dialog open={showLecturerDialog} onOpenChange={setShowLecturerDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLecturer ? "Sửa Giảng viên" : "Thêm Giảng viên"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={lecturerForm.email}
                onChange={(e) => setLecturerForm({ ...lecturerForm, email: e.target.value })}
                disabled={!!editingLecturer}
              />
            </div>
            {!editingLecturer && (
              <div>
                <Label htmlFor="password">Mật khẩu</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={lecturerForm.password}
                    onChange={(e) => setLecturerForm({ ...lecturerForm, password: e.target.value })}
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
              <Label htmlFor="full_name">Họ tên</Label>
              <Input
                id="full_name"
                value={lecturerForm.full_name}
                onChange={(e) => setLecturerForm({ ...lecturerForm, full_name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="department">Khoa</Label>
              <Input
                id="department"
                value={lecturerForm.department}
                onChange={(e) => setLecturerForm({ ...lecturerForm, department: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLecturerDialog(false)}>
              Hủy
            </Button>
            <Button onClick={editingLecturer ? handleUpdateLecturer : handleAddLecturer}>
              {editingLecturer ? "Cập nhật" : "Thêm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
