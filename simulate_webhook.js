require('dotenv').config({ path: '/Users/faqrealam149/Desktop/new new new/outflank-admin/.env.local' });
require('dotenv').config({ path: '/Users/faqrealam149/Desktop/new new new/outflank-admin/.env' });
const { createClient } = require('@supabase/supabase-js');
const http = require('http');

async function run() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log("Usage: node simulate_webhook.js <order_id_or_short_id> <event_type>");
    console.log("Example: node simulate_webhook.js A269B4A0 delivered");
    console.log("Available events: ofd (Out for Delivery), delivered, rto, cancelled");
    process.exit(1);
  }

  const [inputObj, eventType] = args;
  let orderId = inputObj.toLowerCase();

  // Initialize Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // If it's a short ID (doesn't contain hyphens), find the full UUID
  if (!orderId.includes('-')) {
    const { data, error } = await supabase
      .from('retail_orders')
      .select('id');
    
    if (error || !data) {
      console.error("Could not fetch orders:", error?.message);
      process.exit(1);
    }
    
    const match = data.find(o => o.id.toLowerCase().startsWith(orderId));
    if (!match) {
      console.error("Could not find an order matching that short ID.");
      process.exit(1);
    }
    orderId = match.id;
    console.log(`Found full Order ID: ${orderId}`);
  }

  const payload = JSON.stringify({
    awb_number: "SF_TEST_12345",
    order_id: orderId,
    event: eventType,
    status: eventType.toUpperCase(),
    current_location: "Test Location",
    rider_name: "Test Rider",
    rider_contact: "9999999999",
    event_timestamp: new Date().toISOString()
  });

  const req = http.request('http://localhost:3000/api/webhooks/shadowfax', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  }, (res) => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => {
      console.log(`Webhook responded with status: ${res.statusCode}`);
      console.log(`Response:`, body);
    });
  });

  req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
  });

  req.write(payload);
  req.end();
}

run();
