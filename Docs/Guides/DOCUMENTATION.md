# Project Documentation: Luxe Beauty

## 1. Project Overview

Luxe Beauty is a web application designed to manage beauty service bookings, price lists, and client communications, including a newsletter. It provides functionalities for clients to browse services, book appointments, and subscribe to newsletters, while administrators can manage services, prices, unavailable dates, and review bookings. The application aims to streamline the booking process and enhance client engagement for a beauty service business.

## 2. Tech Stack

The project is built using a modern Next.js framework, leveraging a robust set of libraries and tools for a performant and scalable application.

**Frontend:**
*   **Next.js:** React framework for building server-rendered and static web applications.
*   **React:** JavaScript library for building user interfaces.
*   **Tailwind CSS:** A utility-first CSS framework for rapid UI development.
*   **Shadcn/ui:** A collection of re-usable components built using Radix UI and Tailwind CSS.
*   **Framer Motion:** A production-ready motion library for React.
*   **React Hook Form:** For form management and validation.
*   **Zod:** A TypeScript-first schema declaration and validation library.
*   **date-fns:** A comprehensive JavaScript date utility library.
*   **Recharts:** A composable charting library built on React components.
*   **Sonner:** An opinionated toast component for React.

**Backend/Database:**
*   **Next.js API Routes:** For building backend API endpoints.
*   **Prisma:** Next-generation ORM for Node.js and TypeScript, used for database interaction.
*   **PostgreSQL (implied by Prisma schema):** Relational database.
*   **Resend:** For sending transactional emails (e.g., newsletters).
*   **@vercel/blob:** For handling file uploads (e.g., price list images).

**Development Tools & Utilities:**
*   **TypeScript:** Superset of JavaScript that adds static types.
*   **Autoprefixer:** PostCSS plugin to parse CSS and add vendor prefixes.
*   **PostCSS:** A tool for transforming CSS with JavaScript.
*   **clsx & tailwind-merge:** Utilities for conditionally joining CSS class names and merging Tailwind CSS classes.
*   **lucide-react & @tabler/icons-react:** Icon libraries.
*   **embla-carousel-react:** A carousel library for React.
*   **react-day-picker:** A flexible date picker component.
*   **react-resizable-panels:** Resizable panels for React applications.
*   **html-to-image & html2canvas:** For converting HTML elements to images.
*   **simplex-noise:** A JavaScript library for generating Perlin noise.
*   **vaul:** A drawer component for React.

## 3. Folder/File Structure

The project follows a standard Next.js application structure with clear separation of concerns.

*   `app/`: Contains all route-based files and API endpoints.
    *   `about/`: About page.
    *   `admin/`: Admin dashboard for managing bookings, services, and availability.
    *   `api/`: Backend API routes.
        *   `bookings/`: API for booking management.
            *   `upload/`: API for uploading booking-related files.
        *   `newsletter/`: API for newsletter subscriptions and sending.
            *   `send/`: API for sending newsletters.
            *   `subscribers/`: API for managing newsletter subscribers.
            *   `unsubscribe/`: API for unsubscribing from newsletters.
        *   `price-list/`: API for managing price lists.
            *   `upload/`: API for uploading price list images.
        *   `services/`: API for managing services.
        *   `unavailable-dates/`: API for managing unavailable dates and time slots.
    *   `booking/`: Booking pages.
        *   `confirmation/`: Booking confirmation page.
    *   `contact/`: Contact page.
    *   `globals.css`: Global CSS styles.
    *   `icon.png`: Application icon.
    *   `layout.tsx`: Root layout for the application.
    *   `page.tsx`: Homepage.
    *   `prices/`: Prices page displaying service prices.
    *   `services/`: Services page displaying available services.
    *   `unsubscribed/`: Page for newsletter unsubscription confirmation.
*   `components/`: Reusable React components.
    *   `ui/`: Shadcn/ui components and custom UI components.
    *   `booking-form.tsx`: Component for client booking.
    *   `header.tsx`, `footer.tsx`: Layout components.
    *   `newsletter-form.tsx`, `newsletter-signup.tsx`: Components related to newsletter.
    *   `whatsapp-button.tsx`: WhatsApp contact button.
