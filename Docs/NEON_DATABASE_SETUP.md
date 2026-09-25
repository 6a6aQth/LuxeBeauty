# Neon Database Setup Guide

This guide will walk you through setting up a Neon PostgreSQL database for your Next.js application with Prisma, avoiding common pitfalls we've encountered.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Step 1: Create Neon Database](#step-1-create-neon-database)
3. [Step 2: Configure Environment Variables](#step-2-configure-environment-variables)
4. [Step 3: Install Dependencies](#step-3-install-dependencies)
5. [Step 4: Configure Prisma](#step-4-configure-prisma)
6. [Step 5: Push Schema to Database](#step-5-push-schema-to-database)
7. [Step 6: Set Up Seed Script](#step-6-set-up-seed-script)
7. [Step 7: Configure Build Script](#step-7-configure-build-script)
8. [Step 8: Deploy to Vercel](#step-8-deploy-to-vercel)
9. [Common Issues & Solutions](#common-issues--solutions)
10. [Recovery Procedures](#recovery-procedures)
11. [Best Practices](#best-practices)

---

## Prerequisites

- Node.js 18+ installed
- A Neon account (free tier works fine)
- A Next.js project initialized
- Git repository set up

---

## Step 1: Create Neon Database

1. Go to [Neon Console](https://console.neon.tech/)
2. Sign up or log in
3. Click **"Create Project"**
4. Choose a project name (e.g., "luxebeautyy")
5. Select a region closest to your users
6. Click **"Create Project"**
7. Once created, you'll see a connection string that looks like:
   ```
   postgresql://username:password@ep-xxxxx.us-east-2.aws.neon.tech/dbname?sslmode=require
   ```
8. **Copy this connection string** - you'll need it in the next step

---

## Step 2: Configure Environment Variables

1. In your project root, create a `.env` file (if it doesn't exist)
2. Add your database URL:
   ```env
   DATABASE_URL="postgresql://username:password@ep-xxxxx.us-east-2.aws.neon.tech/dbname?sslmode=require"
   ```
3. **Important**: Add `.env` to your `.gitignore` file to keep credentials safe
4. For Vercel deployment, you'll need to add this as an environment variable in the Vercel dashboard (see Step 8)

---

## Step 3: Install Dependencies

Install Prisma and the Prisma Client:

```bash
npm install @prisma/client
npm install -D prisma
```

Or with pnpm (recommended for this project):
```bash
pnpm add @prisma/client
pnpm add -D prisma
```

---

## Step 4: Configure Prisma

1. Initialize Prisma (if not already done):
   ```bash
   npx prisma init
   ```

2. Your `prisma/schema.prisma` should look like this:

   ```prisma
   generator client {
     provider = "prisma-client-js"
   }

   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }

   // Your models go here...
   ```

3. **Critical**: Ensure your schema includes all necessary models. Refer to your current `prisma/schema.prisma` for the complete schema.

---

## Step 5: Push Schema to Database

1. **Generate Prisma Client**:
   ```bash
   npx prisma generate
   ```

2. **Push schema to database** (creates tables):
   ```bash
   npx prisma db push
   ```

   ⚠️ **Note**: `db push` is for development. For production, use migrations:
   ```bash
   npx prisma migrate dev --name init
   ```

3. Verify tables were created:
   ```bash
   npx prisma studio
   ```
   This opens a visual database browser at `http://localhost:5555`

---

## Step 6: Set Up Seed Script

1. Create `prisma/seed.js` (or `seed.ts` if using TypeScript):

   ```javascript
   const { PrismaClient } = require('@prisma/client');
   const prisma = new PrismaClient();

   async function main() {
     console.log('Start seeding...');
     
     // Your seed data here
     // Example: await prisma.service.create({ data: {...} });
     
     console.log('Seeding finished.');
   }

   main()
     .catch((e) => {
       console.error(e);
       process.exit(1);
     })
     .finally(async () => {
       await prisma.$disconnect();
     });
   ```

2. **Configure `package.json`** to include the seed command:

   ```json
   {
     "prisma": {
       "seed": "node prisma/seed.js"
     }
   }
   ```

3. **Run the seed script**:
   ```bash
   npx prisma db seed
   ```

   ✅ This populates your database with initial data (services, etc.)

---

## Step 7: Configure Build Script

**Critical for Vercel Deployment**: Update your `package.json` build script to generate Prisma Client before building:

```json
{
  "scripts": {
    "build": "prisma generate && next build",
    "dev": "next dev",
    "start": "next start"
  }
}
```

This ensures Prisma Client is generated during the build process on Vercel.

---

## Step 8: Deploy to Vercel

1. Push your code to GitHub/GitLab/Bitbucket
2. In Vercel Dashboard:
   - Go to your project settings
   - Navigate to **Environment Variables**
   - Add `DATABASE_URL` with your Neon connection string
   - Make sure it's set for **Production**, **Preview**, and **Development**
3. Deploy your project
4. Vercel will automatically run `prisma generate` during build (thanks to Step 7)

---

## Common Issues & Solutions

### Issue 1: "Prisma Client not generated" error on Vercel

**Solution**: Ensure your `package.json` build script includes `prisma generate`:
```json
"build": "prisma generate && next build"
```

### Issue 2: "Environment variable not found"

**Solution**: 
- Check `.env` file exists locally
- Verify `DATABASE_URL` is set in Vercel environment variables
- Restart your dev server after adding `.env` variables

### Issue 3: "Cannot find module '@prisma/client'"

**Solution**: 
```bash
npx prisma generate
```
This regenerates the Prisma Client after schema changes.

### Issue 4: "Table does not exist" error

**Solution**: 
```bash
npx prisma db push
```
Or if using migrations:
```bash
npx prisma migrate deploy
```

### Issue 5: Schema changes not reflected

**Solution**: 
1. Update `prisma/schema.prisma`
2. Run `npx prisma db push` (dev) or `npx prisma migrate dev` (production)
3. Run `npx prisma generate` to update the client

### Issue 6: Accidentally deleted data

**Solution**: Use the seed script to restore:
```bash
npx prisma db seed
```

⚠️ **Warning**: The seed script will delete existing data in the seeded tables. Always backup important data before running seed scripts.

---

## Recovery Procedures

### Restoring Services After Accidental Deletion

If you accidentally run `DELETE FROM "Service";` or similar:

1. **Don't panic** - your seed script has you covered
2. Run the seed command:
   ```bash
   npx prisma db seed
   ```
3. Verify in Prisma Studio:
   ```bash
   npx prisma studio
   ```

### Resetting the Entire Database

⚠️ **Warning**: This will delete ALL data. Use with caution.

1. In Neon Console, go to your project
2. Click **"Settings"** → **"Delete Project"** (or create a new branch)
3. Or use Prisma to reset:
   ```bash
   npx prisma migrate reset
   ```
   This will:
   - Drop the database
   - Create a new database
   - Apply all migrations
   - Run the seed script

### Backing Up Data

1. **Using Neon Console**:
   - Go to your project
   - Click **"Branches"**
   - Create a branch (this is a snapshot)
   - Or use **"Backup"** feature if available

2. **Using Prisma Studio**:
   - Export data manually from Prisma Studio
   - Or use `pg_dump` for full database backup

---

## Best Practices

### 1. Always Generate Prisma Client After Schema Changes

```bash
npx prisma generate
```

### 2. Use Migrations for Production

Instead of `db push`, use migrations:
```bash
npx prisma migrate dev --name descriptive_name
```

### 3. Keep Seed Scripts Idempotent

Your seed script should handle re-running safely:
```javascript
// Check if data exists before creating
const existing = await prisma.service.findFirst();
if (!existing) {
  // Create data
}
```

### 4. Never Commit `.env` Files

Ensure `.gitignore` includes:
```
.env
.env.local
.env*.local
```

### 5. Use Connection Pooling for Production

Neon provides connection pooling. Use the pooled connection string:
```
postgresql://username:password@ep-xxxxx-pooler.us-east-2.aws.neon.tech/dbname?sslmode=require
```

### 6. Regular Backups

- Set up automated backups in Neon Console
- Or create database branches as snapshots
- Export critical data regularly

### 7. Test Seed Script Locally First

Always test your seed script locally before running in production:
```bash
npx prisma db seed
```

### 8. Document Schema Changes

When modifying the schema:
1. Update `prisma/schema.prisma`
2. Create a migration with a descriptive name
3. Update seed script if needed
4. Test locally before deploying

---

## Quick Reference Commands

```bash
# Generate Prisma Client
npx prisma generate

# Push schema changes (dev)
npx prisma db push

# Create migration (production)
npx prisma migrate dev --name migration_name

# Run seed script
npx prisma db seed

# Open Prisma Studio (visual database browser)
npx prisma studio

# Reset database (⚠️ deletes all data)
npx prisma migrate reset

# Format schema file
npx prisma format

# Validate schema
npx prisma validate
```

---

## Troubleshooting Checklist

If something isn't working:

- [ ] Is `DATABASE_URL` set correctly in `.env`?
- [ ] Is `DATABASE_URL` set in Vercel environment variables?
- [ ] Have you run `npx prisma generate` after schema changes?
- [ ] Have you run `npx prisma db push` or migrations?
- [ ] Is the build script configured correctly in `package.json`?
- [ ] Are all dependencies installed (`@prisma/client`, `prisma`)?
- [ ] Is the seed script configured in `package.json`?
- [ ] Have you restarted your dev server after changes?

---

## Additional Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [Neon Documentation](https://neon.tech/docs)
- [Next.js with Prisma](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-vercel)
- [Prisma Migrate Guide](https://www.prisma.io/docs/guides/migrate)

---

## Summary

The key steps to remember:

1. ✅ Create Neon database and get connection string
2. ✅ Set `DATABASE_URL` in `.env` and Vercel
3. ✅ Configure `package.json` with seed script and build command
4. ✅ Run `npx prisma generate` after schema changes
5. ✅ Run `npx prisma db push` to create tables
6. ✅ Run `npx prisma db seed` to populate initial data
7. ✅ Always include `prisma generate` in build script for Vercel

Following this guide should prevent the issues we encountered today. If you run into problems, refer to the [Common Issues & Solutions](#common-issues--solutions) section above.


