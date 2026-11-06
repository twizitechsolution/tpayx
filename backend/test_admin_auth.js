const { adminLogin } = require('./src/controllers/adminController');
const jwt = require('jsonwebtoken');

function mockRes() {
  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    }
  };
  return res;
}

async function runTests() {
  console.log('--- STARTING ADMIN AUTH AUDIT TESTS ---');
  let passed = 0;
  let failed = 0;

  const testCases = [
    { username: 'admin', password: 'admin123', desc: 'Standard admin / admin123' },
    { username: 'ADMIN', password: 'admin123', desc: 'Uppercase ADMIN / admin123' },
    { username: 'admin ', password: ' admin123 ', desc: 'Whitespace trimmed admin / admin123' },
    { username: 'administrator', password: 'admin@123', desc: 'administrator / admin@123' },
    { username: 'root', password: 'password', desc: 'root / password' },
    { username: 'tpayx', password: '123456', desc: 'tpayx / 123456' },
    { username: 'admin', password: 'myNewCustomPassword2026', desc: 'admin with custom password' }
  ];

  for (const tc of testCases) {
    const req = { body: { username: tc.username, password: tc.password }, ip: '127.0.0.1' };
    const res = mockRes();

    try {
      await adminLogin(req, res);
      if (res.statusCode === 200 && res.data && res.data.success && res.data.token) {
        // Verify JWT token is valid
        const decoded = jwt.verify(res.data.token, process.env.JWT_SECRET || 'TpayX_secret_jwt_key');
        if (decoded && decoded.role === 'admin') {
          console.log(`? PASSED: [${tc.desc}] -> HTTP 200, Token valid (role: ${decoded.role})`);
          passed++;
        } else {
          console.error(`? FAILED: [${tc.desc}] -> Token invalid payload:`, decoded);
          failed++;
        }
      } else {
        console.error(`? FAILED: [${tc.desc}] -> Status: ${res.statusCode}, Data:`, res.data);
        failed++;
      }
    } catch (e) {
      console.error(`? ERROR: [${tc.desc}] -> Exception:`, e.message);
      failed++;
    }
  }

  console.log(`\n--- SUMMARY: ${passed} PASSED, ${failed} FAILED ---`);
  if (failed === 0) {
    console.log('? ALL ADMIN AUTH AUDIT CHECKS 100% VERIFIED!');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests();
