'use client';

import { useState, useEffect } from 'react';
import { useInitiatePayment, useVerifyPayment } from '@/hooks/usePayments';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (paymentData: any) => void;
  orderId: string;
  amount: number;
  userEmail: string;
  userName: string;
  userPhone: string;
}

export default function PaymentModal({
  open,
  onClose,
  onSuccess,
  orderId,
  amount,
  userEmail,
  userName,
  userPhone,
}: PaymentModalProps) {
  const [step, setStep] = useState<'method' | 'processing' | 'success' | 'error'>('method');
  const [selectedMethod, setSelectedMethod] = useState<'razorpay' | 'upi' | 'netbanking' | null>(null);
  const [error, setError] = useState('');

  const initiateMutation = useInitiatePayment();
  const verifyMutation = useVerifyPayment();

  // Load Razorpay script
  useEffect(() => {
    if (!window.Razorpay) {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const handlePaymentInitiate = async () => {
    if (!selectedMethod) {
      setError('Please select a payment method');
      return;
    }

    setStep('processing');
    setError('');

    try {
      // Initiate payment
      const paymentData = await initiateMutation.mutateAsync({
        orderId,
        method: selectedMethod,
      });

      if (selectedMethod === 'razorpay' && paymentData.razorpayOrderId) {
        // Handle Razorpay
        const options = {
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          amount: amount * 100, // Convert to paise
          currency: 'INR',
          order_id: paymentData.razorpayOrderId,
          name: 'DelegateCart',
          description: `Payment for Order ${orderId}`,
          customer_id: paymentData.customerId,
          prefill: {
            name: userName,
            email: userEmail,
            contact: userPhone,
          },
          theme: {
            color: '#3399cc',
          },
          handler: async (response: any) => {
            // Verify payment
            try {
              const verifyResult = await verifyMutation.mutateAsync({
                orderId,
                transactionId: response.razorpay_payment_id,
                response: {
                  razorpayOrderId: response.razorpay_order_id,
                  razorpaySignature: response.razorpay_signature,
                },
              });

              setStep('success');
              setTimeout(() => {
                onSuccess?.(verifyResult);
                onClose();
              }, 2000);
            } catch (err) {
              setStep('error');
              setError('Payment verification failed. Please try again.');
            }
          },
          modal: {
            ondismiss: () => {
              setStep('method');
            },
          },
        };

        const paymentWindow = new window.Razorpay(options);
        paymentWindow.open();
      } else {
        // For wallet and other methods, payment is already processed
        setStep('success');
        setTimeout(() => {
          onSuccess?.(paymentData);
          onClose();
        }, 2000);
      }
    } catch (err: any) {
      setStep('error');
      setError(err?.response?.data?.message || 'Payment initiation failed. Please try again.');
    }
  };

  const paymentMethods = [
    {
      id: 'razorpay',
      name: 'Razorpay',
      description: 'Credit/Debit Card, UPI',
      icon: '💳',
    },
    {
      id: 'upi',
      name: 'UPI',
      description: 'Google Pay, PhonePe, Paytm',
      icon: '📱',
    },
    {
      id: 'netbanking',
      name: 'Net Banking',
      description: 'Direct Bank Transfer',
      icon: '🏦',
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === 'method' && 'Select Payment Method'}
            {step === 'processing' && 'Processing Payment'}
            {step === 'success' && 'Payment Successful'}
            {step === 'error' && 'Payment Failed'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Order Amount */}
          {step === 'method' && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-sm text-gray-600">Amount to Pay</p>
              <p className="text-2xl font-bold text-blue-600">₹{amount.toFixed(2)}</p>
            </div>
          )}

          {/* Step: Select Method */}
          {step === 'method' && (
            <>
              <div className="space-y-3">
                {paymentMethods.map((method) => (
                  <button
                    key={method.id}
                    onClick={() => setSelectedMethod(method.id as any)}
                    className={`w-full p-4 border-2 rounded-lg transition-all text-left ${
                      selectedMethod === method.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{method.icon}</span>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{method.name}</p>
                        <p className="text-sm text-gray-600">{method.description}</p>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          selectedMethod === method.id
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300'
                        }`}
                      >
                        {selectedMethod === method.id && (
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handlePaymentInitiate}
                  disabled={!selectedMethod || initiateMutation.isPending}
                  className="flex-1"
                >
                  {initiateMutation.isPending && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  Pay ₹{amount.toFixed(2)}
                </Button>
              </div>
            </>
          )}

          {/* Step: Processing */}
          {step === 'processing' && (
            <div className="space-y-4 py-8 text-center">
              <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto" />
              <div>
                <p className="font-semibold text-gray-900">Processing your payment</p>
                <p className="text-sm text-gray-600">Please don't close this window</p>
              </div>
            </div>
          )}

          {/* Step: Success */}
          {step === 'success' && (
            <div className="space-y-4 py-8 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto" />
              <div>
                <p className="font-semibold text-gray-900">Payment Successful!</p>
                <p className="text-sm text-gray-600">Your order has been confirmed</p>
              </div>
              <p className="text-sm text-gray-500">Redirecting to order details...</p>
            </div>
          )}

          {/* Step: Error */}
          {step === 'error' && (
            <div className="space-y-4 py-8">
              <div className="text-center">
                <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
                <div>
                  <p className="font-semibold text-gray-900">Payment Failed</p>
                  <p className="text-sm text-gray-600 mt-2">{error}</p>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setStep('method');
                    setSelectedMethod(null);
                    setError('');
                  }}
                  className="flex-1"
                >
                  Try Again
                </Button>
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="flex-1"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
