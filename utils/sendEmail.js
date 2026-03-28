const { Resend } = require('resend');
const { appConfig } = require('../config/appConfig');
const resend = new Resend(appConfig.resendApiKey);

if (!appConfig.resendApiKey) {
    console.warn('RESEND_API_KEY is missing. OTP/Welcome emails will fail until it is configured.');
}

// ─────────────────────────────────────────
//  OTP Email
// ─────────────────────────────────────────
exports.sendOtpEmail = async (email, otp) => {
    await resend.emails.send({
        from: 'SnapLink <noreply@snaplink.fun>',
        to: email,
        subject: `${otp} is your SnapLink verification code`,
        html: `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="light"/>
<meta name="supported-color-schemes" content="light"/>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f0ede8;-webkit-text-size-adjust:100%;mso-line-height-rule:exactly">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0ede8;padding:40px 16px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">

  <!-- Logo bar -->
  <tr><td style="padding-bottom:20px" align="center">
    <table role="presentation" cellpadding="0" cellspacing="0">
      <tr>
        <td style="width:8px;height:8px;background-color:#f5c842;border-radius:50%;vertical-align:middle"></td>
        <td style="padding-left:8px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:18px;font-weight:700;color:#1a1916;letter-spacing:-0.3px">
          Snap<span style="color:#b8860b">Link</span>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Main card -->
  <tr><td style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">

    <!-- Yellow top bar -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="height:4px;background-color:#f5c842;font-size:0;line-height:0">&nbsp;</td></tr>
    </table>

    <!-- Body -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding:40px 44px 36px">

        <!-- Icon -->
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
          <tr>
            <td style="width:48px;height:48px;background-color:#fef9e7;border:1.5px solid #f5c842;border-radius:12px;text-align:center;vertical-align:middle;font-size:22px;line-height:48px">
              🔐
            </td>
            <td style="padding-left:14px;vertical-align:middle">
              <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#b8860b;margin-bottom:3px">One-Time Password</div>
              <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:20px;font-weight:700;color:#1a1916;letter-spacing:-0.3px">Verification Code</div>
            </td>
          </tr>
        </table>

        <p style="margin:0 0 28px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:#6b6862;line-height:1.7">
          Tumne SnapLink mein login ya signup request kiya hai.<br/>
          Neeche diya code use karo — sirf <strong style="color:#1a1916">10 minutes</strong> ke liye valid hai.
        </p>

        <!-- OTP Box -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
          <tr>
            <td align="center" style="background-color:#fef9e7;border:2px solid #f5c842;border-radius:12px;padding:28px 20px">
              <div style="font-family:'Courier New',Courier,monospace;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#b8860b;margin-bottom:12px">Your OTP</div>
              <div style="font-family:'Courier New',Courier,monospace;font-size:44px;font-weight:700;letter-spacing:16px;color:#1a1400;text-indent:16px">${otp}</div>
            </td>
          </tr>
        </table>

        <!-- Timer -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
          <tr>
            <td style="background-color:#fff8e1;border-left:3px solid #f5c842;border-radius:0 8px 8px 0;padding:12px 16px">
              <span style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;color:#6b6862">
                ⏱&nbsp; Expires in <strong style="color:#b8860b">10 minutes</strong> — use it before it's gone.
              </span>
            </td>
          </tr>
        </table>

        <!-- Security note -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #f0ede8;padding-top:20px">
          <tr>
            <td style="padding-top:20px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:#a09d98;line-height:1.7">
              🔒 Agar tumne yeh request nahi kiya toh is email ko ignore karo — tumhara account safe hai. Yeh OTP kisi ke saath share mat karo. SnapLink team kabhi OTP nahi maangti.
            </td>
          </tr>
        </table>

      </td></tr>
    </table>

  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:20px 0" align="center">
    <p style="margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:#a09d98">
      &copy; 2026 SnapLink &nbsp;·&nbsp;
      <a href="https://snaplink.fun" style="color:#b8860b;text-decoration:none">snaplink.fun</a>
    </p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`
    });
};

