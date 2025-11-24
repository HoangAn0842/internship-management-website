import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// POST: Auto-assign lecturers to students who haven't chosen yet
// This should be called after lecturer_selection_end deadline
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

    // Get all students who registered but haven't been assigned a lecturer yet
    const { data: unassignedStudents, error: studentsError } = await supabase
      .from("student_registrations")
      .select("id, student_id, profiles!student_registrations_student_id_fkey(department)")
      .eq("period_id", periodId)
      .eq("status", "registered")
      .is("assigned_lecturer_id", null);

    if (studentsError) throw studentsError;

    if (!unassignedStudents || unassignedStudents.length === 0) {
      return NextResponse.json({ 
        message: "No unassigned students found",
        assigned: 0 
      });
    }

    // Get available lecturers with slots for this period
    const { data: availableLecturers, error: lecturersError } = await supabase
      .from("lecturer_availability")
      .select("*")
      .eq("period_id", periodId)
      .gt("slots_remaining", 0);

    if (lecturersError) throw lecturersError;

    if (!availableLecturers || availableLecturers.length === 0) {
      return NextResponse.json({ 
        error: "No available lecturers with remaining slots",
        assigned: 0 
      }, { status: 400 });
    }

    // Group lecturers by department
    const lecturersByDept = availableLecturers.reduce((acc, lec) => {
      if (!acc[lec.lecturer_department]) {
        acc[lec.lecturer_department] = [];
      }
      acc[lec.lecturer_department].push(lec);
      return acc;
    }, {} as Record<string, typeof availableLecturers>);

    let assignedCount = 0;
    const assignments: Array<{ id: string; assigned_lecturer_id: string; status: string }> = [];

    // Assign students to lecturers in their department
    for (const student of unassignedStudents) {
      // @ts-expect-error - profiles is joined
      const studentDept = student.profiles?.department;
      
      if (!studentDept || !lecturersByDept[studentDept]) {
        console.log(`No available lecturer for student ${student.student_id} in dept ${studentDept}`);
        continue;
      }

      // Get lecturers in student's department with available slots, sorted by slots remaining (descending)
      const deptLecturers = lecturersByDept[studentDept]
        .filter((l: { slots_remaining: number }) => l.slots_remaining > 0)
        .sort((a: { slots_remaining: number }, b: { slots_remaining: number }) => b.slots_remaining - a.slots_remaining);

      if (deptLecturers.length === 0) {
        console.log(`No available slots for student ${student.student_id} in dept ${studentDept}`);
        continue;
      }

      // Assign to lecturer with most remaining slots (for load balancing)
      const assignedLecturer = deptLecturers[0];
      
      assignments.push({
        id: student.id,
        assigned_lecturer_id: assignedLecturer.lecturer_id,
        status: 'lecturer_confirmed'
      });

      // Decrement available slots
      assignedLecturer.slots_remaining--;
      assignedCount++;
    }

    // Batch update all assignments
    if (assignments.length > 0) {
      for (const assignment of assignments) {
        const { error: updateError } = await supabase
          .from("student_registrations")
          .update({
            assigned_lecturer_id: assignment.assigned_lecturer_id,
            status: assignment.status
          })
          .eq("id", assignment.id);

        if (updateError) {
          console.error(`Failed to assign student ${assignment.id}:`, updateError);
        }
      }
    }

    return NextResponse.json({
      message: `Successfully assigned ${assignedCount} students`,
      assigned: assignedCount,
      total_unassigned: unassignedStudents.length
    });

  } catch (error) {
    console.error("Error auto-assigning lecturers:", error);
    return NextResponse.json(
      { error: "Failed to auto-assign lecturers" },
      { status: 500 }
    );
  }
}
