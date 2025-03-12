# USCIS Visa Tracker App

A web application for tracking I-129F (K-1 Visa) application status using the USCIS API.

## Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- npm (v6 or higher)

### Backend Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file in the project root (or use the provided one)
4. Start the server:
   ```
   npm start
   ```
   For development with auto-restart:
   ```
   npm run dev
   ```

### Frontend Setup

The frontend is served by the Node.js backend. The HTML/CSS/JavaScript files should be placed in the `public` folder.

1. Create a `public` folder in the project root
2. Copy the HTML file into `public/index.html`
3. Start the server as described above

## API Endpoints

### Get Case Status
```
GET /api/case-status/:receiptNumber
```

Parameters:
- `receiptNumber`: USCIS receipt number (e.g., EAC9999103403)

Response:
```json
{
  "receiptNumber": "EAC9999103403",
  "status": "Case Is Being Actively Reviewed",
  "statusDescription": "Your case is currently undergoing review...",
  "formType": "I-129F",
  "applicationTypeCode": "K1",
  "applicationType": "Petition for Alien Fiancé(e)",
  "receivedDate": "2024-10-18",
  "lastUpdatedDate": "2025-03-05",
  "estimatedCompletionTimeframe": "7-9 months",
  "serviceCenter": "Vermont Service Center",
  "queuePosition": {
    "position": 12465,
    "totalInQueue": 37892
  },
  "caseHistory": [
    {
      "date": "2024-10-18",
      "status": "Case Received",
      "description": "We received your Form I-129F..."
    },
    // Additional history items
  ]
}
```

## Environment Variables

- `PORT`: Server port (default: 3000)
- `USCIS_CLIENT_ID`: USCIS API client ID
- `USCIS_CLIENT_SECRET`: USCIS API client secret

## Project Structure

```
visa-tracker-app/
├── .env                 # Environment variables
├── server.js            # Node.js backend
├── package.json         # Project dependencies
├── public/              # Frontend files
│   └── index.html       # Main HTML page
└── README.md            # Project documentation
```

## USCIS API Integration

This application integrates with the USCIS API to retrieve visa application status information. The backend server handles authentication and proxies requests to avoid CORS issues.

## Security Considerations

- The app uses environment variables to store sensitive API credentials
- HTTPS should be implemented in production
- Input validation is performed on both client and server side