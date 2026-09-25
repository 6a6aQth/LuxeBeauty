"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StudioPolicies } from "@/components/studio-policies";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { FileUpload } from "@/components/ui/file-upload";
import { BookingFormProps, Service } from "@/types/types";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { StudioPoliciesContent } from "@/components/studio-policies";
import useSWR from 'swr';
import { toast } from '@/hooks/use-toast';

export function BookingForm({
  formData,
  setFormData,
  date,
  handleDateSelect,
  fullyBookedDates,
  step,
  isSubmitting,
  handleSubmit,
  handleSelectChange,
  availableSlotsForSelectedDate,
  unavailableSlots,
  formatTime,
  isPaying,
  agreedToTerms,
  setAgreedToTerms,
  handlePayment,
  setStep,
  loyaltyDiscountEligible,
  isReschedule,
}: BookingFormProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showPoliciesDialog, setShowPoliciesDialog] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [fileUploading, setFileUploading] = useState(false);
  const [clearedTimeSlot, setClearedTimeSlot] = useState(false);

  // SWR fetcher
  const fetcher = (url: string) => fetch(url).then(res => res.json());
  const { data: services = [], isLoading: servicesLoading } = useSWR<Service[]>('/api/services', fetcher, { refreshInterval: 1000 });
  const { data: categoriesFromApi = [] } = useSWR<any[]>('/api/categories', fetcher, { refreshInterval: 0 });

  // Prevent running on first render for services
  const isFirstServices = useRef(true);
  const prevServices = useRef(formData.services);
  useEffect(() => {
    if (isFirstServices.current) {
      isFirstServices.current = false;
      prevServices.current = formData.services;
      return;
    }
    if (!Array.isArray(services) || services.length === 0) return;
    setFormData((prev: any) => {
      const stillAvailable = prev.services.filter((id: string) =>
        services.some((s) => s.id === id && s.isAvailable)
      );
      // Only show toast if the change was not user-initiated
      if (
        stillAvailable.length !== prev.services.length &&
        prevServices.current.length === prev.services.length
      ) {
        toast({
          title: 'Service(s) Unavailable',
          description: 'Some of the services you selected are no longer available. Please review your selection.',
          variant: 'destructive',
        });
      }
      prevServices.current = stillAvailable;
      return { ...prev, services: stillAvailable };
    });
  }, [services]);

  // Robust unavailableSlots effect for timeSlot
  const isFirstSlots = useRef(true);
  const prevTimeSlot = useRef(formData.timeSlot);
  useEffect(() => {
    if (isFirstSlots.current) {
      isFirstSlots.current = false;
      prevTimeSlot.current = formData.timeSlot;
      return;
    }
    setFormData((prev: any) => {
      if (
        prev.timeSlot &&
        unavailableSlots.includes(prev.timeSlot)
      ) {
        setClearedTimeSlot(true); // trigger toast in another effect
        prevTimeSlot.current = '';
        return { ...prev, timeSlot: '' };
      }
      prevTimeSlot.current = prev.timeSlot;
      return prev;
    });
  }, [unavailableSlots, formData.timeSlot]);

  useEffect(() => {
    if (clearedTimeSlot) {
      toast({
        title: 'Time Slot Unavailable',
        description: 'The time slot you selected is no longer available. Please choose another time.',
        variant: 'destructive',
      });
      setClearedTimeSlot(false);
    }
  }, [clearedTimeSlot]);

  // Use centrally managed categories, falling back to categories inferred from services
  const categories = React.useMemo(() => {
    if (categoriesFromApi && Array.isArray(categoriesFromApi) && categoriesFromApi.length > 0) {
      return categoriesFromApi.map((c: any) => c.name as string);
    }
    if (!Array.isArray(services) || services.length === 0) return [];
    const cats = services.map((s: any) => s.category);
    return Array.from(new Set(cats));
  }, [categoriesFromApi, services]);

  const filteredServices = React.useMemo(() => {
    if (!selectedCategory || !Array.isArray(services)) return [];
    return services.filter((s: any) => s.category === selectedCategory);
  }, [services, selectedCategory]);

  const handleChange = (e: any) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleRemoveImage = (idx: number) => {
    setFormData((prev: any) => ({
      ...prev,
      inspirationPhotos: prev.inspirationPhotos.filter((_: any, i: number) => i !== idx),
    }));
  };

  const handleFileChange = async (files: File[]) => {
    if (files.length > 0) {
      setFileUploading(true);
      try {
        const remainingSlots = 5 - (formData.inspirationPhotos?.length || 0);
        const filesToUpload = files.slice(0, remainingSlots);
        const uploadedUrls: string[] = [];
        for (const file of filesToUpload) {
          const response = await fetch(
            `/api/bookings/upload?filename=${file.name}`,
            {
              method: "POST",
              body: file,
            }
          );
          const newBlob = await response.json();
          console.log('Upload response:', newBlob);
          if (newBlob.url) {
            uploadedUrls.push(newBlob.url);
          }
        }
        setFormData((prev: any) => ({
          ...prev,
          inspirationPhotos: [...(prev.inspirationPhotos || []), ...uploadedUrls],
        }));
      } catch (error) {
        console.error("Failed to upload file", error);
      } finally {
        setFileUploading(false);
      }
    }
  };

  return (
    <>
      <div id="wrapper"></div>
      <Card className="max-w-4xl mx-auto border-none overflow-hidden shadow-soft">
        <div className="grid md:grid-cols-2">
          <div className="relative bg-gray-100 p-8">
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: "url('/IMG_9067.png')" }}
            >
              <div className="absolute inset-0 bg-black opacity-40"></div>
            </div>
            <div className="relative z-10 text-white">
              <h3 className="text-3xl font-serif mb-6">Business Hours</h3>
              <div className="space-y-3 text-lg font-light">
                <div className="flex justify-between border-b border-gray-400 py-2">
                  <span>Mon - Thu</span>
                  <span>10:00 - 16:30</span>
                </div>
                <div className="flex justify-between border-b border-gray-400 py-2">
                  <span>Friday</span>
                  <span>10:00 - 15:00</span>
                </div>
                <div className="flex justify-between border-b border-gray-400 py-2">
                  <span>Saturday</span>
                  <span>10:00 - 15:00</span>
                </div>
                <div className="flex justify-between border-b border-gray-400 py-2">
                  <span>Sunday</span>
                  <span>Closed</span>
                </div>
              </div>
              <div className="mt-8">
                <h4 className="text-2xl font-serif mb-4">Loyalty Program</h4>
                <p className="text-gray-200">
                  Your{" "}
                  <span className="font-semibold text-white">
                    6th booking comes with a 30% discount
                  </span>{" "}
                  as a thank you for your continued trust in us.
                </p>
              </div>
            </div>
          </div>

          <div className="p-8 bg-white">
            <CardHeader className="p-0 mb-6 text-center">
              <CardTitle className="text-2xl font-bold text-gray-900">
                {step === "form" ? "Book Your Slot" : "Confirm & Pay"}
              </CardTitle>
              <CardDescription className="text-sm text-gray-500">
                {step === "form"
                  ? "A K10,000 non-refundable deposit is required."
                  : "Review your details and pay the booking fee."}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {step === "form" ? (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Input
                      id="name"
                      name="name"
                      placeholder="Full Name"
                      required
                      value={formData.name}
                      onChange={handleChange}
                      className="bg-gray-50 border-gray-300 text-gray-900 rounded-md focus:ring-brand-pink focus:border-brand-pink"
                    />
                    <Input
                      id="phone"
                      name="phone"
                      placeholder="Phone Number"
                      required
                      value={formData.phone}
                      onChange={handleChange}
                      className="bg-gray-50 border-gray-300 text-gray-900 rounded-md focus:ring-brand-pink focus:border-brand-pink"
                    />
                  </div>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="Email Address"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="bg-gray-50 border-gray-300 text-gray-900 rounded-md focus:ring-brand-pink focus:border-brand-pink"
                  />

                  <div className="space-y-4 pt-4 border-t border-gray-200">
                    <Label className="text-base font-medium text-gray-900">
                      Select Service Category
                    </Label>
                    <Select
                      onValueChange={setSelectedCategory}
                      value={selectedCategory || ""}
                      disabled={servicesLoading}
                    >
                      <SelectTrigger className="bg-gray-50 border-gray-300 text-gray-900 rounded-md focus:ring-brand-pink">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent className="bg-white text-gray-900 border-gray-200">
                        {servicesLoading ? (
                          <SelectItem value="__loading" disabled>
                            Loading categories…
                          </SelectItem>
                        ) : categories.length === 0 ? (
                          <SelectItem value="__empty" disabled>
                            No categories found.
                          </SelectItem>
                        ) : (
                          categories.map((category) => (
                            <SelectItem
                              key={category}
                              value={category}
                              className="focus:bg-brand-pink/10"
                            >
                              {category
                                .replace(/-/g, " ")
                                .replace(/\b\w/g, (l) => l.toUpperCase())}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedCategory && (
                    <div className="space-y-4">
                      <Label className="text-base font-medium text-gray-900">
                        Select Services
                      </Label>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                        {filteredServices.map((service) => (
                          <div
                            key={service.id}
                            className="flex items-center space-x-3"
                          >
                            <Checkbox
                              id={`service-${service.id}`}
                              name="services"
                              value={service.id}
                              checked={formData.services.includes(service.id)}
                              disabled={!service.isAvailable}
                              onCheckedChange={() => {
                                const newServices = formData.services.includes(
                                  service.id
                                )
                                  ? formData.services.filter(
                                    (s: any) => s !== service.id
                                  )
                                  : [...formData.services, service.id];
                                setFormData((prev: any) => ({
                                  ...prev,
                                  services: newServices,
                                }));
                              }}
                            />
                            <Label
                              htmlFor={`service-${service.id}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              {service.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {formData.services.length > 0 && (
                    <div className="space-y-4">
                      <Label className="text-base font-medium text-gray-900">
                        Selected Services
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {formData.services.map((serviceId: string) => {
                          const service = services.find(s => s.id === serviceId);
                          if (!service) return null;
                          return (
                            <Badge
                              key={service.id}
                              variant="default"
                              className="bg-brand-pink/10 text-brand-pink border-brand-pink/20 flex items-center gap-2 rounded-full px-3 py-1 text-sm font-normal"
                            >
                              <span>{service.name}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const newServices = formData.services.filter(
                                    (s: any) => s !== serviceId
                                  );
                                  setFormData((prev: any) => ({
                                    ...prev,
                                    services: newServices,
                                  }));
                                }}
                                className="rounded-full hover:bg-black/10 p-0.5"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="space-y-4 pt-4 border-t border-gray-200">
                    <Label className="text-base font-medium text-gray-900 col-span-full">
                      Select Date & Time
                    </Label>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full justify-start text-left font-normal bg-gray-50 border-gray-300",
                              !date && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {date ? (
                              format(date, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={date}
                            onSelect={(selectedDate) => {
                              handleDateSelect(selectedDate);
                              setCalendarOpen(false);
                            }}
                            initialFocus
                            disabled={(d) => {
                              const today = new Date();
                              today.setHours(0, 0, 0, 0);
                              const tomorrow = new Date(today);
                              tomorrow.setDate(today.getDate() + 1);
                              return d < tomorrow || fullyBookedDates.some(
                                (bookedDate) =>
                                  new Date(d).toDateString() ===
                                  new Date(bookedDate).toDateString()
                              );
                            }}
                          />
                        </PopoverContent>
                      </Popover>

                      <Select
                        value={formData.timeSlot}
                        onValueChange={(value) =>
                          handleSelectChange("timeSlot", value)
                        }
                        disabled={!date}
                      >
                        <SelectTrigger className="bg-gray-50 border-gray-300 text-gray-900 rounded-md focus:ring-brand-pink">
                          <SelectValue placeholder="Select a time" />
                        </SelectTrigger>
                        <SelectContent className="bg-white text-gray-900 border-gray-200">
                          {date && availableSlotsForSelectedDate.length > 0 ? (
                            availableSlotsForSelectedDate.map((slot: any) => (
                              <SelectItem
                                key={slot}
                                value={slot}
                                className="focus:bg-brand-pink/10"
                              >
                                {formatTime(slot)}
                              </SelectItem>
                            ))
                          ) : (
                            <div className="p-2 text-sm text-gray-500">
                              {date
                                ? "No slots available."
                                : "Select a date first."}
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Textarea
                    id="notes"
                    name="notes"
                    placeholder="Additional Notes (Optional)"
                    value={formData.notes}
                    onChange={handleChange}
                    className="bg-gray-50 border-gray-300 text-gray-900 rounded-md focus:ring-brand-pink focus:border-brand-pink"
                  />

                  <div className="space-y-4">
                    <Label className="text-base font-medium text-gray-900">
                      Inspiration Photo (Optional)
                    </Label>
                    {fileUploading && (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <svg className="animate-spin h-4 w-4 mr-2 text-brand-pink" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path></svg>
                        Uploading…
                      </div>
                    )}
                    <FileUpload
                      onChange={handleFileChange}
                      uploadedFiles={formData.inspirationPhotos}
                      onRemove={handleRemoveImage}
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-brand-pink text-white hover:bg-brand-pink/90 transition-colors"
                    disabled={
                      isSubmitting ||
                      !formData.date ||
                      formData.services.length === 0 ||
                      !formData.timeSlot
                    }
                  >
                    {isSubmitting ? "Submitting..." : "Proceed"}
                  </Button>
                </form>
              ) : (
                <div className="space-y-6">
                  {loyaltyDiscountEligible && (
                    <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-green-800 text-center font-semibold text-base mb-2">
                      🎉 Congratulations! You qualify for a <span className="font-bold">30% loyalty discount</span> on this booking.
                    </div>
                  )}
                  <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <div className="flex justify-between">
                      <span className="font-medium">Full Name:</span>
                      <span className="text-gray-900 font-semibold">{formData.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Phone:</span>
                      <span className="text-gray-900 font-semibold">{formData.phone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Date:</span>
                      <span className="text-gray-900 font-semibold">{formData.date ? format(new Date(formData.date), "PPP") : ""}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Time Slot:</span>
                      <span className="text-gray-900 font-semibold">{formatTime(formData.timeSlot)}</span>
                    </div>
                    {formData.services && formData.services.length > 0 && (
                      <div>
                        <span className="font-medium">Selected Services:</span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {formData.services.map((serviceId: string) => {
                            const service = services.find(s => s.id === serviceId);
                            if (!service) return null;
                            return (
                              <span key={service.id} className="inline-block bg-brand-pink/10 text-brand-pink border border-brand-pink/20 rounded-full px-3 py-1 text-sm font-medium">
                                {service.name}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {formData.inspirationPhotos && formData.inspirationPhotos.length > 0 && (
                      <div>
                        <span className="font-medium">Inspiration Photo(s):</span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {formData.inspirationPhotos.map((url: string, idx: number) => (
                            <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                              <img src={url} alt={`Inspiration ${idx + 1}`} className="w-16 h-16 object-cover rounded border border-gray-200 shadow-sm hover:scale-105 transition-transform" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    {formData.notes && formData.notes.trim() !== "" && (
                      <div>
                        <span className="font-medium">Notes:</span>
                        <p className="text-gray-700 mt-1">{formData.notes}</p>
                      </div>
                    )}
                  </div>

                  <div className="items-top flex space-x-2">
                    <Checkbox
                      id="terms"
                      checked={agreedToTerms}
                      onCheckedChange={(checked) =>
                        setAgreedToTerms(checked as boolean)
                      }
                    />
                    <div className="grid gap-1.5 leading-none">
                      <label
                        htmlFor="terms"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        I agree to the{' '}
                        <button
                          type="button"
                          className="text-brand-pink underline hover:text-brand-pink/80 focus:outline-none"
                          onClick={() => setShowPoliciesDialog(true)}
                        >
                          Studio Policies
                        </button>
                      </label>
                    </div>
                  </div>

                  <Dialog open={showPoliciesDialog} onOpenChange={setShowPoliciesDialog}>
                    <DialogContent className="max-w-lg">
                      <DialogTitle className="text-2xl font-serif mb-1">Studio Policies</DialogTitle>
                      <DialogDescription className="text-gray-600 mb-4 text-sm">Please read our policies carefully before confirming your appointment.</DialogDescription>
                      <StudioPoliciesContent />
                    </DialogContent>
                  </Dialog>

                  <div className="grid grid-cols-2 gap-4">
                    <Button
                      onClick={() => setStep("form")}
                      variant="outline"
                      className="w-full"
                    >
                      Go Back & Edit
                    </Button>
                    <Button
                      onClick={isReschedule ? handleSubmit : handlePayment}
                      disabled={isPaying || !agreedToTerms}
                      className="w-full bg-green-500 text-white hover:bg-green-600"
                    >
                      {isPaying ? "Processing..." : isReschedule ? "Reschedule Appointment" : "Pay"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </div>
        </div>
      </Card>
    </>
  );
} 