// server.js - Node.js Express Backend for USCIS API
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// USCIS API Configuration
const USCIS_TOKEN_URL = 'https://api-int.uscis.gov/oauth/accesstoken';
const USCIS_CASE_STATUS_URL = 'https://api-int.uscis.gov/case-status';
const CLIENT_ID = process.env.USCIS_CLIENT_ID || 'Hp28qmiyWSseAe4WMUTqROst2aMho9gl';
const CLIENT_SECRET = process.env.USCIS_CLIENT_SECRET || '84rAIeVYR0oZjmkk';

// Token cache
let tokenCache = {
  token: null,
  expiry: 0
};

// Get access token from USCIS
async function getAccessToken() {
  // Check if we have a valid cached token
  const now = Date.now();
  if (tokenCache.token && tokenCache.expiry > now) {
    console.log('Using cached token');
    return tokenCache.token;
  }

  try {
    console.log('--------- TOKEN REQUEST ---------');
    console.log(`Requesting new access token from: ${USCIS_TOKEN_URL}`);
    console.log(`Using client ID: ${CLIENT_ID}`);
    console.log(`Using client secret: ${CLIENT_SECRET.substring(0, 3)}...${CLIENT_SECRET.substring(CLIENT_SECRET.length - 3)}`);
    
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', CLIENT_ID);
    params.append('client_secret', CLIENT_SECRET);

    const response = await axios.post(USCIS_TOKEN_URL, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    console.log('TOKEN RESPONSE:');
    console.log(`Status code: ${response.status}`);
    console.log(`Access token received: ${response.data.access_token ? response.data.access_token.substring(0, 10) + '...' : 'NONE'}`);
    console.log(`Token type: ${response.data.token_type}`);
    console.log(`Expires in: ${response.data.expires_in} seconds`);
    console.log('--------- END TOKEN REQUEST ---------');

    // Cache the token with expiry (subtract 60 seconds for safety margin)
    const expiresIn = (response.data.expires_in || 3600) * 1000;
    tokenCache = {
      token: response.data.access_token,
      expiry: now + expiresIn - 60000
    };

    return tokenCache.token;
  } catch (error) {
    console.error('--------- TOKEN ERROR ---------');
    console.error(`URL attempted: ${USCIS_TOKEN_URL}`);
    console.error(`Status code: ${error.response?.status || 'No status code'}`);
    console.error(`Error data: ${JSON.stringify(error.response?.data || {})}`);
    console.error(`Error message: ${error.message}`);
    console.error('--------- END TOKEN ERROR ---------');
    throw new Error('Failed to obtain access token');
  }
}

/**
 * Process the raw API response to normalize format
 * @param {Object} apiResponse - Raw USCIS API response 
 * @returns {Object} - Normalized response
 */
function processApiResponse(apiResponse) {
  // Check if the response already has our expected format
  if (apiResponse.case_status) {
    return apiResponse;
  }
  
  // Handle raw USCIS API format and transform to our expected format
  // This is a safeguard in case the API format changes
  try {
    // Create a standardized response
    return {
      case_status: {
        receiptNumber: apiResponse.receiptNumber || apiResponse.receipt_number,
        formType: apiResponse.formType || apiResponse.form_type || apiResponse.applicationTypeCode,
        submittedDate: apiResponse.receivedDate || apiResponse.received_date || apiResponse.createdDate,
        modifiedDate: apiResponse.lastUpdatedDate || apiResponse.last_updated_date || apiResponse.updatedDate,
        current_case_status_text_en: apiResponse.status || apiResponse.case_status,
        current_case_status_desc_en: apiResponse.statusDescription || apiResponse.status_description,
        // Create history from caseHistory format if available
        hist_case_status: Array.isArray(apiResponse.caseHistory) ? 
          apiResponse.caseHistory.map(history => ({
            date: history.date,
            completed_text_en: history.description || history.status_description
          })) : []
      }
    };
  } catch (error) {
    console.error('Error processing API response:', error);
    // Return the original response if processing fails
    return apiResponse;
  }
}

// API route to get case status
app.get('/api/case-status/:receiptNumber', async (req, res) => {
  try {
    const { receiptNumber } = req.params;
    console.log('--------- CASE STATUS REQUEST ---------');
    console.log(`Processing request for receipt number: ${receiptNumber}`);

    // Validate receipt number format (basic validation)
    const receiptPattern = /^[A-Z]{3}[0-9]{10}$/;
    if (!receiptPattern.test(receiptNumber)) {
      console.log(`Invalid receipt number format: ${receiptNumber}`);
      return res.status(400).json({ 
        error: 'Invalid receipt number format',
        message: 'Receipt number should be in the format: XXX0000000000'
      });
    }

    // Get access token
    console.log('Getting access token...');
    const token = await getAccessToken();
    console.log(`Token received, first 10 chars: ${token.substring(0, 10)}...`);

    // Call USCIS API for case status
    const caseStatusUrl = `${USCIS_CASE_STATUS_URL}/${receiptNumber}`;
    console.log(`Making request to: ${caseStatusUrl}`);
    console.log('Request headers:');
    console.log(`- Authorization: Bearer ${token.substring(0, 10)}...`);
    console.log(`- Content-Type: application/json`);

    const response = await axios.get(caseStatusUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('CASE STATUS RESPONSE:');
    console.log(`Status code: ${response.status}`);
    console.log(`Response data: ${JSON.stringify(response.data, null, 2)}`);
    console.log('--------- END CASE STATUS REQUEST ---------');

    // Process the API response to standardize format
    const processedResponse = processApiResponse(response.data);

    // Return processed case status
    return res.json(processedResponse);
  } catch (error) {
    console.error('--------- CASE STATUS ERROR ---------');
    console.error(`Receipt number attempted: ${req.params.receiptNumber}`);
    console.error(`Status code: ${error.response?.status || 'No status code'}`);
    console.error(`Error data: ${JSON.stringify(error.response?.data || {})}`);
    console.error(`Error message: ${error.message}`);
    console.error('--------- END CASE STATUS ERROR ---------');
    
    // Return appropriate error message
    if (error.response?.status === 404) {
      return res.status(404).json({ 
        error: 'Case not found',
        message: 'The receipt number you provided was not found in the USCIS system'
      });
    }
    
    return res.status(500).json({ 
      error: 'Service error',
      message: 'An error occurred while fetching case status'
    });
  }
});

// Debug route to check API connection
app.get('/api/test-connection', async (req, res) => {
  try {
    console.log('--------- TEST CONNECTION ---------');
    console.log('Testing connection to USCIS API...');
    
    // Try to get a token
    const token = await getAccessToken();
    
    // Use sample receipt number to test case status endpoint
    const testReceiptNumber = 'EAC9999103403';
    console.log(`Testing case status with receipt number: ${testReceiptNumber}`);
    
    try {
      const caseStatusUrl = `${USCIS_CASE_STATUS_URL}/${testReceiptNumber}`;
      const response = await axios.get(caseStatusUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      // If we get here, the endpoint is working
      console.log('Case status endpoint is working!');
      console.log(`Status code: ${response.status}`);
      
      res.json({
        success: true,
        message: 'Successfully connected to USCIS API',
        tokenStatus: 'Valid token obtained',
        caseStatusEndpoint: 'Working correctly',
        statusCode: response.status
      });
    } catch (caseError) {
      // Even if we get an error from the case endpoint, check if it's a 404
      // A 404 means the endpoint is working but the test case number isn't found
      if (caseError.response?.status === 404) {
        console.log('Case status endpoint is working (404 for test case is expected)');
        res.json({
          success: true,
          message: 'Successfully connected to USCIS API',
          tokenStatus: 'Valid token obtained',
          caseStatusEndpoint: 'Working correctly (test receipt not found)',
          statusCode: caseError.response.status
        });
      } else {
        throw caseError;
      }
    }
  } catch (error) {
    console.error('Test connection failed!');
    console.error(`Error: ${error.message}`);
    
    res.status(500).json({
      success: false,
      message: 'Failed to connect to USCIS API',
      error: error.message,
      statusCode: error.response?.status || 'Unknown',
      details: error.response?.data || {}
    });
  }
  console.log('--------- END TEST CONNECTION ---------');
});

// Fallback route for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});