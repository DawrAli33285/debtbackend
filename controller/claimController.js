// const Claim = require('../models/claim');
// const User=require('../models/user')
// const path=require('path')
// const fs=require('fs')
// exports.createClaim = async (req, res) => {
//   try {
//     const user = await User.findById(req.user.id);

//     const now = new Date();
//     if (user.billing_cycle_end && now > user.billing_cycle_end) {
//       user.claims_used_this_month = 0;
//       user.billing_cycle_start = now;
//       user.billing_cycle_end = new Date(now.setMonth(now.getMonth() + 1));
//       await user.save();
//     }

//     if (
//       user.subscription_plan !== 'unlimited' &&
//       user.claims_used_this_month >= user.monthly_claim_limit
//     ) {
//       return res.status(403).json({
//         message: 'Monthly claim limit reached. Please upgrade your plan.',
//         claims_used: user.claims_used_this_month,
//         claim_limit: user.monthly_claim_limit,
//         plan: user.subscription_plan,
//       });
//     }

//     const {
//       debtor_type, debtor_name, debtor_email,
//       debtor_phone, debtor_address, amount,
//       due_date, past_due_period, description,
//     } = req.body;

 
//     const documents = (req.files || []).map(file => ({
//       filename: file.originalname,
//       path: file.filename,       // just the filename — served via /uploads/:filename
//       mimetype: file.mimetype,
//     }));

//     const claim = await Claim.create({
//       user_id: req.user.id,
//       debtor_type, debtor_name, debtor_email,
//       debtor_phone, debtor_address, amount,
//       due_date, past_due_period, description,
//       documents,
//     });

//     user.claims_used_this_month += 1;
//     await user.save();

//     res.status(201).json({
//       message: 'Claim submitted',
//       claim,
//       claims_remaining: user.monthly_claim_limit - user.claims_used_this_month,
//     });

//   } catch (err) {
//     console.log(err.message)
//     res.status(500).json({ message: err.message });
//   }
// };

// exports.getClaims = async (req, res) => {
//   try {
//     const claims = await Claim.find({ user_id: req.user.id });
//     res.status(200).json({ claims });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };


// exports.getClaimById = async (req, res) => {
//   try {
//     const claim = await Claim.findOne({ _id: req.params.id, user_id: req.user.id });
//     if (!claim) return res.status(404).json({ message: 'Claim not found' });

//     res.status(200).json({ claim });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };




// exports.updateClaim = async (req, res) => {
//   try {
//     const {
//       debtor_name, debtor_email, debtor_phone,
//       debtor_address, debtor_type, amount, due_date, description
//     } = req.body;

//     const claim = await Claim.findOne({ _id: req.params.id });


//     if (!claim) {
//       return res.status(404).json({ message: 'Claim not found or unauthorized' });
//     }

//     // Update only the editable fields
//     claim.debtor_name    = debtor_name    ?? claim.debtor_name;
//     claim.debtor_email   = debtor_email   ?? claim.debtor_email;
//     claim.debtor_phone   = debtor_phone   ?? claim.debtor_phone;
//     claim.debtor_address = debtor_address ?? claim.debtor_address;
//     claim.debtor_type    = debtor_type    ?? claim.debtor_type;
//     claim.amount         = amount         ?? claim.amount;
//     claim.due_date       = due_date       ?? claim.due_date;
//     claim.description    = description    ?? claim.description;

//     await claim.save();

//     res.json({ claim });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: 'Server error' });
//   }
// };



// exports.deleteDocument = async (req, res) => {
//   try {
//     const claim = await Claim.findOne({ _id: req.params.id, user_id: req.user.id });
//     if (!claim) return res.status(404).json({ message: 'Claim not found' });
 
//     const doc = claim.documents.id(req.params.docId);
//     if (!doc) return res.status(404).json({ message: 'Document not found' });
 
//     // Delete file from disk
//     const filePath = path.join('/tmp/public/files/files', doc.path);
//     fs.unlink(filePath, (err) => {
//       if (err) console.warn('Could not delete file from disk:', err.message);
//     });
 
