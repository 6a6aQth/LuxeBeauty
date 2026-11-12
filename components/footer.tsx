import Link from "next/link"
import { Instagram, Facebook, Phone, Mail, MapPin, MapPinIcon, PhoneIcon, MailIcon } from "lucide-react"
import Logo from "@/components/logo"
import { TiktokIcon } from "@/components/tiktok-icon"
import { LinkPreview } from "@/components/ui/link-preview"

export default function Footer() {
  const address = "Lauryn Luxe Beauty Studio, Blantyre, Malawi";
  const googleMapsUrl = "https://maps.app.goo.gl/3X5D11gfKSbZ3iSNA?g_st=com.google.maps.preview.copy"

  return (
    <footer className="bg-black text-white py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center md:text-left">
          <div className="flex flex-col items-center md:items-start">
            <Logo />
            <p className="mt-2 text-sm text-gray-400">
              Luxury & Precision in Every Detail.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li><Link href="/about" className="hover:text-pink-400">About Us</Link></li>
              <li><Link href="/services" className="hover:text-pink-400">Services</Link></li>
              <li><Link href="/booking" className="hover:text-pink-400">Book Now</Link></li>
              <li><Link href="/gift-voucher" className="hover:text-pink-400">Gift Voucher</Link></li>
              <li><Link href="/contact" className="hover:text-pink-400">Contact</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-4">Contact & Location</h3>
            <div className="space-y-3">
              <a 
                href={googleMapsUrl}
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-center md:justify-start space-x-2 hover:text-pink-400"
              >
                <MapPinIcon className="h-5 w-5 flex-shrink-0" />
                <span>{address}</span>
              </a>
              <a href="mailto:lambatlauryn@gmail.com" className="flex items-center justify-center md:justify-start space-x-2 hover:text-pink-400">
                <MailIcon className="h-5 w-5" />
                <span>lambatlauryn@gmail.com</span>
              </a>
              <div className="flex items-center justify-center md:justify-start space-x-2">
                 <PhoneIcon className="h-5 w-5" />
                 <span>0997940419 / 0890000069</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-4">Follow Us</h3>
            <div className="flex justify-center md:justify-start space-x-4">
              <a
                href="https://www.instagram.com/laurynluxebeautystudio"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white"
              >
                <Instagram className="h-6 w-6" />
              </a>
              <a
                href="https://www.tiktok.com/@nailsbylauryn_nbl"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white"
              >
                <TiktokIcon className="h-6 w-6" />
              </a>
            </div>
          </div>
        </div>
        <div className="text-center text-gray-500 mt-10 pt-6 border-t border-gray-800">
          <p>&copy; {new Date().getFullYear()} Lauryn Luxe Beauty Studio. All Rights Reserved.</p>
          <p className="mt-2 text-sm">
            Powered By
          </p>
          <LinkPreview
            url="https://www.midascreed.com/"
            imageSrc="/LinkPreview.png"
            isStatic
            className="text-blue-500 hover:text-blue-400 font-medium mt-1"
          >
            MidasCreed
          </LinkPreview>
        </div>
      </div>
    </footer>
  )
}
