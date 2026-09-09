import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Get the only row from store_settings
    const { data, error } = await supabase
      .from('store_settings')
      .select('*')
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching settings:', error)
      return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
    }

    if (!data) {
      // Return default values if table is empty
      return NextResponse.json({
        is_cod_enabled: true,
        cod_min_amount: 500,
        free_shipping_threshold: 2000,
        flat_shipping_rate: 100,
      })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const supabase = await createClient()

    // Ensure the user is an admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: adminProfile } = await supabase
      .from('admin_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!adminProfile || !['admin', 'super_admin'].includes(adminProfile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { is_cod_enabled, cod_min_amount, free_shipping_threshold, flat_shipping_rate } = body

    // We expect exactly one row to exist or we update all rows since there should only be one
    const { data: existingRows } = await supabase.from('store_settings').select('id').limit(1)

    let result
    if (existingRows && existingRows.length > 0) {
      // Update existing
      result = await supabase
        .from('store_settings')
        .update({
          is_cod_enabled,
          cod_min_amount,
          free_shipping_threshold,
          flat_shipping_rate,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingRows[0].id)
        .select()
        .single()
    } else {
      // Insert new if it somehow doesn't exist
      result = await supabase
        .from('store_settings')
        .insert([{
          is_cod_enabled,
          cod_min_amount,
          free_shipping_threshold,
          flat_shipping_rate
        }])
        .select()
        .single()
    }

    if (result.error) {
      console.error('Error updating settings:', result.error)
      return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
    }

    return NextResponse.json(result.data)
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
