const Agency = require('../models/agency')
const AgencyUser = require('../models/agencyuser')

const PLAN_CLAIM_LIMITS = {
    starter:      25,
    growth:       100,
    professional: 500,
    enterprise:   99999,
}

const toDate = (unixTimestamp) => {
    if (!unixTimestamp) return null
    const d = new Date(unixTimestamp * 1000)
    return isNaN(d.getTime()) ? null : d
}

const calculatePeriodEnd = () => {
    const date = new Date()
    date.setMonth(date.getMonth() + 1)
    return date
}

const createSubscription = async (req, res) => {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
    try {
        const {
            amount,
            currency = 'usd',
            paymentMethod,
            planName,
        } = req.body

        if (!paymentMethod) {
            return res.status(400).json({ message: 'Payment method is required' })
        }

        if (!['starter', 'growth', 'professional', 'enterprise'].includes(planName)) {
            return res.status(400).json({ message: 'Invalid plan name' })
        }

        if (!amount) {
            return res.status(400).json({ message: 'Amount is required' })
        }

        // Get agencyUser from token, then fetch the linked Agency
        const agencyUser = await AgencyUser.findById(req.agencyUser.id)
        if (!agencyUser) return res.status(404).json({ message: 'Agency user not found' })

        // Only owner can manage subscriptions
        if (agencyUser.role !== 'owner') {
            return res.status(403).json({ message: 'Only agency owners can manage subscriptions' })
        }

        const agency = await Agency.findById(agencyUser.agency_id)
        if (!agency) return res.status(404).json({ message: 'Agency not found' })

        const claimLimit = PLAN_CLAIM_LIMITS[planName]
        const billingEmail = agency.contact_email || agencyUser.email

        // ── UPGRADE ──
        if (agency.stripeSubscriptionId) {
            const stripeSubscription = await stripe.subscriptions.retrieve(agency.stripeSubscriptionId)

            await stripe.paymentMethods.attach(paymentMethod, {
                customer: agency.stripeCustomerId,
            })

            await stripe.customers.update(agency.stripeCustomerId, {
                invoice_settings: { default_payment_method: paymentMethod },
            })

            const newPrice = await stripe.prices.create({
                unit_amount: Math.round(amount * 100),
                currency,
                recurring: { interval: 'month' },
                product_data: { name: `Agency ${planName.charAt(0).toUpperCase() + planName.slice(1)} Plan` },
            })

            const updatedStripeSubscription = await stripe.subscriptions.update(stripeSubscription.id, {
                items: [{ id: stripeSubscription.items.data[0].id, price: newPrice.id }],
                default_payment_method: paymentMethod,
                proration_behavior: 'create_prorations',
            })

            const periodEnd = toDate(updatedStripeSubscription.current_period_end) ?? calculatePeriodEnd()

            await Agency.findByIdAndUpdate(agency._id, {
                plan_type:               planName,
                claim_limit:             claimLimit,
                claims_used:             0,
                subscription_start_date: new Date(),
                subscription_end_date:   periodEnd,
            })

            return res.status(200).json({
                message:               'Subscription upgraded successfully',
                plan:                  planName,
                subscription_end_date: periodEnd,
            })
        }

        // ── NEW SUBSCRIPTION ──
        const customer = await stripe.customers.create({
            email: billingEmail,
            payment_method: paymentMethod,
            invoice_settings: { default_payment_method: paymentMethod },
        })

        const price = await stripe.prices.create({
            unit_amount: Math.round(amount * 100),
            currency,
            recurring: { interval: 'month' },
            product_data: { name: `Agency ${planName.charAt(0).toUpperCase() + planName.slice(1)} Plan` },
        })

        const stripeSubscription = await stripe.subscriptions.create({
            customer: customer.id,
            items: [{ price: price.id }],
            default_payment_method: paymentMethod,
        })

        const periodEnd = toDate(stripeSubscription.current_period_end) ?? calculatePeriodEnd()

        await Agency.findByIdAndUpdate(agency._id, {
            plan_type:               planName,
            claim_limit:             claimLimit,
            claims_used:             0,
            subscription_start_date: new Date(),
            subscription_end_date:   periodEnd,
            stripeCustomerId:        customer.id,
            stripeSubscriptionId:    stripeSubscription.id,
        })

        res.status(201).json({
            message:               'Subscription created successfully',
            plan:                  planName,
            subscription_end_date: periodEnd,
        })

    } catch (error) {
        console.error(error.message)
        res.status(500).json({ message: 'Server error', error: error.message })
    }

}

module.exports = { createSubscription }