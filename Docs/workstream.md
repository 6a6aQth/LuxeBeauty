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
- [x] 5.6 Poll payment verification from the verifying page after PayChangu redirects back [SUPERSEDED BY 16.0]
- [ ] 5.7 Enforce file type and size limits on inspiration-photo uploads
- [ ] 5.8 Load the in-progress booking from the database by transaction reference on the verifying page, so a cleared browser session can still finish

6.0 PayChangu Payments (generated against SDD v1) [SUPERSEDED BY 16.0]
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

14.0 Customer Accounts (generated against SDD v2)
- [x] 14.1 Add Neon Auth (`createNeonAuth`, auth route handler, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`) and read the customer session on the server. Leave guest booking, lookup, payment, and webhook routes public.
- [x] 14.2 Add a `CustomerProfile` with unique `neonUserId`, name, unique email, and unique phone stored in the same string form bookings already use. Create it during signup. Do not add a user foreign key on `Booking`. [SUPERSEDED BY 15.0]
- [x] 14.3 Build sign-up (name, email, password, phone) and sign-in (email, password), plus sign-out. Reject a phone that already belongs to an account.
- [x] 14.4 In the header, show Sign in when there is no session and Account when there is one. A guest can still open booking and complete checkout with no session.
- [x] 14.5 When a session exists, do not show name, phone, or email on the booking form. Submit the profile values on the booking. Guests still type those three fields.
- [x] 14.6 Add `/account` with a Visits section split into Upcoming and Past: successful bookings whose phone equals the profile phone, using Africa/Blantyre for the split. Require a session. Do not offer ticket-id search on this page.
- [x] 14.7 Opening an upcoming visit shows the same downloadable ticket the confirmation page already renders.
- [x] 14.8 Reschedule from that upcoming visit uses the existing once / 24-hour notice / no extra payment rules, and the server rejects the request unless the booking phone is the session phone.
- [x] 14.9 On the account page, show loyalty progress from the count of successful bookings for that phone. The discount rule stays every 6th booking at 30%. Example copy: "two visits until the 30% visit".
- [x] 14.10 After signup, bookings already stored under that phone appear in Visits. Do not move bookings that use a different phone. [SUPERSEDED BY 15.0]

15.0 Canonical Malawi phone for loyalty and visits (generated against SDD v3)
- [ ] 15.1 Add one normalizer: strip spaces and dashes; accept `0` plus 9 digits, 9 digits, `265` plus 9 digits, or `+265` plus 9 digits; reject anything else; return `+265` plus 9 digits. [SUPERSEDED BY 15.8]
- [x] 15.2 Save that value on guest checkout, signed-in checkout, signup, and admin phone edit. Signup uniqueness uses the canonical value.
- [x] 15.3 Loyalty preview, payment verification, and the PayChangu webhook count successful bookings for that phone, including rows still stored in an equivalent form. Verification uses the phone stored on the booking.
- [x] 15.4 Account visits and account reschedule compare canonical phones.
- [x] 15.5 Rewrite existing `Booking.phone` and `CustomerProfile.phone` values that canonicalize. If two profiles collapse to one number, stop and report them; do not merge accounts.
- [x] 15.6 Send confirmation SMS to that same canonical number.
- [x] 15.7 Replace the signup note that says visits and loyalty match the number exactly as written.
- [x] 15.8 Replace the Malawi-only normalizer. Save E.164. Collapse Malawi local forms, including brackets, an extra `0` after `+265`, and a leading letter `O`, to `+265` plus 9 digits. Accept any other number that already starts with `+` and a country code, such as `+256`. Do not invent a country code for `07…`. Reject names and junk.
- [x] 15.9 On the booking, signup, and admin phone boxes, block letters and refuse submit until the value canonicalizes. Show that a Malawi number can be typed locally and every other country needs `+` and its country code. The server enforces the same rule.
- [x] 15.10 When rewriting `Booking.phone`, also store already-international `+` numbers as digits-only E.164. Leave names, junk, and country-less non-Malawi numbers unchanged.

16.0 Direct Charge booking payment (generated against SDD v5)
- [x] 16.1 Remove hosted PayChangu checkout from the booking flow: no checkout URL, no redirect, and no use of the public key
- [x] 16.2 Add a booking payment step that offers TNM Mpamba (`08`) and Airtel Money (`09`), in the studio UI, and stays on the site
- [x] 16.3 Initialize a Direct Charge for MWK 100 with a new server-generated charge id, create the booking as pending, and ignore any amount from the browser
- [x] 16.4 Poll PayChangu verify from that same page. On success, mark the booking successful, apply loyalty, send the SMS, show the ticket, and allow the PNG download
- [x] 16.5 Email the ticket through Resend when the booking has an email. A failed send does not undo the booking
- [x] 16.6 Keep the webhook route, reject it while `PAYCHANGU_WEBHOOK_SECRET` is missing, and when the secret exists require a valid `Signature` plus a fresh verify before the shared confirm path runs
- [x] 16.7 Log initialize, verify, confirm, ticket email, and webhook attempts on `PaymentEvent`
- [ ] 16.8 Restore the charged amount to K10,000 before this flow is used for real deposits

17.0 Luxury loading mark (generated against SDD v5)
- [x] 17.1 Add one shared mark from `/Llogo.png` with two sizes: a full-page black field, centered mark, soft glow, and at most one quiet line; and a smaller mark that leaves the header and footer in place
- [x] 17.2 Use the full-page mark for the homepage “Loading...” suspense, the empty booking and reschedule suspense fallbacks, the booking status and verifying “Loading...” fallbacks, and any route navigation that is otherwise a blank wait
- [x] 17.3 Use the full-page mark for account “Loading your visits…” and “Finishing sign-in…”. On sign-in, sign-up, Google, and profile-continue, keep the button label and show the small mark beside it
- [x] 17.4 Replace the services catalog’s empty wait, the prices gray skeleton, and the booking form’s “Loading categories…” line with the small mark
- [x] 17.5 Use the small mark for lookup search, “Show earlier visits”, the booking “Please wait while we process your booking...” line, and the admin subscriber “Loading...” count. Leave the payment step’s existing step copy in place

18.0 Same email across Google and password (generated against SDD v5)
- [x] 18.1 When someone who already continued with Google tries email and password sign-in, do not create a Neon user, do not create a CustomerProfile, and do not start a session. Tell them to continue with Google.
- [x] 18.2 When someone tries to sign up with an email that already belongs to an account, including a Google sign-in that has not saved a phone yet, refuse it. Do not create a second profile.
- [x] 18.3 On sign-up, require the password twice and refuse submit when the two values differ. On sign-up and sign-in, let the customer show or hide the password. Send one password to Neon Auth. Do not store it in the app database.
- [x] 18.4 When a password account later continues with Google for the same verified email, keep the same Neon user and the existing CustomerProfile. Do not ask them to create a second profile.

## Reactive Log

F1.0 — 26 Sept 2026 — After a successful PayChangu payment the ticket is shown (“Appointment confirmed”) and a destructive toast still says “Time Slot Unavailable / The time slot you selected is no longer available.”
- Affected area: `components/booking-form.tsx` unavailable-slot effect; `app/booking/page.tsx` successful-booking poll (`/api/bookings?status=successful`, 1s).
- Root cause: Once verify marks the booking `successful`, the next poll adds that date/time to `unavailableSlots`. The form effect still holds the same `formData.timeSlot`, treats the customer’s own booking as a lost slot, clears it, and toasts. The ticket reads separate `ticketDetails`, so both the error and the confirmed ticket render together. The PayChangu receipt and the ticket (for example 2027-08-31 10:00, Gel soak off, MWK 100) are the real outcome.
- Fix: Do not clear the slot or show that toast after the customer has left the form, and never when the slot disappeared because this payment just confirmed it. Keep the warning only while they are still choosing a time and another booking or an admin block takes that slot.
- Security-relevant: No
- Priority: High
- Capsule log: `F1.0-false-slot-unavailable-toast.md`
- Status: Resolved

## Recent Activity Index
- 26 Sept 2026 — 18.0 Same email across Google and password
- 26 Sept 2026 — 18.1 Google-only email cannot sign in with a password
- 26 Sept 2026 — 18.2 Refuse sign-up when the email already exists
- 26 Sept 2026 — 18.3 Confirm password and show or hide it
- 26 Sept 2026 — 18.4 Google after a password account stays one profile
- 26 Sept 2026 — 17.0 Luxury loading mark
- 26 Sept 2026 — 17.1 Shared full-page and inline mark from `/Llogo.png`
- 26 Sept 2026 — 17.2 Full-page waits on home, booking, status, and verifying
- 26 Sept 2026 — 17.3 Account visits, finishing sign-in, and auth buttons
- 26 Sept 2026 — 17.4 Services, prices, and booking categories
- 26 Sept 2026 — 17.5 Lookup, earlier visits, booking wait, and subscriber count
- 26 Sept 2026 — F1.0 resolved
- 26 Sept 2026 — F1.0 False “Time Slot Unavailable” toast after a successful payment
- 25 Sept 2026 — 16.0 Direct Charge booking payment
- 25 Sept 2026 — 16.1 Remove hosted checkout
- 25 Sept 2026 — 16.2 On-site TNM and Airtel payment step
- 25 Sept 2026 — 16.3 Initialize MWK 100 Direct Charge
- 25 Sept 2026 — 16.4 Verify, then ticket and database
- 25 Sept 2026 — 16.5 Email the ticket with Resend
- 25 Sept 2026 — 16.6 Webhook backup gated on secret
- 25 Sept 2026 — 16.7 Payment event log
- 25 Sept 2026 — 16.8 Restore K10,000 after the test
- 25 Sept 2026 — 15.8 E.164 storage, Malawi collapse, international `+` numbers
- 25 Sept 2026 — 15.9 Phone boxes reject messy input
- 25 Sept 2026 — 15.10 Rewrite keeps foreign `+` numbers and leaves junk
- 25 Sept 2026 — 15.0 Canonical Malawi phone for loyalty and visits
- 25 Sept 2026 — 15.1 Shared phone normalizer
- 25 Sept 2026 — 15.2 Save canonical phone on checkout, signup, and admin edit
- 25 Sept 2026 — 15.3 Loyalty counts equivalent phone forms
- 25 Sept 2026 — 15.4 Account visits and reschedule use the canonical phone
- 25 Sept 2026 — 15.5 Rewrite stored phones; do not merge colliding profiles
- 25 Sept 2026 — 15.6 SMS uses the canonical number
- 25 Sept 2026 — 15.7 Signup copy no longer says the raw string is the match
- 25 Sept 2026 — 14.0 Customer accounts with optional Neon Auth sign-in
- 25 Sept 2026 — Initial roadmap generated (13 parent tasks, against SDD v1)
