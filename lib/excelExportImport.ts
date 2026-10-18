import ExcelJS from 'exceljs'

export interface ExcelLeadRow {
  name: string
  company: string
  email: string
  phone?: string
  status?: string
  source?: string
  product_name?: string
  quality?: string
  quantity?: number | string
  unit_price?: number | string
  deal_value?: number | string
  order_items?: any
  requirements?: string
  notes?: string
}

// ─── STAGE CONFIGURATIONS FOR EXCEL STYLING ─────────────────────────────────
const STAGE_EXCEL_STYLES: Record<string, { fill: string; font: string; label: string }> = {
  conversation: { fill: 'F1F5F9', font: '475569', label: 'Conversation' },
  sampling: { fill: 'F3E8FF', font: '6B21A8', label: 'Sampling' },
  finalise: { fill: 'FEF3C7', font: '92400E', label: 'Finalise' },
  advance_received: { fill: 'D1FAE5', font: '065F46', label: 'Advance Received' },
  close_deal: { fill: 'DCFCE7', font: '166534', label: 'Closed Deal' },
  delivered: { fill: 'E0F2FE', font: '075985', label: 'Delivered' },
}

// ─── 1. EXPORT LEADS TO BEAUTIFULLY STYLED EXCEL WORKBOOK ─────────────────────
export async function exportLeadsToExcel(
  leads: any[],
  paymentLogsByLeadId: Record<string, any[]> = {}
): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Outflank CRM'
  workbook.lastModifiedBy = 'Outflank Admin'
  workbook.created = new Date()
  workbook.modified = new Date()

  const worksheet = workbook.addWorksheet('Sales CRM Leads', {
    views: [{ showGridLines: true, state: 'frozen', ySplit: 6 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  })

  // Format currency helper
  const fmtInr = (n: number) => `₹${n.toLocaleString('en-IN')}`

  // Calculate totals
  let totalPipelineValue = 0
  let totalAmountCollected = 0

  leads.forEach((lead) => {
    let orderTotal = Number(lead.deal_value) || 0
    let items: any[] = []
    if (Array.isArray(lead.order_items)) {
      items = lead.order_items
    } else if (typeof lead.order_items === 'string') {
      try { items = JSON.parse(lead.order_items) } catch {}
    }

    if (orderTotal === 0 && items.length > 0) {
      orderTotal = items.reduce((s, it) => s + (Number(it.total) || (Number(it.quantity) * Number(it.unit_price)) || 0), 0)
    }

    const logs = paymentLogsByLeadId[lead.id] || []
    const paid = logs.reduce((sum, l) => sum + (Number(l.total_amount) || 0), 0)

    totalPipelineValue += orderTotal
    totalAmountCollected += paid
  })

  const totalBalanceDue = Math.max(0, totalPipelineValue - totalAmountCollected)

  // ── ROW 1: HEADER BANNER (BRANDED OUTFLANK DARK THEME) ──
  worksheet.mergeCells('A1:N1')
  const titleCell = worksheet.getCell('A1')
  titleCell.value = 'OUTFLANK • B2B SALES CRM & LEADS PIPELINE REPORT'
  titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } }
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F172A' } // Slate 900
  }
  worksheet.getRow(1).height = 36

  // ── ROW 2: METADATA & KPI SUMMARY SUBTITLE ──
  worksheet.mergeCells('A2:N2')
  const subtitleCell = worksheet.getCell('A2')
  subtitleCell.value = `Exported: ${new Date().toLocaleString('en-IN')}  |  Total Inquiries: ${leads.length}  |  Pipeline Value: ${fmtInr(totalPipelineValue)}  |  Total Collected: ${fmtInr(totalAmountCollected)}  |  Balance Due: ${fmtInr(totalBalanceDue)}`
  subtitleCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFE2E8F0' } }
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'center' }
  subtitleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' } // Slate 800
  }
  worksheet.getRow(2).height = 24

  // ── ROW 3: BLANK SEPARATOR ──
  worksheet.getRow(3).height = 10

  // ── ROW 4 & 5: MINI KPI CARDS INSIDE EXCEL ──
  const kpis = [
    { start: 'B4', end: 'C5', label: 'TOTAL INQUIRIES', val: `${leads.length} Leads`, bg: 'FFF8FAFC', fg: 'FF0F172A' },
    { start: 'E4', end: 'F5', label: 'PIPELINE VALUE', val: fmtInr(totalPipelineValue), bg: 'FFF8FAFC', fg: 'FF0F172A' },
    { start: 'H4', end: 'I5', label: 'AMOUNT COLLECTED', val: fmtInr(totalAmountCollected), bg: 'FFECFDF5', fg: 'FF047857' },
    { start: 'K4', end: 'L5', label: 'BALANCE PENDING', val: fmtInr(totalBalanceDue), bg: 'FFFFFBEB', fg: 'FFB45309' },
  ]

  kpis.forEach((kpi) => {
    worksheet.mergeCells(`${kpi.start}:${kpi.end}`)
    const cell = worksheet.getCell(kpi.start)
    cell.value = `${kpi.label}\n${kpi.val}`
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: kpi.fg } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.bg } }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    }
  })
  worksheet.getRow(4).height = 18
  worksheet.getRow(5).height = 20

  // ── ROW 6: TABLE HEADERS ──
  const columns = [
    { key: 'index', header: '#', width: 6 },
    { key: 'name', header: 'Contact Person', width: 22 },
    { key: 'company', header: 'Company Name', width: 26 },
    { key: 'status', header: 'Pipeline Stage', width: 18 },
    { key: 'deal_value', header: 'Deal Value (₹)', width: 18 },
    { key: 'amount_paid', header: 'Amount Paid (₹)', width: 18 },
    { key: 'balance_due', header: 'Balance Due (₹)', width: 18 },
    { key: 'payment_status', header: 'Payment Status', width: 16 },
    { key: 'order_items', header: 'Quotation Items & Specs', width: 36 },
    { key: 'phone', header: 'Phone Number', width: 18 },
    { key: 'email', header: 'Email Address', width: 26 },
    { key: 'source', header: 'Source', width: 14 },
    { key: 'requirements', header: 'Client Requirements / Brief', width: 34 },
    { key: 'notes', header: 'Internal Sales Notes', width: 30 },
  ]

  const headerRow = worksheet.getRow(6)
  headerRow.height = 30

  columns.forEach((col, idx) => {
    const colNumber = idx + 1
    const cell = headerRow.getCell(colNumber)
    cell.value = col.header
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.alignment = { vertical: 'middle', horizontal: idx === 0 ? 'center' : idx >= 4 && idx <= 6 ? 'right' : 'left' }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F172A' } // Dark Slate
    }
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF334155' } },
      bottom: { style: 'medium', color: { argb: 'FF334155' } },
      left: { style: 'thin', color: { argb: 'FF1E293B' } },
      right: { style: 'thin', color: { argb: 'FF1E293B' } },
    }
    worksheet.getColumn(colNumber).width = col.width
  })

  // ── ROWS 7+: DATA ROWS WITH PREMIUM STYLING ──
  let currentRowIndex = 7

  leads.forEach((lead, idx) => {
    let orderTotal = Number(lead.deal_value) || 0
    let items: any[] = []
    if (Array.isArray(lead.order_items)) {
      items = lead.order_items
    } else if (typeof lead.order_items === 'string') {
      try { items = JSON.parse(lead.order_items) } catch {}
    }

    if (orderTotal === 0 && items.length > 0) {
      orderTotal = items.reduce((s, it) => s + (Number(it.total) || (Number(it.quantity) * Number(it.unit_price)) || 0), 0)
    }

    const logs = paymentLogsByLeadId[lead.id] || []
    const totalPaid = logs.reduce((sum, l) => sum + (Number(l.total_amount) || 0), 0)
    const balanceDue = Math.max(0, orderTotal - totalPaid)

    // Format items string
    let itemsSummary = ''
    if (items.length > 0) {
      itemsSummary = items.map((it) => `${it.quantity || 1}x ${it.name}${it.quality ? ` (${it.quality})` : ''} @ ₹${it.unit_price || 0}`).join('; ')
    } else if (lead.product_name) {
      itemsSummary = lead.product_name
    }

    // Payment status label
    let paymentStatusLabel = 'No Quote'
    if (orderTotal > 0) {
      if (balanceDue === 0) {
        paymentStatusLabel = 'Fully Settled ✓'
      } else if (totalPaid > 0) {
        const pct = Math.round((totalPaid / orderTotal) * 100)
        paymentStatusLabel = `Partial (${pct}%)`
      } else {
        paymentStatusLabel = 'Unpaid'
      }
    }

    const isZebra = idx % 2 === 1
    const rowBg = isZebra ? 'FFF8FAFC' : 'FFFFFFFF'
    const stageStyle = STAGE_EXCEL_STYLES[lead.status] || STAGE_EXCEL_STYLES.conversation

    const row = worksheet.getRow(currentRowIndex)
    row.height = 24

    // Values
    row.getCell(1).value = idx + 1
    row.getCell(2).value = lead.name || 'N/A'
    row.getCell(3).value = lead.company || 'N/A'
    row.getCell(4).value = stageStyle.label
    row.getCell(5).value = orderTotal
    row.getCell(6).value = totalPaid
    row.getCell(7).value = balanceDue
    row.getCell(8).value = paymentStatusLabel
    row.getCell(9).value = itemsSummary || '—'
    row.getCell(10).value = lead.phone || '—'
    row.getCell(11).value = lead.email || '—'
    row.getCell(12).value = lead.source || 'website'
    row.getCell(13).value = lead.requirements || '—'
    row.getCell(14).value = lead.notes || '—'

    // Formats & Alignments
    for (let c = 1; c <= 14; c++) {
      const cell = row.getCell(c)
      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      }
      cell.alignment = { vertical: 'middle', horizontal: 'left' }
    }

    // Index column
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' }
    row.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF64748B' } }

    // Contact & Company bold
    row.getCell(2).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } }
    row.getCell(3).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF334155' } }

    // Stage Column Badge Style
    const stageCell = row.getCell(4)
    stageCell.alignment = { vertical: 'middle', horizontal: 'center' }
    stageCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${stageStyle.fill}` } }
    stageCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: `FF${stageStyle.font}` } }

    // Currency Formats
    const dealCell = row.getCell(5)
    dealCell.numFmt = '₹#,##0.00'
    dealCell.alignment = { vertical: 'middle', horizontal: 'right' }
    dealCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } }

    const paidCell = row.getCell(6)
    paidCell.numFmt = '₹#,##0.00'
    paidCell.alignment = { vertical: 'middle', horizontal: 'right' }
    paidCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: totalPaid > 0 ? 'FF047857' : 'FF94A3B8' } }

    const balCell = row.getCell(7)
    balCell.numFmt = '₹#,##0.00'
    balCell.alignment = { vertical: 'middle', horizontal: 'right' }
    balCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: balanceDue > 0 ? 'FFB45309' : 'FF64748B' } }

    // Payment Status Chip
    const pStatusCell = row.getCell(8)
    pStatusCell.alignment = { vertical: 'middle', horizontal: 'center' }
    if (balanceDue === 0 && orderTotal > 0) {
      pStatusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } }
      pStatusCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF166534' } }
    } else if (totalPaid > 0) {
      pStatusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }
      pStatusCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF92400E' } }
    }

    currentRowIndex++
  })

  // ── ROW: TOTALS SUMMARY ROW ──
  const summaryRow = worksheet.getRow(currentRowIndex)
  summaryRow.height = 28
  summaryRow.getCell(3).value = 'TOTAL PIPELINE:'
  summaryRow.getCell(3).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0F172A' } }
  summaryRow.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' }

  // Deal Value Sum
  summaryRow.getCell(5).value = { formula: `SUM(E7:E${currentRowIndex - 1})` }
  summaryRow.getCell(5).numFmt = '₹#,##0.00'
  summaryRow.getCell(5).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0F172A' } }
  summaryRow.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' }

  // Paid Sum
  summaryRow.getCell(6).value = { formula: `SUM(F7:F${currentRowIndex - 1})` }
  summaryRow.getCell(6).numFmt = '₹#,##0.00'
  summaryRow.getCell(6).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF047857' } }
  summaryRow.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' }

  // Balance Sum
  summaryRow.getCell(7).value = { formula: `SUM(G7:G${currentRowIndex - 1})` }
  summaryRow.getCell(7).numFmt = '₹#,##0.00'
  summaryRow.getCell(7).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFB45309' } }
  summaryRow.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' }

  for (let c = 1; c <= 14; c++) {
    const cell = summaryRow.getCell(c)
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF334155' } },
      bottom: { style: 'double', color: { argb: 'FF0F172A' } }, // Classic accounting double underline
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    }
  }

  // ── TRIGGER BROWSER DOWNLOAD ──
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `Outflank_Leads_Pipeline_${new Date().toISOString().slice(0, 10)}.xlsx`
  anchor.click()
  window.URL.revokeObjectURL(url)
}

// ─── 2. GENERATE SAMPLE IMPORT TEMPLATE EXCEL ────────────────────────────────
export async function downloadSampleLeadsTemplate(): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Outflank CRM'

  const worksheet = workbook.addWorksheet('Leads Import Template', {
    views: [{ showGridLines: true }]
  })

  // Title Banner
  worksheet.mergeCells('A1:J1')
  const title = worksheet.getCell('A1')
  title.value = 'OUTFLANK LEADS IMPORT TEMPLATE (Fill rows below and upload)'
  title.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } }
  title.alignment = { vertical: 'middle', horizontal: 'center' }
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }
  worksheet.getRow(1).height = 32

  // Instruction Row
  worksheet.mergeCells('A2:J2')
  const inst = worksheet.getCell('A2')
  inst.value = 'Instructions: "Name" and "Company" are required. Status options: conversation, sampling, finalise, advance_received, close_deal, delivered.'
  inst.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FFE2E8F0' } }
  inst.alignment = { vertical: 'middle', horizontal: 'center' }
  inst.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } }
  worksheet.getRow(2).height = 20

  // Headers
  const templateHeaders = [
    { key: 'name', label: 'Contact Name *', width: 22 },
    { key: 'company', label: 'Company Name *', width: 25 },
    { key: 'email', label: 'Email Address', width: 26 },
    { key: 'phone', label: 'Phone Number', width: 18 },
    { key: 'product_name', label: 'Item / Product Name', width: 26 },
    { key: 'quality', label: 'Quality / Specs', width: 24 },
    { key: 'quantity', label: 'Quantity', width: 12 },
    { key: 'unit_price', label: 'Unit Price (₹)', width: 15 },
    { key: 'status', label: 'Stage (Status)', width: 18 },
    { key: 'notes', label: 'Sales Notes', width: 28 },
  ]

  const hRow = worksheet.getRow(4)
  hRow.height = 28
  templateHeaders.forEach((th, idx) => {
    const cell = hRow.getCell(idx + 1)
    cell.value = th.label
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.alignment = { vertical: 'middle', horizontal: 'left' }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF0F172A' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
    }
    worksheet.getColumn(idx + 1).width = th.width
  })

  // Sample Rows
  const sampleData = [
    {
      name: 'Aditya Mehta',
      company: 'Tata Technologies',
      email: 'aditya.mehta@tatatech.com',
      phone: '+91 98201 12345',
      product_name: 'Custom Canvas Bags',
      quality: '140 GSM Premium Cotton',
      quantity: 500,
      unit_price: 350,
      status: 'conversation',
      notes: 'Need samples dispatched to Pune office by Friday'
    },
    {
      name: 'Sneha Patel',
      company: 'Zomato Enterprise',
      email: 'sneha.p@zomato.com',
      phone: '+91 97112 54321',
      product_name: 'Bio-Washed Polo T-Shirts',
      quality: '240 GSM Combed Cotton with Logo Print',
      quantity: 250,
      unit_price: 480,
      status: 'sampling',
      notes: 'Advance approved, awaiting physical fabric swatch'
    },
    {
      name: 'Rohan Deshmukh',
      company: 'Razorpay Software',
      email: 'rohan.d@razorpay.com',
      phone: '+91 99887 65432',
      product_name: 'Employee Welcome Kits (Hoodies + Mugs)',
      quality: 'Fleece 320 GSM + Ceramic Mug with UV print',
      quantity: 100,
      unit_price: 1200,
      status: 'finalise',
      notes: 'Final quotation sent, PO expected this week'
    }
  ]

  sampleData.forEach((item, idx) => {
    const row = worksheet.getRow(5 + idx)
    row.height = 22
    row.getCell(1).value = item.name
    row.getCell(2).value = item.company
    row.getCell(3).value = item.email
    row.getCell(4).value = item.phone
    row.getCell(5).value = item.product_name
    row.getCell(6).value = item.quality
    row.getCell(7).value = item.quantity
    row.getCell(8).value = item.unit_price
    row.getCell(9).value = item.status
    row.getCell(10).value = item.notes

    for (let c = 1; c <= 10; c++) {
      const cell = row.getCell(c)
      cell.font = { name: 'Calibri', size: 10 }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC' } }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      }
      cell.alignment = { vertical: 'middle', horizontal: 'left' }
    }
  })

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'Outflank_Leads_Import_Template.xlsx'
  a.click()
  window.URL.revokeObjectURL(url)
}

// ─── 3. PARSE UPLOADED EXCEL FILE ─────────────────────────────────────────────
export async function parseExcelLeadsFile(file: File): Promise<ExcelLeadRow[]> {
  const buffer = await file.arrayBuffer()
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)

  const worksheet = workbook.worksheets[0]
  if (!worksheet) {
    throw new Error('Excel file does not contain any sheets.')
  }

  // Find header row by searching for common keywords
  let headerRowIndex = -1
  let headerMap: Record<string, number> = {}

  worksheet.eachRow((row, rowNumber) => {
    if (headerRowIndex !== -1) return
    const rowValues = row.values as any[]
    if (!Array.isArray(rowValues)) return

    const stringValues = rowValues.map((v) => (v != null ? String(v).toLowerCase().trim() : ''))

    const hasName = stringValues.some((v) => v.includes('name') || v.includes('contact') || v.includes('person'))
    const hasCompany = stringValues.some((v) => v.includes('company') || v.includes('org') || v.includes('client'))

    if (hasName && hasCompany) {
      headerRowIndex = rowNumber
      rowValues.forEach((val, colIdx) => {
        if (!val) return
        const str = String(val).toLowerCase().trim()
        if (str.includes('name') && !str.includes('product') && !str.includes('item')) headerMap['name'] = colIdx
        else if (str.includes('company') || str.includes('org')) headerMap['company'] = colIdx
        else if (str.includes('email')) headerMap['email'] = colIdx
        else if (str.includes('phone') || str.includes('mobile') || str.includes('contact num')) headerMap['phone'] = colIdx
        else if (str.includes('product') || str.includes('item') || str.includes('goods')) headerMap['product_name'] = colIdx
        else if (str.includes('quality') || str.includes('spec') || str.includes('fabric')) headerMap['quality'] = colIdx
        else if (str.includes('qty') || str.includes('quantity')) headerMap['quantity'] = colIdx
        else if (str.includes('unit price') || str.includes('rate') || str.includes('price')) headerMap['unit_price'] = colIdx
        else if (str.includes('stage') || str.includes('status')) headerMap['status'] = colIdx
        else if (str.includes('note') || str.includes('remark')) headerMap['notes'] = colIdx
        else if (str.includes('deal') || str.includes('total value') || str.includes('amount')) headerMap['deal_value'] = colIdx
      })
    }
  })

  if (headerRowIndex === -1) {
    throw new Error('Could not identify a valid header row. Please make sure the sheet includes columns for "Contact Name" and "Company".')
  }

  const parsedLeads: ExcelLeadRow[] = []

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowIndex) return

    const getVal = (field: string) => {
      const colIdx = headerMap[field]
      if (!colIdx) return ''
      const cell = row.getCell(colIdx)
      return cell.value != null ? String(cell.value).trim() : ''
    }

    const name = getVal('name')
    const company = getVal('company')

    if (!name && !company) return // skip empty rows

    const rawStatus = getVal('status').toLowerCase().replace(/\s+/g, '_')
    const allowed = ['conversation', 'sampling', 'finalise', 'advance_received', 'close_deal', 'delivered']
    const status = allowed.includes(rawStatus) ? rawStatus : 'conversation'

    const quantity = Number(getVal('quantity')) || 1
    const unit_price = Number(getVal('unit_price')) || 0
    const explicitDealValue = Number(getVal('deal_value')) || 0
    const deal_value = explicitDealValue > 0 ? explicitDealValue : quantity * unit_price

    const product_name = getVal('product_name')
    const quality = getVal('quality')

    parsedLeads.push({
      name: name || 'Lead Contact',
      company: company || 'Corporate Client',
      email: getVal('email') || `${(name || 'client').toLowerCase().replace(/[^a-z0-9]/g, '')}@client.local`,
      phone: getVal('phone'),
      product_name,
      quality,
      quantity,
      unit_price,
      deal_value,
      status,
      notes: getVal('notes'),
    })
  })

  return parsedLeads
}
