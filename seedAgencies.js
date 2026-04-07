const mongoose = require('mongoose');
const Agency   = require('./models/agency');
require('dotenv').config();

const agencies = [
  {
    name:           'National Recovery Group',
    states_covered: ['CA', 'TX', 'NY', 'FL'],
    specialties:    ['Medical', 'Commercial'],
    fee_percentage: 25,
    is_verified:    true,
    plan_type:      'professional',
    claim_limit:    150,
    claims_used:    0,
    is_active:      true,
  },
  {
    name:           'Apex Collections LLC',
    states_covered: ['IL', 'OH', 'PA', 'GA'],
    specialties:    ['Consumer Debt', 'Auto Loans'],
    fee_percentage: 20,
    is_verified:    true,
    plan_type:      'growth',
    claim_limit:    75,
    claims_used:    0,
    is_active:      true,
  },
  {
    name:           'Summit Debt Solutions',
    states_covered: ['WA', 'OR', 'AZ', 'NV'],
    specialties:    ['Business', 'Legal'],
    fee_percentage: 30,
    is_verified:    false,
    plan_type:      'starter',
    claim_limit:    25,
    claims_used:    0,
    is_active:      true,
  },
];

mongoose.connect("mongodb://127.0.0.1/debt").then(async () => {
  await Agency.deleteMany({});
  await Agency.insertMany(agencies);
  console.log('✅ Agencies seeded');
  process.exit();
}).catch(err => {
  console.error(err);
  process.exit(1);
});