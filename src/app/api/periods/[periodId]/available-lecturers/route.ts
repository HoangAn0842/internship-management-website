import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// GET: Lấy danh sách giảng viên cùng khoa với slot còn lại
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ periodId: string }> }
) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get student profile to know department
    const { data: studentProfile } = await supabase
      .from("profiles")
      .select("department, role")
      .eq("id", user.id)
      .single();

    if (!studentProfile || studentProfile.role !== "student") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { periodId } = await params;

    // Get available lecturers in this period with same department
    const { data, error } = await supabase
      .from("lecturer_availability")
      .select("*")
      .eq("period_id", periodId)
      .eq("lecturer_department", studentProfile.department)
      .order("slots_remaining", { ascending: false });

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("Error fetching available lecturers:", error);
    return NextResponse.json(
      { error: "Failed to fetch available lecturers" },
      { status: 500 }
    );
  }
}
