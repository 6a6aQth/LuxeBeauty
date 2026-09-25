import { Card, CardContent } from "@/components/ui/card"
import { Instagram, Phone, Mail, MapPin, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TiktokIcon } from "@/components/tiktok-icon"
import { AnimatedSection } from "@/components/ui/animated-section"
import { PageHeader } from "@/components/page-header"
import Image from "next/image"

export default function Contact() {
  const address = "Lauryn Luxe Beauty Studio, Blantyre, Malawi"
  const googleMapsUrl = "https://maps.app.goo.gl/3X5D11gfKSbZ3iSNA?g_st=com.google.maps.preview.copy"

  return (
    <div>
      <PageHeader
        title="Contact Us"
        description="Get in touch with Lauryn Luxe Beauty Studio. We're here to answer your questions and help you book your appointment."
      />

      {/* Contact Information */}
      <AnimatedSection className="py-20 bg-white" delay={0.2}>
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12">
              <div>
                <h2 className="text-3xl font-serif mb-8">Get In Touch</h2>

                <div className="space-y-6">
                  <div className="flex items-start">
                    <Phone className="h-5 w-5 mr-4 mt-1" />
                    <div>
                      <h3 className="font-medium mb-1">Phone</h3>
                      <p className="text-gray-700">0997940419</p>
                      <p className="text-gray-700">0890000069</p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <Mail className="h-5 w-5 mr-4 mt-1" />
                    <div>
                      <h3 className="font-medium mb-1">Email</h3>
                      <p className="text-gray-700">lambatlauryn@gmail.com</p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <MapPin className="h-5 w-5 mr-4 mt-1" />
                    <div>
                      <h3 className="font-medium mb-1">Location</h3>
                      <p className="text-gray-700">{address}</p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <MessageCircle className="h-5 w-5 mr-4 mt-1" />
                    <div>
                      <h3 className="font-medium mb-1">WhatsApp</h3>
                      <p className="text-gray-700">0997940419</p>
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <h3 className="font-medium mb-4">Follow Us</h3>
                  <div className="flex space-x-4">
                    <a
                      href="https://www.instagram.com/laurynluxebeautystudio"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-black text-white p-3 rounded-full hover:bg-gray-800 transition-colors inline-flex items-center justify-center"
                    >
                      <Instagram className="h-5 w-5" />
                    </a>
                    <a
                      href="https://www.tiktok.com/@nailsbylauryn_nbl"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-black text-white p-3 rounded-full hover:bg-gray-800 transition-colors inline-flex items-center justify-center"
                    >
                      <TiktokIcon className="h-5 w-5" />
                    </a>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-3xl font-serif mb-8">Quick Connect</h2>

                <div className="grid gap-4">
                  <Card className="border-none shadow-soft transition-all duration-300 hover:shadow-glow hover:-translate-y-1">
                    <CardContent className="p-6">
                      <a
                        href="https://wa.me/265997940419"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center">
                          <MessageCircle className="h-5 w-5 mr-3 text-green-500" />
                          <span>Chat on WhatsApp</span>
                        </div>
                        <span className="text-sm text-gray-500">→</span>
                      </a>
                    </CardContent>
                  </Card>

                  <Card className="border-none shadow-soft transition-all duration-300 hover:shadow-glow hover:-translate-y-1">
                    <CardContent className="p-6">
                      <a href="tel:+265997940419" className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Phone className="h-5 w-5 mr-3 text-blue-500" />
                          <span>Call Us</span>
                        </div>
                        <span className="text-sm text-gray-500">→</span>
                      </a>
                    </CardContent>
                  </Card>

                  <Card className="border-none shadow-soft transition-all duration-300 hover:shadow-glow hover:-translate-y-1">
                    <CardContent className="p-6">
                      <a href="mailto:lambatlauryn@gmail.com" className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Mail className="h-5 w-5 mr-3 text-pink-500" />
                          <span>Email Us</span>
                        </div>
                        <span className="text-sm text-gray-500">→</span>
                      </a>
                    </CardContent>
                  </Card>
                </div>

                <div className="mt-8">
                  <h3 className="font-medium mb-4">Business Hours</h3>
                  <div className="space-y-2 text-gray-700">
                    <div className="flex justify-between items-center text-gray-700">
                      <span className="font-medium text-gray-900">Monday - Thursday</span>
                      <span>10:00 AM - 4:30 PM</span>
                    </div>
                    <div className="flex justify-between items-center text-gray-700 pt-2 border-t border-gray-100">
                      <span className="font-medium text-gray-900">Friday</span>
                      <span>10:00 AM - 3:00 PM</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Saturday</span>
                      <span>10:00 AM - 3:00 PM</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Sunday</span>
                      <span>Closed</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AnimatedSection>

      {/* Map Section */}
      <AnimatedSection className="py-20 bg-nude-light" delay={0.4}>
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto text-center">
            <h2 className="text-3xl font-serif mb-8">Find Us</h2>
            <div
              className="aspect-[16/9] w-full rounded-lg shadow-soft overflow-hidden relative flex flex-col items-center justify-center"
            >
              <Image
                src="/MapPlace.png"
                alt="Map showing location of Lauryn Luxe Beauty Studio"
                fill
                className="object-cover"
                priority
                sizes="100vw"
              />
              <div className="bg-black bg-opacity-50 p-8 rounded-lg z-10">
                <p className="text-white text-xl font-semibold mb-4">{address}</p>
                <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                  <Button className="bg-white text-black hover:bg-gray-200">
                    <MapPin className="h-5 w-5 mr-2" />
                    Get Directions
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </div>
      </AnimatedSection>
    </div>
  )
}
