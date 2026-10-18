import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { leads } = body

    if (!Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json({ error: 'No leads provided for import' }, { status: 400 })
    }

    // Sanitize and validate rows
    const validRows: any[] = []
    const errors: string[] = []

    leads.forEach((row, idx) => {
      const rowIndex = idx + 1
      const name = typeof row.name === 'string' ? row.name.trim() : ''
      const company = typeof row.company === 'string' ? row.company.trim() : ''
      const email = typeof row.email === 'string' ? row.email.trim() : ''

      if (!name) {
        errors.push(`Row ${rowIndex}: Name is missing`)
        return
      }

      // Format status
      const rawStatus = typeof row.status === 'string' ? row.status.toLowerCase().replace(/\s+/g, '_') : 'conversation'
      const allowedStages = ['conversation', 'sampling', 'finalise', 'advance_received', 'close_deal', 'delivered']
      const status = allowedStages.includes(rawStatus) ? rawStatus : 'conversation'

      // Parse order items if string or array
      let order_items: any[] = []
      if (Array.isArray(row.order_items)) {
        order_items = row.order_items
      } else if (typeof row.order_items === 'string' && row.order_items.trim()) {
        try {
          order_items = JSON.parse(row.order_items)
        } catch {
          order_items = [{
            id: `item-${Date.now()}-${idx}`,
            name: row.order_items.trim(),
            quality: row.quality || '',
            quantity: Number(row.quantity) || 1,
            unit_price: Number(row.unit_price) || Number(row.deal_value) || 0,
            total: Number(row.deal_value) || 0
          }]
        }
      } else if (row.product_name) {
        order_items = [{
          id: `item-${Date.now()}-${idx}`,
          name: row.product_name,
          quality: row.quality || '',
          quantity: Number(row.quantity) || 1,
          unit_price: Number(row.unit_price) || Number(row.deal_value) || 0,
          total: Number(row.deal_value) || 0
        }]
      }

      // Calculate deal value
      let deal_value = Number(row.deal_value) || 0
      if (deal_value === 0 && order_items.length > 0) {
        deal_value = order_items.reduce((s, it) => s + (Number(it.total) || (Number(it.quantity) * Number(it.unit_price)) || 0), 0)
      }

      validRows.push({
        name,
        company: company || 'Individual Client',
        email: email || `${name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'lead'}@client.local`,
        phone: row.phone ? String(row.phone).trim() : null,
        requirements: row.requirements || null,
        product_name: row.product_name || (order_items[0]?.name) || null,
        status,
        source: row.source || 'excel_import',
        notes: row.notes || null,
        deal_value,
        order_items
      })
    })

    if (validRows.length === 0) {
      return NextResponse.json({ error: 'No valid rows found to import', details: errors }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('leads')
      .insert(validRows)
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      importedCount: data?.length || validRows.length,
      skippedCount: errors.length,
      errors: errors.slice(0, 5),
      leads: data
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Import failed' }, { status: 500 })
  }
}
