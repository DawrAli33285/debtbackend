const User = require('../models/user')
const Subscription = require('../models/subscription')

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
            email,
            amount,
            currency = 'usd',
            paymentMethod,
            planName,
            claimsLimit,
        } = req.body

        if (!paymentMethod) {
            return res.status(400).json({ message: 'Payment method is required' })
        }

        if (!['starter', 'growth', 'unlimited'].includes(planName)) {
            return res.status(400).json({ message: 'Invalid plan name' })
        }

        if (!amount || !claimsLimit) {
            return res.status(400).json({ message: 'Amount and claims limit are required' })
        }

        const user = await User.findById(req.user.id)
        if (!user) return res.status(404).json({ message: 'User not found' })

        // ── UPGRADE ──
        if (user.stripeSubscriptionId) {
            const stripeSubscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId)

            await stripe.paymentMethods.attach(paymentMethod, {
                customer: user.stripeCustomerId,
            })

            await stripe.customers.update(user.stripeCustomerId, {
                invoice_settings: { default_payment_method: paymentMethod },
            })

            const newPrice = await stripe.prices.create({
                unit_amount: Math.round(amount * 100),
                currency,
                recurring: { interval: 'month' },
                product_data: { name: `Pasado ${planName.charAt(0).toUpperCase() + planName.slice(1)} Plan` },
            })

            const updatedStripeSubscription = await stripe.subscriptions.update(stripeSubscription.id, {
                items: [{ id: stripeSubscription.items.data[0].id, price: newPrice.id }],
                default_payment_method: paymentMethod,
                proration_behavior: 'create_prorations',
            })

            const periodEnd =
                toDate(updatedStripeSubscription.current_period_end) ?? calculatePeriodEnd()

            await User.findByIdAndUpdate(req.user.id, {
                subscription_plan:      planName,
                monthly_claim_limit:    claimsLimit,
                claims_used_this_month: 0,
                billing_cycle_start:    new Date(),
                billing_cycle_end:      periodEnd,
            })

            await Subscription.findOneAndUpdate(
                { user: req.user.id, status: 'active' },
                {
                    plan:                 planName,
                    status:               'active',
                    stripeCustomerId:     user.stripeCustomerId,
                    stripeSubscriptionId: stripeSubscription.id,
                    billing_cycle_start:  new Date(),
                    billing_cycle_end:    periodEnd,
                },
                { new: true }
            )

            return res.status(200).json({
                message:           'Subscription upgraded successfully',
                plan:              planName,
                billing_cycle_end: periodEnd,
            })
        }

        // ── NEW SUBSCRIPTION ──
        const customer = await stripe.customers.create({
            email,
            payment_method: paymentMethod,
            invoice_settings: { default_payment_method: paymentMethod },
        })

        const price = await stripe.prices.create({
            unit_amount: Math.round(amount * 100),
            currency,
            recurring: { interval: 'month' },
            product_data: { name: `Pasado ${planName.charAt(0).toUpperCase() + planName.slice(1)} Plan` },
        })

        const stripeSubscription = await stripe.subscriptions.create({
            customer: customer.id,
            items: [{ price: price.id }],
            default_payment_method: paymentMethod,
        })

        const periodEnd =
            toDate(stripeSubscription.current_period_end) ?? calculatePeriodEnd()

        await User.findByIdAndUpdate(req.user.id, {
            subscription_plan:      planName,
            monthly_claim_limit:    claimsLimit,
            claims_used_this_month: 0,
            billing_cycle_start:    new Date(),
            billing_cycle_end:      periodEnd,
            stripeCustomerId:       customer.id,
            stripeSubscriptionId:   stripeSubscription.id,
        })

        await Subscription.create({
            user:                 req.user.id,
            plan:                 planName,
            status:               'active',
            stripeCustomerId:     customer.id,
            stripeSubscriptionId: stripeSubscription.id,
            billing_cycle_start:  new Date(),
            billing_cycle_end:    periodEnd,
        })

        res.status(201).json({
            message:           'Subscription created successfully',
            plan:              planName,
            billing_cycle_end: periodEnd,
        })

    } catch (error) {
        console.error(error.message)
        res.status(500).json({ message: 'Server error', error: error.message })
    }
}

module.exports = { createSubscription }