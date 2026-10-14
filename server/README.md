# Travels Cab & Travel Booking System — Server

Backend foundation for the Travels Cab & Travel Booking Management System.

## Stack

- Node.js
- Express
- MongoDB / Mongoose
- JWT
- bcryptjs
- CORS
- dotenv

## Structure

- `config/` — database and configuration
- `controllers/` — request/business controllers
- `middleware/` — authentication, authorization and error middleware
- `models/` — MongoDB models
- `routes/` — REST API routes
- `services/` — reusable business services such as fare calculation
- `utils/` — utility functions
- `server.js` — application entry point

## Setup

```bash
npm install
```

Copy `.env.example` to `.env` and configure `MONGO_URI` and `JWT_SECRET`.

Run development server:

```bash
npm run dev
```

Run production server:

```bash
npm start
```
