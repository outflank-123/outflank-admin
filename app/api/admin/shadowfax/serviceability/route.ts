import { NextRequest, NextResponse } from 'next/server'

const SHADOWFAX_BASE_URL = process.env.SHADOWFAX_BASE_URL || 'https://dale.staging.shadowfax.in/api'
const SHADOWFAX_API_TOKEN = process.env.SHADOWFAX_API_TOKEN || ''

/**
 * GET /api/admin/shadowfax/serviceability?pincode=110001
 *
 * Checks if a pincode is serviceable by Shadowfax before dispatching.
 */
export async function GET(req: NextRequest) {
  const pincode = req.nextUrl.searchParams.get('pincode')

  if (!pincode) {
    return NextResponse.json({ error: 'pincode is required' }, { status: 400 })
  }

  try {
    const url = `${SHADOWFAX_BASE_URL}/v1/clients/serviceability/?service=customer_delivery&pincodes=${pincode}`
    const res = await fetch(url, {
      headers: {
        'Authorization': `Token ${SHADOWFAX_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json({ serviceable: false, error: data?.message || 'Shadowfax API error' })
    }

    const results: any[] = data?.results || []
    const isServiceable = results.some((r: any) => String(r.pincode) === String(pincode))

    return NextResponse.json({ serviceable: isServiceable, pincode })
  } catch (err) {
    console.error('[Shadowfax Serviceability] Error:', err)
    return NextResponse.json({ serviceable: false, error: 'Network error' }, { status: 500 })
  }
}
