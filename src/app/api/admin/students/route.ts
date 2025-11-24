import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase-server';

export async function POST(request: Request) {
  try {
    // Verify user is authenticated and is admin
    const supabase = await createClient();
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (!user || userError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { email, password, full_name, student_id, department, academic_year } = body;

    // Validate required fields
    if (!email || !password || !full_name || !student_id || !department || !academic_year) {
      return NextResponse.json(
        { error: 'Vui lòng điền đầy đủ thông tin bắt buộc' },
        { status: 400 }
      );
    }

    // Validate student_id format
    if (!/^\d{2}DH\d{6}$/.test(student_id)) {
      return NextResponse.json(
        { error: 'MSSV không đúng định dạng xxDHxxxxxx (ví dụ: 22DH123456)' },
        { status: 400 }
      );
    }

    // Validate academic_year format
    if (!/^\d{4}-\d{4}$/.test(academic_year)) {
      return NextResponse.json(
        { error: 'Niên khoá không đúng định dạng yyyy-yyyy (ví dụ: 2022-2026)' },
        { status: 400 }
      );
    }

    // Validate academic_year duration (must be 4 years)
    const [startYear, endYear] = academic_year.split('-').map(Number);
    if (endYear - startYear !== 4) {
      return NextResponse.json(
        { error: 'Niên khoá không hợp lệ: năm kết thúc phải lớn hơn năm bắt đầu đúng 4 năm' },
        { status: 400 }
      );
    }

    // Validate student_id prefix matches academic_year
    const yearPrefix = String(startYear).slice(-2);
    const studentPrefix = student_id.slice(0, 2);
    if (yearPrefix !== studentPrefix) {
      return NextResponse.json(
        { error: `MSSV không khớp với niên khoá: 2 số đầu của MSSV (${studentPrefix}) phải là ${yearPrefix}` },
        { status: 400 }
      );
    }

    // Check if student_id already exists
    const adminClient = createAdminClient();
    const { data: existingStudent } = await adminClient
      .from('profiles')
      .select('student_id')
      .eq('student_id', student_id)
      .eq('role', 'student')
      .maybeSingle();

    if (existingStudent) {
      return NextResponse.json(
        { error: `MSSV ${student_id} đã tồn tại trong hệ thống` },
        { status: 400 }
      );
    }

    // Check if email already exists
    const { data: existingEmail } = await adminClient
      .from('profiles')
      .select('email')
      .eq('email', email)
      .maybeSingle();

    if (existingEmail) {
      return NextResponse.json(
        { error: `Email ${email} đã được sử dụng` },
        { status: 400 }
      );
    }
    
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        role: 'student',
      },
    });

    if (authError) {
      console.error('Error creating student:', authError);
      // Parse auth errors
      if (authError.message.includes('already registered')) {
        return NextResponse.json({ error: `Email ${email} đã được sử dụng` }, { status: 400 });
      }
      return NextResponse.json({ error: `Lỗi tạo tài khoản: ${authError.message}` }, { status: 500 });
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'Không thể tạo tài khoản sinh viên' }, { status: 500 });
    }

    // Update profile with student_id, department, and academic_year
    const { error: profileError } = await adminClient
      .from('profiles')
      .update({
        student_id,
        department,
        academic_year,
      })
      .eq('id', authData.user.id);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      
      // Rollback: Delete the created user
      await adminClient.auth.admin.deleteUser(authData.user.id);
      
      // Parse profile errors
      if (profileError.message.includes('duplicate key')) {
        if (profileError.message.includes('student_id')) {
          return NextResponse.json({ error: `MSSV ${student_id} đã tồn tại trong hệ thống` }, { status: 400 });
        }
        return NextResponse.json({ error: 'Dữ liệu bị trùng lặp' }, { status: 400 });
      }
      if (profileError.message.includes('violates check constraint')) {
        if (profileError.message.includes('student_id_format')) {
          return NextResponse.json({ error: 'MSSV không đúng định dạng xxDHxxxxxx' }, { status: 400 });
        }
        return NextResponse.json({ error: `Dữ liệu không hợp lệ: ${profileError.message}` }, { status: 400 });
      }
      if (profileError.message.includes('MSSV không khớp')) {
        return NextResponse.json({ error: profileError.message }, { status: 400 });
      }
      if (profileError.message.includes('Niên khoá không hợp lệ')) {
        return NextResponse.json({ error: profileError.message }, { status: 400 });
      }
      return NextResponse.json({ error: `Lỗi cập nhật thông tin sinh viên: ${profileError.message}` }, { status: 500 });
    }

    return NextResponse.json({ data: authData.user }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Lỗi hệ thống không xác định' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    // Verify user is authenticated and is admin
    const supabase = await createClient();
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (!user || userError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { id, full_name, student_id, department, academic_year } = body;

    if (!id || !full_name || !student_id || !department || !academic_year) {
      return NextResponse.json(
        { error: 'Vui lòng điền đầy đủ thông tin bắt buộc' },
        { status: 400 }
      );
    }

    // Validate student_id format
    if (!/^\d{2}DH\d{6}$/.test(student_id)) {
      return NextResponse.json(
        { error: 'MSSV không đúng định dạng xxDHxxxxxx (ví dụ: 22DH123456)' },
        { status: 400 }
      );
    }

    // Validate academic_year format
    if (!/^\d{4}-\d{4}$/.test(academic_year)) {
      return NextResponse.json(
        { error: 'Niên khoá không đúng định dạng yyyy-yyyy (ví dụ: 2022-2026)' },
        { status: 400 }
      );
    }

    // Validate academic_year duration
    const [startYear, endYear] = academic_year.split('-').map(Number);
    if (endYear - startYear !== 4) {
      return NextResponse.json(
        { error: 'Niên khoá không hợp lệ: năm kết thúc phải lớn hơn năm bắt đầu đúng 4 năm' },
        { status: 400 }
      );
    }

    // Validate student_id prefix matches academic_year
    const yearPrefix = String(startYear).slice(-2);
    const studentPrefix = student_id.slice(0, 2);
    if (yearPrefix !== studentPrefix) {
      return NextResponse.json(
        { error: `MSSV không khớp với niên khoá: 2 số đầu của MSSV (${studentPrefix}) phải là ${yearPrefix}` },
        { status: 400 }
      );
    }

    // Check if student_id is being changed and if new student_id already exists
    const adminClient = createAdminClient();
    const { data: currentProfile } = await adminClient
      .from('profiles')
      .select('student_id')
      .eq('id', id)
      .single();

    if (currentProfile && currentProfile.student_id !== student_id) {
      const { data: existingStudent } = await adminClient
        .from('profiles')
        .select('student_id')
        .eq('student_id', student_id)
        .eq('role', 'student')
        .neq('id', id)
        .maybeSingle();

      if (existingStudent) {
        return NextResponse.json(
          { error: `MSSV ${student_id} đã tồn tại trong hệ thống` },
          { status: 400 }
        );
      }
    }

    // Use admin client to update profile
    const { error: profileError } = await adminClient
      .from('profiles')
      .update({
        full_name,
        student_id,
        department,
        academic_year,
      })
      .eq('id', id);

    if (profileError) {
      console.error('Error updating student:', profileError);
      
      // Parse profile errors
      if (profileError.message.includes('duplicate key')) {
        if (profileError.message.includes('student_id')) {
          return NextResponse.json({ error: `MSSV ${student_id} đã tồn tại trong hệ thống` }, { status: 400 });
        }
        return NextResponse.json({ error: 'Dữ liệu bị trùng lặp' }, { status: 400 });
      }
      if (profileError.message.includes('violates check constraint')) {
        if (profileError.message.includes('student_id_format')) {
          return NextResponse.json({ error: 'MSSV không đúng định dạng xxDHxxxxxx' }, { status: 400 });
        }
        return NextResponse.json({ error: `Dữ liệu không hợp lệ: ${profileError.message}` }, { status: 400 });
      }
      if (profileError.message.includes('MSSV không khớp')) {
        return NextResponse.json({ error: profileError.message }, { status: 400 });
      }
      if (profileError.message.includes('Niên khoá không hợp lệ')) {
        return NextResponse.json({ error: profileError.message }, { status: 400 });
      }
      return NextResponse.json({ error: `Lỗi cập nhật thông tin: ${profileError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Lỗi hệ thống không xác định' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    // Verify user is authenticated and is admin
    const supabase = await createClient();
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (!user || userError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get student ID from URL
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Student ID is required' },
        { status: 400 }
      );
    }

    // Use admin client to delete user
    const adminClient = createAdminClient();
    const { error } = await adminClient.auth.admin.deleteUser(id);

    if (error) {
      console.error('Error deleting student:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
