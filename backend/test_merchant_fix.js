const assert = require('assert');
const {
  getRandomSellerName,
  getBankNameFromUpi,
  sanitizeSellerName,
  sanitizeBankName,
  getAdminFallbackReceiver
} = require('./src/utils/merchantHelper');

console.log('--- Testing Merchant & UPI Allocation Fix ---');

// Test 1: Random seller names
const name1 = getRandomSellerName();
assert(typeof name1 === 'string' && name1.length > 3, 'Seller name should be a non-empty string');
console.log('Test 1 Passed: Random seller name generated ->', name1);

// Test 2: Sanitize rogue / official names
const dirtyNames = ['Official Merchant', 'official merchant', 'OFFICIAL', 'Admin', 'System Administrator', 'P2P Desk', 'Earnclub', 'Seller 101'];
for (const bad of dirtyNames) {
  const cleaned = sanitizeSellerName(bad);
  assert(!cleaned.toLowerCase().includes('official'), `Failed to sanitize: ${bad}`);
  assert(!cleaned.toLowerCase().includes('merchant') || cleaned.toLowerCase().includes('agarwal'), `Failed to sanitize: ${bad}`);
  assert(!cleaned.toLowerCase().includes('earnclub'), `Failed to sanitize: ${bad}`);
}
console.log('Test 2 Passed: All rogue/official names sanitized successfully.');

// Test 3: Bank name derivation from UPI
assert.strictEqual(getBankNameFromUpi('john@okhdfcbank'), 'HDFC Bank');
assert.strictEqual(getBankNameFromUpi('user@okaxis'), 'Axis Bank');
assert.strictEqual(getBankNameFromUpi('myname@ybl'), 'YES Bank');
assert.strictEqual(getBankNameFromUpi('pay@paytm'), 'Paytm Payments Bank');
assert.strictEqual(getBankNameFromUpi('someone@oksbi'), 'State Bank of India');
assert.strictEqual(getBankNameFromUpi('club@apl'), 'AU Small Finance Bank');
console.log('Test 3 Passed: Bank names derived accurately from UPI handles.');

// Test 4: Sanitize rogue bank name
const cleanBank = sanitizeBankName('Official Payment', 'test@ybl');
assert.strictEqual(cleanBank, 'YES Bank', 'Official Payment must be converted to realistic bank name');
console.log('Test 4 Passed: "Official Payment" cleanly replaced by realistic bank name ->', cleanBank);

// Test 5: Admin fallback with admin UPI rotation
const mockSettings = {
  upi_ids: 'myadmin1@ybl, myadmin2@okhdfcbank, Earnclub@apl',
  admin_receiver_name: 'Official Merchant',
  admin_bank_name: 'Official Payment'
};

for (let i = 0; i < 20; i++) {
  const fallback = getAdminFallbackReceiver(mockSettings, i);
  // Ensure "Earnclub@apl" was filtered out
  assert(fallback.upi_id !== 'Earnclub@apl', 'Earnclub@apl must be filtered out of upi_ids');
  assert(fallback.upi_id === 'myadmin1@ybl' || fallback.upi_id === 'myadmin2@okhdfcbank', 'Must select from valid admin UPIs');
  // Ensure receiver_name is never "Official Merchant"
  assert(!fallback.receiver_name.toLowerCase().includes('official'), 'Fallback receiver_name must not include "official"');
  // Ensure bank_name is never "Official Payment"
  assert(!fallback.bank_name.toLowerCase().includes('official'), 'Fallback bank_name must not include "official"');
}
console.log('Test 5 Passed: Admin fallback rotation & rogue filtering verified over 20 iterations.');

console.log('\n>>> ALL 5 TESTS PASSED SUCCESSFULLY! <<<\n');
