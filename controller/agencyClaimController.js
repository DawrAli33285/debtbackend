// const Claim = require('../models/claim');
// const Agency = require('../models/agency');
// const { ChatRoom } = require('../models/chat');
// const Assignment = require('../models/assignment');

// exports.acceptClaim = async (req, res) => {
//   try {
//     const claim = await Claim.findById(req.params.id);
//     if (!claim) return res.status(404).json({ message: 'Claim not found' });
//     const assignment= await Assignment.findOne({claim_id:claim._id})
    
//     if (claim.status === 'closed' || claim.status === 'denied')
//       return res.status(400).json({ message: 'This claim is already closed or denied' });

//     const agency = await Agency.findById(req.agencyUser.agency_id || req.agencyUser._id);
//     if (!agency) return res.status(404).json({ message: 'Agency not found' });

//     if (agency.claims_used >= agency.claim_limit)
//       return res.status(403).json({ message: 'Monthly claim limit reached. Upgrade your plan.' });

//     claim.status = 'in_progress';
    
//     await claim.save();

//     agency.claims_used += 1;
//     await agency.save();


//         await ChatRoom.create({
//           claim_id:  assignment.claim_id,
//           agency_id: assignment.agency_id,
//           user_id:   claim.user_id,  
//         });
    

//     res.json({ message: 'Claim accepted successfully', claim });
//   } catch (err) {
//     console.log(err.message);
//     res.status(500).json({ message: 'Server error', error: err.message });
//   }
// };

// exports.denyClaim = async (req, res) => {
//   try {
//     const claim = await Claim.findById(req.params.id);
//     if (!claim) return res.status(404).json({ message: 'Claim not found' });

//     if (claim.status === 'closed' || claim.status === 'denied')
//       return res.status(400).json({ message: 'This claim is already closed or denied' });

//     claim.status = 'denied';
//     await claim.save();

//     res.json({ message: 'Claim denied', claim });
//   } catch (err) {
//     console.log(err.message);
//     res.status(500).json({ message: 'Server error', error: err.message });
//   }
// };


// // ADD to existing controller file

// exports.reopenClaim = async (req, res) => {
//   try {
//     const claim = await Claim.findById(req.params.id);
//     if (!claim) return res.status(404).json({ message: 'Claim not found' });
   
//     claim.status = 'in_progress';
//     await claim.save();
//     res.json({ claim });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

// exports.closeClaim = async (req, res) => {
//   try {
//     const claim = await Claim.findById(req.params.id);
//     if (!claim) return res.status(404).json({ message: 'Claim not found' });
//     if (claim.status !== 'in_progress') return res.status(400).json({ message: 'Only in-progress claims can be closed' });

//     claim.status = 'closed';
//     await claim.save();
//     res.json({ claim });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };






const Claim = require('../models/claim');
const Agency = require('../models/agency');
const { ChatRoom } = require('../models/chat');
const Mailgun = require("mailgun.js");
const FormData = require("form-data");
const Assignment = require('../models/assignment');
const User = require('../models/user');

const nodemailer = require('nodemailer'); // add this if you have nodemailer setup

