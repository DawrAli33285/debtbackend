const User = require('../models/user');
const Subscription = require('../models/subscription');
const bcrypt = require('bcryptjs');

// ── GET ACCOUNT OVERVIEW ──
const getAccountOverview = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password_hash');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const subscription = await Subscription.findOne({ user: req.user.id, status: 'active' });

        return res.status(200).json({
            user: {
                id:                     user._id,
                name:                   user.contact_name,
                email:                  user.email,
                business_name:          user.business_name,
                subscription_plan:      user.subscription_plan,
                monthly_claim_limit:    user.monthly_claim_limit,
                claims_used_this_month: user.claims_used_this_month,
                billing_cycle_start:    user.billing_cycle_start,
                billing_cycle_end:      user.billing_cycle_end,
                member_since:           user.createdAt,
            },
            subscription: subscription
                ? {
                    plan:               subscription.plan,
                    status:             subscription.status,
                    billing_cycle_end:  subscription.billing_cycle_end,
                }
                : null,
        });
    } catch (err) {
        console.error('getAccountOverview error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// ── UPDATE PROFILE ──
const updateProfile = async (req, res) => {
    try {
        const { email, phone, contact_name, business_name } = req.body;

        const updateFields = {};
        if (email)        updateFields.email        = email;
        if (phone)        updateFields.phone        = phone;
        if (contact_name) updateFields.contact_name = contact_name;
        if (business_name) updateFields.business_name = business_name;

        // Check if email is taken by another user
        if (email) {
            const existing = await User.findOne({ email, _id: { $ne: req.user.id } });
            if (existing) return res.status(400).json({ message: 'Email already in use by another account.' });
        }

        const updated = await User.findByIdAndUpdate(
            req.user.id,
            updateFields,
            { new: true }
        ).select('-password_hash');

        return res.status(200).json({ message: 'Profile updated successfully.', user: updated });
    } catch (err) {
        console.error('updateProfile error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// ── UPDATE PASSWORD ──
const updatePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword)
            return res.status(400).json({ message: 'All fields are required.' });

        if (newPassword.length < 8)
            return res.status(400).json({ message: 'Password must be at least 8 characters.' });

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect.' });

        const salt = await bcrypt.genSalt(10);
        user.password_hash = await bcrypt.hash(newPassword, salt);
        await user.save();

        return res.status(200).json({ message: 'Password updated successfully.' });
    } catch (err) {
        console.error('updatePassword error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { getAccountOverview, updateProfile, updatePassword };