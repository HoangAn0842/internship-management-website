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
    const {
      semester,
      academic_year,
      registration_start,
      registration_end,
      lecturer_selection_end,
      start_date,
      search_deadline,
      end_date,
      is_active,
      target_departments,
      target_academic_years,
      target_internship_statuses,
    } = body;

    // Validate required fields
    if (
      !semester ||
      !academic_year ||
      !registration_start ||
      !registration_end ||
      !lecturer_selection_end ||
      !start_date ||
      !search_deadline ||
      !end_date
    ) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // If setting this period as active, deactivate all others first
    if (is_active) {
      const adminClient = createAdminClient();
      await adminClient
        .from('internship_periods')
        .update({ is_active: false })
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all
    }

    // Use admin client to bypass RLS for insert
    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from('internship_periods')
      .insert({
        semester,
        academic_year,
        registration_start,
        registration_end,
        lecturer_selection_end,
        start_date,
        search_deadline,
        end_date,
        is_active: is_active ?? false,
        target_departments: target_departments && target_departments.length > 0 ? target_departments : null,
        target_academic_years: target_academic_years && target_academic_years.length > 0 ? target_academic_years : null,
        target_internship_statuses: target_internship_statuses && target_internship_statuses.length > 0 ? target_internship_statuses : null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating period:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
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
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Period ID is required' },
        { status: 400 }
      );
    }

    // If setting this period as active, deactivate all others first
    if (updates.is_active) {
      const adminClient = createAdminClient();
      await adminClient
        .from('internship_periods')
        .update({ is_active: false })
        .neq('id', id);
    }

    // Use admin client to bypass RLS for update
    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from('internship_periods')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating period:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
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

    // Get period ID from URL
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Period ID is required' },
        { status: 400 }
      );
    }

    // Use admin client to bypass RLS for delete
    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from('internship_periods')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting period:', error);
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
