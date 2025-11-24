import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// GET: Lấy danh sách giảng viên trong kỳ thực tập
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ periodId: string }> }
) {
  try {
    const supabase = await createClient();

    // Verify admin
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { periodId } = await params;

    // Get lecturers in this period with availability info
    const { data, error } = await supabase
      .from("lecturer_availability")
      .select("*")
      .eq("period_id", periodId)
      .order("lecturer_name");

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("Error fetching period lecturers:", error);
    return NextResponse.json(
      { error: "Failed to fetch lecturers" },
      { status: 500 }
    );
  }
}

// POST: Thêm giảng viên vào kỳ thực tập
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ periodId: string }> }
) {
  try {
    const supabase = await createClient();

    // Verify admin
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { periodId } = await params;
    const body = await request.json();
    const { lecturer_ids, max_students = 20 } = body;

    if (!lecturer_ids || !Array.isArray(lecturer_ids)) {
      return NextResponse.json(
        { error: "lecturer_ids array is required" },
        { status: 400 }
      );
    }

    // Insert multiple lecturers
    const records = lecturer_ids.map((lecturer_id) => ({
      period_id: periodId,
      lecturer_id,
      max_students,
    }));

    const { data, error } = await supabase
      .from("period_lecturers")
      .insert(records)
      .select();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error adding lecturers to period:", error);
    return NextResponse.json(
      { error: "Failed to add lecturers" },
      { status: 500 }
    );
  }
}

// DELETE: Xóa giảng viên khỏi kỳ thực tập
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ periodId: string }> }
) {
  try {
    const supabase = await createClient();

    // Verify admin
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const lecturerId = searchParams.get("lecturer_id");

    if (!lecturerId) {
      return NextResponse.json(
        { error: "lecturer_id is required" },
        { status: 400 }
      );
    }

    const { periodId } = await params;

    const { error } = await supabase
      .from("period_lecturers")
      .delete()
      .eq("period_id", periodId)
      .eq("lecturer_id", lecturerId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing lecturer from period:", error);
    return NextResponse.json(
      { error: "Failed to remove lecturer" },
      { status: 500 }
    );
  }
}