//     doc.deleteOne();
//     await claim.save();
 
//     res.json({ claim });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: 'Server error' });
//   }
// };
 
// // POST /api/claims/:id/documents
// exports.addDocuments = async (req, res) => {
//   try {
//     const claim = await Claim.findOne({ _id: req.params.id, user_id: req.user.id });
//     if (!claim) return res.status(404).json({ message: 'Claim not found' });
 
//     if (!req.files || req.files.length === 0) {
//       return res.status(400).json({ message: 'No files uploaded' });
//     }
 
//     const newDocs = req.files.map(file => ({
//       filename: file.originalname,
//       path: file.filename,
//       mimetype: file.mimetype,
//     }));
 
//     claim.documents.push(...newDocs);
//     await claim.save();
 
//     res.json({ claim });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: 'Server error' });
//   }
// };






const { ChatRoom } = require('../models/chat');

const Claim = require('../models/claim');
const User = require('../models/user');
const Assignment = require('../models/assignment');
const path = require('path');
const Mailgun = require("mailgun.js");
const FormData = require("form-data");
const fs = require('fs');


module.exports.closeClaim = async (req, res) => {
  try {
    const claim = await Claim.findById(req.params.id);

    if (!claim) {
      return res.status(404).json({ message: 'Claim not found.' });
    }

    // Only the claim owner can close it
    if (claim.user_id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to close this claim.' });
    }

    // Already closed
    if (claim.status === 'closed') {
      return res.status(400).json({ message: 'Claim is already closed.' });
    }

    // Cannot close a denied claim
    if (claim.status === 'denied') {
      return res.status(400).json({ message: 'Cannot close a denied claim.' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // ── 24-hour rule ──────────────────────────────────────────────
    const claimAgeHours = (Date.now() - new Date(claim.createdAt).getTime()) / (1000 * 60 * 60);
    const packageDeducted = claimAgeHours > 24;

    if (packageDeducted && user.subscription_plan !== 'unlimited') {
      // Deduct 1 from their monthly allowance
      user.claims_used_this_month = Math.max((user.claims_used_this_month || 0) - 1, 0);

      // Also decrement monthly_claim_limit so they permanently lose the slot
      user.monthly_claim_limit = Math.max((user.monthly_claim_limit || 1) - 1, 0);
      await user.save();
    }

    // ── Update claim status ───────────────────────────────────────
    claim.status = 'closed';
    await claim.save();

    await ChatRoom.findOneAndUpdate(
      { claim_id: claim._id },
      { is_closed: true, closed_at: new Date(), closed_reason: 'business_closed_claim' },
    );


    // ── Notify the assigned agency ────────────────────────────────
    const assignment = await Assignment.findOne({ claim_id: claim._id })
      .populate('agency_id', 'name contact_email');

    // If you have a notification / email system, trigger it here.
    // Example placeholder:
    // if (assignment?.agency_id?.contact_email) {
    //   await sendEmail({
    //     to: assignment.agency_id.contact_email,
    //     subject: 'Claim Closed by Business',
    //     body: `The business has closed claim #${claim._id}. No further action is required.`,
    //   });
    // }

    // ── Audit log ─────────────────────────────────────────────────
    console.log('[CLAIM_CLOSED]', {
      claim_id:        claim._id,
      user_id:         req.user.id,
      timestamp:       new Date().toISOString(),
      claim_age_hours: claimAgeHours.toFixed(2),
      package_deducted: packageDeducted,
    });

    return res.status(200).json({
      message: packageDeducted
        ? 'Claim closed. 1 claim point has been deducted from your package.'
        : 'Claim closed successfully. No package deduction applied.',
      claim,
      package_deducted: packageDeducted,
      agency_notified:  !!assignment,
    });

  } catch (err) {
    console.error('[closeClaim]', err.message);
    res.status(500).json({ message: err.message });
  }
};


exports.createClaim = async (req, res) => {
  try {
    console.log('req.user:', req.user);
    const user = await User.findById(req.user.id);
    console.log('user found:', user);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    
    const now = new Date();
    if (user.billing_cycle_end && now > user.billing_cycle_end) {
      user.claims_used_this_month = 0;
      user.billing_cycle_start = now;
      user.billing_cycle_end = new Date(now.setMonth(now.getMonth() + 1));
      await user.save();
    }

    if (
      user.subscription_plan !== 'unlimited' &&
      user.claims_used_this_month >= user.monthly_claim_limit
    ) {
      return res.status(403).json({
        message: 'Monthly claim limit reached. Please upgrade your plan.',
        claims_used: user.claims_used_this_month,
        claim_limit: user.monthly_claim_limit,
        plan: user.subscription_plan,
      });
    }

    const {
      debtor_type, debtor_name, debtor_email,
      debtor_phone, debtor_address, amount,
      due_date, past_due_period, description,
    } = req.body;

    const documents = (req.files || []).map(file => ({
      filename: file.originalname,
      path: file.filename,
      mimetype: file.mimetype,
    }));

    // ✅ status defaults to 'submitted' — correct starting point
    const claim = await Claim.create({
      user_id: req.user.id,
      debtor_type, debtor_name, debtor_email,
      debtor_phone, debtor_address, amount,
      due_date, past_due_period, description,
      documents,
    });

    user.claims_used_this_month += 1;
    await user.save();


    const mailgun = new Mailgun(FormData);
const mg = mailgun.client({
  username: "api",
  key: process.env.MAILGUN_API_KEY,
});

if (user.email) {
  await mg.messages.create("collectionsconnector.com", {
    from: 'noreply@collectionsconnector.com',
    to: [user.email],
    subject: '✅ Claim Submitted Successfully - Collections Connector',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <div style="background-color: #1669A9; padding: 30px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 26px;">Claim Submitted</h1>
        </div>
        <div style="padding: 30px;">
          <p style="color: #2c3e50; font-size: 15px;">Hi <strong>${user.business_name || user.contact_name || 'there'}</strong>,</p>
          <p style="color: #495057; font-size: 15px; line-height: 1.6;">
            Your claim has been successfully submitted.
          </p>
          <p style="color: #495057; font-size: 15px; line-height: 1.6;">
            Our system is now preparing your claim for agency review. Please continue to the next step to select a collection agency.
          </p>
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
              <td style="padding: 12px; background-color: #f8f9fa; font-weight: 600; border: 1px solid #dee2e6;">Submitted On</td>
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

    res.status(201).json({
      message: 'Claim submitted successfully. Our team will review and assign your claim shortly.',
      claim,
      claims_remaining: user.monthly_claim_limit - user.claims_used_this_month,
    });

  } catch (err) {
    console.log(err.message);
    res.status(500).json({ message: err.message });
  }
};

// ✅ Returns claims with agency info pulled from Assignment
exports.getClaims = async (req, res) => {
  try {
    const claims = await Claim.find({ user_id: req.user.id }).sort({ createdAt: -1 });

    // Attach agency info to each claim via Assignment
    const claimsWithAgency = await Promise.all(
      claims.map(async (claim) => {
        const assignment = await Assignment.findOne({ claim_id: claim._id })
          .populate('agency_id', 'name states_covered')
          .sort({ assigned_at: -1 });

        return {
          ...claim.toObject(),
          agency: assignment?.agency_id
            ? {
                name:           assignment.agency_id.name,
                states_covered: assignment.agency_id.states_covered,
              }
            : null,
          // Human-readable status label for the frontend
          status_label: STATUS_LABELS[claim.status] || claim.status,
        };
      })
    );

    res.status(200).json({ claims: claimsWithAgency });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ✅ Single claim with agency info
exports.getClaimById = async (req, res) => {
  try {
    const claim = await Claim.findOne({ _id: req.params.id, user_id: req.user.id });
    if (!claim) return res.status(404).json({ message: 'Claim not found' });

    const assignment = await Assignment.findOne({ claim_id: claim._id })
      .populate('agency_id', 'name states_covered')
      .sort({ assigned_at: -1 });

    res.status(200).json({
      claim: {
        ...claim.toObject(),
        agency: assignment?.agency_id
          ? {
              name:           assignment.agency_id.name,
              states_covered: assignment.agency_id.states_covered,
            }
          : null,
        status_label: STATUS_LABELS[claim.status] || claim.status,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateClaimPopup = async (req, res) => {
  try {
   

    const claim = await Claim.findOne({ _id: req.params.id, user_id: req.user.id });
    if (!claim) return res.status(404).json({ message: 'Claim not found or unauthorized' });

 
 claim.adminDenied=false

    await claim.save();
    res.json({ claim });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateClaim = async (req, res) => {
  try {
    const {
      debtor_name, debtor_email, debtor_phone,
      debtor_address, debtor_type, amount, due_date, description
    } = req.body;

    const claim = await Claim.findOne({ _id: req.params.id, user_id: req.user.id });
    if (!claim) return res.status(404).json({ message: 'Claim not found or unauthorized' });

    // ✅ Only allow edits when claim is still submitted (not yet assigned)
    if (!['submitted', 'denied'].includes(claim.status)) {
      return res.status(400).json({
        message: 'Claim cannot be edited once it has been assigned to an agency.',
      });
    }

    claim.debtor_name    = debtor_name    ?? claim.debtor_name;
    claim.debtor_email   = debtor_email   ?? claim.debtor_email;
    claim.debtor_phone   = debtor_phone   ?? claim.debtor_phone;
    claim.debtor_address = debtor_address ?? claim.debtor_address;
    claim.debtor_type    = debtor_type    ?? claim.debtor_type;
    claim.amount         = amount         ?? claim.amount;
    claim.due_date       = due_date       ?? claim.due_date;
    claim.description    = description    ?? claim.description;

    await claim.save();
    res.json({ claim });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteDocument = async (req, res) => {
  try {
    const claim = await Claim.findOne({ _id: req.params.id, user_id: req.user.id });
    if (!claim) return res.status(404).json({ message: 'Claim not found' });

    const doc = claim.documents.id(req.params.docId);
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    const filePath = path.join('/tmp/public/files/files', doc.path);
    fs.unlink(filePath, (err) => {
      if (err) console.warn('Could not delete file from disk:', err.message);
    });

    doc.deleteOne();
    await claim.save();
    res.json({ claim });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.addDocuments = async (req, res) => {
  try {
    const claim = await Claim.findOne({ _id: req.params.id, user_id: req.user.id });
    if (!claim) return res.status(404).json({ message: 'Claim not found' });

    if (!req.files || req.files.length === 0)
      return res.status(400).json({ message: 'No files uploaded' });

    const newDocs = req.files.map(file => ({
      filename: file.originalname,
      path: file.filename,
      mimetype: file.mimetype,
    }));

    claim.documents.push(...newDocs);
    await claim.save();
    res.json({ claim });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Status labels (used in getClaims & getClaimById) ─────────────────────────
const STATUS_LABELS = {
  submitted:          'Submitted — Awaiting Assignment',
  assigned:           'Under Agency Review',
  approved_by_agency: 'Approved by Agency',
  pending_admin:      'Pending Admin Approval',
  connection_approved:'Connection Approved — In Progress',
  connection_denied:  'Connection Denied',
  denied:             'Denied by Agency',
  closed:             'Closed',
};

exports.getClaimsDeniedByAdmin = async (req, res) => {
  try {
    let claim = await Claim.findOne({ 
      user_id: req.user.id,  // ✅ use req.user instead of req.agencyUser
      adminDenied: true 
    });

    return res.status(200).json({ claim });
  } catch (e) {
    console.log("ERROR OF IS")
    console.log(e.message);
    res.status(500).json({ message: 'Server error' });
  }
}