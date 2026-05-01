const Agency = require('../models/agency')
const AgencyUser = require('../models/agencyuser')
const axios = require('axios')

const PAYPAL_BASE = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com'

const PLAN_CLAIM_LIMITS = {
    starter:      25,
    growth:       75,
    professional: 150,
    enterprise:   999999,
}

// ── Hardcoded Plan IDs (provided by client) ──
const PLAN_IDS = {
    starter:      'P-6NG06940P7148641YNHXWWBA',  // Agency Starter Annual
    growth:      'P-25V87375WL414664TNHXWWSQ',                       // Not created yet in sandbox
    professional:      'P-19536608K92748707NHXWXAY',                           // Not created yet in sandbox
    enterprise:   'P-4N6479001L030084FNHXWXUQ',  // Agency Enterprise Annual
}
const getPayPalToken = async () => {
    const res = await axios.post(
        `${PAYPAL_BASE}/v1/oauth2/token`,
        'grant_type=client_credentials',
        {
            auth: {
                username: process.env.PAYPAL_CLIENT_ID,
                password: process.env.PAYPAL_CLIENT_SECRET,
            },
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
    )
    return res.data.access_token
}

const cancelPayPalSubscription = async (token, subscriptionId) => {
    await axios.post(
        `${PAYPAL_BASE}/v1/billing/subscriptions/${subscriptionId}/cancel`,
        { reason: 'User upgraded to a new plan' },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    )
}

const calculatePeriodEnd = () => {
    const date = new Date()
    date.setMonth(date.getMonth() + 1)
    return date
}

// ── GET PLAN ID ──
const getPlanId = async (req, res) => {
    console.log("GETPLANID")
    try {
        const { planName } = req.body

        if (!['starter', 'growth', 'professional', 'enterprise'].includes(planName)) {
            return res.status(400).json({ message: 'Invalid plan name' })
        }

        const agencyUser = await AgencyUser.findById(req.agencyUser.id)
        if (!agencyUser) return res.status(404).json({ message: 'Agency user not found' })
        if (agencyUser.role !== 'owner') {
            return res.status(403).json({ message: 'Only agency owners can manage subscriptions' })
        }

        const planId = PLAN_IDS[planName]
        if (!planId) {
            return res.status(400).json({ message: `Plan ID for "${planName}" is not configured yet` })
        }

        console.log('[getPlanId] returning planId:', planId)
        return res.status(200).json({ planId })

    } catch (error) {
        console.error(error.message)
        res.status(500).json({ message: 'Server error', error: error.message })
    }
}

// ── CONFIRM SUBSCRIPTION ──
const confirmSubscription = async (req, res) => {
    console.log("CONFIRM SUBSCRIPTION")
    try {
        const { subscriptionId, planName, claimsLimit } = req.body

        if (!subscriptionId) {
            return res.status(400).json({ message: 'Subscription ID required' })
        }

        const agencyUser = await AgencyUser.findById(req.agencyUser.id)
        if (!agencyUser) return res.status(404).json({ message: 'Agency user not found' })
        if (agencyUser.role !== 'owner') {
            return res.status(403).json({ message: 'Only agency owners can manage subscriptions' })
        }

        const agency = await Agency.findById(agencyUser.agency_id)
        if (!agency) return res.status(404).json({ message: 'Agency not found' })

        const token = await getPayPalToken()

        // Cancel old subscription if upgrading
        if (agency.paypalSubscriptionId) {
            try {
                await cancelPayPalSubscription(token, agency.paypalSubscriptionId)
            } catch (e) {
                console.warn('Could not cancel old PayPal subscription:', e.message)
            }
        }

        const periodEnd = calculatePeriodEnd()
        const claimLimit = claimsLimit ?? PLAN_CLAIM_LIMITS[planName]

        await Agency.findByIdAndUpdate(agency._id, {
            plan_type:               planName,
            claim_limit:             claimLimit,
            claims_used:             0,
            subscription_start_date: new Date(),
            subscription_end_date:   periodEnd,
            paypalSubscriptionId:    subscriptionId,
        })

        return res.status(200).json({
            message:               'Subscription confirmed',
            plan:                  planName,
            subscription_end_date: periodEnd,
        })

    } catch (error) {
        console.error(error.message)
        res.status(500).json({ message: 'Server error', error: error.message })
    }
}

// ── WEBHOOK ──
// ── WEBHOOK ──
const handlePayPalWebhook = async (req, res) => {
    try {
        const event = req.body

        // ── Subscription activated ──
        if (event.event_type === 'BILLING.SUBSCRIPTION.ACTIVATED') {
            const subscriptionId = event.resource?.id
            if (subscriptionId) {
                await Agency.findOneAndUpdate(
                    { paypalSubscriptionId: subscriptionId },
                    { subscription_status: 'active' }
                )
            }
        }

        // ── Subscription cancelled ──
        if (event.event_type === 'BILLING.SUBSCRIPTION.CANCELLED') {
            const subscriptionId = event.resource?.id
            if (subscriptionId) {

                await Agency.findOneAndUpdate(
                    { paypalSubscriptionId: subscriptionId },
                    {
                        plan_type:               'starter',  // ✅ valid enum in Agency
                        claim_limit:             0,          // ✅ blocks all claims
                        claims_used:             0,          // ✅ field exists in Agency
                        subscription_status:     'cancelled',// ✅ field exists in Agency
                        paypalSubscriptionId:    null,       // ✅ field exists in Agency
                        subscription_start_date: null,       // ✅ field exists in Agency
                        subscription_end_date:   null,       // ✅ field exists in Agency
                    }
                )
            }
        }

        res.status(200).json({ received: true })

    } catch (err) {
        console.error('Webhook error:', err.message)
        res.status(500).json({ message: 'Webhook error' })
    }
}
module.exports = { getPlanId, confirmSubscription, handlePayPalWebhook }