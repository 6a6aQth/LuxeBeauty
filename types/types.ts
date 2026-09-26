export interface Service {
  id: string;
  name: string;
  isAvailable: boolean;
  description: string | null;
  duration: number;
  category: string;
}

export interface BookingFormProps {
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  date: Date | undefined;
  handleDateSelect: (date: Date | undefined) => void;
  fullyBookedDates: Date[];
  step: 'form' | 'payment' | 'awaiting' | 'failed' | 'ticket';
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
  setStep: React.Dispatch<React.SetStateAction<'form' | 'payment' | 'awaiting' | 'failed' | 'ticket'>>;
  loyaltyDiscountEligible?: boolean;
  isReschedule?: boolean;
  accountBooking?: boolean;
  operator: 'tnm' | 'airtel';
  setOperator: React.Dispatch<React.SetStateAction<'tnm' | 'airtel'>>;
  payerNumber: string;
  setPayerNumber: React.Dispatch<React.SetStateAction<string>>;
  failureMessage?: string;
  onRetry: () => void;
  onAwaitingRetry?: () => void;
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