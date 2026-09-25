import Image from "next/image"
import { PageHeader } from "@/components/page-header"
import { Timeline } from "@/components/ui/timeline"
import { Button } from "@/components/ui/button"
import Link from "next/link"

const timelineData = [
  {
    tag: "Our Mission",
    title: "Precision & Excellence",
    content: (
      <>
        <p className="mb-4">
          At Lauryn Luxe, we believe that excellence lies in the details. Every
          service we provide is executed with meticulous precision and unwavering
          attention to detail. We take pride in our craftsmanship and strive for
          perfection in every nail we touch.
        </p>
        <Image
          src="/images/nails-9.jpeg"
          alt="Precision red manicure in progress"
          width={400}
          height={300}
          className="rounded-lg object-cover w-full h-64"
          sizes="(max-width: 768px) 100vw, 50vw"
        />
      </>
    ),
  },
  {
    tag: "Our Vision",
    title: "Elegance & Sophistication",
    content: (
      <>
        <p className="mb-4">
          Elegance is at the heart of our aesthetic. We embrace sophisticated
          designs, clean lines, and timeless beauty. Our work reflects a refined
          taste that enhances your natural beauty while making a statement of
          quiet confidence.
        </p>
        <Image
          src="/images/nails-2.jpeg"
          alt="Elegant floral nail art"
          width={400}
          height={300}
          className="rounded-lg object-cover w-full h-64"
          sizes="(max-width: 768px) 100vw, 50vw"
        />
      </>
    ),
  },
  {
    tag: "Our Promise",
    title: "Self-Care & Wellness",
    content: (
      <>
        <p className="mb-4">
          We view beauty rituals as essential acts of self-care. Our studio
          provides a sanctuary where you can disconnect from the outside world and
          focus on your wellbeing. Every treatment is designed to nurture both
          your physical appearance and inner peace.
        </p>
        <Image
          src="/images/lamination-3.jpeg"
          alt="Relaxing brow lamination appointment"
          width={400}
          height={300}
          className="rounded-lg object-cover w-full h-64"
          sizes="(max-width: 768px) 100vw, 50vw"
        />
      </>
    ),
  },
  {
    tag: "Our Commitment",
    title: "Premium Experience",
    content: (
      <>
        <p className="mb-4">
          From the moment you enter our studio to the moment you leave, we are
          committed to providing a premium experience. We use only the finest
          products, maintain impeccable hygiene standards, and offer personalized
          attention to ensure your complete satisfaction.
        </p>
        <Image
          src="/images/eyelashes-3.jpeg"
          alt="Eyelash treatment at the studio"
          width={400}
          height={300}
          className="rounded-lg object-cover w-full h-64"
          sizes="(max-width: 768px) 100vw, 50vw"
        />
      </>
    ),
  },
]

export default function AboutPage() {
  return (
    <div>
      <PageHeader
        title="About Lauryn Luxe Beauty"
        description="A sanctuary for nail care artistry and the pursuit of elegance."
      />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="w-full h-auto">
            <Image
              src="/lauryn.jpg"
              alt="Beautifully manicured hands with intricate red nail art"
              width={800}
              height={1000}
              className="rounded-lg object-cover shadow-lg"
              priority
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
          <div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              About Lauryn
            </h2>
            <div className="space-y-4 text-neutral-600 dark:text-neutral-400">
              <p>
                Lauryn Lambat is the creative force and founder behind Lauryn
                Luxe Beauty Studio. With a background in beauty and a passion
                for nail artistry, Lauryn established her studio in 2022 with a
                vision to redefine luxury beauty experiences in Blantyre.
              </p>
              <p>
                Her journey began with a simple belief: that beauty rituals
                should be moments of self-care, luxury, and personal
                expression. This philosophy guides every aspect of the
                studio&apos;s operations, from the serene ambiance to the
                meticulous attention given to each client.
              </p>
              <p>
                Lauryn's expertise and artistic eye have earned her a reputation
                for excellence. She continuously hones her craft by staying
                updated with the latest techniques and trends in the beauty
                industry, ensuring that her clients receive nothing but the
                best.
              </p>
              <p>
                Beyond her technical skills, Lauryn is known for her warm
                personality and ability to make every client feel valued and
                comfortable. She believes that true beauty comes from feeling
                confident and cared for, and she strives to create this
                experience for everyone who visits her studio.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
          Our Philosophy
        </h2>
        <Timeline data={timelineData} />
      </div>
      <div className="bg-black text-white py-20 text-center">
        <h2 className="text-4xl md:text-5xl font-bold mb-4">
          Experience Luxury Beauty
        </h2>
        <p className="max-w-2xl mx-auto mb-8 text-neutral-300">
          We invite you to visit Lauryn Luxe Beauty Studio and experience our
          philosophy in action. Book your appointment today and discover the
          difference.
        </p>
        <Link href="/booking">
          <Button
            variant="outline"
            className="bg-white text-black hover:bg-neutral-200"
          >
            Book Your Appointment
          </Button>
        </Link>
      </div>
    </div>
  )
}
