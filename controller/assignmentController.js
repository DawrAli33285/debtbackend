const Assignment = require('../models/assignment');
const Agency     = require('../models/agency');
const Claim      = require('../models/claim');
const Referral   = require('../models/referal');
const { ChatRoom } = require('../models/chat');
const Mailgun = require("mailgun.js");
const FormData = require("form-data");

exports.createAssignment = async (req, res) => {
  try {
    const { claim_id, agency_id, method = 'manual' } = req.body;

    const claim = await Claim.findOne({ _id: claim_id });
    if (!claim) return res.status(404).json({ message: 'Claim not found' });

    // ✅ Allow assignment from submitted OR after connection_denied (reassignment)
    if (!['submitted', 'connection_denied', 'denied'].includes(claim.status)) {
      return res.status(400).json({
        message: `Claim cannot be assigned. Current status: "${claim.status}". Only submitted or previously denied claims can be assigned.`,
      });
    }

    const agency = await Agency.findById(agency_id);
    if (!agency) return res.status(404).json({ message: 'Agency not found' });

    if (agency.claims_used >= agency.claim_limit) {
      return res.status(403).json({
        message: 'Agency has reached its claim limit. Please select another agency.',
        claims_used: agency.claims_used,
        claim_limit: agency.claim_limit,
        plan: agency.plan_type,
      });
    }

    // ✅ If reassigning after denial, deactivate old assignment
    await Assignment.updateMany(
      { claim_id, status: { $ne: 'completed' } },
      { status: 'replaced' }
    );

    const assignment = await Assignment.create({
      claim_id,
      agency_id,
      assigned_by: req.user.id,
      method,
      status: 'active',
    });

    // ✅ Removed the pointless ChatRoom.findOne that was here
    // ChatRoom is only created later when admin approves the connection

    claim.status = 'assigned';
    await claim.save();

    // ✅ Only increment if this is a fresh assignment, not a reassignment
    // (agency already had this claim counted if it was connection_denied)
    agency.claims_used += 1;
    await agency.save();



    const populatedClaim = await Claim.findById(claim_id).populate('user_id', 'business_name contact_name email');

const mailgun = new Mailgun(FormData);
const mg = mailgun.client({
  username: "api",
  key: process.env.MAILGUN_API_KEY,
});

const businessName = populatedClaim.user_id?.business_name || populatedClaim.user_id?.contact_name || 'A business';
const debtorName   = populatedClaim.debtor_name || '—';
const amount       = populatedClaim.amount ? `$${Number(populatedClaim.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—';
const userEmail    = populatedClaim.user_id?.email;
const agencyEmail  = agency.email;

// Email to Business
if (userEmail) {
  await mg.messages.create("collectionsconnector.com", {
    from: 'noreply@collectionsconnector.com',
    to: [userEmail],
    subject: '✅ Claim Assigned to Agency - Collections Connector',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <div style="background-color: #1669A9; padding: 30px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 26px;">Claim Assigned</h1>
        </div>
        <div style="padding: 30px;">
          <p style="color: #2c3e50; font-size: 15px;">Hi <strong>${businessName}</strong>,</p>
          <p style="color: #495057; font-size: 15px; line-height: 1.6;">
            Your claim has been assigned to the selected agency and submitted for internal review.
          </p>
          <p style="color: #495057; font-size: 15px; line-height: 1.6;">
            Our back office will review the claim details and connection request before the connection becomes active.
            You will be notified once the connection is approved.
          </p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 12px; background-color: #f8f9fa; font-weight: 600; width: 40%; border: 1px solid #dee2e6;">Debtor</td>
              <td style="padding: 12px; border: 1px solid #dee2e6;">${debtorName}</td>
            </tr>
            <tr>
              <td style="padding: 12px; background-color: #f8f9fa; font-weight: 600; border: 1px solid #dee2e6;">Amount</td>
              <td style="padding: 12px; border: 1px solid #dee2e6;">${amount}</td>
            </tr>
            <tr>
              <td style="padding: 12px; background-color: #f8f9fa; font-weight: 600; border: 1px solid #dee2e6;">Assigned Agency</td>
              <td style="padding: 12px; border: 1px solid #dee2e6;">${agency.name}</td>
            </tr>
            <tr>
              <td style="padding: 12px; background-color: #f8f9fa; font-weight: 600; border: 1px solid #dee2e6;">Assigned On</td>
              <td style="padding: 12px; border: 1px solid #dee2e6;">${new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</td>
            </tr>
          </table>
        </div>
        <div style="background-color: #f5f7fa; padding: 20px; text-align: center; border-top: 1px solid #e0e7ef;">
          <p style="margin: 0; color: #7a96a8; font-size: 12px;">© ${new Date().getFullYear()} Collections Connector. All rights reserved.</p>
        </div>
      </div>
    `,
  });
}

