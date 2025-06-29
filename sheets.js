// sheets.js - Google Sheets integration for Telegram Bot
const { google } = require('googleapis');
const { JWT } = require('google-auth-library');
const fs = require('fs');
const xlsx = require('xlsx');
const keys = JSON.parse(process.env.GOOGLE_CREDENTIALS);


const auth = new JWT({
  email: keys.client_email,
  key: keys.private_key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = '1XTeIkm9rl4weAi47kevgFA7QRwUyEghEdOjfMITIF_k';
const SHEET_NAME = 'Sheet1';

async function getAllBookings() {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:G`
    });
    return res.data.values || [];
  } catch (error) {
    console.error('Error fetching all bookings:', error);
    throw error;
  }
}

async function isSlotAvailable(date, time) {
  try {
    const bookings = await getAllBookings();
    const bookingsAtSlot = bookings.filter(row => row[4] === date && row[5] === time);
    return bookingsAtSlot.length < 3; // Assuming slot limit is 3
  } catch (error) {
    console.error('Error checking slot availability:', error);
    return false;
  }
}

async function getBookingsBySlot(date, time) {
  try {
    const bookings = await getAllBookings();
    return bookings.filter(row => row[4] === date && row[5] === time);
  } catch (error) {
    console.error('Error fetching bookings by slot:', error);
    return [];
  }
}

async function hasUserBooked(userId) {
  try {
    const bookings = await getAllBookings();
    return bookings.some(row => row[0] === userId);
  } catch (error) {
    console.error('Error checking if user has booked:', error);
    return false;
  }
}

async function getUserBooking(userId) {
  try {
    const bookings = await getAllBookings();
    return bookings.find(row => row[0] === userId);
  } catch (error) {
    console.error('Error fetching user booking:', error);
    return null;
  }
}

async function appendBooking(userId, name, age, gender, date, time, test) {
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1:G1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[userId, name, age, gender, date, time, test]]
      }
    });
    console.log(`Booking added for user ${userId}: ${name} - ${test} on ${date} at ${time}`);
  } catch (error) {
    console.error('Error appending booking:', error);
    throw error;
  }
}

async function exportBookingsToExcel() {
  try {
    const bookings = await getAllBookings();
    const headers = ['User ID', 'Name', 'Age', 'Gender', 'Date', 'Time', 'Test'];
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.aoa_to_sheet([headers, ...bookings]);
    xlsx.utils.book_append_sheet(wb, ws, 'Bookings');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = `./bookings_export_${timestamp}.xlsx`;
    xlsx.writeFile(wb, filePath);
    
    console.log(`Bookings exported to ${filePath}`);
    return filePath;
  } catch (error) {
    console.error('Error exporting bookings to Excel:', error);
    throw error;
  }
}

async function cancelUserBooking(userId) {
  try {
    const bookings = await getAllBookings();
    const index = bookings.findIndex(row => row[0] === userId);
    
    if (index === -1) {
      console.log(`No booking found for user ${userId}`);
      return false;
    }

    // Fetch the entire sheet data
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:G`
    });

    // Remove the entry from the in-memory list
    const updated = res.data.values || [];
    const cancelledBooking = updated.splice(index, 1)[0];

    // Clear the sheet data (excluding header)
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:G`
    });

    // Rewrite the updated list if there are remaining bookings
    if (updated.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A2`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: updated }
      });
    }

    console.log(`Booking cancelled for user ${userId}: ${cancelledBooking[1]} - ${cancelledBooking[6]} on ${cancelledBooking[4]}`);
    return true;
  } catch (error) {
    console.error('Error cancelling user booking:', error);
    return false;
  }
}

async function getAllBookingsForToday(date) {
  try {
    const bookings = await getAllBookings();
    const todayBookings = bookings.filter(row => row[4] === date);
    console.log(`Found ${todayBookings.length} bookings for ${date}`);
    return todayBookings;
  } catch (error) {
    console.error('Error fetching bookings for today:', error);
    return [];
  }
}

// Additional helper functions for Telegram bot

async function getBookingStats() {
  try {
    const bookings = await getAllBookings();
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    const todayBookings = bookings.filter(row => row[4] === today);
    const tomorrowBookings = bookings.filter(row => row[4] === tomorrowStr);
    
    return {
      total: bookings.length,
      today: todayBookings.length,
      tomorrow: tomorrowBookings.length
    };
  } catch (error) {
    console.error('Error fetching booking stats:', error);
    return { total: 0, today: 0, tomorrow: 0 };
  }
}

async function getSlotAvailability(date) {
  try {
    const timeSlots = ['9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM'];
    const slotLimit = 3;
    const availability = {};
    
    for (const slot of timeSlots) {
      const bookingsAtSlot = await getBookingsBySlot(date, slot);
      availability[slot] = {
        booked: bookingsAtSlot.length,
        available: slotLimit - bookingsAtSlot.length,
        isFull: bookingsAtSlot.length >= slotLimit
      };
    }
    
    return availability;
  } catch (error) {
    console.error('Error fetching slot availability:', error);
    return {};
  }
}

// Initialize Google Sheets (create header if not exists)
async function initializeSheet() {
  try {
    // Check if the sheet has headers
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1:G1`
    });
    
    if (!res.data.values || res.data.values.length === 0) {
      // Add headers if they don't exist
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A1:G1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [['User ID', 'Name', 'Age', 'Gender', 'Date', 'Time', 'Test']]
        }
      });
      console.log('Sheet headers initialized');
    } else {
      console.log('Sheet headers already exist');
    }
  } catch (error) {
    console.error('Error initializing sheet:', error);
  }
}

// Call initialization when module is loaded
initializeSheet();

module.exports = {
  appendBooking,
  isSlotAvailable,
  hasUserBooked,
  getUserBooking,
  getAllBookings,
  getBookingsBySlot,
  exportBookingsToExcel,
  cancelUserBooking,
  getAllBookingsForToday,
  getBookingStats,
  getSlotAvailability,
  initializeSheet
};