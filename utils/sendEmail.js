const nodemailer = require('nodemailer')

const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.BREVO_USER,
        pass: process.env.BREVO_PASS,
    }
});


exports.sendOtpEmail = async (email, otp) => {
    await transporter.sendMail({
        from: `"SnapLink" <${process.env.MAIL_FROM}>`,
        to: email,
        subject: 'Your OTP Code',
        html: `
            <div style="font-family:monospace;padding:2rem;max-width:400px">
                <h2>Your OTP Code</h2>
                <p>Yeh code sirf <strong>10 minutes</strong> ke liye valid hai.</p>
                <div style="font-size:32px;font-weight:700;letter-spacing:8px;
                            background:#f5f5f3;padding:1rem;border-radius:8px;
                            text-align:center;margin:1rem 0">
                    ${otp}
                </div>
                <p style="color:#999;font-size:12px">
                    Agar tumne request nahi kiya toh ignore karo.
                </p>
            </div>
        `
    })
}