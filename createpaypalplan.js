// Run this ONCE to create plans in PayPal Sandbox
// node createPayPalPlans.js
require('dotenv').config()
const axios = require('axios')

const PAYPAL_BASE = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com'

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

// ── Match these to your Stripe plans ──
const PLANS = [
    { name: 'starter',    price: '9.99',  description: 'Starter Plan - 50 claims/month',     claimsLimit: 50  },
    { name: 'growth',     price: '29.99', description: 'Growth Plan - 200 claims/month',      claimsLimit: 200 },
    { name: 'enterprise', price: '99.99', description: 'Enterprise Plan - Unlimited claims',  claimsLimit: 9999 },
]

const createProduct = async (token, plan) => {
    const res = await axios.post(
        `${PAYPAL_BASE}/v1/catalogs/products`,
        {
            name:        `Collections Connector - ${plan.name}`,
            description: plan.description,
            type:        'SERVICE',
            category:    'SOFTWARE',
        },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    )
    console.log(`✅ Product created for [${plan.name}]:`, res.data.id)
    return res.data.id
}

const createBillingPlan = async (token, productId, plan) => {
    const res = await axios.post(
        `${PAYPAL_BASE}/v1/billing/plans`,
        {
            product_id:   productId,
            name:         `Collections Connector ${plan.name} Monthly`,
            description:  plan.description,
            status:       'ACTIVE',
            billing_cycles: [
                {
                    frequency: { interval_unit: 'MONTH', interval_count: 1 },
                    tenure_type:    'REGULAR',
                    sequence:       1,
                    total_cycles:   0, // 0 = infinite
                    pricing_scheme: {
                        fixed_price: { value: plan.price, currency_code: 'USD' },
                    },
                },
            ],
            payment_preferences: {
                auto_bill_outstanding:     true,
                setup_fee:                 { value: '0', currency_code: 'USD' },
                setup_fee_failure_action:  'CONTINUE',
                payment_failure_threshold: 3,
            },
        },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    )
    console.log(`✅ Plan created for [${plan.name}]:`, res.data.id)
    return res.data.id
}

const run = async () => {
    try {
        const token = await getPayPalToken()
        console.log('🔑 Got PayPal token\n')

        const results = {}

        for (const plan of PLANS) {
            const productId = await createProduct(token, plan)
            const planId    = await createBillingPlan(token, productId, plan)
            results[plan.name] = { productId, planId, claimsLimit: plan.claimsLimit }
        }

        console.log('\n\n========================================')
        console.log('📋 Copy these into your .env file:')
        console.log('========================================')
        for (const [name, val] of Object.entries(results)) {
            console.log(`PAYPAL_PLAN_${name.toUpperCase()}=${val.planId}`)
        }
        console.log('\n📋 Or use as PLAN_IDS object:')
        console.log('const PLAN_IDS = {')
        for (const [name, val] of Object.entries(results)) {
            console.log(`    ${name}: '${val.planId}',  // $${PLANS.find(p=>p.name===name).price}/mo`)
        }
        console.log('}')

    } catch (err) {
        console.error('❌ Error:', err.response?.data || err.message)
    }
}

run()