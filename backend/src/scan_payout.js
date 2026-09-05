const https = require('https');
const crypto = require('crypto');
const fs = require('fs');

const dbPath = 'backend/data/database.json';
const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8')).dbData;
// Use settings from database
const apiKey = dbData.settings.winpey_api_key || "488b923c-2b03-465e-b9df-55d018124e0c";
const apiSecret = dbData.settings.winpey_api_secret || "fc4a56a2439f47c19213c747ee5693c6";

const variations = [
  // 1. camelCase standard
  {
    name: "Variation 1: camelCase standard (merchantOrderId, accountNumber, accountName, ifsc)",
    payload: {
      merchantOrderId: 'scan1_' + Date.now(),
      amount: 1.00,
      bankName: 'State Bank of India',
      accountNumber: '5414512478945',
      accountName: 'Demo',
      ifsc: 'SBIN0005154',
      currency: 'INR'
    }
  },
  // 2. camelCase variation (merchantOrderId, accountNo, accountHolder, ifscCode)
  {
    name: "Variation 2: camelCase variation (merchantOrderId, accountNo, accountHolder, ifscCode)",
    payload: {
      merchantOrderId: 'scan2_' + Date.now(),
      amount: 1.00,
      bankName: 'State Bank of India',
      accountNo: '5414512478945',
      accountHolder: 'Demo',
      ifscCode: 'SBIN0005154',
      currency: 'INR'
    }
  },
  // 3. out_trade_no (traditional Chinese gateway style)
  {
    name: "Variation 3: out_trade_no style (out_trade_no, bank_account, account_name, ifsc)",
    payload: {
      out_trade_no: 'scan3_' + Date.now(),
      amount: 1.00,
      bank_name: 'State Bank of India',
      bank_account: '5414512478945',
      account_name: 'Demo',
      ifsc: 'SBIN0005154',
      currency: 'INR'
    }
  },
  // 4. mchOrderNo style
  {
    name: "Variation 4: mchOrderNo style (mchOrderNo, accountNo, accountName, ifscCode)",
    payload: {
      mchOrderNo: 'scan4_' + Date.now(),
      amount: 1.00,
      bankName: 'State Bank of India',
      accountNo: '5414512478945',
      accountName: 'Demo',
      ifscCode: 'SBIN0005154',
      currency: 'INR'
    }
  },
  // 5. beneficiary_name (standard SNAP/Indian transfer style)
  {
    name: "Variation 5: beneficiary style (merchant_order_id, account_no, beneficiary_name, ifsc)",
    payload: {
      merchant_order_id: 'scan5_' + Date.now(),
      amount: 1.00,
      bank_name: 'State Bank of India',
      account_no: '5414512478945',
      beneficiary_name: 'Demo',
      ifsc: 'SBIN0005154',
      currency: 'INR'
    }
  },
  // 6. minimum required fields (merchant_order_id, amount, account_no, ifsc)
  {
    name: "Variation 6: minimal (merchant_order_id, amount, account_no, ifsc, account_name)",
    payload: {
      merchant_order_id: 'scan6_' + Date.now(),
      amount: 1.00,
      account_no: '5414512478945',
      account_name: 'Demo',
      ifsc: 'SBIN0005154'
    }
  }
];

async function testVariation(variation) {
  return new Promise((resolve) => {
    const payload = { ...variation.payload };
    
    // Sign
    const signParams = { ...payload };
    const sortedKeys = Object.keys(signParams).sort();
    const joined = sortedKeys.map(k => `${k}=${signParams[k]}`).join('&');
    const stringToSign = `${joined}&key=${apiSecret}`;
    const signature = crypto.createHash('sha256').update(stringToSign).digest('hex').toLowerCase();
    payload.sign = signature;

    const dataString = JSON.stringify(payload);

    const options = {
      hostname: 'winpey.us.cc',
      port: 443,
      path: '/api/v1/payout/create',
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
        'X-Api-Secret': apiSecret,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataString)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        resolve({ name: variation.name, response: body });
      });
    });

    req.on('error', (e) => {
      resolve({ name: variation.name, response: `Error: ${e.message}` });
    });
    req.write(dataString);
    req.end();
  });
}

async function run() {
  console.log('Starting Winpey Payout API scan...');
  for (const v of variations) {
    const res = await testVariation(v);
    console.log(`\n-------------------------------------`);
    console.log(res.name);
    console.log(`Response: ${res.response}`);
  }
  console.log('\nScan completed.');
}

run();
