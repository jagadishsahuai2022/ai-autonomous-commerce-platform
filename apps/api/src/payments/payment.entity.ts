// Payment type - TypeORM entity removed; use Prisma for persistence

export interface Payment {
  id: string;
  orderId: string;
  method: string; // 'razorpay' | 'stripe' | 'wallet' | 'upi' | 'netbanking'
  amount: number;
  transactionId?: string;
  status: string; // 'pending' | 'processing' | 'completed' | 'failed' | 'refunded'
  metadata?: any; // raw gateway response
  failureReason?: string;
  refundedAmount: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}
