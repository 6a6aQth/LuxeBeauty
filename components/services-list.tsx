'use client'

import React, { useState } from "react"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Service } from "@prisma/client"

interface ServicesListProps {
    groupedServices: Record<string, Service[]>;
}

export function ServicesList({ groupedServices }: ServicesListProps) {
    const categories = Object.keys(groupedServices)
    const [activeTab, setActiveTab] = useState(categories.length > 0 ? categories[0] : '')

    if (!categories.length) {
        return <div>No services available at the moment.</div>;
    }

    const serviceImages: Record<string, string> = {
        manicure: "/images/nails-1.jpeg",
        pedicure: "/images/nails-8.jpeg",
        refills: "/images/nails-4.jpeg",
        'nail-art': "/images/nails-5.jpeg",
        'soak-off': "/images/nails-7.jpeg",
        nails: "/images/nails-2.jpeg",
        lamination: "/images/lamination-2.jpeg",
        'brow-lamination': "/images/lamination-1.jpeg",
        eyelashes: "/images/eyelashes-2.jpeg",
        lashes: "/images/eyelashes-1.jpeg",
    }

    const categoryDescriptions: Record<string, string> = {
        manicure: "Our manicure services are designed to enhance the natural beauty of your hands while ensuring nail health and longevity.",
        pedicure: "Pamper your feet with our luxurious pedicure treatments that combine relaxation with expert nail care.",
        refills: "Maintain your beautiful nails with our professional refill services, extending the life of your manicure.",
        'nail-art': "Express your personality with our creative nail art options, from subtle elegance to bold statements.",
        'soak-off': "Our gentle soak-off services ensure safe removal of previous applications without damaging your natural nails.",
        nails: "From classic manicures to detailed nail art, each set is finished with care and precision.",
        lamination: "Brow lamination lifts and sets the brows for a groomed shape that stays in place.",
        'brow-lamination': "Brow lamination lifts and sets the brows for a groomed shape that stays in place.",
        eyelashes: "Lash treatments add length and fullness while keeping the look soft and natural.",
        lashes: "Lash treatments add length and fullness while keeping the look soft and natural.",
    };
    
    return (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="hidden md:grid w-full grid-cols-2 md:grid-cols-5 bg-white/80 border backdrop-blur-sm">
              {categories.map((category) => (
                <TabsTrigger
                  key={category}
                  value={category}
                  className="capitalize data-[state=active]:bg-black data-[state=active]:text-white data-[state=active]:shadow-lg rounded-md transition-all duration-300"
                >
                  {category.replace("-", " ")}
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="md:hidden">
              <Select value={activeTab} onValueChange={setActiveTab}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category} className="capitalize">
                      {category.replace('-', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="mt-12">
              {categories.map((category) => (
                <TabsContent key={category} value={category}>
                  <div className="grid md:grid-cols-2 gap-12 items-start">
                    <div className="sticky top-24">
                      <div className="aspect-square relative overflow-hidden rounded-lg shadow-lg mb-6">
                        <Image
                          src={serviceImages[category] || '/images/nails-3.jpeg'}
                          alt={`${category.replace(/-/g, " ")} services`}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, 50vw"
                        />
                      </div>
                      <p className="text-gray-600 text-sm italic">
                        {categoryDescriptions[category] || "Explore our curated selection of services in this category, crafted to give you a luxurious, long-lasting finish."}
                      </p>
                    </div>

                    <div>
                      <h2 className="text-3xl font-serif mb-6 capitalize">{category.replace(/-/g, " ")}</h2>
                      <div className="space-y-4">
                        {groupedServices[category].map((service: Service) => (
                          <Card key={service.id} className="border-none shadow-md bg-white/90">
                            <CardContent className="p-4">
                              <h3 className="font-medium text-lg mb-2">{service.name}</h3>
                              <p className="text-gray-600 text-sm">
                                {service.description}
                              </p>
                              <p className="text-sm text-gray-500 mt-2">
                                Duration: {service.duration} minutes
                              </p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  </div>
                </TabsContent>
              ))}
            </div>
          </Tabs>
    )
} 