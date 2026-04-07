const express = require('express');
const mongoose = require('mongoose');
const authRoutes = require('./routes/auth');
const cors=require('cors')
const claimRoutes = require('./routes/claims');
require('dotenv').config();
const connection=require('./connection/connection')
const app = express();
app.use(express.json());
app.use(cors())
connection


app.use('/api/auth', authRoutes);
app.use('/api/claims', claimRoutes);
app.use('/api/chat', require('./routes/chat'));
app.use('/api/agencies',    require('./routes/agency'));
app.use('/api/assignments', require('./routes/assignment'));
app.listen(5000, () => console.log('Server running on port 5000'));