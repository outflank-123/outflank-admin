import dotenv from 'dotenv';
dotenv.config();

async function test() {
   const token = process.env.WHATSAPP_ACCESS_TOKEN;
   const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
   
   if (!token || !phoneId) {
      console.log("Missing token or phoneId in .env");
      return;
   }
   
   const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '918447334407',
      type: 'template',
      template: {
         name: 'hello_world',
         language: { code: 'en_US' }
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
