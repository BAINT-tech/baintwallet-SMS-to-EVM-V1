const walletService = require('./wallet-service');

class SMSHandler {
  constructor() {
    this.pendingTransactions = new Map();
  }

  async processCommand(phoneNumber, message) {
    const command = message.trim().toUpperCase();
    const parts = message.trim().split(/\s+/);
    const cmd = parts[0].toUpperCase();

    try {
      // Check if user has a wallet, create if not (except for HELP command)
      if (cmd !== 'HELP' && cmd !== 'START') {
        const hasWallet = await walletService.hasWallet(phoneNumber);
        if (!hasWallet) {
          return "Welcome to Baintwallet! 🎉\n\nReply START to create your wallet.";
        }
      }

      // Process commands
      switch (cmd) {
        case 'START':
          return await this.handleStart(phoneNumber);
        
        case 'BALANCE':
        case 'BAL':
          return await this.handleBalance(phoneNumber);
        
        case 'WALLET':
        case 'ADDRESS':
          return await this.handleWallet(phoneNumber);
        
        case 'SEND':
          return await this.handleSend(phoneNumber, parts);
        
        case 'CONFIRM':
          return await this.handleConfirm(phoneNumber);
        
        case 'CANCEL':
          return await this.handleCancel(phoneNumber);
        
        case 'HISTORY':
        case 'TX':
          return await this.handleHistory(phoneNumber);
        
        case 'HELP':
          return this.handleHelp();
        
        default:
          return `Unknown command: ${cmd}\n\nReply HELP for available commands.`;
      }
    } catch (error) {
      console.error('Command processing error:', error);
      return `Error: ${error.message}`;
    }
  }

  async handleStart(phoneNumber) {
    try {
      const hasWallet = await walletService.hasWallet(phoneNumber);
      
      if (hasWallet) {
        return "You already have a wallet! 👍\n\nReply WALLET to see your address or HELP for commands.";
      }

      const wallet = await walletService.createWallet(phoneNumber);
      
      return `✅ Wallet created!\n\n` +
             `Address: ${wallet.address}\n\n` +
             `⚠️ IMPORTANT: Keep your phone secure. Your private key is encrypted and stored securely.\n\n` +
             `Reply HELP for available commands.`;
    } catch (error) {
      throw new Error('Failed to create wallet. Please try again.');
    }
  }

  async handleBalance(phoneNumber) {
    try {
      const balance = await walletService.getBalance(phoneNumber);
      
      return `💰 Your Balance:\n\n` +
             `${balance.formatted} ${balance.symbol}\n` +
             `($${balance.usdValue || 'N/A'})\n\n` +
             `Chain: ${balance.chainName}`;
    } catch (error) {
      throw new Error('Failed to fetch balance. Please try again.');
    }
  }

  async handleWallet(phoneNumber) {
    try {
      const wallet = await walletService.getWalletAddress(phoneNumber);
      
      return `🏦 Your Wallet:\n\n` +
             `${wallet.address}\n\n` +
             `Reply BALANCE to check your balance.`;
    } catch (error) {
      throw new Error('Failed to retrieve wallet info.');
    }
  }

  async handleSend(phoneNumber, parts) {
    try {
      // Format: SEND <address> <amount>
      if (parts.length < 3) {
        return `❌ Invalid format.\n\n` +
               `Use: SEND <address> <amount>\n\n` +
               `Example: SEND 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb 0.01`;
      }

      const toAddress = parts[1];
      const amount = parts[2];

      // Validate address
      if (!toAddress.startsWith('0x') || toAddress.length !== 42) {
        return '❌ Invalid address format. Address must start with 0x and be 42 characters long.';
      }

      // Validate amount
      if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        return '❌ Invalid amount. Must be a positive number.';
      }

      // Store pending transaction
      this.pendingTransactions.set(phoneNumber, {
        to: toAddress,
        amount: amount,
        timestamp: Date.now()
      });

      return `📤 Send Transaction:\n\n` +
             `To: ${toAddress}\n` +
             `Amount: ${amount} ETH\n\n` +
             `⚠️ Reply CONFIRM to proceed or CANCEL to abort.\n\n` +
             `This transaction cannot be reversed!`;
    } catch (error) {
      throw new Error('Failed to prepare transaction.');
    }
  }

  async handleConfirm(phoneNumber) {
    try {
      const pending = this.pendingTransactions.get(phoneNumber);
      
      if (!pending) {
        return '❌ No pending transaction found.\n\nUse SEND <address> <amount> first.';
      }

      // Check if transaction is expired (10 minutes)
      if (Date.now() - pending.timestamp > 10 * 60 * 1000) {
        this.pendingTransactions.delete(phoneNumber);
        return '❌ Transaction expired. Please create a new transaction.';
      }

      // Execute transaction
      const result = await walletService.sendTransaction(
        phoneNumber,
        pending.to,
        pending.amount
      );

      // Clear pending transaction
      this.pendingTransactions.delete(phoneNumber);

      return `✅ Transaction Sent!\n\n` +
             `Hash: ${result.hash}\n` +
             `Amount: ${pending.amount} ETH\n` +
             `To: ${pending.to}\n\n` +
             `Track at: https://etherscan.io/tx/${result.hash}`;
    } catch (error) {
      this.pendingTransactions.delete(phoneNumber);
      throw new Error(`Transaction failed: ${error.message}`);
    }
  }

  async handleCancel(phoneNumber) {
    const pending = this.pendingTransactions.get(phoneNumber);
    
    if (!pending) {
      return 'ℹ️ No pending transaction to cancel.';
    }

    this.pendingTransactions.delete(phoneNumber);
    return '✅ Transaction cancelled.';
  }

  async handleHistory(phoneNumber) {
    try {
      const history = await walletService.getTransactionHistory(phoneNumber);
      
      if (history.length === 0) {
        return '📜 No transaction history yet.';
      }

      let response = '📜 Recent Transactions:\n\n';
      
      history.slice(0, 5).forEach((tx, index) => {
        response += `${index + 1}. ${tx.type} ${tx.amount} ${tx.symbol}\n`;
        response += `   ${tx.hash.substring(0, 10)}...\n`;
        response += `   ${tx.date}\n\n`;
      });

      return response + 'Reply WALLET for your address.';
    } catch (error) {
      throw new Error('Failed to fetch transaction history.');
    }
  }

  handleHelp() {
    return `📱 Baintwallet Commands:\n\n` +
           `START - Create your wallet\n` +
           `BALANCE - Check balance\n` +
           `WALLET - Get your address\n` +
           `SEND <addr> <amt> - Send tokens\n` +
           `CONFIRM - Confirm transaction\n` +
           `CANCEL - Cancel transaction\n` +
           `HISTORY - View transactions\n` +
           `HELP - Show this message\n\n` +
           `Example:\n` +
           `SEND 0x742d35Cc... 0.01`;
  }

  async getWalletInfo(phoneNumber) {
    const hasWallet = await walletService.hasWallet(phoneNumber);
    
    if (!hasWallet) {
      return { error: 'No wallet found for this number' };
    }

    const wallet = await walletService.getWalletAddress(phoneNumber);
    const balance = await walletService.getBalance(phoneNumber);

    return {
      address: wallet.address,
      balance: balance
    };
  }
}

module.exports = new SMSHandler();
