/**
 * India Localization Service
 * Handles India-specific e-commerce features
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class IndiaLocalizationService {
  private readonly logger = new Logger(IndiaLocalizationService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get EMI options for product
   */
  async getEMIOptions(
    amount: number,
    userPreferences?: any
  ): Promise<
    Array<{
      tenure: number;
      monthlyAmount: number;
      totalAmount: number;
      interestRate: number;
      processor: string;
    }>
  > {
    // Common EMI tenures in India
    const tenures = [3, 6, 12, 18, 24];
    const interestRate = 0.12; // 12% annual (typical)

    const options = tenures
      .filter((tenure) => {
        // Check user preferences if available
        if (userPreferences?.preferredTenures) {
          return userPreferences.preferredTenures.includes(tenure);
        }
        return true;
      })
      .map((tenure) => {
        const monthlyRate = interestRate / 12;
        const monthlyAmount =
          (amount * monthlyRate * Math.pow(1 + monthlyRate, tenure)) /
          (Math.pow(1 + monthlyRate, tenure) - 1);
        const totalAmount = monthlyAmount * tenure;

        return {
          tenure,
          monthlyAmount: Math.round(monthlyAmount * 100) / 100,
          totalAmount: Math.round(totalAmount * 100) / 100,
          interestRate: interestRate * 100,
          processor: 'HDFC', // Could vary based on partner
        };
      });

    return options;
  }

  /**
   * Check COD availability for pincode/amount
   */
  async checkCODAvailability(
    pincode: string,
    amount: number,
    userPreferences?: any
  ): Promise<{
    available: boolean;
    maxAmount: number;
    estimatedDelivery: number; // days
    charges: number;
  }> {
    // COD availability logic
    const codMaxAmount = userPreferences?.codMaxAmount || 100000; // Default 1 lakh

    // Check against amount
    if (amount > codMaxAmount) {
      return {
        available: false,
        maxAmount: codMaxAmount,
        estimatedDelivery: 0,
        charges: 0,
      };
    }

    // Tier 1 cities: COD available for amounts up to 100k
    const tier1Pincodes = this.getTier1Pincodes();
    const isTier1 = tier1Pincodes.includes(pincode);

    // Tier 2 cities: COD available for amounts up to 50k
    if (!isTier1 && amount > 50000) {
      return {
        available: false,
        maxAmount: 50000,
        estimatedDelivery: 0,
        charges: 0,
      };
    }

    // Determine delivery days
    let estimatedDelivery = isTier1 ? 2 : 4;
    if (userPreferences?.preferExpress && amount < 50000) {
      estimatedDelivery = 1;
    }

    // COD charges (typically 1-2% of order value)
    const charges = Math.round(amount * 0.015 * 100) / 100;

    return {
      available: true,
      maxAmount: codMaxAmount,
      estimatedDelivery,
      charges,
    };
  }

  /**
   * Calculate delivery ETA by pincode
   */
  async getDeliveryETA(
    pincode: string,
    userPreferences?: any
  ): Promise<{
    standardDelivery: number; // days
    expressDelivery?: number; // days
    available: boolean;
    estimatedDate: Date;
  }> {
    const tier1Pincodes = this.getTier1Pincodes();
    const tier2Pincodes = this.getTier2Pincodes();

    let standardDays = 4;
    let expressDays = undefined;

    if (tier1Pincodes.includes(pincode)) {
      standardDays = 2;
      expressDays = 1;
    } else if (tier2Pincodes.includes(pincode)) {
      standardDays = 3;
      expressDays = 2;
    }

    // Override with user preferences
    if (userPreferences?.maxDeliveryDays) {
      standardDays = Math.min(standardDays, userPreferences.maxDeliveryDays);
    }

    // Calculate estimated date
    const estimatedDate = new Date();
    estimatedDate.setDate(estimatedDate.getDate() + standardDays);

    return {
      standardDelivery: standardDays,
      expressDelivery: expressDays,
      available: true,
      estimatedDate,
    };
  }

  /**
   * Get payment methods for region
   */
  async getAvailablePaymentMethods(
    pincode: string,
    userPreferences?: any
  ): Promise<{
    methods: Array<{
      id: string;
      name: string;
      available: boolean;
      charges: number; // percentage
      processingTime: number; // minutes
    }>;
  }> {
    const defaultMethods = [
      {
        id: 'card',
        name: 'Credit/Debit Card',
        available: true,
        charges: 0,
        processingTime: 1,
      },
      {
        id: 'upi',
        name: 'UPI',
        available: true,
        charges: 0,
        processingTime: 1,
      },
      {
        id: 'netbanking',
        name: 'Net Banking',
        available: true,
        charges: 0,
        processingTime: 2,
      },
      {
        id: 'wallet',
        name: 'Digital Wallet',
        available: true,
        charges: 0,
        processingTime: 1,
      },
      {
        id: 'emi',
        name: 'EMI',
        available: true,
        charges: 0.99, // Bank charges
        processingTime: 5,
      },
      {
        id: 'cod',
        name: 'Cash on Delivery',
        available: true,
        charges: 1.5,
        processingTime: 0,
      },
    ];

    // Filter based on user preferences
    if (userPreferences?.preferredPaymentMethods) {
      return {
        methods: defaultMethods.filter((m) =>
          userPreferences.preferredPaymentMethods.includes(m.id)
        ),
      };
    }

    return { methods: defaultMethods };
  }

  /**
   * Format price in Indian format
   */
  formatIndianPrice(amount: number): string {
    // Indian numbering: 1,00,000 for 100000
    const parts = amount.toString().split('.');
    const integerPart = parts[0];
    const decimalPart = parts[1] ? '.' + parts[1] : '';

    const formatted = integerPart.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    return '₹' + formatted + decimalPart;
  }

  /**
   * Save user localization preferences
   */
  async saveUserPreferences(
    userId: string,
    preferences: {
      emiEnabled?: boolean;
      codEnabled?: boolean;
      preferredPaymentMethods?: string[];
      defaultPincode?: string;
      homeState?: string;
      maxDeliveryDays?: number;
      maxEMIAmount?: number;
      codMaxAmount?: number;
    }
  ): Promise<void> {
    try {
      await this.prisma.indiaLocalizedFeature.upsert({
        where: { userId },
        update: preferences,
        create: {
          userId,
          maxEMIAmount: preferences.maxEMIAmount ?? 50000,
          codMaxAmount: preferences.codMaxAmount ?? 10000,
          ...preferences,
        },
      });

      this.logger.log(`✓ Saved localization preferences for user ${userId}`);
    } catch (error) {
      this.logger.error('Failed to save localization preferences', error);
    }
  }

  /**
   * Get user localization preferences
   */
  async getUserPreferences(userId: string): Promise<any | null> {
    return this.prisma.indiaLocalizedFeature.findUnique({
      where: { userId },
    });
  }

  /**
   * Get tier 1 cities (major metros)
   */
  private getTier1Pincodes(): string[] {
    // Sample tier 1 pincodes (major metros in India)
    return [
      // Delhi NCR
      '110001',
      '110002',
      '110003',
      '110004',
      '110005',
      '201001',
      '201101',
      '251001',
      // Mumbai
      '400001',
      '400002',
      '400003',
      '400004',
      '400005',
      // Bangalore
      '560001',
      '560002',
      '560003',
      '560004',
      '560005',
      // Hyderabad
      '500001',
      '500002',
      '500003',
      '500004',
      '500005',
      // Chennai
      '600001',
      '600002',
      '600003',
      '600004',
      '600005',
    ];
  }

  /**
   * Get tier 2 cities
   */
  private getTier2Pincodes(): string[] {
    // Sample tier 2 pincodes
    return [
      // Pune
      '411001',
      '411002',
      '411003',
      // Kolkata
      '700001',
      '700002',
      '700003',
      // Jaipur
      '302001',
      '302002',
      '302003',
      // Lucknow
      '226001',
      '226002',
      '226003',
    ];
  }

  /**
   * Convert amount from one currency to INR
   */
  async convertToINR(amount: number, currency: string): Promise<number> {
    // Mock conversion rates
    const rates: Record<string, number> = {
      USD: 83,
      EUR: 90,
      GBP: 105,
      INR: 1,
    };

    if (currency === 'INR') {
      return amount;
    }

    const rate = rates[currency] || 1;
    return Math.round(amount * rate * 100) / 100;
  }
}