*   `emails/`: React Email templates for various email communications.
    *   `newsletter-template.tsx`: Template for newsletters.
*   `hooks/`: Custom React hooks for shared logic.
    *   `use-mobile.tsx`: Hook to detect mobile devices.
    *   `use-toast.ts`: Hook for displaying toast notifications.
*   `lib/`: Utility functions and configurations.
    *   `prisma.ts`: Prisma client initialization.
    *   `time-slots.ts`: Utility for generating time slots.
    *   `utils.ts`: General utility functions.
*   `prisma/`: Prisma schema and database migrations.
    *   `migrations/`: Database migration files.
    *   `schema.prisma`: Prisma schema defining database models.
    *   `seed.js`: Script for seeding the database.
*   `public/`: Static assets like images and fonts.
*   `styles/`: Additional global styles.
*   `types/`: TypeScript type definitions.

## 4. Key Components

*   **`app/admin/page.tsx`**: The main administrative dashboard. This component handles the display of bookings, management of unavailable dates, and potentially other admin-specific tasks. Recent changes indicate a focus on synchronizing managed time slots with unavailable dates and robust error handling for availability updates.
*   **`components/booking-form.tsx`**: This component is crucial for client interaction, allowing users to select services, dates, and time slots for their bookings.
*   **`app/api/bookings/route.ts`**: Handles the API logic for creating, retrieving, and possibly updating/deleting booking records in the database.
*   **`app/api/unavailable-dates/route.ts`**: Manages the unavailable dates and time slots, which is critical for preventing double bookings and allowing administrators to block out specific times.
*   **`lib/prisma.ts`**: Initializes the Prisma client, providing the interface for all database operations throughout the application.
*   **`prisma/schema.prisma`**: Defines the application's database schema, including models for bookings, services, users, and unavailable dates.
*   **`emails/newsletter-template.tsx`**: This defines the structure and content of the newsletter emails sent to subscribers.

## 5. Setup Instructions

To set up and run the project locally, follow these steps:

1.  **Clone the repository:**
    ```bash
    git clone [repository-url]
    cd luxebeautyy
    ```

2.  **Install dependencies:**
    The project uses `pnpm` as the package manager. If you don't have it installed, you can install it via npm:
    ```bash
    npm install -g pnpm
    ```
    Then, install the project dependencies:
    ```bash
    pnpm install
    ```

3.  **Set up environment variables:**
    Create a `.env` file in the root of the project based on `.env.example` (if available, otherwise create it manually). You will need to configure your database connection string, Resend API key, and Vercel Blob API keys.
    ```env
    DATABASE_URL="postgresql://user:password@host:port/database?schema=public"
    RESEND_API_KEY="YOUR_RESEND_API_KEY"
    BLOB_READ_WRITE_TOKEN="YOUR_VERCEL_BLOB_READ_WRITE_TOKEN"
    ```
    *Note: Replace placeholders with your actual credentials.*

4.  **Database Setup:**
    *   Ensure your PostgreSQL database is running.
    *   Run Prisma migrations to create the necessary tables in your database:
        ```bash
        pnpm prisma migrate dev --name init
        ```
    *   Seed the database with initial data (optional but recommended for development):
        ```bash
        pnpm prisma db seed
        ```

5.  **Run the development server:**
    ```bash
    pnpm dev
    ```
    The application will be accessible at `http://localhost:3000`.

## 6. Deployment Instructions

This project is built with Next.js, making it highly compatible with Vercel for deployment.

