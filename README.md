# Hookup/Dating Platform

A complete dating/hookup platform built with React, Node.js, Express, and Neon PostgreSQL.

## Features

### User Features
- User registration and login with JWT authentication
- Profile management with photo uploads
- Location-based user discovery
- Swipe (like/pass) system
- Real-time messaging with Socket.io
- Match system
- Premium membership with Stripe integration
- Online/offline status

### Admin Features
- User management (ban/unban)
- Report management
- Analytics dashboard
- Payment monitoring

### Safety Features
- Age verification (18+)
- Report system
- Admin moderation
- Email verification (can be added)

## Tech Stack

### Backend
- Node.js with Express
- Neon PostgreSQL (serverless Postgres)
- Socket.io for real-time features
- JWT for authentication
- Stripe for payments
- Cloudinary for image uploads

### Frontend
- React 18
- Tailwind CSS for styling
- Socket.io-client for real-time
- Axios for API calls

## Installation

### Prerequisites
- Node.js (v16 or higher)
- Neon PostgreSQL account
- Stripe account
- Cloudinary account

### Database Setup
1. Create a Neon PostgreSQL database
2. Run the `init.sql` script to create tables

### Environment Variables
Copy the `.env.example` files and fill in your credentials:

Backend `.env`: