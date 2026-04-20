const User = require('../models/user')
const Subscription = require('../models/subscription')
const axios = require('axios')

const PAYPAL_BASE = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com'

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

// ── Create or retrieve a PayPal Product ──
const ensureProduct = async (token, planName) => {
    const res = await axios.post(
        `${PAYPAL_BASE}/v1/catalogs/products`,
        {
            name: `Pasado ${planName.charAt(0).toUpperCase() + planName.slice(1)} Plan`,
            type: 'SERVICE',
            category: 'SOFTWARE',
        },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    )
    return res.data.id
}

// ── Create a Billing Plan ──
const createBillingPlan = async (token, productId, amount, currency, planName) => {
    const res = await axios.post(
        `${PAYPAL_BASE}/v1/billing/plans`,
        {
            product_id: productId,
            name: `Pasado ${planName.charAt(0).toUpperCase() + planName.slice(1)} Monthly`,
            status: 'ACTIVE',
            billing_cycles: [
                {
                    frequency: { interval_unit: 'MONTH', interval_count: 1 },
                    tenure_type: 'REGULAR',
                    sequence: 1,
                    total_cycles: 0, // infinite
                    pricing_scheme: {
                        fixed_price: {
                            value: String(amount),
                            currency_code: currency.toUpperCase(),
                        },
                    },
                },
            ],
            payment_preferences: {
                auto_bill_outstanding: true,
                setup_fee_failure_action: 'CONTINUE',
                payment_failure_threshold: 3,
            },
        },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    )
    return res.data.id
}

// ── Create a Subscription ──
const createPayPalSubscription = async (token, planId, email) => {
    const res = await axios.post(
        `${PAYPAL_BASE}/v1/billing/subscriptions`,
        {
            plan_id: planId,
            subscriber: { email_address: email },
            application_context: {
                return_url: `${process.env.FRONTEND_URL}/subscription/success`,
                cancel_url: `${process.env.FRONTEND_URL}/subscription/cancel`,
                shipping_preference: 'NO_SHIPPING',
                user_action: 'SUBSCRIBE_NOW',
            },
        },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    )
    return res.data
}

// ── Retrieve a Subscription ──
const getPayPalSubscription = async (token, subscriptionId) => {
    const res = await axios.get(
        `${PAYPAL_BASE}/v1/billing/subscriptions/${subscriptionId}`,
        { headers: { Authorization: `Bearer ${token}` } }
    )
    return res.data
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
    date.setMonth(date.getMonth() + 1)
    return date
}

// ─────────────────────────────────────────────
// MAIN CONTROLLER
// ─────────────────────────────────────────────
// ── GET PLAN ID (called before PayPal button renders subscription) ──
const getPlanId = async (req, res) => {
    console.log("CALLING")
    try {
        const { amount, currency = 'USD', planName } = req.body
        console.log('[getPlanId] body received:', { amount, currency, planName })

        if (!['starter', 'growth', 'professional', 'enterprise'].includes(planName)) {
            console.log('[getPlanId] invalid plan name:', planName)
            return res.status(400).json({ message: 'Invalid plan name' })
        }

        console.log('[getPlanId] getting PayPal token...')
        const token = await getPayPalToken()
        console.log('[getPlanId] token received:', token ? 'YES' : 'NO')

        console.log('[getPlanId] creating product...')
        const productId = await ensureProduct(token, planName)
        console.log('[getPlanId] productId:', productId)

        console.log('[getPlanId] creating billing plan...')
        const planId = await createBillingPlan(token, productId, amount, currency, planName)
        console.log('[getPlanId] planId:', planId)

        return res.status(200).json({ planId })

    } catch (error) {
        console.error('[getPlanId] ERROR:', error.message)
        console.error('[getPlanId] Full error:', error.response?.data || error)
        res.status(500).json({ message: 'Server error', error: error.message, paypalError: error.response?.data })
    }
}

// ── CONFIRM SUBSCRIPTION (called after user approves on PayPal) ──
const confirmSubscription = async (req, res) => {
    try {
        const {
            subscriptionId,
            planName,
            claimsLimit,
        } = req.body

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


// ─────────────────────────────────────────────
// WEBHOOK — PayPal calls this after user approves
// ─────────────────────────────────────────────
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