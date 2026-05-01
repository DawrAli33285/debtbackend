// cron/subscriptionReset.js

const cron = require('node-cron')
const User = require('../models/user')
const Agency = require('../models/agency')

const PLAN_CLAIM_LIMITS = {
    // User plans
    starter:    3,
    growth:     10,
    unlimited:  999999,
    enterprise: 999999,

    // Agency plans
    professional: 150,
}

const AGENCY_PLAN_CLAIM_LIMITS = {
    starter:      25,
    growth:       75,
    professional: 150,
    enterprise:   999999,
}

// ── Runs every hour ──
cron.schedule('0 * * * *', async () => {
    console.log(`[CRON] Running subscription check at ${new Date().toISOString()}`)

    const now = new Date()

    try {
        // ────────────────────────────────────────────────
        // USERS — reset monthly_claim_limit if still active
        // ────────────────────────────────────────────────
        const activeUsers = await User.find({
            billing_cycle_end:   { $gt: now },   // subscription hasn't ended
            paypalSubscriptionId: { $ne: null },  // has an active paypal sub
        })

        for (const user of activeUsers) {
            const correctLimit = PLAN_CLAIM_LIMITS[user.subscription_plan]

            if (correctLimit === undefined) {
                console.warn(`[CRON] Unknown plan "${user.subscription_plan}" for user ${user._id}`)
                continue
            }

            // Only update if limit was wrongly reduced (e.g. after failed payment)
            if (user.monthly_claim_limit !== correctLimit) {
                await User.findByIdAndUpdate(user._id, {
                    monthly_claim_limit: correctLimit,
                })
                console.log(`[CRON] Restored claim limit for user ${user._id} → ${correctLimit}`)
            }
        }

        // ────────────────────────────────────────────────
        // USERS — expire if billing_cycle_end has passed
        // ────────────────────────────────────────────────
        const expiredUsers = await User.find({
            billing_cycle_end:    { $lte: now },
            paypalSubscriptionId: { $ne: null },
            monthly_claim_limit:  { $gt: 0 },    // not already locked out
        })

        for (const user of expiredUsers) {
            await User.findByIdAndUpdate(user._id, {
                monthly_claim_limit:    0,
                claims_used_this_month: 0,
                paypalSubscriptionId:   null,
                billing_cycle_start:    null,
                billing_cycle_end:      null,
                subscription_plan:      'starter',
            })
            console.log(`[CRON] Expired subscription for user ${user._id}`)
        }

        console.log(`[CRON] Users processed — active: ${activeUsers.length}, expired: ${expiredUsers.length}`)

    } catch (err) {
        console.error('[CRON] Error processing users:', err.message)
    }

    try {
        // ────────────────────────────────────────────────
        // AGENCIES — restore claim_limit if still active
        // ────────────────────────────────────────────────
        const activeAgencies = await Agency.find({
            subscription_end_date: { $gt: now },
            paypalSubscriptionId:  { $ne: null },
        })

        for (const agency of activeAgencies) {
            const correctLimit = AGENCY_PLAN_CLAIM_LIMITS[agency.plan_type]

            if (correctLimit === undefined) {
                console.warn(`[CRON] Unknown plan "${agency.plan_type}" for agency ${agency._id}`)
                continue
            }

            if (agency.claim_limit !== correctLimit) {
                await Agency.findByIdAndUpdate(agency._id, {
                    claim_limit: correctLimit,
                })
                console.log(`[CRON] Restored claim limit for agency ${agency._id} → ${correctLimit}`)
            }
        }

        // ────────────────────────────────────────────────
        // AGENCIES — expire if subscription_end_date has passed
        // ────────────────────────────────────────────────
        const expiredAgencies = await Agency.find({
            subscription_end_date: { $lte: now },
            paypalSubscriptionId:  { $ne: null },
            claim_limit:           { $gt: 0 },
        })

        for (const agency of expiredAgencies) {
            await Agency.findByIdAndUpdate(agency._id, {
                plan_type:               'starter',
                claim_limit:             0,
                claims_used:             0,
                subscription_status:     'expired',
                paypalSubscriptionId:    null,
                subscription_start_date: null,
                subscription_end_date:   null,
            })
            console.log(`[CRON] Expired subscription for agency ${agency._id}`)
        }

        console.log(`[CRON] Agencies processed — active: ${activeAgencies.length}, expired: ${expiredAgencies.length}`)

    } catch (err) {
        console.error('[CRON] Error processing agencies:', err.message)
    }
})

console.log('[CRON] Subscription check cron registered — runs every hour')