// Email to Agency
if (agencyEmail) {
  await mg.messages.create("collectionsconnector.com", {
    from: 'noreply@collectionsconnector.com',
    to: [agencyEmail],
    subject: '📋 New Claim Submitted to Your Agency - Collections Connector',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <div style="background-color: #1669A9; padding: 30px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 26px;">New Claim Received</h1>
        </div>
        <div style="padding: 30px;">
          <p style="color: #2c3e50; font-size: 15px;">Hi <strong>${agency.name}</strong>,</p>
          <p style="color: #495057; font-size: 15px; line-height: 1.6;">
            A new claim has been submitted to your agency by <strong>${businessName}</strong>. The connection is currently pending internal review by our back office.
          </p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 12px; background-color: #f8f9fa; font-weight: 600; width: 40%; border: 1px solid #dee2e6;">Debtor</td>
              <td style="padding: 12px; border: 1px solid #dee2e6;">${debtorName}</td>
            </tr>
            <tr>
              <td style="padding: 12px; background-color: #f8f9fa; font-weight: 600; border: 1px solid #dee2e6;">Amount</td>
              <td style="padding: 12px; border: 1px solid #dee2e6;">${amount}</td>
            </tr>
            <tr>
              <td style="padding: 12px; background-color: #f8f9fa; font-weight: 600; border: 1px solid #dee2e6;">Submitted By</td>
              <td style="padding: 12px; border: 1px solid #dee2e6;">${businessName}</td>
            </tr>
            <tr>
              <td style="padding: 12px; background-color: #f8f9fa; font-weight: 600; border: 1px solid #dee2e6;">Received On</td>
              <td style="padding: 12px; border: 1px solid #dee2e6;">${new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</td>
            </tr>
          </table>
          <p style="color: #495057; font-size: 14px; line-height: 1.6;">
            You will be notified once the connection is approved by our back office.
          </p>
        </div>
        <div style="background-color: #f5f7fa; padding: 20px; text-align: center; border-top: 1px solid #e0e7ef;">
          <p style="margin: 0; color: #7a96a8; font-size: 12px;">© ${new Date().getFullYear()} Collections Connector. All rights reserved.</p>
        </div>
      </div>
    `,
  });
}

    res.status(201).json({ message: 'Claim assigned successfully', assignment });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.closeClaim = async (req, res) => {
  try {
    const { claim_id, recovered_amount } = req.body;

    const claim = await Claim.findById(claim_id);
    if (!claim) return res.status(404).json({ message: 'Claim not found' });

    // ✅ Only connection_approved claims can be closed — they are the ones actively in work
    if (claim.status !== 'connection_approved') {
      return res.status(400).json({
        message: `Only active claims (connection_approved) can be closed. Current status: "${claim.status}"`,
      });
    }

    if (!recovered_amount || recovered_amount < 0) {
      return res.status(400).json({ message: 'A valid recovered amount is required to close the claim.' });
    }

    const assignment = await Assignment.findOne({ claim_id, status: 'active' });
    if (!assignment) return res.status(404).json({ message: 'Active assignment not found' });

    const referral_fee = recovered_amount * 0.07;

    await Referral.create({
      claim_id,
      agency_id: assignment.agency_id,
      recovered_amount,
      referral_fee,
      status: 'pending',
    });

    claim.status = 'closed';
    await claim.save();

    assignment.status = 'completed';
    await assignment.save();

    res.status(200).json({
      message: 'Claim closed and referral fee recorded',
      recovered_amount,
      referral_fee,
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};