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
// ── Runs every hour — safety net only, webhooks do the real work ──
cron.schedule('0 * * * *', async () => {
    console.log(`[CRON] Running subscription check at ${new Date().toISOString()}`)

    const now = new Date()
    const gracePeriod = new Date(now - 24 * 60 * 60 * 1000) // 24hr grace window

    try {
        // ────────────────────────────────────────────────
        // USERS — expire if billing_cycle_end passed 24hrs ago and webhook never fired
        // ────────────────────────────────────────────────
        const result = await User.updateMany(
            {
                billing_cycle_end:    { $lte: gracePeriod },
                paypalSubscriptionId: { $ne: null },
            },
            {
                subscription_plan:      'starter',
                monthly_claim_limit:    0,
                claims_used_this_month: 0,
                paypalSubscriptionId:   null,
                billing_cycle_start:    null,
                billing_cycle_end:      null,
            }
        )
        console.log(`[CRON] Users expired: ${result.modifiedCount}`)

    } catch (err) {
        console.error('[CRON] Error processing users:', err.message)
    }

    try {
        // ────────────────────────────────────────────────
        // AGENCIES — expire if subscription_end_date passed 24hrs ago and webhook never fired
        // ────────────────────────────────────────────────
        const result = await Agency.updateMany(
            {
                subscription_end_date: { $lte: gracePeriod },
                paypalSubscriptionId:  { $ne: null },
            },
            {
                plan_type:               'starter',
                claim_limit:             0,
                claims_used:             0,
                subscription_status:     'expired',
                paypalSubscriptionId:    null,
                subscription_start_date: null,
                subscription_end_date:   null,
            }
        )
        console.log(`[CRON] Agencies expired: ${result.modifiedCount}`)

    } catch (err) {
        console.error('[CRON] Error processing agencies:', err.message)
    }
})

console.log('[CRON] Subscription check cron registered — runs every hour')