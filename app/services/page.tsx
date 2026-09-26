'use client'
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { AnimatedSection } from "@/components/ui/animated-section"
import { PageHeader } from "@/components/page-header"
import { ServicesList } from "@/components/services-list"
import useSWR from 'swr';
import type { Service } from '@prisma/client';
import React from 'react';
import { LuxuryMark } from "@/components/luxury-mark";

export default function ServicesPage() {
  const fetcher = (url: string) => fetch(url).then(res => res.json());
  const { data: services = [], isLoading } = useSWR<Service[]>('/api/services', fetcher, { refreshInterval: 2000 });
  const { data: categories = [] } = useSWR<any[]>('/api/categories', fetcher, { refreshInterval: 0 });

  // Group services by category
  const groupedServices = React.useMemo(() => {
    const byCategory: Record<string, Service[]> = {};

    (services as Service[]).forEach((service: Service) => {
      const key = service.category;
      if (!key) return;
      if (!byCategory[key]) {
        byCategory[key] = [];
      }
      byCategory[key].push(service);
    });

    // Optionally order categories according to central Category list
    if (Array.isArray(categories) && categories.length > 0) {
      const ordered: Record<string, Service[]> = {};
      categories.forEach((cat: any) => {
        if (byCategory[cat.name]) {
          ordered[cat.name] = byCategory[cat.name];
        }
      });
      // Include any legacy categories not present in Category table
      Object.keys(byCategory).forEach((key) => {
        if (!ordered[key]) {
          ordered[key] = byCategory[key];
        }
      });
      return ordered;
    }

    return byCategory;
  }, [services, categories]);

  return (
    <div>
      <PageHeader
        title="Our Services"
        description="Discover our nails, lamination, and eyelash services, each delivered with meticulous attention to detail and using only the finest products."
      />

      <section className="bg-gray-100 py-20">
        <div className="container mx-auto px-4">
          {isLoading && services.length === 0 ? (
            <LuxuryMark />
          ) : (
            <ServicesList groupedServices={groupedServices} />
          )}
        </div>
      </section>

      <AnimatedSection className="py-20 bg-white" delay={0.2}>
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-serif mb-8 text-center">Additional Information</h2>
          <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-xl font-serif mb-3">Products We Use</h3>
              <p className="text-gray-500 mb-4">Only the finest quality for our clients</p>
              <ul className="space-y-2 text-gray-700 list-disc list-inside">
                <li>Premium gel polish brands</li>
                <li>High-quality acrylic products</li>
                <li>Luxury hand and foot creams</li>
                <li>Professional-grade tools and equipment</li>
                <li>Sanitized and sterilized implements for each client</li>
              </ul>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-xl font-serif mb-3">Service Policies</h3>
              <p className="text-gray-500 mb-4">What to expect during your visit</p>
              <ul className="space-y-2 text-gray-700 list-disc list-inside">
                <li>Please arrive 5-10 minutes before your appointment</li>
                <li>Cancellations require 24-hour notice</li>
                <li>Late arrivals may result in shortened service time</li>
                <li>Complimentary beverages offered during your service</li>
                <li>Payment methods: Cash, mobile money, and bank transfers</li>
              </ul>
            </div>
          </div>
        </div>
      </AnimatedSection>

      <section className="py-20 bg-black text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-serif mb-6">Ready to Book Your Service?</h2>
          <p className="text-gray-300 mb-8 max-w-2xl mx-auto">
            Schedule your appointment today and experience the luxury of Lauryn Luxe Beauty Studio.
          </p>
          <Link href="/booking">
            <Button className="bg-white text-black hover:bg-gray-200 rounded-none px-8 py-6 text-base">
              Book Your Appointment
            </Button>
          </Link>
        </div>
      </section>
    </div>
  )
}
