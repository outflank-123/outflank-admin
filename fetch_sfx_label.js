const https = require('https');
const token = '1b138578bd8e9d3dbb3a20a916d6441fb00113dd';
const awb = 'SF1819099539FKP'; // From user's screenshot

const req = https.request(`https://dale.staging.shadowfax.in/api/v3/clients/orders/${awb}/`, {
  method: 'GET',
  headers: {
    'Authorization': `Token ${token}`,
  }
}, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => console.log(JSON.stringify(JSON.parse(body), null, 2)));
});
req.on('error', e => console.error(e));
req.end();