1.  **Vercel Deployment:**
    *   Ensure your project is hosted on a Git provider (GitHub, GitLab, Bitbucket).
    *   Log in to your [Vercel account](https://vercel.com/) (or sign up if you don't have one).
    *   Import your Git repository into Vercel. Vercel will automatically detect that it's a Next.js project.
    *   Configure environment variables in Vercel settings (e.g., `DATABASE_URL`, `RESEND_API_KEY`, `BLOB_READ_WRITE_TOKEN`).
    *   Vercel will build and deploy your application automatically on every push to your configured branch (usually `main`).

2.  **Other Platforms:**
    The project can also be deployed to other platforms supporting Node.js applications with custom servers or Docker. Refer to Next.js deployment documentation for more details on specific platforms.

## 7. Contribution Guidelines

Standard contribution guidelines apply:

*   Fork the repository.
*   Create a new branch for your features or bug fixes (`git checkout -b feature/your-feature-name` or `bugfix/your-bug-name`).
*   Ensure your code adheres to the project's coding style (ESLint and Prettier are recommended).
*   Write clear, concise commit messages.
*   Submit a pull request with a detailed description of your changes.

## 8. API Documentation

The application exposes several API endpoints built with Next.js API Routes.

### Bookings API

*   **`POST /api/bookings`**: Create a new booking.
    *   **Request Body**: JSON object containing booking details (e.g., `name`, `email`, `serviceId`, `date`, `timeSlot`).
    *   **Response**: New booking object on success, error message on failure.
*   **`GET /api/bookings`**: Retrieve all bookings. (May require authentication/authorization for admin access)
    *   **Response**: Array of booking objects.

### Price List API

*   **`GET /api/price-list`**: Retrieve the current price list.
    *   **Response**: JSON object or array containing service prices.
*   **`POST /api/price-list/upload`**: Upload a new price list image/document. (Admin only)
    *   **Request Body**: Form data with the file.
    *   **Response**: URL of the uploaded file.

### Newsletter API

*   **`POST /api/newsletter`**: Subscribe to the newsletter.
    *   **Request Body**: JSON object with `email`.
    *   **Response**: Success message or error.
*   **`POST /api/newsletter/unsubscribe`**: Unsubscribe from the newsletter.
    *   **Request Body**: JSON object with `email`.
    *   **Response**: Success message or error.
*   **`GET /api/newsletter/subscribers`**: Retrieve all newsletter subscribers. (Admin only)
    *   **Response**: Array of subscriber objects.
*   **`POST /api/newsletter/send`**: Send a newsletter to all subscribers. (Admin only)
    *   **Request Body**: JSON object with newsletter content.
    *   **Response**: Success message.

### Services API

*   **`GET /api/services`**: Retrieve all available services.
    *   **Response**: Array of service objects.
*   **`GET /api/services/[id]`**: Retrieve a single service by ID.
    *   **Response**: Service object.
*   **`POST /api/services`**: Create a new service. (Admin only)
*   **`PUT /api/services/[id]`**: Update an existing service. (Admin only)
*   **`DELETE /api/services/[id]`**: Delete a service. (Admin only)

### Unavailable Dates API

*   **`GET /api/unavailable-dates`**: Retrieve all unavailable dates and their blocked time slots.
    *   **Response**: Array of objects, each containing a `date` string and `timeSlots` array.
*   **`POST /api/unavailable-dates`**: Add or update unavailable dates and time slots. (Admin only)
    *   **Request Body**: JSON object with `date` (string, e.g., "YYYY-MM-DD") and `slots` (array of time slot strings, e.g., ["09:00", "10:00"]).
    *   **Response**: Updated unavailable date object.

## 10. Webhook Documentation

The application implements a secure webhook to handle asynchronous payment notifications from PayChangu.

### PayChangu Webhook
*   **Endpoint**: `/api/webhook/paychangu`
*   **Method**: `POST`
*   **Environment Variable**: `PAYCHANGU_WEBHOOK_SECRET` (Required for signature verification)

#### Security & Authentication
The webhook implementation uses **HMAC SHA-256** signature verification to ensure requests originate from PayChangu.
1.  The raw request body is read.
2.  A HMAC signature is computed using the `PAYCHANGU_WEBHOOK_SECRET`.
3.  The computed signature is compared against the `signature` header provided in the request.
4.  If signatures do not match, the request is rejected with a **401 Unauthorized** status.

#### Expected Workflow
1.  **Event Reception**: Receives a `POST` request from PayChangu.
2.  **Signature Verification**: Validates the payload integrity.
3.  **Event Filtering**: Only processes events where `eventType === 'payment.success'` or `status === 'success'`.
4.  **Booking Lookup**: Matches the `tx_ref` from the payload to a `ticketId` in the database.
5.  **Status Update**: Marks the booking as `successful` and calculates loyalty discount eligibility.
6.  **SMS Confirmation**: Triggers a non-blocking SMS confirmation to the client via `@/lib/sms`.
7.  **Event Logging**: Records the event details using `logPaymentEvent` for auditing and troubleshooting.

#### Payload Structure (Simplified)
```json
{
  "event": "payment.success",
  "data": {
    "status": "success",
    "tx_ref": "TX-12345",
    "amount": 5000,
    "currency": "MWK",
    "meta": {
      "phone": "+265...",
      "date": "2024-05-20",
      "timeSlot": "10:00"
    }
  }
}
```

## 9. Common Issues & Troubleshooting

*   **Database Connection Errors:**
    *   **Issue:** `PrismaClientKnownRequestError: P2002` (Unique constraint failed) or `P1001` (Can't reach database server).
    *   **Troubleshooting:**
        *   Ensure your `DATABASE_URL` in `.env` is correct.
        *   Verify your PostgreSQL server is running and accessible.
        *   Check firewall rules if deployed remotely.
        *   Run `pnpm prisma migrate dev` to ensure your database schema is up-to-date.
*   **Environment Variable Not Loaded:**
    *   **Issue:** API keys or other configurations are `undefined`.
    *   **Troubleshooting:** Ensure `.env` file is correctly placed in the project root and values are set. Restart the development server after modifying `.env`.
*   **API Route Not Found (404):**
    *   **Issue:** Fetch requests to API routes return 404.
    *   **Troubleshooting:**
        *   Verify the file path of your API route (e.g., `app/api/bookings/route.ts`). Next.js routes are file-system based.
        *   Check for typos in the fetch URL.
        *   Ensure the HTTP method (GET, POST, etc.) matches the handler in your `route.ts` file.
*   **Frontend-Backend Data Mismatch / Stale Data:**
    *   **Issue:** Data displayed on the frontend doesn't reflect the latest changes in the database.
    *   **Troubleshooting:**
        *   Ensure you are re-fetching data after successful mutations (e.g., after saving unavailable dates in `app/admin/page.tsx`, `fetchAdminData()` is called).
        *   Check server-side caching mechanisms if any are implemented.
*   **Time Slot Management Issues:**
    *   **Issue:** Incorrect time slots being marked as unavailable or booked.
    *   **Troubleshooting:**
        *   Review the `generateTimeSlots` utility in `lib/time-slots.ts`.
        *   Examine the logic in `app/admin/page.tsx` that manages `selectedTimeSlots` (now `managedSlots`) and `unavailableDates`, especially the `useEffect` hooks and the `handleSaveAvailability` function. Ensure synchronization between local state and database.
*   **Image Upload Issues:**
    *   **Issue:** Images not uploading or accessible.
    *   **Troubleshooting:**
        *   Verify `BLOB_READ_WRITE_TOKEN` is correctly configured for Vercel Blob.
        *   Check the API route for image uploads (`app/api/price-list/upload/route.ts` or `app/api/bookings/upload/route.ts`) for correct handling of `FormData` and `vercel/blob` API usage.

## What We've Done Recently

*   **Improved Unavailable Dates Management:** Enhanced the admin panel (`app/admin/page.tsx`) to better manage and synchronize unavailable time slots. This involved:
    *   Switching from `selectedTimeSlots` to `managedSlots` for better clarity in state management.
    *   Implementing a new `useEffect` hook to synchronize `managedSlots` with `unavailableDates` fetched from the API when the availability modal is opened.
    *   Refining the `handleSaveAvailability` function to correctly update the `unavailableDates` state after a successful save, ensuring the UI reflects the latest data.
    *   Adding `fetchAdminData()` call after saving availability to ensure the latest data is fetched.
    *   Fixing a minor display bug in the booking details within the modal (adding closing parenthesis).
    *   Correcting the checkbox logic for time slots to accurately reflect managed slots.
*   **Refactored API Call for Unavailable Dates:** Switched from a simple `fetch` to capturing the response and handling potential errors more robustly, including updating the local state based on the API's response for unavailable dates.
*   **Added `key` prop to `DialogContent`:** This ensures the dialog content re-mounts when the `selectedDate` changes, preventing stale state issues with time slot selection.

---
**Note:** This documentation is a living document and may be updated as the project evolves.