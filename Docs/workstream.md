# Lauryn Luxe Beauty Studio Workstream
This file combines the planned development roadmap and the reactive work log (fixes & debug sessions). It is managed by `@tasklist` (Planned Roadmap section only) and `@intake` (Reactive Log section only — `@tasklist` never writes here). It does not carry its own version number; git history and the `[x]` markers are sufficient. The SDD (`/Docs/SDD.md`) is versioned and is the contract this roadmap implements.

---

## Planned Roadmap

1.0 Application Foundation (generated against SDD v1)
- [x] 1.1 Scaffold the Next.js app with the root layout, theme provider, header, footer, and global styles
- [x] 1.2 Define the Prisma models for Booking, PaymentEvent, Service, Category, UnavailableDate, NewsletterSubscription, and SiteSettings, and connect them to Neon PostgreSQL
- [x] 1.3 Add shared modules for the Prisma client, class-name helper, Malawi time slots, Twilio SMS, and the payment event logger
- [x] 1.4 Read PayChangu, Twilio, Resend, Vercel Blob, and admin secrets from environment variables
- [x] 1.5 Remove unused UI scaffold, duplicate toast hook, unused stylesheet, one-off scripts, the unused callback stub, and unreferenced image dumps

2.0 Public Studio Site (generated against SDD v1)
- [x] 2.1 Build the homepage with hero, service preview, gallery, and newsletter signup
- [x] 2.2 Build the About page with studio and founder information
- [x] 2.3 Build the services catalog grouped by category
- [x] 2.4 Build the public prices page from the stored price-list image
- [x] 2.5 Build the policies page
- [x] 2.6 Build the contact page with studio details, social links, and map
- [x] 2.7 Add the persistent header, footer, and WhatsApp button
- [ ] 2.8 Publish one set of business hours on the homepage, contact page, and booking form that matches `lib/time-slots.ts`

3.0 Service and Category Catalog (generated against SDD v1)
- [x] 3.1 Implement service list, create, update, and delete APIs, including an availability flag
- [x] 3.2 Implement category list, create, update, and delete APIs, and block deletion while services still use that category name
- [x] 3.3 Manage services and categories from the admin dashboard
- [x] 3.4 Seed the initial categories and services
- [ ] 3.5 Replace the string `Service.category` link with a foreign key to Category, and migrate existing rows

4.0 Availability and Time Slots (generated against SDD v1)
- [x] 4.1 Define weekday slots and resolve the weekday in Africa/Blantyre so Friday does not offer a 15:00 slot
- [x] 4.2 Reject a checkout time slot that is not valid for that date
- [x] 4.3 Let an admin block specific slots on a date, and store those blocks in UnavailableDate
- [x] 4.4 Disable fully booked dates on the booking calendar
- [ ] 4.5 Stop polling services, unavailable dates, and successful bookings every second; refresh on focus or when the selected date changes

5.0 Customer Booking (generated against SDD v1)
- [x] 5.1 Build the multi-step booking form for customer details, services, date, and time
- [x] 5.2 Create the booking as pending when checkout starts
- [x] 5.3 Upload up to five inspiration photos to Vercel Blob and store the URLs on the booking
- [x] 5.4 Show a confirmation ticket and let the customer download it as a PNG
- [x] 5.5 Show a failed or cancelled payment status page
- [x] 5.6 Poll payment verification from the verifying page after PayChangu redirects back
- [ ] 5.7 Enforce file type and size limits on inspiration-photo uploads
- [ ] 5.8 Load the in-progress booking from the database by transaction reference on the verifying page, so a cleared browser session can still finish

6.0 PayChangu Payments (generated against SDD v1)
- [x] 6.1 Create a PayChangu checkout session and redirect the customer to it
- [x] 6.2 Verify a payment from the client, with retries, and mark the booking successful when PayChangu confirms it
- [x] 6.3 Accept the PayChangu webhook, verify the HMAC signature, and confirm the booking only once
- [x] 6.4 Write a sequenced PaymentEvent row for checkout, verification, webhook, and admin verification
- [x] 6.5 Provide an admin API that can force-verify a pending payment by transaction reference
- [ ] 6.6 Add an admin control that calls the manual verification API and shows the result
- [ ] 6.7 Store the deposit amount in SiteSettings and enforce that amount on the server during checkout and verification

7.0 Loyalty and SMS (generated against SDD v1)
- [x] 7.1 Apply a 30% discount on every 6th successful booking for a phone number during verification and on the webhook
- [x] 7.2 Preview loyalty eligibility on the booking form before payment
- [x] 7.3 Send a Twilio confirmation SMS with ticket id, date, time, and services, using Malawi +265 numbers
- [ ] 7.4 Move loyalty calculation and booking confirmation into one shared module, and run that same path from admin verification

8.0 Newsletter (generated against SDD v1)
- [x] 8.1 Subscribe an email address and ignore duplicates
- [x] 8.2 Unsubscribe from a link and show the unsubscribed page
- [x] 8.3 Let an admin compose and batch-send a newsletter through Resend with the React email template
- [x] 8.4 List current subscribers for the admin send flow

9.0 Price List (generated against SDD v1)
- [x] 9.1 Upload a price-list image to Vercel Blob and save the URL in SiteSettings
- [x] 9.2 Show the current price list on the public prices page
- [x] 9.3 Reject price-list files over 4.5MB in the admin browser before upload
- [ ] 9.4 Enforce the same size and image-type limit on the upload API

10.0 Lookup and Reschedule (generated against SDD v1)
- [x] 10.1 Look up a booking by ticket id
- [x] 10.2 Reschedule a successful booking once, with 24 hours' notice, and reject a conflicting slot
- [x] 10.3 Offer reschedule from lookup and from the standalone reschedule page, with no extra payment

11.0 Admin Dashboard (generated against SDD v1)
- [x] 11.1 Provide one admin screen for bookings, services, categories, availability, the price list, and newsletters
- [x] 11.2 Default the booking list to all statuses so pending payments are visible
- [ ] 11.3 Split the admin screen into separate panels for bookings, services, categories, availability, newsletter, and price list
- [ ] 11.4 Paginate booking queries used by the admin list and by slot availability

12.0 Security and Build Safety (generated against SDD v1)
- [ ] 12.1 Remove the hardcoded admin password from the client and sign the admin in with an HTTP-only session
- [ ] 12.2 Require that session on every admin and mutating API: bookings update/delete, services, categories, unavailable dates, price list, newsletter send, and subscriber list
- [ ] 12.3 Turn TypeScript and ESLint errors back on for production builds, and fix what they report
- [ ] 12.4 Add rate limits on checkout, verification, upload, and SMS-triggering routes

13.0 Data Integrity and Operations (generated against SDD v1)
- [ ] 13.1 Prevent two successful bookings from occupying the same date and time slot, including under concurrent checkout
- [ ] 13.2 Add error monitoring so production payment and SMS failures are visible without reading server logs

## Recent Activity Index
- 25 Sept 2026 — Initial roadmap generated (13 parent tasks, against SDD v1)
