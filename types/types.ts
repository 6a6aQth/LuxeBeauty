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
  step: 'form' | 'payment';
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
  setStep: React.Dispatch<React.SetStateAction<'form' | 'payment'>>;
  loyaltyDiscountEligible?: boolean;
  isReschedule?: boolean;
} 