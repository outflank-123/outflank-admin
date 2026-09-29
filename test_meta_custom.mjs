import dotenv from 'dotenv';
dotenv.config();

async function test() {
   const token = process.env.WHATSAPP_ACCESS_TOKEN;
   const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
   
   if (!token || !phoneId) {
      console.log("Missing credentials");
      return;
   }
   
   const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '918447334407',
      type: 'template',
      template: {
         name: 'outflank_custom_message',
         language: { code: 'en' },
         components: [
            {
               type: 'header',
               parameters: [
                  { type: 'image', image: { link: 'https://bestgifts.co.in/wp-content/uploads/2026/09/j156.jpg' } }
               ]
            },
            {
               type: 'body',
               parameters: [
                  { type: 'text', text: 'Admin Tester' },
                  { type: 'text', text: 'This is a strict test from the API.' }
               ]
            },
            {
               type: 'button',
               sub_type: 'url',
               index: 0,
               parameters: [
                  { type: 'text', text: 'products' }
               ]
            }
         ]
      }
   };
   
   const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
         'Authorization': `Bearer ${token}`,
         'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
   });
   
   const json = await res.json();
   console.log("Response:", JSON.stringify(json, null, 2));
}
test();
