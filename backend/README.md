# Baintwallet - SMS to EVM Wallet

Send crypto via text message! 📱⛓️

## Quick Start

1. Clone this repo
2. Run `npm install`
3. Configure `.env` with your Twilio credentials
4. Run `npm start`
5. Send SMS commands to your Twilio number!

## SMS Commands

- `START` - Create wallet
- `BALANCE` - Check balance
- `WALLET` - Get address
- `SEND <address> <amount>` - Send transaction
- `CONFIRM` - Confirm pending transaction
- `HELP` - Show all commands

## Setup

```bash
npm install
cp .env.example .env
# Edit .env with your credentials
npm start
