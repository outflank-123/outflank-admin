import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const q = searchParams.get('q')

  const admin = createAdminClient()
  let query = admin
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })

  if (status && status !== 'all') query = query.eq('status', status)
  if (q) query = query.or(`name.ilike.%${q}%,company.ilike.%${q}%,email.ilike.%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ leads: data })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, company, email, phone, requirements, product_name, status, source, notes, deal_value, order_items } = body

  if (!name || !company || !email) {
    return NextResponse.json({ error: 'Name, company, and email are required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('leads')
    .insert({
      name,
      company,
      email,
      phone: phone || null,
      requirements: requirements || null,
      product_name: product_name || null,
      status: status || 'conversation',
      source: source || 'admin_manual',
      notes: notes || null,
      deal_value: deal_value != null ? Number(deal_value) : 0,
      order_items: order_items || []
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, lead: data })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  // Support batch updates (e.g. from Drag & Drop canvas save)
  if (Array.isArray(body.updates)) {
    const admin = createAdminClient()
    const updatedLeads = []
    for (const item of body.updates) {
      if (!item.id) continue
      const updateData: Record<string, any> = {}
      if (item.status) updateData.status = item.status
      if (item.notes !== undefined) updateData.notes = item.notes
      if (item.name) updateData.name = item.name
      if (item.company) updateData.company = item.company
      if (item.email) updateData.email = item.email
      if (item.phone !== undefined) updateData.phone = item.phone
      if (item.requirements !== undefined) updateData.requirements = item.requirements
      if (item.product_name !== undefined) updateData.product_name = item.product_name
      if (item.source !== undefined) updateData.source = item.source
      if (item.deal_value !== undefined) updateData.deal_value = Number(item.deal_value)
      if (item.order_items !== undefined) updateData.order_items = item.order_items
      updateData.updated_at = new Date().toISOString()

      const { data, error } = await admin
        .from('leads')
        .update(updateData)
        .eq('id', item.id)
        .select()
        .single()

      if (!error && data) {
        updatedLeads.push(data)
      } else if (error) {
        console.error(`[PATCH /api/admin/leads] Error updating lead ${item.id}:`, error)
      }
    }

    return NextResponse.json({ success: true, count: updatedLeads.length, leads: updatedLeads })
  }

  // Single lead update
  const { id, status, notes, name, company, email, phone, requirements, product_name, source, deal_value, order_items } = body
  if (!id) return NextResponse.json({ error: 'Lead ID required' }, { status: 400 })

  const admin = createAdminClient()
  const updateData: Record<string, any> = {}
  if (status) updateData.status = status
  if (notes !== undefined) updateData.notes = notes
  if (name) updateData.name = name
  if (company) updateData.company = company
  if (email) updateData.email = email
  if (phone !== undefined) updateData.phone = phone
  if (requirements !== undefined) updateData.requirements = requirements
  if (product_name !== undefined) updateData.product_name = product_name
  if (source !== undefined) updateData.source = source
  if (deal_value !== undefined) updateData.deal_value = Number(deal_value)
  if (order_items !== undefined) updateData.order_items = order_items
  updateData.updated_at = new Date().toISOString()

  const { data, error } = await admin
    .from('leads')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, lead: data })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('leads').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, id })
}
