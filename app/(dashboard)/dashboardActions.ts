'use server'

import { createClient } from '@/lib/supabase/server'

export async function fetchDashboardData(range: string = 'last_30_days', customStart?: string, customEnd?: string) {
  const supabase = await createClient()

  let startDate = new Date()
  let endDate = new Date()

  if (range === 'today') {
    startDate.setHours(0, 0, 0, 0)
  } else if (range === 'last_7_days') {
    startDate.setDate(startDate.getDate() - 7)
  } else if (range === 'last_30_days') {
    startDate.setDate(startDate.getDate() - 30)
  } else if (range === 'last_90_days') {
    startDate.setDate(startDate.getDate() - 90)
  } else if (range === 'this_month') {
    startDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
  } else if (range === 'custom' && customStart && customEnd) {
    startDate = new Date(customStart)
    endDate = new Date(customEnd)
    endDate.setHours(23, 59, 59, 999)
  }

  // Calculate previous period for comparisons
  const duration = endDate.getTime() - startDate.getTime()
  const prevEndDate = new Date(startDate.getTime() - 1)
  const prevStartDate = new Date(prevEndDate.getTime() - duration)

  const isoStart = startDate.toISOString()
  const isoEnd = endDate.toISOString()
  const isoPrevStart = prevStartDate.toISOString()
  const isoPrevEnd = prevEndDate.toISOString()

  try {
    // Current Period Queries
    const [
      { data: orders },
      { data: leads },
      { data: customers },
      { data: products },
      // Previous Period Queries
      { data: prevOrders },
      { data: prevLeads }
    ] = await Promise.all([
      supabase.from('retail_orders').select('id, status, total_amount, created_at').gte('created_at', isoStart).lte('created_at', isoEnd),
      supabase.from('leads').select('id, status, created_at').gte('created_at', isoStart).lte('created_at', isoEnd),
      supabase.from('customers').select('id, created_at').gte('created_at', isoStart).lte('created_at', isoEnd),
      supabase.from('products').select('id, name, stock_quantity, category_id, is_active'),
      
      supabase.from('retail_orders').select('id, status, total_amount').gte('created_at', isoPrevStart).lte('created_at', isoPrevEnd),
      supabase.from('leads').select('id, status').gte('created_at', isoPrevStart).lte('created_at', isoPrevEnd)
    ])

    // Current Order Stats
    const currentOrders = orders || []
    const totalRevenue = currentOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0)
    const orderCount = currentOrders.length
    const deliveredCount = currentOrders.filter(o => o.status === 'delivered').length
    const inTransitCount = currentOrders.filter(o => o.status === 'shipped' || o.status === 'to_dispatch').length
    const aov = orderCount > 0 ? totalRevenue / orderCount : 0
    const cancelledCount = currentOrders.filter(o => o.status === 'cancelled' || o.status === 'failed').length
    const cancelRate = orderCount > 0 ? (cancelledCount / orderCount) * 100 : 0

    // Previous Order Stats
    const pOrders = prevOrders || []
    const prevRevenue = pOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0)
    const prevOrderCount = pOrders.length
    
    const revChange = prevRevenue === 0 ? 100 : ((totalRevenue - prevRevenue) / prevRevenue) * 100
    const ordersChange = prevOrderCount === 0 ? 100 : ((orderCount - prevOrderCount) / prevOrderCount) * 100

    // Current Leads Stats
    const currentLeads = leads || []
    const totalLeads = currentLeads.length
    const newLeads = currentLeads.filter(l => l.status === 'new').length
    const qualifiedLeads = currentLeads.filter(l => l.status === 'qualified').length
    const closedLeads = currentLeads.filter(l => l.status === 'closed').length
    const leadConversion = totalLeads > 0 ? (closedLeads / totalLeads) * 100 : 0

    // Previous Leads Stats
    const pLeads = prevLeads || []
    const prevLeadsCount = pLeads.length
    const leadsChange = prevLeadsCount === 0 ? 100 : ((totalLeads - prevLeadsCount) / prevLeadsCount) * 100

    // Low Stock Products
    const lowStock = (products || []).filter(p => p.stock_quantity !== null && p.stock_quantity < 10 && p.is_active).sort((a, b) => a.stock_quantity - b.stock_quantity).slice(0, 5)

    // Chart Data (Group by Day)
    const chartDataMap: Record<string, { date: string, revenue: number, orders: number }> = {}
    currentOrders.forEach(o => {
      const day = new Date(o.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      if (!chartDataMap[day]) chartDataMap[day] = { date: day, revenue: 0, orders: 0 }
      chartDataMap[day].revenue += o.total_amount || 0
      chartDataMap[day].orders += 1
    })
    
    // Status Distribution
    const statusMap: Record<string, number> = {}
    currentOrders.forEach(o => {
      statusMap[o.status] = (statusMap[o.status] || 0) + 1
    })
    const statusData = Object.entries(statusMap).map(([name, value]) => ({ name, value }))

    // Unified Feed (Recent Activity)
    const feed = [
      ...currentOrders.map(o => ({ type: 'order', id: o.id, title: `Order #${o.id.split('-')[0].toUpperCase()}`, amount: o.total_amount, status: o.status, date: o.created_at })),
      ...currentLeads.map(l => ({ type: 'lead', id: l.id, title: `New Lead`, status: l.status, date: l.created_at })),
      ...(customers || []).map(c => ({ type: 'customer', id: c.id, title: `New Customer`, date: c.created_at }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 15)

    return {
      revenue: { current: totalRevenue, change: revChange },
      orders: { current: orderCount, change: ordersChange },
      aov: { current: aov },
      cancelRate: { current: cancelRate },
      inTransit: { current: inTransitCount },
      delivered: { current: deliveredCount },
      leads: { current: totalLeads, change: leadsChange },
      leadConversion: { current: leadConversion },
      chartData: Object.values(chartDataMap),
      statusData,
      lowStock,
      feed
    }
  } catch (error) {
    console.error('Dashboard Aggregation Error:', error)
    return null
  }
}
