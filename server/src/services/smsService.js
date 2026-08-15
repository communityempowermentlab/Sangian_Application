const axios = require('axios');

// SMS India Hub (cloud.smsindiahub.in) — a DLT-compliant Indian bulk/
// transactional SMS gateway. India's TRAI regulations require the sender ID
// (`sid`) AND the exact message text to be pre-registered on the DLT
// platform — sending arbitrary text through an approved sender ID gets
// silently dropped by the carrier's scrubber, regardless of whether this
// API call itself succeeds.
//
// TEMPORARY: SID `CELKMC` and the message template below are reused as-is
// from an existing CEL project (Saksham/KGMU) at the user's explicit
// request, as a stopgap to prove the send pipeline end-to-end. This is NOT
// a Sangian-specific DLT-approved template — replace SMS_OTP_TEMPLATE (env)
// with a proper Sangian-branded, DLT-approved template before relying on
// this for real users; until then, delivery is best-effort/unverified.
const SMS_GATEWAY_URL = 'https://cloud.smsindiahub.in/vendorsms/pushsms.aspx';

const SMS_USER = process.env.SMS_INDIAHUB_USER || 'saksham_cel';
const SMS_PASSWORD = process.env.SMS_INDIAHUB_PASSWORD || '13#APR$2021';
const SMS_SID = process.env.SMS_INDIAHUB_SID || 'CELKMC';
// {otp} is substituted with the actual code before sending.
const SMS_OTP_TEMPLATE = process.env.SMS_OTP_TEMPLATE
  || 'OTP {otp} से आप KGMU Lucknow फैसिलिटी में लॉगिन कर सकते हैं। CEL';

// mobile must already be a normalized bare 10-digit Indian number (see
// utils/mobileNumber.js) — the gateway's `msisdn` param expects exactly
// that form, no +91/leading-0 prefix.
const sendOtpSms = async (mobile, otp) => {
  const msg = SMS_OTP_TEMPLATE.replace('{otp}', otp);

  const { data } = await axios.get(SMS_GATEWAY_URL, {
    params: {
      user: SMS_USER,
      password: SMS_PASSWORD,
      msisdn: mobile,
      sid: SMS_SID,
      msg,
      fl: 0,
      // dc=8 selects UCS2/Unicode encoding — required because the template
      // contains non-ASCII (Hindi) characters; a plain-ASCII template could
      // use dc=0 instead, but this stays correct either way since UCS2
      // covers ASCII too.
      dc: 8,
      gwid: 2,
    },
    timeout: 10000,
  });

  console.log(`📱 [SMS India Hub] Sent to ${mobile} — gateway response:`, typeof data === 'string' ? data : JSON.stringify(data));
  return { sent: true, gatewayResponse: data };
};

module.exports = { sendOtpSms };
