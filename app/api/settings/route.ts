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
        whatsapp_support_phone: '919999926273',
        whatsapp_admin_alerts_phone: '919999926273',
        whatsapp_notifications_enabled: false,
        whatsapp_provider: 'meta_cloud',
        whatsapp_phone_number_id: '',
        whatsapp_business_account_id: '',
        whatsapp_access_token: '',
      })
    }

    return NextResponse.json({
      ...data,
      whatsapp_support_phone: data.whatsapp_support_phone || '919999926273',
      whatsapp_admin_alerts_phone: data.whatsapp_admin_alerts_phone || '919999926273',
      whatsapp_notifications_enabled: Boolean(data.whatsapp_notifications_enabled),
      whatsapp_provider: data.whatsapp_provider || 'meta_cloud',
      whatsapp_phone_number_id: data.whatsapp_phone_number_id || '',
      whatsapp_business_account_id: data.whatsapp_business_account_id || '',
      whatsapp_access_token: data.whatsapp_access_token || '',
    })
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
    const { 
      is_cod_enabled, 
      cod_min_amount, 
      free_shipping_threshold, 
      flat_shipping_rate,
      whatsapp_support_phone,
      whatsapp_admin_alerts_phone,
      whatsapp_notifications_enabled,
      whatsapp_provider,
      whatsapp_phone_number_id,
      whatsapp_business_account_id,
      whatsapp_access_token,
    } = body

    const updatePayload: any = {
      is_cod_enabled,
      cod_min_amount,
      free_shipping_threshold,
      flat_shipping_rate,
      updated_at: new Date().toISOString()
    }

    if (whatsapp_support_phone !== undefined) updatePayload.whatsapp_support_phone = whatsapp_support_phone
    if (whatsapp_admin_alerts_phone !== undefined) updatePayload.whatsapp_admin_alerts_phone = whatsapp_admin_alerts_phone
    if (whatsapp_notifications_enabled !== undefined) updatePayload.whatsapp_notifications_enabled = Boolean(whatsapp_notifications_enabled)
    if (whatsapp_provider !== undefined) updatePayload.whatsapp_provider = whatsapp_provider
    if (whatsapp_phone_number_id !== undefined) updatePayload.whatsapp_phone_number_id = whatsapp_phone_number_id
    if (whatsapp_business_account_id !== undefined) updatePayload.whatsapp_business_account_id = whatsapp_business_account_id
    if (whatsapp_access_token !== undefined) updatePayload.whatsapp_access_token = whatsapp_access_token

    // We expect exactly one row to exist or we update all rows since there should only be one
    const { data: existingRows } = await supabase.from('store_settings').select('id').limit(1)

    let result
    if (existingRows && existingRows.length > 0) {
      result = await supabase
        .from('store_settings')
        .update(updatePayload)
        .eq('id', existingRows[0].id)
        .select()
        .single()
    } else {
      result = await supabase
        .from('store_settings')
        .insert([updatePayload])
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
