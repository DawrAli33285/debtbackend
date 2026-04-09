const express = require('express');
const mongoose = require('mongoose');
const authRoutes = require('./routes/auth');
const cors=require('cors')
const claimRoutes = require('./routes/claims');
const businessSubscriptionRoutes=require('./routes/businesssubscription')
const agencySubscriptionRoutes=require('./routes/agencysubscription')
require('dotenv').config();
const connection=require('./connection/connection')
const app = express();
app.use(express.json());
app.use(cors())
connection


app.use('/uploads', express.static('/tmp/public/files/files'));
app.use('/api/auth', authRoutes);
app.use('/api/claims', claimRoutes);
app.use('/api/chat', require('./routes/chat'));
app.use('/api/agencies',    require('./routes/agency'));
app.use('/api/assignments', require('./routes/assignment'));
app.use('/api/subscription',agencySubscriptionRoutes)
app.use('/api/businessSubscription',businessSubscriptionRoutes)
app.use('/api/agency/claims', require('./routes/agencyclaim'));
app.listen(5000, () => console.log('Server running on port 5000'));