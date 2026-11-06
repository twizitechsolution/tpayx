// Utility functions for P2P Merchant and UPI allocation
// Ensures no "Official Merchant" or legacy fake accounts appear and rotates valid admin UPIs with natural names

const RANDOM_SELLER_NAMES = [
  'Ramesh Kumar', 'Amit Sharma', 'Vikram Singh', 'Deepak Verma', 'Suresh Patel',
  'Rajesh Yadav', 'Pooja Gupta', 'Ankit Mishra', 'Rahul Verma', 'Sunil Chauhan',
  'Manoj Tiwari', 'Rohit Mehra', 'Sanjay Rawat', 'Ajay Thakur', 'Praveen Joshi',
  'Manish Agarwal', 'Kavita Devi', 'Neeraj Pandey', 'Dinesh Saini', 'Vikas Goyal'
];

function getRandomSellerName(seed = null) {
  if (seed && typeof seed === 'number') {
    return RANDOM_SELLER_NAMES[Math.abs(seed) % RANDOM_SELLER_NAMES.length];
  }
  return RANDOM_SELLER_NAMES[Math.floor(Math.random() * RANDOM_SELLER_NAMES.length)];
}

function getBankNameFromUpi(upiId) {
  if (!upiId) return 'State Bank of India';
  const clean = String(upiId).toLowerCase().trim();
  const handle = clean.includes('@') ? clean.split('@')[1] : clean;
  if (handle.includes('okhdfc') || handle.includes('hdfc')) return 'HDFC Bank';
  if (handle.includes('okaxis') || handle.includes('axis')) return 'Axis Bank';
  if (handle.includes('okicici') || handle.includes('icici')) return 'ICICI Bank';
  if (handle.includes('oksbi') || handle.includes('sbi')) return 'State Bank of India';
  if (handle.includes('ybl') || handle.includes('ibl')) return 'YES Bank';
  if (handle.includes('paytm')) return 'Paytm Payments Bank';
  if (handle.includes('airtel')) return 'Airtel Payments Bank';
  if (handle.includes('ippb') || handle.includes('postbank')) return 'India Post Payments Bank';
  if (handle.includes('barodampay') || handle.includes('bob')) return 'Bank of Baroda';
  if (handle.includes('pnb')) return 'Punjab National Bank';
  if (handle.includes('cnrb') || handle.includes('canara')) return 'Canara Bank';
  if (handle.includes('aubank') || handle.includes('apl')) return 'AU Small Finance Bank';
  if (handle.includes('kotak')) return 'Kotak Mahindra Bank';
  if (handle.includes('idbi')) return 'IDBI Bank';
  if (handle.includes('unionbank') || handle.includes('uboi')) return 'Union Bank of India';
  if (handle.includes('federal')) return 'Federal Bank';
  if (handle.includes('indus')) return 'IndusInd Bank';
  return 'State Bank of India';
}

function sanitizeSellerName(rawName, seed = null) {
  if (!rawName) return getRandomSellerName(seed);
  const lower = String(rawName).toLowerCase().trim();
  if (
    lower.includes('official') ||
    lower.includes('merchant') ||
    lower.includes('admin') ||
    lower.includes('earnclub') ||
    lower.includes('desk') ||
    lower.includes('system') ||
    lower.includes('seller') ||
    lower.length < 3
  ) {
    return getRandomSellerName(seed);
  }
  return rawName;
}

function sanitizeBankName(rawBank, upiId) {
  if (!rawBank) return getBankNameFromUpi(upiId);
  const lower = String(rawBank).toLowerCase().trim();
  if (
    lower.includes('official') ||
    lower.includes('payment') ||
    lower.includes('earnclub') ||
    lower.length < 3
  ) {
    return getBankNameFromUpi(upiId);
  }
  return rawBank;
}

function getAdminFallbackReceiver(settings = {}, seed = null) {
  // Extract all configured UPI IDs from Admin Panel Settings
  const rawUpi = settings.upi_ids || settings.upi_id || '';
  const upiList = String(rawUpi)
    .split(/[\r\n,]+/)
    .map(s => s.trim())
    .filter(s => Boolean(s) && !s.toLowerCase().includes('earnclub') && !s.toLowerCase().includes('official'));

  const selectedUpi = upiList.length > 0
    ? upiList[Math.floor(Math.random() * upiList.length)]
    : '7790098808@ybl';

  const sellerName = getRandomSellerName(seed);
  const bankName = getBankNameFromUpi(selectedUpi);
  const accNum = settings.admin_account_number && !settings.admin_account_number.toLowerCase().includes('official')
    ? settings.admin_account_number
    : '50100' + Math.floor(100000000 + Math.random() * 900000000);

  const ifsc = settings.admin_ifsc_code || (
    bankName === 'HDFC Bank' ? 'HDFC0000123' :
    bankName === 'Airtel Payments Bank' ? 'AIRP0000001' :
    bankName === 'Paytm Payments Bank' ? 'PYTM0123456' :
    bankName === 'YES Bank' ? 'YESB0000001' :
    'SBIN0001234'
  );

  return {
    receiver_name: sellerName,
    bank_name: bankName,
    account_number: accNum,
    ifsc_code: ifsc,
    upi_id: selectedUpi,
    mobile: settings.admin_mobile || '9876543210'
  };
}

module.exports = {
  RANDOM_SELLER_NAMES,
  getRandomSellerName,
  getBankNameFromUpi,
  sanitizeSellerName,
  sanitizeBankName,
  getAdminFallbackReceiver
};
