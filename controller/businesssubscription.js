const User = require('../models/user')
const Subscription = require('../models/subscription')
const axios = require('axios')

const PAYPAL_BASE = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com'

// ── Hardcoded Plan IDs (provided by client) ──
const PLAN_IDS = {
    starter: 'P-7F292727A87140022NHTGIOY',      // Pasado Starter Monthly
    growth: 'P-66526901VN719461KNHTGKMA',        // Pasado Growth Monthly
    enterprise: 'P-1R27947964072291FNHTGLWA',    // Pasado Enterprise Monthly
}


// ── Get OAuth token ──
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

// ── Cancel a Subscription ──
const cancelPayPalSubscription = async (token, subscriptionId) => {
    await axios.post(
        `${PAYPAL_BASE}/v1/billing/subscriptions/${subscriptionId}/cancel`,
        { reason: 'User upgraded to a new plan' },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    )
}

const calculatePeriodEnd = () => {
    const date = new Date()
    date.setDate(date.getDate() + 1) // 1 day for testing
    return date
}

    // ── GET PLAN ID ──
    const getPlanId = async (req, res) => {
        try {
            const { planName } = req.body
            console.log('[getPlanId] body received:', { planName })

            if (!['starter', 'growth', 'professional', 'enterprise'].includes(planName)) {
                return res.status(400).json({ message: 'Invalid plan name' })
            }

            const planId = PLAN_IDS[planName]

            if (!planId) {
                return res.status(400).json({ message: `Plan ID for "${planName}" is not configured yet` })
            }

            console.log('[getPlanId] returning planId:', planId)
            return res.status(200).json({ planId })

        } catch (error) {
            console.error('[getPlanId] ERROR:', error.message)
            res.status(500).json({ message: 'Server error', error: error.message })
        }
    }

// ── CONFIRM SUBSCRIPTION ──
const confirmSubscription = async (req, res) => {
    try {
        const { subscriptionId, planName, claimsLimit } = req.body

        if (!subscriptionId) {
            return res.status(400).json({ message: 'Subscription ID required' })
        }

        const user = await User.findById(req.user.id)
        if (!user) return res.status(404).json({ message: 'User not found' })

        const token = await getPayPalToken()

        // Cancel old subscription if upgrading
        if (user.paypalSubscriptionId) {
            try {
                await cancelPayPalSubscription(token, user.paypalSubscriptionId)
            } catch (e) {
                console.warn('Could not cancel old PayPal subscription:', e.message)
            }
        }

        const periodEnd = calculatePeriodEnd()

        await User.findByIdAndUpdate(req.user.id, {
            subscription_plan:      planName,
            monthly_claim_limit:    claimsLimit,
            claims_used_this_month: 0,
            billing_cycle_start:    new Date(),
            billing_cycle_end:      periodEnd,
            paypalSubscriptionId:   subscriptionId,
        })

        await Subscription.findOneAndUpdate(
            { user: req.user.id },
            {
                plan:                planName,
                status:              'active',
                paypalSubscriptionId: subscriptionId,
                billing_cycle_start: new Date(),
                billing_cycle_end:   periodEnd,
            },
            { upsert: true, new: true }
        )

        return res.status(200).json({ message: 'Subscription confirmed', plan: planName })

    } catch (error) {
        console.error(error.message)
        res.status(500).json({ message: 'Server error', error: error.message, paypalError: error.response?.data })
    }
}

// ── WEBHOOK ──
const handlePayPalWebhook = async (req, res) => {
    try {
        const event = req.body
        if (event.event_type === 'BILLING.SUBSCRIPTION.ACTIVATED') {
            const subscriptionId = event.resource?.id
            if (subscriptionId) {
                await Subscription.findOneAndUpdate(
                    { paypalSubscriptionId: subscriptionId },
                    { status: 'active' }
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