import fetch from 'node-fetch';

const SHADOWFAX_BASE_URL = 'https://dale.staging.shadowfax.in/api';
const SHADOWFAX_API_TOKEN = '1b138578bd8e9d3dbb3a20a916d6441fb00113dd';

async function testDispatchDirect() {
  const sfxBody = {
      order_details: {
        client_order_id: "test-order-" + Date.now(),
        payment_mode: "prepaid",
        cod_amount: 0,
        product_value: 500,
      },
      customer_details: {
        name: "Test Customer",
        contact: "9876543210",
        address_line_1: "123 Test Street",
        address_line_2: "",
        city: "Delhi",
        state: "Delhi",
        pincode: "110001",
      },
      pickup_details: {
        name: 'Outflank Warehouse',
        contact: '9999926273',
        address_line_1: 'T-513/1, Gali Dargah Wali, Near Fire Station',
        city: 'New Delhi',
        state: 'Delhi',
        pincode: '110001',
      },
      return_details: {
        return_type: 'origin',
        name: 'Outflank Warehouse',
        contact: '9999926273',
        address_line_1: 'T-513/1, Gali Dargah Wali, Near Fire Station',
        city: 'New Delhi',
        state: 'Delhi',
        pincode: '110001',
      },
      product_details: [{
        name: "Outflank Product",
        sku_name: "Outflank Product",
        quantity: 1,
        price: 500,
        weight: 1.0,
      }]
  };

  const res = await fetch(`${SHADOWFAX_BASE_URL}/v3/clients/orders/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Token ${SHADOWFAX_API_TOKEN}`
    },
    body: JSON.stringify(sfxBody)
  });

  const text = await res.text();
  console.log('\nShadowfax API Response:', text);
  
  try {
    const data = JSON.parse(text);
    if (res.ok && (data.awb_number || (data.data && data.data.awb_number))) {
      console.log(`\n🎉 SUCCESS! API Key is working perfectly.`);
      console.log(`AWB Number Generated: ${data.awb_number || data.data.awb_number}`);
    } else {
      console.log(`\n❌ Failed to generate AWB`);
    }
  } catch(e) {}
}

testDispatchDirect();
