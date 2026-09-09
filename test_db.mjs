import { createClient } from '@supabase/supabase-js'

const supabase = createClient('https://goowpzynxlohbbrfqqng.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdvb3dwenlueGxvaGJicmZxcW5nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzE1Njc3NSwiZXhwIjoyMTAyNzMyNzc1fQ._U7qMxWI7TsWebKsv4vOe33-d36onk_aZiVkaJMj2E4')

async function run() {
  const { data, error } = await supabase.from('retail_orders').select('shipping_address, total_amount').limit(1)
  console.log(JSON.stringify(data, null, 2))
  
  const { data: items } = await supabase.from('retail_order_items').select('*').limit(1)
  console.log(JSON.stringify(items, null, 2))
}
run()