// ─────────────────────────────────────────
//  Welcome Email
//  Usage: await sendWelcomeEmail(email, name)
// ─────────────────────────────────────────
exports.sendWelcomeEmail = async (email, name) => {
    const firstName = name ? name.split(' ')[0] : 'there';

    await resend.emails.send({
        from: 'SnapLink <noreply@snaplink.fun>',
        to: email,
        subject: `Welcome to SnapLink, ${firstName}! Your links await ⚡`,
        html: `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="light"/>
<meta name="supported-color-schemes" content="light"/>
</head>
<body style="margin:0;padding:0;background-color:#f0ede8;-webkit-text-size-adjust:100%">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0ede8;padding:40px 16px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">

  <!-- Logo -->
  <tr><td style="padding-bottom:20px" align="center">
    <table role="presentation" cellpadding="0" cellspacing="0">
      <tr>
        <td style="width:8px;height:8px;background-color:#f5c842;border-radius:50%;vertical-align:middle"></td>
        <td style="padding-left:8px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:18px;font-weight:700;color:#1a1916;letter-spacing:-0.3px">
          Snap<span style="color:#b8860b">Link</span>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Card -->
  <tr><td style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">

    <!-- Hero yellow gradient bar -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="height:5px;background-color:#f5c842;font-size:0;line-height:0">&nbsp;</td></tr>
    </table>

    <!-- Hero section -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:44px 44px 32px;background-color:#fffdf5">
          <div style="font-size:52px;line-height:1;margin-bottom:18px">⚡</div>
          <h1 style="margin:0 0 10px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:28px;font-weight:700;color:#1a1400;letter-spacing:-0.5px">
            Welcome, ${firstName}!
          </h1>
          <p style="margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;color:#6b6862;line-height:1.7">
            Tumhara SnapLink account ready hai.<br/>
            Ab apne long URLs ko snap karo —<br/>
            <strong style="color:#1a1916">clean, fast, aur trackable.</strong>
          </p>
        </td>
      </tr>
    </table>

    <!-- Divider -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="height:1px;background-color:#f0ede8;font-size:0;line-height:0">&nbsp;</td></tr>
    </table>

    <!-- Features -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding:32px 44px">

        <p style="margin:0 0 16px;font-family:'Courier New',Courier,monospace;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#a09d98">
          Tumhare paas ab hai
        </p>

        <!-- Feature rows -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #f0ede8;border-radius:12px;overflow:hidden">

          <tr style="border-bottom:1px solid #f0ede8">
            <td style="padding:14px 18px;border-bottom:1px solid #f0ede8">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="width:36px">
                    <div style="width:32px;height:32px;background-color:#fef9e7;border:1px solid #f5e196;border-radius:8px;text-align:center;line-height:32px;font-size:15px">🔗</div>
                  </td>
                  <td style="padding-left:12px;vertical-align:middle">
                    <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:#1a1916">Instant Short Links</div>
                    <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:#a09d98;margin-top:1px">Koi bhi URL seconds mein short karo</div>
                  </td>
                  <td align="right">
                    <span style="font-family:'Courier New',Courier,monospace;font-size:10px;font-weight:700;color:#2d8a4e;background-color:#e8f5ee;padding:3px 8px;border-radius:99px">FREE</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:14px 18px;border-bottom:1px solid #f0ede8">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="width:36px">
                    <div style="width:32px;height:32px;background-color:#eef5ff;border:1px solid #c5d9f5;border-radius:8px;text-align:center;line-height:32px;font-size:15px">📊</div>
                  </td>
                  <td style="padding-left:12px;vertical-align:middle">
                    <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:#1a1916">Click Analytics</div>
                    <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:#a09d98;margin-top:1px">Real-time clicks track karo</div>
                  </td>
                  <td align="right">
                    <span style="font-family:'Courier New',Courier,monospace;font-size:10px;font-weight:700;color:#2d8a4e;background-color:#e8f5ee;padding:3px 8px;border-radius:99px">FREE</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:14px 18px;border-bottom:1px solid #f0ede8">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="width:36px">
                    <div style="width:32px;height:32px;background-color:#f5f0ff;border:1px solid #d9c5f5;border-radius:8px;text-align:center;line-height:32px;font-size:15px">📷</div>
                  </td>
                  <td style="padding-left:12px;vertical-align:middle">
                    <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:#1a1916">QR Code Generator</div>
                    <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:#a09d98;margin-top:1px">Har link ka QR download karo</div>
                  </td>
                  <td align="right">
                    <span style="font-family:'Courier New',Courier,monospace;font-size:10px;font-weight:700;color:#2d8a4e;background-color:#e8f5ee;padding:3px 8px;border-radius:99px">FREE</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:14px 18px">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="width:36px">
                    <div style="width:32px;height:32px;background-color:#fef9e7;border:1px solid #f5e196;border-radius:8px;text-align:center;line-height:32px;font-size:15px">⭐</div>
                  </td>
                  <td style="padding-left:12px;vertical-align:middle">
                    <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:#1a1916">Custom Alias + Password Lock</div>
                    <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:#a09d98;margin-top:1px">snap.link/tumhara-naam — Pro mein</div>
                  </td>
                  <td align="right">
                    <span style="font-family:'Courier New',Courier,monospace;font-size:10px;font-weight:700;color:#b8860b;background-color:#fef9e7;padding:3px 8px;border-radius:99px">PRO</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td></tr>
    </table>

    <!-- CTA -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center" style="padding:4px 44px 36px">
        <a href="https://snaplink.fun/dashboard"
           style="display:inline-block;background-color:#f5c842;color:#1a1400;
                   font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
                   font-size:15px;font-weight:700;padding:15px 40px;
                   border-radius:10px;text-decoration:none;letter-spacing:0.02em">
          Pehla Link Snap Karo →
        </a>
        <p style="margin:12px 0 0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:#a09d98">
          <a href="https://snaplink.fun/dashboard" style="color:#b8860b;text-decoration:none">snaplink.fun/dashboard</a>
        </p>
      </td></tr>
    </table>

    <!-- Personal note -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding:0 44px 36px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fffdf5;border:1px solid #f5e196;border-radius:10px">
          <tr><td style="padding:18px 22px">
            <p style="margin:0 0 6px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;color:#1a1400">
              SnapLink Team ki taraf se ✌️
            </p>
            <p style="margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;color:#6b6862;line-height:1.8">
              Khush hain ki tum hamare saath ho, <strong>${firstName}</strong>!
              Koi bhi problem ya suggestion ho toh directly reply karo —
              hum personally respond karte hain. Ab jao aur apna pehla link snap karo! 🚀
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>

  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:20px 0" align="center">
    <p style="margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:#a09d98">
      &copy; 2026 SnapLink &nbsp;·&nbsp;
      <a href="https://snaplink.fun" style="color:#b8860b;text-decoration:none">snaplink.fun</a>
      &nbsp;·&nbsp;
      <a href="https://snaplink.fun/unsubscribe" style="color:#a09d98;text-decoration:none">Unsubscribe</a>
    </p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`
    });
};
