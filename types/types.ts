export interface Service {
  id: string;
  name: string;
  isAvailable: boolean;
  description: string | null;
  duration: number;
  category: string;
  price: number | null;
}

export interface BookingFormProps {
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  date: Date | undefined;
  handleDateSelect: (date: Date | undefined) => void;
  fullyBookedDates: Date[];
  step: 'form' | 'payment' | 'awaiting' | 'bank' | 'failed' | 'ticket';
  isSubmitting: boolean;
  handleSubmit: (e: React.FormEvent) => void;
  handleSelectChange: (name: string, value: string) => void;
  availableSlotsForSelectedDate: string[];
  unavailableSlots: string[];
  formatTime: (time: string) => string;
  isPaying: boolean;
  agreedToTerms: boolean;
  setAgreedToTerms: React.Dispatch<React.SetStateAction<boolean>>;
  handlePayment: () => Promise<void>;
  setStep: React.Dispatch<React.SetStateAction<'form' | 'payment' | 'awaiting' | 'bank' | 'failed' | 'ticket'>>;
  loyaltyDiscountEligible?: boolean;
  isReschedule?: boolean;
  accountBooking?: boolean;
  operator: 'tnm' | 'airtel' | 'bank' | null;
  setOperator: React.Dispatch<React.SetStateAction<'tnm' | 'airtel' | 'bank' | null>>;
  bankDetails?: {
    bank: string;
    name: string;
    number: string;
  } | null;
  onVerifyBank?: () => void;
  verifyingBank?: boolean;
  paymentExpiresAt?: string | null;
  reference?: string;
  payerNumber: string;
  setPayerNumber: React.Dispatch<React.SetStateAction<string>>;
  failureMessage?: string;
  onRetry: () => void;
  onAwaitingRetry?: () => void;
  onCancelPayment?: () => void;
  cancelConfirm?: boolean;
  ticketDetails?: {
    name: string;
    date: string;
    timeSlot: string;
    services: string[];
    fee: string;
    ticketId: string;
    discountApplied?: boolean;
  } | null;
  serviceNames?: string[];
} 