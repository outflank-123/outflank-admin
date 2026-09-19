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
  const { name, company, email, phone, requirements, product_name, status, source, notes } = body

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
      status: status || 'new',
      source: source || 'admin_manual',
      notes: notes || null
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
  const { id, status, notes, name, company, email, phone, requirements } = body

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

  const { data, error } = await admin
    .from('leads')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, lead: data })
}
