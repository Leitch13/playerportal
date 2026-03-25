# Player Portal — Deployment Guide

## Prerequisites
- Vercel account
- Supabase project
- Stripe account
- Resend account (for emails)
- Custom domain (optional)

## Step 1: Deploy to Vercel

1. Push your code to GitHub
2. Go to vercel.com → New Project → Import your repo
3. Framework: Next.js (auto-detected)
4. Add environment variables (see .env.example)
5. Deploy

## Step 2: Environment Variables

Set these in Vercel → Settings → Environment Variables:

| Variable | Where to find it |
|----------|-----------------|
| NEXT_PUBLIC_SUPABASE_URL | Supabase Dashboard → Settings → API |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase Dashboard → Settings → API |
| SUPABASE_SERVICE_ROLE_KEY | Supabase Dashboard → Settings → API (service_role key) |
| STRIPE_SECRET_KEY | Stripe Dashboard → Developers → API Keys |
| STRIPE_WEBHOOK_SECRET | Stripe Dashboard → Developers → Webhooks |
| NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY | Stripe Dashboard → Developers → API Keys |
| RESEND_API_KEY | Resend Dashboard → API Keys |
| FROM_EMAIL | Your verified sending domain email |
| NEXT_PUBLIC_APP_URL | Your deployed URL (e.g. https://playerportal.app) |
| CRON_SECRET | Generate: openssl rand -hex 32 |

## Step 3: Stripe Webhook

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-domain.com/api/stripe/webhooks`
3. Select events:
   - checkout.session.completed
   - invoice.payment_succeeded
   - invoice.payment_failed
   - customer.subscription.deleted
   - customer.subscription.updated
4. Copy the signing secret → set as STRIPE_WEBHOOK_SECRET

## Step 4: Cron Jobs

Cron jobs are configured in vercel.json and run automatically:
- Payment reminders: Daily 9am
- Session reminders: Daily 5pm
- Post-session follow-ups: Daily 9pm
- Trial follow-ups: Daily 10am
- Subscription expiring: Weekly Monday 9am
- Win-back emails: Daily 11am
- Progress reports: Daily 8pm
- Upsell emails: Daily 10am

All crons authenticate via CRON_SECRET header.

## Step 5: Email Setup (Resend)

1. Sign up at resend.com
2. Add and verify your sending domain
3. Create API key → set as RESEND_API_KEY
4. Set FROM_EMAIL to your verified domain email

## Step 6: Custom Domain (Optional)

1. In Vercel → Settings → Domains
2. Add your domain (e.g. playerportal.app)
3. Update DNS records as instructed
4. Update NEXT_PUBLIC_APP_URL env var

## Database Migrations

Run all SQL migrations in order in Supabase SQL Editor:
- schema.sql (base tables)
- 004-011 (enhanced features)
- 012-021 (advanced features)

## Post-Deploy Checklist

- [ ] Visit landing page — verify it loads
- [ ] Test signup flow — create a test account
- [ ] Test Stripe checkout — make a test payment
- [ ] Verify webhook — check Stripe webhook logs
- [ ] Test email — trigger a test email
- [ ] Check cron jobs — verify in Vercel dashboard
- [ ] Test mobile — open on phone, check PWA install prompt
- [ ] Share a class link — verify public booking page
