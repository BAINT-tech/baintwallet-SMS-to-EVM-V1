const { ethers } = require('ethers');
const CryptoJS = require('crypto-js');

class WalletService {
  constructor() {
    // Initialize provider
    this.provider = new ethers.JsonRpcProvider(
      process.env.RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/demo'
    );
    
    // In-memory storage (use database in production)
    this.wallets = new Map();
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';
  }

  // Encrypt private key
  encryptPrivateKey(privateKey, phoneNumber) {
    const key = `${this.encryptionKey}-${phoneNumber}`;
    return CryptoJS.AES.encrypt(privateKey, key).toString();
  }

  // Decrypt private key
  decryptPrivateKey(encryptedKey, phoneNumber) {
    const key = `${this.encryptionKey}-${phoneNumber}`;
    const bytes = CryptoJS.AES.decrypt(encryptedKey, key);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  // Check if wallet exists
  async hasWallet(phoneNumber) {
    return this.wallets.has(phoneNumber);
  }

  // Create new wallet
  async createWallet(phoneNumber) {
    try {
      if (this.wallets.has(phoneNumber)) {
        throw new Error('Wallet already exists for this number');
      }

      // Generate new wallet
      const wallet = ethers.Wallet.createRandom();
      
      // Encrypt and store private key
      const encryptedPrivateKey = this.encryptPrivateKey(wallet.privateKey, phoneNumber);
      
      this.wallets.set(phoneNumber, {
        address: wallet.address,
        encryptedPrivateKey: encryptedPrivateKey,
        createdAt: new Date().toISOString()
      });

      return {
        address: wallet.address
      };
    } catch (error) {
      throw new Error(`Wallet creation failed: ${error.message}`);
    }
  }

  // Get wallet address
  async getWalletAddress(phoneNumber) {
    const walletData = this.wallets.get(phoneNumber);
    
    if (!walletData) {
      throw new Error('Wallet not found');
    }

    return {
      address: walletData.address
    };
  }

  // Get wallet instance
  async getWallet(phoneNumber) {
    const walletData = this.wallets.get(phoneNumber);
    
    if (!walletData) {
      throw new Error('Wallet not found');
    }

    const privateKey = this.decryptPrivateKey(walletData.encryptedPrivateKey, phoneNumber);
    return new ethers.Wallet(privateKey, this.provider);
  }

  // Get balance
  async getBalance(phoneNumber) {
    try {
      const walletData = this.wallets.get(phoneNumber);
      
      if (!walletData) {
        throw new Error('Wallet not found');
      }

      const balance = await this.provider.getBalance(walletData.address);
      const formattedBalance = ethers.formatEther(balance);

      // Get chain info
      const network = await this.provider.getNetwork();

      return {
        balance: balance.toString(),
        formatted: parseFloat(formattedBalance).toFixed(4),
        symbol: 'ETH',
        chainId: network.chainId.toString(),
        chainName: network.name,
        usdValue: null // Add price oracle integration for USD value
      };
    } catch (error) {
      throw new Error(`Failed to fetch balance: ${error.message}`);
    }
  }

  // Send transaction
  async sendTransaction(phoneNumber, toAddress, amount) {
    try {
      const wallet = await this.getWallet(phoneNumber);

      // Validate recipient address
      if (!ethers.isAddress(toAddress)) {
        throw new Error('Invalid recipient address');
      }

      // Parse amount
      const amountInWei = ethers.parseEther(amount);

      // Check balance
      const balance = await wallet.provider.getBalance(wallet.address);
      if (balance < amountInWei) {
        throw new Error('Insufficient balance');
      }

      // Get gas price
      const feeData = await wallet.provider.getFeeData();

      // Estimate gas
      const gasLimit = 21000n; // Standard ETH transfer

      // Calculate total cost
      const totalCost = amountInWei + (feeData.gasPrice * gasLimit);
      
      if (balance < totalCost) {
        throw new Error('Insufficient balance for transaction + gas');
      }

      // Create and send transaction
      const tx = await wallet.sendTransaction({
        to: toAddress,
        value: amountInWei,
        gasLimit: gasLimit,
        gasPrice: feeData.gasPrice
      });

      // Wait for confirmation
      const receipt = await tx.wait();

      return {
        hash: receipt.hash,
        from: wallet.address,
        to: toAddress,
        amount: amount,
        blockNumber: receipt.blockNumber,
        status: receipt.status === 1 ? 'success' : 'failed'
      };
    } catch (error) {
      throw new Error(`Transaction failed: ${error.message}`);
    }
  }

  // Get transaction history
  async getTransactionHistory(phoneNumber) {
    try {
      const walletData = this.wallets.get(phoneNumber);
      
      if (!walletData) {
        throw new Error('Wallet not found');
      }

      // Note: This is a simplified version
      // In production, use etherscan API or graph protocol for full history
      
      const currentBlock = await this.provider.getBlockNumber();
      const history = [];

      // Search last 1000 blocks for transactions (demo purposes)
      const fromBlock = Math.max(0, currentBlock - 1000);
      
      // This is simplified - in production use proper indexing service
      return history;
    } catch (error) {
      console.error('History fetch error:', error);
      return [];
    }
  }

  // Get gas estimate
  async estimateGas(fromAddress, toAddress, amount) {
    try {
      const amountInWei = ethers.parseEther(amount);
      
      const gasEstimate = await this.provider.estimateGas({
        from: fromAddress,
        to: toAddress,
        value: amountInWei
      });

      const feeData = await this.provider.getFeeData();
      const gasCost = gasEstimate * feeData.gasPrice;

      return {
        gasLimit: gasEstimate.toString(),
        gasPrice: ethers.formatUnits(feeData.gasPrice, 'gwei'),
        gasCost: ethers.formatEther(gasCost),
        totalCost: ethers.formatEther(amountInWei + gasCost)
      };
    } catch (error) {
      throw new Error(`Gas estimation failed: ${error.message}`);
    }
  }
}

module.exports = new WalletService();
