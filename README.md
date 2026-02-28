# Sangian - Cognitive Assessment Platform 123

This project is based on the Kaufman Assessment Battery for Children – Second Edition (KABC-II). The goal is to digitally implement assessment components through interactive game-based modules, supported by a structured backend system for administration and reporting.

## Technology Stack

*   **Frontend:** React.js
*   **Backend:** Node.js (with Express.js)
*   **Database:** MySQL

## Application Structure

The project follows a structured full-stack architecture with separate folders for the client (frontend) and server (backend).

```
Sangian/
├── server/                # Node.js (Backend)
│   ├── src/
│   │   ├── config/        # Database connection
│   │   ├── controllers/   # Request/response logic
│   │   ├── routes/        # API routes
│   │   ├── models/        # Database models
│   │   └── middleware/    # Auth and other middleware
│   ├── app.js             # Express app configuration
│   ├── server.js          # Entry point
│   └── .env               # Environment variables
│
└── client/                # React (Frontend)
    ├── public/            # Static assets
    │   └── index.html
    └── src/
        ├── components/    # Reusable UI components
        ├── pages/         # Page-level components
        ├── services/      # API communication logic
        ├── App.js         # Main application routing
        └── index.js       # React entry point
```

## System Architecture

### 1. Backend (Admin Panel)

Managed by administrators to handle:
*   Child profile creation and management
*   Test assignment and monitoring
*   Score tracking and performance analysis
*   Report generation
*   Dashboard with overall statistics and insights

### 2. Frontend (Game Module for Children)

An interactive game-based assessment platform where:
*   Children log in and play cognitive assessment games.
*   Scores are automatically recorded and synced to the backend.

### Planned Game Modules

*   Atlantic
*   Number Recall
*   Rovers
*   Triangle
*   Auditory Attention
*   Working Memory
*   Cognitive Flexibility
*   Numeracy Test
*   Literacy Test

## Getting Started

*(Development instructions to be added)*