// ── helper: send email (adjust to your existing email setup) ──────────────────
const sendMail = async ({ to, subject, html }) => {
  try {
    const transporter = nodemailer.createTransporter({
      // replace with your SMTP config / service
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
    await transporter.sendMail({ from: process.env.EMAIL_USER, to, subject, html });
  } catch (err) {
    console.error('Email send error:', err.message);
  }
};

// ── Agency accepts a claim ────────────────────────────────────────────────────
// Status: assigned → approved_by_agency → pending_admin
exports.acceptClaim = async (req, res) => {
  try {
    const claim = await Claim.findById(req.params.id).populate('user_id', 'email business_name');
    if (!claim) return res.status(404).json({ message: 'Claim not found' });

    if (['closed', 'denied', 'connection_denied'].includes(claim.status))
      return res.status(400).json({ message: 'This claim is already closed or denied' });

    const agency = await Agency.findById(req.agencyUser.agency_id || req.agencyUser._id);
    if (!agency) return res.status(404).json({ message: 'Agency not found' });

    if (agency.claims_used >= agency.claim_limit)
      return res.status(403).json({ message: 'Monthly claim limit reached. Upgrade your plan.' });

    const assignment = await Assignment.findOne({ claim_id: claim._id });

    // ✅ Move to pending_admin (NOT in_progress anymore)
    claim.status = 'pending';
    claim.agency_approved_at = new Date();
    await claim.save();

    // Update to pending_admin right after
    claim.status = 'pending';
    await claim.save();

    agency.claims_used += 1;
    await agency.save();

    // ✅ DO NOT create ChatRoom yet — only created after admin approves
    // ChatRoom is created in admin approveConnection controller

    // ✅ Notify business that agency approved and admin review is pending
    if (claim.user_id?.email) {
     
    }

    res.json({ message: 'Claim accepted — pending admin approval', claim });
  } catch (err) {
    console.log(err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── Agency denies a claim ─────────────────────────────────────────────────────
// Status: assigned → denied
exports.denyClaim = async (req, res) => {
  try {
    const claim = await Claim.findById(req.params.id);
    if (!claim) return res.status(404).json({ message: 'Claim not found' });

    if (['closed', 'denied', 'connection_denied'].includes(claim.status))
      return res.status(400).json({ message: 'This claim is already closed or denied' });

    claim.status = 'denied';
    await claim.save();

    // Send denial email to business
    const user = await User.findById(claim.user_id);
    if (user?.email) {
      const mailgun = new Mailgun(FormData);
      const mg = mailgun.client({
        username: "api",
        key: process.env.MAILGUN_API_KEY,
      });
  
      await mg.messages.create('collectionsconnector.com', {
        from: 'noreply@collectionsconnector.com',
        to: [user.email],
        subject: 'Update on Your Claim Submission - Collections Connector',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <div style="background-color: #1669A9; padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 26px;">Claim Status Update</h1>
            </div>
            <div style="padding: 30px;">
              <p style="color: #2c3e50; font-size: 15px;">Dear <strong>${user.business_name || user.contact_name || 'Business Owner'}</strong>,</p>
              <p style="color: #495057; font-size: 15px; line-height: 1.7;">I hope you're doing well.</p>
              <p style="color: #495057; font-size: 15px; line-height: 1.7;">
                We wanted to inform you that the agency you selected has reviewed your submitted claim and has decided not to accept it at this time.
              </p>
              <p style="color: #495057; font-size: 15px; line-height: 1.7;">
                While this can happen for a variety of reasons, the good news is that you still have options to move forward. You may:
              </p>
              <ul style="color: #495057; font-size: 15px; line-height: 1.9; padding-left: 20px;">
                <li>Resubmit the claim with any additional or updated information, or</li>
                <li>Reassign the claim to another agency within the platform for review</li>
              </ul>

              <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
                <tr>
                  <td style="padding: 12px; background-color: #f8f9fa; font-weight: 600; width: 40%; border: 1px solid #dee2e6;">Debtor</td>
                  <td style="padding: 12px; border: 1px solid #dee2e6;">${claim.debtor_name || '—'}</td>
                </tr>
                <tr>
                  <td style="padding: 12px; background-color: #f8f9fa; font-weight: 600; border: 1px solid #dee2e6;">Amount</td>
                  <td style="padding: 12px; border: 1px solid #dee2e6;">${claim.amount ? `$${Number(claim.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}</td>
                </tr>
              </table>

              <p style="color: #495057; font-size: 15px; line-height: 1.7;">
                Our goal is to help you get your claim placed with the right agency as efficiently as possible.
                If you need assistance selecting another agency or updating your submission, please don't hesitate to reach out — we're here to help.
              </p>
              <p style="color: #495057; font-size: 15px; line-height: 1.7;">
                Thank you for using our platform, and we look forward to helping you move this forward.
              </p>
              <p style="color: #2c3e50; font-size: 15px; margin-top: 24px;">
                Warm regards,<br/>
                <strong>The Collections Connector Team</strong>
              </p>
            </div>
            <div style="background-color: #f5f7fa; padding: 20px; text-align: center; border-top: 1px solid #e0e7ef;">
              <p style="margin: 0; color: #7a96a8; font-size: 12px;">© ${new Date().getFullYear()} Collections Connector. All rights reserved.</p>
            </div>
          </div>
        `,
      });
    }

    res.json({ message: 'Claim denied', claim });
  } catch (err) {
    console.log(err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── Close a claim ─────────────────────────────────────────────────────────────
// Only allowed when connection_approved (actively being worked)
exports.closeClaim = async (req, res) => {
  try {
    const claim = await Claim.findById(req.params.id);
    if (!claim) return res.status(404).json({ message: 'Claim not found' });

    // ✅ Only connection_approved claims can be closed (they are actively in work)
    if (claim.status!=='in_progress')
      return res.status(400).json({ message: 'Only active (connection approved) claims can be closed' });

    claim.status = 'closed';
    await claim.save();

    res.json({ message: 'Claim closed successfully', claim });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Reopen a claim ────────────────────────────────────────────────────────────
// Goes back to submitted so admin can reassign to a new agency
exports.reopenClaim = async (req, res) => {
  try {
    const claim = await Claim.findById(req.params.id);
    if (!claim) return res.status(404).json({ message: 'Claim not found' });

    if (claim.status !== 'closed')
      return res.status(400).json({ message: 'Only closed claims can be reopened' });

    const mailgun = new Mailgun(FormData);
    const mg = mailgun.client({
      username: "api",
      key: process.env.MAILGUN_API_KEY,
    });

    // Fetch business user and agency assignment
    const user = await User.findById(claim.user_id);
    const assignment = await Assignment.findOne({ claim_id: claim._id }).populate('agency_id');
    const agency = assignment?.agency_id;

    claim.status = 'assigned';
    await claim.save();

    const claimSummaryRows = `
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 12px; background-color: #f8f9fa; font-weight: 600; width: 40%; border: 1px solid #dee2e6;">Debtor</td>
          <td style="padding: 12px; border: 1px solid #dee2e6;">${claim.debtor_name || '—'}</td>
        </tr>
        <tr>
          <td style="padding: 12px; background-color: #f8f9fa; font-weight: 600; border: 1px solid #dee2e6;">Amount</td>
          <td style="padding: 12px; border: 1px solid #dee2e6;">${claim.amount ? `$${Number(claim.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}</td>
        </tr>
        <tr>
          <td style="padding: 12px; background-color: #f8f9fa; font-weight: 600; border: 1px solid #dee2e6;">Reopened On</td>
          <td style="padding: 12px; border: 1px solid #dee2e6;">${new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</td>
        </tr>
      </table>
    `;

    // Email to business
    if (user?.email) {
      await mg.messages.create("collectionsconnector.com", {
        from: 'noreply@collectionsconnector.com',
        to: [user.email],
        subject: '🔄 Your Claim Has Been Reopened - Collections Connector',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <div style="background-color: #1669A9; padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 26px;">Claim Reopened</h1>
            </div>
            <div style="padding: 30px;">
              <p style="color: #2c3e50; font-size: 15px;">Hi <strong>${user.business_name || user.contact_name || 'there'}</strong>,</p>
              <p style="color: #495057; font-size: 15px; line-height: 1.6;">
                Your claim has been <strong>reopened</strong> and is back in the queue. It has been reassigned to the agency and work will resume shortly.
              </p>
              ${claimSummaryRows}
              <p style="color: #495057; font-size: 14px; line-height: 1.6;">
                If you have any questions, please contact our support team.
              </p>
            </div>
            <div style="background-color: #f5f7fa; padding: 20px; text-align: center; border-top: 1px solid #e0e7ef;">
              <p style="margin: 0; color: #7a96a8; font-size: 12px;">© ${new Date().getFullYear()} Collections Connector. All rights reserved.</p>
            </div>
          </div>
        `,
      });
    }

    // Email to agency
    if (agency?.contact_email) {
      await mg.messages.create("collectionsconnector.com", {
        from: 'noreply@collectionsconnector.com',
        to: [agency.contact_email],
        subject: '🔄 Claim Reopened & Reassigned to Your Agency - Collections Connector',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <div style="background-color: #1669A9; padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 26px;">Claim Reassigned</h1>
            </div>
            <div style="padding: 30px;">
              <p style="color: #2c3e50; font-size: 15px;">Hi <strong>${agency.name || 'Agency'}</strong>,</p>
              <p style="color: #495057; font-size: 15px; line-height: 1.6;">
                A previously closed claim has been <strong>reopened</strong> and reassigned to your agency. Please review the details below and resume collection activity.
              </p>
              ${claimSummaryRows}
              <p style="color: #495057; font-size: 14px; line-height: 1.6;">
                Please log in to your dashboard to view the full claim details and take action.
              </p>
            </div>
            <div style="background-color: #f5f7fa; padding: 20px; text-align: center; border-top: 1px solid #e0e7ef;">
              <p style="margin: 0; color: #7a96a8; font-size: 12px;">© ${new Date().getFullYear()} Collections Connector. All rights reserved.</p>
            </div>
          </div>
        `,
      });
    }

    res.json({ message: 'Claim reopened and back in queue', claim });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};