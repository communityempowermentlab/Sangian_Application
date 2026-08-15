// Normalizes an Indian mobile number to its canonical bare 10-digit form
// (e.g. "+91 98075-62620", "09807562620", "919807562620" all become
// "9807562620"), or returns null if it isn't a valid Indian mobile number.
// Used everywhere a mobile number is validated/stored (registration,
// OTP send/verify) so the same input always normalizes to the same
// canonical value, and matches the bare-10-digit `msisdn` format the SMS
// gateway (smsService.js) expects.
function normalizeIndianMobile(raw) {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, '');

  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);

  if (/^[6-9]\d{9}$/.test(digits)) return digits;
  return null;
}

module.exports = { normalizeIndianMobile };
