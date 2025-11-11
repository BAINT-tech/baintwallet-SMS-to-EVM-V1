require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const smsHandler = require('./sms-handler');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// SMS webhook rate limiter (stricter)
const smsLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10 // limit to 10 SMS per minute per IP
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'Baintwallet SMS to EVM'
  });
});

// Twilio SMS Webhook
app.post('/sms/webhook', smsLimiter, async (req, res) => {
  try {
    const { From, Body } = req.body;
    
    console.log(`SMS received from ${From}: ${Body}`);
    
    // Process the SMS command
    const response = await smsHandler.processCommand(From, Body);
    
    // Send TwiML response
    res.type('text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${response}</Message>
</Response>`);
  } catch (error) {
    console.error('Error processing SMS:', error);
    res.type('text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Sorry, an error occurred. Please try again later.</Message>
</Response>`);
  }
});

// API endpoint to get wallet info (for internal use/testing)
app.get('/api/wallet/:phone', async (req, res) => {
  try {
    const phone = req.params.phone;
    const walletInfo = await smsHandler.getWalletInfo(phone);
    res.json(walletInfo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Baintwallet server running on port ${PORT}`);
  console.log(`📱 SMS webhook ready at /sms/webhook`);
  console.log(`🔗 Health check at /health`);
  console.log(`⛓️  Chain ID: ${process.env.CHAIN_ID || 1}`);
});

module.exports = app;
