'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { format, parseISO, isValid, startOfWeek, endOfWeek, isWithinInterval, addDays, isToday } from 'date-fns'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/dist/style.css'
import { Calendar } from "@/components/ui/calendar"
import { useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { getSlotsForDate, formatTime, generateTimeSlots } from "@/lib/time-slots"
import { canonicalPhone, sanitizePhoneInput } from "@/lib/phone"
import Logo from "@/components/logo";
import NewsletterForm from '@/components/newsletter-form';
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { ShineBorder } from "@/components/ui/shine-border";
import { WavyBackground } from "@/components/ui/wavy-background";
import { PlusCircle, Edit, Trash2, Calendar as CalendarIcon, LogOut, Search, UploadCloud, Send, Sun, Moon, Settings, Users, Briefcase, Mail } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { FileUpload } from '@/components/ui/file-upload'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

const ADMIN_PASSWORD = 'luxe' // This should be an environment variable in a real app

interface Service {
  id: string;
  name: string;
  description: string | null;
  duration: number;
  category: string;
  isAvailable: boolean;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
}

interface Booking {
  id: string;
  ticketId: string;
  name: string;
  date: string;
  timeSlot: string;
  services: string[];
  phone: string;
  email?: string;
  discountApplied?: boolean;
  inspirationPhotos?: string[];
  notes?: string;
  status?: string; // Add status field for filtering
  rescheduleCount?: number;
  originalDate?: string;
}

interface UnavailableDate {
  date: string;
  timeSlots: string[];
}

const emptyService: Service = {
  id: '',
  name: '',
  description: '',
  duration: 60,
  category: '',
  isAvailable: true,
}

export default function AdminPage() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [unavailableDates, setUnavailableDates] = useState<UnavailableDate[]>([])
  const [view, setView] = useState('all') // 'all' or 'upcoming'
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSavingPrices, setIsSavingPrices] = useState(false)
  const [isManageDateOpen, setIsManageDateOpen] = useState(false)
  const [managedSlots, setManagedSlots] = useState<string[]>([])
  const [showAll, setShowAll] = useState(false)
  const [priceListUrl, setPriceListUrl] = useState('')
  const [priceListFile, setPriceListFile] = useState<File | null>(null)
  const [isSavingPriceList, setIsSavingPriceList] = useState(false)
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [isDeletingService, setIsDeletingService] = useState<Service | null>(null)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [isClient, setIsClient] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all') // Default to 'all' so pending bookings are visible immediately (Bug #3)
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [isDeletingCategory, setIsDeletingCategory] = useState<Category | null>(null)
  const [manageServicesTab, setManageServicesTab] = useState<'services' | 'categories'>('services')
  const isMobile = useIsMobile();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDeletingBooking, setIsDeletingBooking] = useState<Booking | null>(null);
  const [isEditingBooking, setIsEditingBooking] = useState<Booking | null>(null);
  const [editingBookingData, setEditingBookingData] = useState<Booking | null>(null);

  useEffect(() => setIsClient(true), [])

  // NEW useEffect hook to synchronize managedSlots with unavailableDates
  useEffect(() => {
    if (isModalOpen && selectedDate) {
      const dateString = format(selectedDate, 'yyyy-MM-dd');
      const unavailableForDate = unavailableDates.find(d => d.date === dateString);
      setManagedSlots(unavailableForDate ? unavailableForDate.timeSlots : []);
    }
  }, [isModalOpen, selectedDate, unavailableDates]); // Dependency array includes unavailableDates

  const allTimeSlots = useMemo(() => generateTimeSlots(true), [])

  const fetchAdminData = async () => {
    try {
      const [bookingsRes, unavailableRes, servicesRes, priceListRes, categoriesRes] =
        await Promise.all([
          fetch(`/api/bookings?status=${statusFilter}`),
          fetch('/api/unavailable-dates'),
          fetch('/api/services'),
          fetch('/api/price-list'),
          fetch('/api/categories'),
        ])

      if (bookingsRes.ok) setBookings(await bookingsRes.json())
      if (unavailableRes.ok) setUnavailableDates(await unavailableRes.json())
      if (servicesRes.ok) setServices(await servicesRes.json())

      // Handle categories with better error logging
      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json()
        console.log('Categories fetched:', categoriesData)
        setCategories(categoriesData)
      } else {
        const errorText = await categoriesRes.text()
        console.error('Categories API error:', categoriesRes.status, errorText)
        toast({
          title: 'Warning',
          description: 'Failed to load categories. Please refresh the page.',
          variant: 'destructive',
        })
      }

      if (priceListRes.ok) {
        const data = await priceListRes.json()
        setPriceListUrl(data.priceListUrl)
      }
    } catch (error) {
      console.error('Failed to fetch admin data', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch data.',
        variant: 'destructive',
      })
    }
  }

  useEffect(() => {
    if (isClient && sessionStorage.getItem('llb_admin_auth') === 'true') {
      setIsAuthenticated(true)
    }
  }, [isClient])

  useEffect(() => {
    if (isAuthenticated) {
      fetchAdminData()
    }
  }, [isAuthenticated, statusFilter])

  const getServiceNames = (serviceIds: string[]): string[] => {
    if (!services || services.length === 0) return serviceIds; // Fallback to IDs if services not loaded
    return serviceIds.map(id => {
      const service = services.find(s => s.id === id);
      return service ? service.name : id; // Fallback to ID if name not found
    });
  };

  const handlePriceChange = (id: string, newPrice: string) => {
    const price = parseInt(newPrice, 10);
    if (isNaN(price)) return;
    setServices(prev =>
      prev.map(s => s.id === id ? { ...s, price } : s)
    );
  };

  const handleSaveChanges = async () => {
    setIsSavingPrices(true);
    try {
      const response = await fetch('/api/services', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ services }),
      });

      if (!response.ok) {
        throw new Error('Failed to save prices');
      }

      toast({ title: "Success", description: "Service prices have been updated." });
    } catch (error) {
      toast({ title: "Error", description: "Could not save prices.", variant: "destructive" });
    } finally {
      setIsSavingPrices(false);
    }
  };

  const handleSavePriceList = async () => {
    if (!priceListFile) {
      toast({ title: "No file selected", description: "Please select an image to upload.", variant: "destructive" });
      return;
    }

    // Bug #2 Fix: Add client-side file size validation (Vercel Blob limit is 4.5MB for free tier)
    const MAX_FILE_SIZE = 4.5 * 1024 * 1024; // 4.5MB
    if (priceListFile.size > MAX_FILE_SIZE) {
      toast({
        title: "File too large",
        description: `The image is too large (${(priceListFile.size / (1024 * 1024)).toFixed(1)}MB). Please upload an image smaller than 4.5MB.`,
        variant: "destructive"
      });
      return;
    }

    setIsSavingPriceList(true);
    try {
      const response = await fetch(
        `/api/price-list/upload?filename=${priceListFile.name}`,
        {
          method: 'POST',
          body: priceListFile,
        }
      );

      if (!response.ok) {
        throw new Error('Failed to upload price list');
      }

      const newBlob = await response.json();
      setPriceListUrl(newBlob.url);
      setPriceListFile(null); // Clear the file input

      toast({ title: "Success", description: "Price list has been updated." });
    } catch (error) {
      toast({ title: "Error", description: "Could not save price list.", variant: "destructive" });
    } finally {
      setIsSavingPriceList(false);
    }
  };

  const filteredBookings = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let bookingsToShow = bookings;

    // Filter by status
    if (statusFilter !== 'all') {
      bookingsToShow = bookingsToShow.filter(booking => booking.status === statusFilter);
    }

    // Filter for upcoming bookings if showAll is false
    if (!showAll) {
      bookingsToShow = bookingsToShow.filter(booking => {
        try {
          const bookingDate = parseISO(booking.date);
          return isValid(bookingDate) && bookingDate >= today;
        } catch {
          return false;
        }
      });
    }

    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      bookingsToShow = bookingsToShow.filter(booking => {
        const servicesString = Array.isArray(booking.services) ? getServiceNames(booking.services).join(' ') : '';
        return (
          booking.name.toLowerCase().includes(searchLower) ||
          booking.phone.toLowerCase().includes(searchLower) ||
          (booking.email && booking.email.toLowerCase().includes(searchLower)) ||
          servicesString.toLowerCase().includes(searchLower)
        );
      });
    }

    // Sort the bookings by date and timeSlot (earliest first)
    return bookingsToShow.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      if (dateA.getTime() !== dateB.getTime()) {
        return dateA.getTime() - dateB.getTime();
      }
      // If dates are equal, compare timeSlot as time (e.g., '8:30 AM')
      const parseTime = (timeStr: string) => {
        // Parse '8:30 AM' to a Date object on the same day
        const [time, modifier] = timeStr.split(' ');
        let [hours, minutes] = time.split(':').map(Number);
        if (modifier === 'PM' && hours !== 12) hours += 12;
        if (modifier === 'AM' && hours === 12) hours = 0;
        return hours * 60 + minutes;
      };
      return parseTime(a.timeSlot) - parseTime(b.timeSlot);
    });
  }, [bookings, searchTerm, showAll, statusFilter]);

  const weeklyCapacity = useMemo(() => {
    const today = new Date();
    const next7Days = addDays(today, 7);
    today.setHours(0, 0, 0, 0);

    const bookingsInNext7Days = bookings.filter(b => {
      try {
        const bookingDate = parseISO(b.date);
        // Only count successful bookings for capacity calculation
        return isValid(bookingDate) &&
          isWithinInterval(bookingDate, { start: today, end: next7Days }) &&
          b.status === 'successful';
      } catch {
        return false;
      }
    });

    const totalSlotsInNext7Days = allTimeSlots.length * 7;
    const bookedSlots = bookingsInNext7Days.length;

    if (totalSlotsInNext7Days === 0) {
      return { count: 0, percentage: 0 };
    }

    const percentage = (bookedSlots / totalSlotsInNext7Days) * 100;

    return { count: bookedSlots, percentage };
  }, [bookings, allTimeSlots]);

  const availableSlotsForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    return getSlotsForDate(selectedDate);
  }, [selectedDate]);

  const bookingsForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    // Only include successful bookings when determining booked slots
    return bookings.filter(b => b.date.startsWith(dateStr) && b.status === 'successful');
  }, [selectedDate, bookings]);

  const bookedTimeSlots = useMemo(() => {
    return bookingsForSelectedDate.map(b => b.timeSlot);
  }, [bookingsForSelectedDate]);

  const handleSaveAvailability = async () => {
    if (!selectedDate) return;
    const dateStr = format(selectedDate, "yyyy-MM-dd");

    try {
      const response = await fetch('/api/unavailable-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr, slots: managedSlots }),
      });

      if (!response.ok) {
        throw new Error('Failed to update availability');
      }

      const updatedUnavailableDate = await response.json();
      setUnavailableDates(prev => {
        const existingIndex = prev.findIndex(u => u.date === updatedUnavailableDate.date);
        if (existingIndex > -1) {
          const newArr = [...prev];
          newArr[existingIndex] = updatedUnavailableDate;
          return newArr;
        } else {
          return [...prev, updatedUnavailableDate];
        }
      });

      toast({ title: "Success", description: "Availability updated successfully." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to update availability.", variant: "destructive" });
    } finally {
      setIsModalOpen(false);
      fetchAdminData(); // Ensure latest data is fetched after saving
    }
  };

  const bookedDays = useMemo(() => {
    return bookings
      .filter(b => b.status === 'successful') // Only include successful bookings
      .map(b => {
        const d = parseISO(b.date);
        return isValid(d) ? d : null;
      }).filter(Boolean) as Date[];
  }, [bookings]);

  const parsedUnavailableDates = useMemo(() => {
    const fullyUnavailableDates: Date[] = [];
    unavailableDates.forEach(unavailableDate => {
      const allPossibleSlots = getSlotsForDate(parseISO(unavailableDate.date));
      if (allPossibleSlots.length > 0 && allPossibleSlots.every(slot => unavailableDate.timeSlots.includes(slot))) {
        const d = parseISO(unavailableDate.date);
        if (isValid(d)) {
          fullyUnavailableDates.push(d);
        }
      }
    });
    return fullyUnavailableDates;
  }, [unavailableDates]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem("llb_admin_auth", "true")
      setIsAuthenticated(true)
    } else {
      toast({ title: "Error", description: "Incorrect password.", variant: "destructive" })
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem("llb_admin_auth")
    setIsAuthenticated(false)
    router.push('/');
  }

  const handleDateClick = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Working days are Mon-Sat. Block clicks only on past dates and Sundays.
    if (date < today || date.getDay() === 0) {
      return;
    }
    setSelectedDate(date);
    const dateString = date.toISOString().split('T')[0];
    const unavailableForDate = unavailableDates.find(d => d.date === dateString);
    setManagedSlots(unavailableForDate ? unavailableForDate.timeSlots : []);
    setIsModalOpen(true);
  };

  const handleOpenServiceModal = (service: Service | null) => {
    setEditingService(service ? { ...service } : { ...emptyService })
    setIsServiceModalOpen(true)
  }

  const handleSaveService = async () => {
    if (!editingService) return

    const { id, name, description, duration, category } = editingService

    const url = id ? `/api/services/${id}` : '/api/services'
    const method = id ? 'PUT' : 'POST'
    const body = JSON.stringify({ name, description, duration, category })

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body,
      })

      if (!response.ok) throw new Error('Failed to save service')

      toast({
        title: 'Success',
        description: `Service has been ${id ? 'updated' : 'created'}.`,
      })
      setIsServiceModalOpen(false)
      setEditingService(null)
      fetchAdminData()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Could not save service.',
        variant: 'destructive',
      })
    }
  }

  const handleDeleteService = async () => {
    if (!isDeletingService) return

    try {
      const response = await fetch(`/api/services/${isDeletingService.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete service')
      }

      toast({ title: 'Success', description: 'Service has been deleted.' })
      setIsDeletingService(null)
      fetchAdminData() // Refresh data
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Could not delete service.',
        variant: 'destructive',
      })
    }
  }

  const handleToggleServiceAvailability = async (service: Service) => {
    try {
      const response = await fetch(`/api/services/${service.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAvailable: !service.isAvailable }),
      });

      if (!response.ok) {
        throw new Error('Failed to update service availability');
      }

      toast({ title: "Success", description: "Service availability has been updated." });
      fetchAdminData();
    } catch (error) {
      toast({ title: "Error", description: "Could not update availability.", variant: "destructive" });
    }
  };

  // Categories used to filter services are derived from central Category list
  const serviceCategories = useMemo(() => {
    return ['all', ...categories.map((c) => c.name)];
  }, [categories]);

  // Ensure the current filter is always valid when categories change
  useEffect(() => {
    if (!serviceCategories.includes(categoryFilter)) {
      setCategoryFilter('all');
    }
  }, [serviceCategories, categoryFilter]);

  const filteredServices = useMemo(() => {
    if (categoryFilter === 'all') {
      return services;
    }
    return services.filter((service) => service.category === categoryFilter);
  }, [services, categoryFilter]);

  const handleOpenBookingDetails = (booking: Booking) => {
    setIsEditingBooking(booking);
    setEditingBookingData({ ...booking });
  };

  const handleDeleteBooking = async () => {
    if (!isDeletingBooking) return;

    try {
      const response = await fetch(`/api/bookings/${isDeletingBooking.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete booking');
      }

      toast({ title: 'Success', description: 'Booking has been deleted.' });
      setIsDeletingBooking(null);
      fetchAdminData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Could not delete booking.',
        variant: 'destructive',
      });
    }
  };

  const handleMarkSuccessful = async (booking: Booking) => {
    try {
      const response = await fetch(`/api/bookings/${booking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'successful' }),
      });

      if (!response.ok) {
        throw new Error('Failed to update booking status');
      }

      toast({ title: 'Updated', description: 'Booking marked as successful.' });
      fetchAdminData();
    } catch (error) {
      toast({ title: 'Error', description: 'Could not update booking status.', variant: 'destructive' });
    }
  };

  const handleSaveBooking = async () => {
    if (!editingBookingData || !isEditingBooking) {
      console.error('Missing booking data or editing state');
      return;
    }

    if (!canonicalPhone(editingBookingData.phone)) {
      toast({
        title: 'Check the phone number',
        description: 'That phone number format is not okay.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await fetch(`/api/bookings/${isEditingBooking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingBookingData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update booking');
      }

      toast({ title: 'Success', description: 'Booking has been updated.' });
      setIsEditingBooking(null);
      setEditingBookingData(null);
      fetchAdminData();
    } catch (error: any) {
      console.error('Error saving booking:', error);
      toast({
        title: 'Error',
        description: error.message || 'Could not update booking.',
        variant: 'destructive'
      });
    }
  };

  const handleOpenCategoryModal = (category: Category | null) => {
    setEditingCategory(category);
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async () => {
    if (!editingCategory || !editingCategory.name.trim()) {
      toast({
        title: "Validation",
        description: "Category name is required.",
        variant: "destructive",
      });
      return;
    }

    const { id, name, description, imageUrl } = editingCategory;
    const url = id ? `/api/categories/${id}` : "/api/categories";
    const method = id ? "PUT" : "POST";

    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, imageUrl }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save category");
      }

      toast({
        title: "Success",
        description: `Category has been ${id ? "updated" : "created"}.`,
      });
      setIsCategoryModalOpen(false);
      setEditingCategory(null);
      fetchAdminData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Could not save category.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteCategory = async () => {
    if (!isDeletingCategory) return;
    try {
      const response = await fetch(`/api/categories/${isDeletingCategory.id}`, {
        method: "DELETE",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Failed to delete category. Make sure no services are using it."
        );
      }

      toast({
        title: "Success",
        description: "Category has been deleted.",
      });
      setIsDeletingCategory(null);
      fetchAdminData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Could not delete category.",
        variant: "destructive",
      });
    }
  };

  if (!isClient) {
    return null; // Render nothing on the server/first-client render
  }

  if (!isAuthenticated) {
    return (
      <WavyBackground
        containerClassName="flex items-center justify-center"
        className="p-4"
        colors={["#2E2E2E", "#4A4A4A", "#1C1C1C"]}
        waveOpacity={0.3}
        backgroundFill="black"
      >
        <Card className="relative max-w-sm p-6 space-y-4 overflow-hidden bg-white dark:bg-gray-900 rounded-2xl shadow-xl">
          <ShineBorder borderWidth={2} shineColor="hsl(var(--primary))" />
          <CardHeader className="text-center p-0">
            <div className="flex justify-center mb-4">
              <Logo />
            </div>
            <CardTitle className="text-2xl font-bold font-serif">Admin Login</CardTitle>
            <CardDescription>Enter password to manage the studio.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <form onSubmit={handleLogin} className="space-y-4 pt-4">
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-lg text-center bg-gray-100 dark:bg-gray-800"
              />
              <Button type="submit" className="w-full bg-brand-pink text-white rounded-lg hover:bg-brand-pink/90 transition-colors">
                Login
              </Button>
            </form>
          </CardContent>
        </Card>
      </WavyBackground>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <header className="flex items-center justify-between mb-8">
        <h1 className="font-serif text-4xl font-bold">Admin Dashboard</h1>
        <Button onClick={handleLogout} variant="ghost" className="flex items-center gap-2 text-gray-600 hover:text-brand-pink">
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </Button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="rounded-2xl shadow-soft overflow-hidden">
            <CardHeader>
              <CardTitle className="font-serif text-2xl flex items-center gap-2"><Briefcase /> Upcoming Bookings</CardTitle>
              <div className="flex items-center space-x-2 mb-4">
                <Button
                  variant={view === 'all' ? 'default' : 'outline'}
                  onClick={() => setView('all')}
                  className={view === 'all' ? 'bg-brand-pink text-white hover:bg-brand-pink/90' : 'text-gray-700 hover:bg-gray-100'}
                >
                  All Bookings
                </Button>
                <Button
                  variant={view === 'upcoming' ? 'default' : 'outline'}
                  onClick={() => setView('upcoming')}
                  className={view === 'upcoming' ? 'bg-brand-pink text-white hover:bg-brand-pink/90' : 'text-gray-700 hover:bg-gray-100'}
                >
                  Upcoming Bookings
                </Button>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="successful">Successful</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  placeholder="Search bookings..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 rounded-lg"
                />
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-4">
                  {filteredBookings.length > 0 ? filteredBookings.map(booking => (
                    <div key={booking.id} className="p-4 bg-gray-100 rounded-xl space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-lg">{booking.name}</p>
                          <div className="flex gap-2 mt-1 flex-wrap">
                            {booking.discountApplied && (
                              <Badge variant="secondary" className="bg-pink-100 text-pink-700 border-pink-200">30% Discount</Badge>
                            )}
                            {(booking.rescheduleCount ?? 0) > 0 && (
                              <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">
                                Rescheduled
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-semibold">{format(parseISO(booking.date), 'EEE, MMM d')}</p>
                          <p className="text-sm text-brand-pink font-medium">{booking.timeSlot}</p>
                          {booking.originalDate && booking.originalDate !== booking.date && (
                            <p className="text-xs text-gray-500">
                              Originally: {format(parseISO(booking.originalDate), 'MMM d')}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div>
                          <p className="font-semibold text-gray-700">Contact</p>
                          <p className="text-gray-600">{booking.phone}</p>
                          {booking.email && <p className="text-gray-600">{booking.email}</p>}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-700">Services</p>
                          <p className="text-gray-600">{Array.isArray(booking.services) ? getServiceNames(booking.services).join(', ') : ''}</p>
                        </div>
                        {booking.notes && (
                          <div className="md:col-span-2">
                            <p className="font-semibold text-gray-700">Notes</p>
                            <p className="text-gray-600 whitespace-pre-wrap">{booking.notes}</p>
                          </div>
                        )}
                        {booking.inspirationPhotos && booking.inspirationPhotos.length > 0 && (
                          <div className="md:col-span-2">
                            <p className="font-semibold text-gray-700">Inspiration Photos</p>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {booking.inspirationPhotos.map((photoUrl, index) => (
                                <a key={index} href={photoUrl} target="_blank" rel="noopener noreferrer">
                                  <img
                                    src={photoUrl}
                                    alt={`Inspiration ${index + 1}`}
                                    className="w-16 h-16 object-cover rounded-md border-2 border-gray-200 hover:border-brand-pink transition"
                                  />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="pt-2 border-t border-gray-200">
                        <p className="text-xs text-gray-500">Ticket ID: {booking.ticketId}</p>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 mt-4">
                        <Button
                          variant="outline"
                          className="flex-1 rounded-lg border border-gray-300 text-gray-700 hover:text-brand-pink hover:border-brand-pink transition-colors"
                          onClick={() => handleOpenBookingDetails(booking)}
                        >
                          <Edit className="mr-2 h-4 w-4" /> Edit Details
                        </Button>
                        {booking.status === 'pending' && (
                          <Button
                            className="flex-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                            onClick={() => handleMarkSuccessful(booking)}
                          >
                            Mark Successful
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          className="flex-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                          onClick={() => setIsDeletingBooking(booking)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete Booking
                        </Button>
                      </div>
                    </div>
                  )) : <p className="text-center text-gray-500 py-8">No upcoming bookings.</p>}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-soft">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <CardTitle className="font-serif text-2xl flex items-center gap-2"><Settings /> Manage Services & Categories</CardTitle>
              {manageServicesTab === 'services' ? (
                <Button onClick={() => handleOpenServiceModal(null)} className="bg-brand-pink text-white rounded-lg hover:bg-brand-pink/90 transition-colors flex items-center gap-2 self-end sm:self-center">
                  <PlusCircle className="w-5 h-5" />
                  Add Service
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    setEditingCategory(null);
                    setIsCategoryModalOpen(true);
                  }}
                  className="bg-brand-pink text-white rounded-lg hover:bg-brand-pink/90 transition-colors flex items-center gap-2 self-end sm:self-center"
                >
                  <PlusCircle className="w-5 h-5" />
                  Add Category
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <Tabs value={manageServicesTab} onValueChange={(v) => setManageServicesTab(v as 'services' | 'categories')} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="services">Services</TabsTrigger>
                  <TabsTrigger value="categories">Categories</TabsTrigger>
                </TabsList>

                <TabsContent value="services" className="mt-0">
                  {isMobile ? (
                    <div className="mb-4">
                      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Filter by category" />
                        </SelectTrigger>
                        <SelectContent>
                          {serviceCategories.map((cat) => (
                            <SelectItem key={cat} value={cat} className="capitalize">
                              {cat.replace('-', ' ')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mb-4 border-b overflow-x-auto pb-2">
                      {serviceCategories.map(cat => (
                        <button
                          key={cat}
                          onClick={() => setCategoryFilter(cat)}
                          className={`capitalize pb-2 text-sm font-medium transition-colors whitespace-nowrap ${categoryFilter === cat ? 'text-brand-pink border-b-2 border-brand-pink' : 'text-gray-500 hover:text-gray-800'}`}
                        >
                          {cat.replace('-', ' ')}
                        </button>
                      ))}
                    </div>
                  )}
                  <ScrollArea className="h-[400px]">
                    {isMobile ? (
                      <Accordion type="single" collapsible className="w-full">
                        {filteredServices.map(service => (
                          <AccordionItem value={service.id} key={service.id}>
                            <AccordionTrigger className="p-3 bg-gray-100 rounded-xl">
                              <span className="font-semibold text-left">{service.name}</span>
                            </AccordionTrigger>
                            <AccordionContent className="p-3 bg-gray-50 rounded-b-xl">
                              <p className="text-sm text-gray-600 mb-4">{service.description || 'No description.'}</p>
                              <div className="flex items-center justify-between">
                                <Label htmlFor={`switch-${service.id}`} className="flex items-center gap-2 text-sm font-medium">
                                  <Switch
                                    id={`switch-${service.id}`}
                                    checked={service.isAvailable}
                                    onCheckedChange={() => handleToggleServiceAvailability(service)}
                                  />
                                  Service Available
                                </Label>
                                <Button variant="outline" size="sm" onClick={() => handleOpenServiceModal(service)} className="flex items-center gap-2">
                                  <Edit className="w-4 h-4" />
                                  Edit
                                </Button>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    ) : (
                      <div className="space-y-3 pr-4">
                        {filteredServices.map(service => (
                          <div key={service.id} className="flex items-center justify-between p-3 bg-gray-100 rounded-xl gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold truncate">{service.name}</p>
                              {service.description && (
                                <p className="text-sm text-gray-500 truncate" title={service.description}>
                                  {service.description}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                              <Switch
                                checked={service.isAvailable}
                                onCheckedChange={() => handleToggleServiceAvailability(service)}
                              />
                              <Button variant="ghost" size="icon" onClick={() => handleOpenServiceModal(service)} className="text-gray-500 hover:text-blue-500 rounded-full">
                                <Edit className="w-5 h-5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="categories" className="mt-0">
                  {categories.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-sm text-gray-500 mb-4">
                        No categories yet. Add categories like "manicure", "pedicure", "refills", "nail art", or "soak off" to start organizing your services.
                      </p>
                      <Button
                        onClick={() => {
                          setEditingCategory(null);
                          setIsCategoryModalOpen(true);
                        }}
                        className="bg-brand-pink text-white rounded-lg hover:bg-brand-pink/90"
                      >
                        <PlusCircle className="w-4 h-4 mr-2" />
                        Create Your First Category
                      </Button>
                    </div>
                  ) : (
                    <ScrollArea className="h-[400px] pr-2">
                      <div className="space-y-3">
                        {categories.map((cat) => (
                          <div
                            key={cat.id}
                            className="flex items-start justify-between p-3 bg-gray-100 rounded-xl gap-2"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold truncate">{cat.name}</p>
                              {cat.description && (
                                <p
                                  className="text-xs text-gray-600 truncate mt-1"
                                  title={cat.description}
                                >
                                  {cat.description}
                                </p>
                              )}
                              {cat.imageUrl && (
                                <p className="text-xs text-gray-400 mt-1">Image: {cat.imageUrl}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-gray-500 hover:text-blue-500 rounded-full"
                                onClick={() => {
                                  setEditingCategory(cat);
                                  setIsCategoryModalOpen(true);
                                }}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-gray-500 hover:text-red-500 rounded-full"
                                onClick={() => setIsDeletingCategory(cat)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">

          <Card className="rounded-2xl shadow-soft">
            <CardHeader>
              <CardTitle className="font-serif text-2xl flex items-center gap-2"><CalendarIcon /> Availability</CardTitle>
              <CardDescription>Click a date to manage time slots.</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={date => date && handleDateClick(date)}
                disabled={{ before: new Date() }}
                className="rounded-lg"
              />
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-soft">
            <CardHeader>
              <CardTitle className="font-serif text-2xl flex items-center gap-2"><Mail /> Newsletter</CardTitle>
            </CardHeader>
            <CardContent>
              <NewsletterForm />
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-soft">
            <CardHeader>
              <CardTitle className="font-serif text-2xl flex items-center gap-2"><UploadCloud /> Price List</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 border rounded-lg">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      setPriceListFile(e.target.files[0]);
                    }
                  }}
                  disabled={isSavingPriceList}
                />
                {priceListFile && (
                  <div className="mt-4 flex flex-col items-center">
                    <img
                      src={URL.createObjectURL(priceListFile)}
                      alt="Selected price list preview"
                      className="w-40 h-40 object-contain rounded border border-gray-200 shadow-sm"
                    />
                    <button
                      type="button"
                      className="mt-2 text-xs text-red-500 hover:underline"
                      onClick={() => {
                        setPriceListFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      disabled={isSavingPriceList}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
              <Button onClick={handleSavePriceList} disabled={!priceListFile || isSavingPriceList} className="w-full bg-black text-white rounded-lg hover:bg-black/80 transition-colors flex items-center justify-center gap-2">
                {isSavingPriceList && (
                  <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                  </svg>
                )}
                {isSavingPriceList ? 'Uploading...' : 'Upload New Price List'}
              </Button>
              {priceListUrl && <a href={priceListUrl} target="_blank" rel="noopener noreferrer" className="block text-center text-sm text-brand-pink hover:underline">View Current Price List</a>}
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-soft">
            <CardHeader>
              <CardTitle className="font-serif text-xl">Next 7 Days Capacity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-600">{weeklyCapacity.count} Bookings</span>
                <span className="text-sm font-medium text-gray-600">{Math.round(weeklyCapacity.percentage)}% full</span>
              </div>
              <Progress value={weeklyCapacity.percentage} className="w-full" />
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent key={selectedDate?.toISOString() || 'default'} className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Manage Availability for {selectedDate && format(selectedDate, 'PPP')}</DialogTitle>
            <DialogDescription>Select the time slots that are unavailable on this day. Booked slots are disabled.</DialogDescription>
          </DialogHeader>

          {bookingsForSelectedDate.length > 0 && (
            <div className="py-2">
              <h4 className="font-semibold mb-2 text-sm text-gray-700">Bookings for this date:</h4>
              <ScrollArea className="h-[100px] rounded-md border p-2 bg-gray-50">
                <div className="space-y-2">
                  {bookingsForSelectedDate.map(booking => (
                    <div key={booking.id} className="text-sm">
                      <strong>{booking.timeSlot}:</strong> {booking.name} ({Array.isArray(booking.services) ? getServiceNames(booking.services).join(', ') : ''})
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          <div className="space-y-3">
            <Label className="text-base font-medium text-gray-900">Unavailable Time Slots</Label>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 max-h-60 overflow-y-auto pr-2">
              {(selectedDate ? getSlotsForDate(selectedDate) : allTimeSlots).map((slot) => {
                const isBooked = bookedTimeSlots.includes(slot);
                const isManagedUnavailable = managedSlots.includes(slot);
                return (
                  <div key={slot} className="flex items-center space-x-2">
                    <Checkbox
                      id={`slot-${slot}`}
                      checked={isManagedUnavailable}
                      onCheckedChange={(checked) => {
                        setManagedSlots(prev =>
                          checked ? [...prev, slot] : prev.filter(s => s !== slot)
                        );
                      }}
                      disabled={isBooked} // Disable if already booked
                    />
                    <Label htmlFor={`slot-${slot}`} className="text-sm text-gray-700">
                      {slot}
                    </Label>
                  </div>
                );
              })}
            </div>
            <Button onClick={handleSaveAvailability} className="w-full bg-brand-pink text-white rounded-lg hover:bg-brand-pink/90 transition-colors">
              Save Availability
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isServiceModalOpen} onOpenChange={setIsServiceModalOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">{editingService?.id ? 'Edit Service' : 'Add New Service'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input placeholder="Service Name" value={editingService?.name || ''} onChange={(e) => setEditingService(s => s ? { ...s, name: e.target.value } : null)} />
            <Textarea placeholder="Description" value={editingService?.description || ''} onChange={(e) => setEditingService(s => s ? { ...s, description: e.target.value } : null)} />
            <Input
              type="number"
              placeholder="Duration (minutes)"
              value={editingService?.duration || ''}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                setEditingService(s => s ? { ...s, duration: isNaN(value) ? 0 : value } : null)
              }}
            />
            <div className="space-y-2">
              <Label className="text-sm font-medium">Category</Label>
              {categories.length === 0 ? (
                <p className="text-xs text-gray-500">
                  No categories yet. Switch to the "Categories" tab above to create your first category, then assign it to services here.
                </p>
              ) : (
                <Select
                  value={editingService?.category || ""}
                  onValueChange={(value) =>
                    setEditingService((s) =>
                      s ? { ...s, category: value } : null
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.name}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-xs text-gray-500">
                Categories are managed centrally and used across the booking form and services page.
              </p>
            </div>
          </div>
          <DialogFooter className="sm:justify-between">
            {editingService?.id && (
              <Button
                variant="destructive"
                onClick={() => {
                  setIsDeletingService(editingService)
                  setIsServiceModalOpen(false)
                }}
                className="bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Delete Service
              </Button>
            )}
            <Button onClick={handleSaveService} className="bg-brand-pink text-white rounded-lg hover:bg-brand-pink/90">Save Service</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCategoryModalOpen} onOpenChange={(open) => {
        setIsCategoryModalOpen(open);
        if (!open) {
          // Only reset editingCategory when closing, not when opening
          setEditingCategory(null);
        }
      }}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">
              {editingCategory?.id ? "Edit Category" : "Add New Category"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="Category Name (e.g. manicure)"
              value={editingCategory?.name || ""}
              onChange={(e) =>
                setEditingCategory((c) =>
                  c ? { ...c, name: e.target.value } : { id: "", slug: "", name: e.target.value, description: "", imageUrl: "" }
                )
              }
            />
            <Textarea
              placeholder="Optional description shown on the services page"
              value={editingCategory?.description || ""}
              onChange={(e) =>
                setEditingCategory((c) =>
                  c ? { ...c, description: e.target.value } : null
                )
              }
            />
            <Input
              placeholder="Image URL (e.g. /images/nails-1.jpeg)"
              value={editingCategory?.imageUrl || ""}
              onChange={(e) =>
                setEditingCategory((c) =>
                  c ? { ...c, imageUrl: e.target.value } : { id: "", slug: "", name: "", description: "", imageUrl: e.target.value }
                )
              }
            />
          </div>
          <DialogFooter className="sm:justify-between">
            {editingCategory?.id && (
              <Button
                variant="destructive"
                onClick={() => {
                  setIsCategoryModalOpen(false);
                  setIsDeletingCategory(editingCategory);
                }}
                className="bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Delete Category
              </Button>
            )}
            <Button
              onClick={handleSaveCategory}
              className="bg-brand-pink text-white rounded-lg hover:bg-brand-pink/90"
            >
              Save Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!isDeletingService} onOpenChange={() => setIsDeletingService(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Are you sure?</DialogTitle>
            <DialogDescription>This action cannot be undone. This will permanently delete the "{isDeletingService?.name}" service.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDeletingService(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteService} className="bg-red-500 text-white rounded-lg hover:bg-red-600">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!isDeletingBooking} onOpenChange={() => setIsDeletingBooking(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Are you sure?</DialogTitle>
            <DialogDescription>This action cannot be undone. This will permanently delete the booking for {isDeletingBooking?.name} on {isDeletingBooking?.date} at {isDeletingBooking?.timeSlot}.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDeletingBooking(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteBooking} className="bg-red-500 text-white rounded-lg hover:bg-red-600">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!isDeletingCategory} onOpenChange={() => setIsDeletingCategory(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Are you sure?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the "{isDeletingCategory?.name}" category.
              You must remove or reassign any services using this category first.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDeletingCategory(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleDeleteCategory}
              className="bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!isEditingBooking} onOpenChange={(open) => {
        if (!open) {
          setIsEditingBooking(null);
          setEditingBookingData(null);
        }
      }}>
        <DialogContent className="rounded-2xl max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Edit Booking Details</DialogTitle>
            <DialogDescription>
              Edit the booking information for {isEditingBooking?.name}
            </DialogDescription>
          </DialogHeader>

          {editingBookingData && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Name *</Label>
                  <Input
                    id="edit-name"
                    value={editingBookingData.name}
                    onChange={(e) => setEditingBookingData(prev => prev ? { ...prev, name: e.target.value } : null)}
                    placeholder="Customer name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-phone">Phone *</Label>
                  <Input
                    id="edit-phone"
                    inputMode="tel"
                    autoComplete="tel"
                    value={editingBookingData.phone}
                    onChange={(e) => setEditingBookingData(prev => prev ? { ...prev, phone: sanitizePhoneInput(e.target.value) } : null)}
                    placeholder="Phone number"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editingBookingData.email || ''}
                  onChange={(e) => setEditingBookingData(prev => prev ? { ...prev, email: e.target.value } : null)}
                  placeholder="Email address (optional)"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date *</Label>
                  <Calendar
                    mode="single"
                    selected={editingBookingData.date ? parseISO(editingBookingData.date) : undefined}
                    onSelect={(date) => {
                      if (date) {
                        setEditingBookingData(prev => prev ? { ...prev, date: format(date, 'yyyy-MM-dd') } : null);
                      }
                    }}
                    disabled={{ before: new Date() }}
                    className="rounded-lg border"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-timeSlot">Time Slot *</Label>
                  <Select
                    value={editingBookingData.timeSlot}
                    onValueChange={(value) => setEditingBookingData(prev => prev ? { ...prev, timeSlot: value } : null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select time slot" />
                    </SelectTrigger>
                    <SelectContent>
                      {(editingBookingData.date ? getSlotsForDate(new Date(editingBookingData.date)) : allTimeSlots).map((slot) => (
                        <SelectItem key={slot} value={slot}>
                          {slot}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Services *</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-lg p-3">
                  {services.map((service) => (
                    <div key={service.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`service-${service.id}`}
                        checked={editingBookingData.services?.includes(service.id) || false}
                        onCheckedChange={(checked) => {
                          setEditingBookingData(prev => {
                            if (!prev) return null;
                            const currentServices = prev.services || [];
                            if (checked) {
                              return { ...prev, services: [...currentServices, service.id] };
                            } else {
                              return { ...prev, services: currentServices.filter(id => id !== service.id) };
                            }
                          });
                        }}
                      />
                      <Label htmlFor={`service-${service.id}`} className="text-sm">
                        {service.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-notes">Notes</Label>
                <Textarea
                  id="edit-notes"
                  value={editingBookingData.notes || ''}
                  onChange={(e) => setEditingBookingData(prev => prev ? { ...prev, notes: e.target.value } : null)}
                  placeholder="Additional notes (optional)"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-inspiration-photos">Inspiration Photos</Label>
                <Textarea
                  id="edit-inspiration-photos"
                  value={editingBookingData.inspirationPhotos?.join('\n') || ''}
                  onChange={(e) => setEditingBookingData(prev => prev ? {
                    ...prev,
                    inspirationPhotos: e.target.value.split('\n').filter(url => url.trim())
                  } : null)}
                  placeholder="One URL per line (optional)"
                  rows={3}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit-discount"
                  checked={editingBookingData.discountApplied || false}
                  onCheckedChange={(checked) => setEditingBookingData(prev => prev ? { ...prev, discountApplied: !!checked } : null)}
                />
                <Label htmlFor="edit-discount">30% Discount Applied</Label>
              </div>
            </div>
          )}

          <DialogFooter className="sm:justify-between">
            <Button
              variant="ghost"
              onClick={() => {
                setIsEditingBooking(null);
                setEditingBookingData(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleSaveBooking()}
              className="bg-brand-pink text-white rounded-lg hover:bg-brand-pink/90"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}