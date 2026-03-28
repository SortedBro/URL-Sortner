const { Resend } = require('resend');

const { appConfig } = require('../config/appConfig');

let resendClient = null;

if (appConfig.resendApiKey) {
    resendClient = new Resend(appConfig.resendApiKey);
}

function getClient() {
    if (!resendClient) {
        throw new Error('RESEND_API_KEY is not configured');
    }
    return resendClient;
}

function renderTopLinks(topLinks) {
    if (!Array.isArray(topLinks) || !topLinks.length) {
        return '<p style="margin:0;color:#6b6862;font-size:14px;line-height:1.7">No active links to report this week.</p>';
    }

    return topLinks
        .map(
            (item, index) => `
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #f0ede8;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#1a1916">${index + 1}. /${item.shortCode}</td>
              <td style="padding:10px 0;border-bottom:1px solid #f0ede8;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6b6862" align="right">${item.clicks} clicks</td>
            </tr>`
        )
        .join('');
}

async function sendWeeklyReportEmail({ to, name, report }) {
    const firstName = String(name || 'there').trim().split(/\s+/)[0] || 'there';

    return getClient().emails.send({
        from: 'SnapLink <noreply@snaplink.fun>',
        to,
        subject: `Weekly SnapLink report for ${firstName}`,
        html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f5f1e8">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f1e8;padding:36px 16px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden">
          <tr>
            <td style="height:5px;background:#fac775;font-size:0;line-height:0">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:34px 34px 28px">
              <p style="margin:0 0 8px;font-family:Helvetica,Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#b8860b">Weekly Report</p>
              <h1 style="margin:0 0 12px;font-family:Helvetica,Arial,sans-serif;font-size:28px;line-height:1.1;color:#1a1916">Hi ${firstName}, your SnapLink week at a glance</h1>
              <p style="margin:0 0 24px;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.7;color:#6b6862">Here is a quick summary of your last 7 days of link activity.</p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
                <tr>
                  <td style="width:33.33%;padding:12px;background:#f9f6ef;border-radius:12px" valign="top">
                    <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#9a9487">Total links</div>
                    <div style="margin-top:6px;font-family:Helvetica,Arial,sans-serif;font-size:26px;font-weight:700;color:#1a1916">${report.totalLinks}</div>
                  </td>
                  <td style="width:8px"></td>
                  <td style="width:33.33%;padding:12px;background:#f9f6ef;border-radius:12px" valign="top">
                    <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#9a9487">Clicks</div>
                    <div style="margin-top:6px;font-family:Helvetica,Arial,sans-serif;font-size:26px;font-weight:700;color:#1a1916">${report.totalClicks}</div>
                  </td>
                  <td style="width:8px"></td>
                  <td style="width:33.33%;padding:12px;background:#f9f6ef;border-radius:12px" valign="top">
                    <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#9a9487">New this week</div>
                    <div style="margin-top:6px;font-family:Helvetica,Arial,sans-serif;font-size:26px;font-weight:700;color:#1a1916">${report.newLinksThisWeek}</div>
                  </td>
                </tr>
              </table>

              <div style="padding:18px;border:1px solid #f0ede8;border-radius:16px">
                <div style="margin-bottom:10px;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:#1a1916">Top performing links</div>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${renderTopLinks(report.topLinks)}
                </table>
              </div>

              <p style="margin:24px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.7;color:#6b6862">
                Dashboard: <a href="${appConfig.appUrl || 'https://snaplink.fun'}/dashboard" style="color:#b8860b;text-decoration:none">${appConfig.appUrl || 'https://snaplink.fun'}/dashboard</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    });
}

module.exports = {
    sendWeeklyReportEmail,
};
