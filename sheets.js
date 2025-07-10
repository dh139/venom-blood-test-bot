// Enhanced Google Sheets integration with advanced features
const { google } = require("googleapis")
const { JWT } = require("google-auth-library")
const fs = require("fs")
const xlsx = require("xlsx")
require('dotenv').config();
function parseCredentials() {
  try {
    const base64 = process.env.GOOGLE_CREDENTIALS;
    if (!base64) {
      throw new Error("GOOGLE_CREDENTIALS_BASE64 environment variable is not set");
    }

    const jsonString = Buffer.from(base64, 'base64').toString('utf8');
    const keys = JSON.parse(jsonString);

    // Handle multiline private key
    if (keys.private_key) {
      keys.private_key = keys.private_key.replace(/\\n/g, "\n");
    }

    const requiredFields = ["client_email", "private_key", "project_id"];
    for (const field of requiredFields) {
      if (!keys[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    console.log("✅ Credentials parsed successfully");
    return keys;

  } catch (error) {
    console.error("❌ Error parsing GOOGLE_CREDENTIALS_BASE64:", error.message);
    throw error;
  }
}

const keys = parseCredentials()
const auth = new JWT({
  email: keys.client_email,
  key: keys.private_key,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
})

const sheets = google.sheets({ version: "v4", auth })
const SPREADSHEET_ID = "1XTeIkm9rl4weAi47kevgFA7QRwUyEghEdOjfMITIF_k"

// Use existing sheet structure but with enhanced data
const MAIN_SHEET = "Sheet1"

// In-memory storage for enhanced features (fallback when sheets don't exist)
const userPreferencesCache = {}
const waitingListCache = []
const feedbackCache = []
const healthTipsCache = [
  "Drink at least 8 glasses of water daily for optimal health.",
  "Regular exercise for 30 minutes can significantly improve your cardiovascular health.",
  "A balanced diet rich in fruits and vegetables boosts your immune system.",
  "Getting 7-8 hours of quality sleep is essential for your body's recovery.",
  "Regular health check-ups can help detect issues early.",
  "Limit processed foods and choose whole grains for better nutrition.",
  "Practice stress management techniques like meditation or deep breathing.",
  "Maintain good hygiene to prevent infections and illnesses.",
  "Stay up to date with vaccinations and preventive care.",
  "Avoid smoking and limit alcohol consumption for better health.",
]

// Enhanced booking functions
async function getAllBookings() {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${MAIN_SHEET}!A2:I`,
    })
    return res.data.values || []
  } catch (error) {
    console.error("Error fetching all bookings:", error)
    return []
  }
}

async function appendBooking(userId, name, age, gender, date, time, test, status = "confirmed") {
  try {
    const timestamp = new Date().toISOString()
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${MAIN_SHEET}!A1:I1`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[userId, name, age, gender, date, time, test, status, timestamp]],
      },
    })
    console.log(`✅ Booking added for user ${userId}: ${name} - ${test} on ${date} at ${time}`)
  } catch (error) {
    console.error("❌ Error appending booking:", error)
    throw error
  }
}

async function isSlotAvailable(date, time) {
  try {
    const bookings = await getAllBookings()
    const bookingsAtSlot = bookings.filter((row) => row[4] === date && row[5] === time && row[7] !== "cancelled")
    return bookingsAtSlot.length < 3
  } catch (error) {
    console.error("Error checking slot availability:", error)
    return false
  }
}

async function getBookingsBySlot(date, time) {
  try {
    const bookings = await getAllBookings()
    return bookings.filter((row) => row[4] === date && row[5] === time && row[7] !== "cancelled")
  } catch (error) {
    console.error("Error fetching bookings by slot:", error)
    return []
  }
}

async function hasUserBooked(userId) {
  try {
    const bookings = await getAllBookings()
    return bookings.some((row) => row[0] === userId && row[7] !== "cancelled")
  } catch (error) {
    console.error("Error checking if user has booked:", error)
    return false
  }
}

async function getUserBooking(userId) {
  try {
    const bookings = await getAllBookings()
    return bookings.find((row) => row[0] === userId && row[7] !== "cancelled")
  } catch (error) {
    console.error("Error fetching user booking:", error)
    return null
  }
}

async function getAllBookingsForToday(date) {
  try {
    const bookings = await getAllBookings()
    const todayBookings = bookings.filter((row) => row[4] === date && row[7] !== "cancelled")
    console.log(`📅 Found ${todayBookings.length} bookings for ${date}`)
    return todayBookings
  } catch (error) {
    console.error("Error fetching bookings for today:", error)
    return []
  }
}

async function cancelUserBooking(userId) {
  try {
    const bookings = await getAllBookings()
    const index = bookings.findIndex((row) => row[0] === userId && row[7] !== "cancelled")

    if (index === -1) {
      console.log(`❌ No booking found for user ${userId}`)
      return false
    }

    // Update the booking status to cancelled
    const rowNumber = index + 2 // +2 because array is 0-indexed and sheet starts from row 2
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${MAIN_SHEET}!H${rowNumber}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [["cancelled"]],
      },
    })

    const cancelledBooking = bookings[index]
    console.log(
      `✅ Booking cancelled for user ${userId}: ${cancelledBooking[1]} - ${cancelledBooking[6]} on ${cancelledBooking[4]}`,
    )
    return true
  } catch (error) {
    console.error("❌ Error cancelling user booking:", error)
    return false
  }
}

// User preferences management (using cache as fallback)
async function updateUserPreferences(userId, preferences) {
  try {
    userPreferencesCache[userId] = { ...userPreferencesCache[userId], ...preferences }
    console.log(`✅ Updated preferences for user ${userId}`)
  } catch (error) {
    console.error("Error updating user preferences:", error)
  }
}

async function getUserPreferences(userId) {
  try {
    return userPreferencesCache[userId] || {}
  } catch (error) {
    console.error("Error getting user preferences:", error)
    return {}
  }
}

// Waiting list management (using cache)
async function addToWaitingList(userId, name, date, time, test) {
  try {
    const timestamp = new Date().toISOString()
    waitingListCache.push({ userId, name, date, time, test, timestamp })
    console.log(`✅ Added to waiting list: ${userId} for ${test} on ${date} at ${time}`)
  } catch (error) {
    console.error("Error adding to waiting list:", error)
    throw error
  }
}

async function getWaitingList(date = null, time = null) {
  try {
    let waitingList = [...waitingListCache]

    if (date && time) {
      waitingList = waitingList.filter((item) => item.date === date && item.time === time)
    }

    return waitingList
  } catch (error) {
    console.error("Error fetching waiting list:", error)
    return []
  }
}

async function removeFromWaitingList(userId, date, time) {
  try {
    const index = waitingListCache.findIndex(
      (item) => item.userId === userId && item.date === date && item.time === time,
    )

    if (index === -1) return false

    waitingListCache.splice(index, 1)
    console.log(`✅ Removed from waiting list: ${userId}`)
    return true
  } catch (error) {
    console.error("Error removing from waiting list:", error)
    return false
  }
}

// Feedback system (save to both cache and Google Sheets)
async function addFeedback(userId, type, rating, message) {
  try {
    const timestamp = new Date().toISOString()

    // Add to cache (for immediate access)
    feedbackCache.push({ userId, type, rating, message, timestamp })

    // Add to Google Sheets
    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: "Feedback!A1:E1",
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [[userId, type, rating || "", message, timestamp]],
        },
      })
      console.log(`✅ Feedback saved to Google Sheets: ${userId} - ${type} - ${rating || "no rating"}`)
    } catch (sheetsError) {
      console.error("❌ Error saving feedback to Google Sheets:", sheetsError)
      // Continue with cache-only operation
    }

    console.log(`✅ Feedback added: ${userId} - ${type} - ${rating || "no rating"}`)
  } catch (error) {
    console.error("Error adding feedback:", error)
    throw error
  }
}

async function getAllFeedback() {
  try {
    // Try to get feedback from Google Sheets first
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Feedback!A2:E",
    })

    if (res.data.values && res.data.values.length > 0) {
      const sheetsFeedback = res.data.values.map((row) => ({
        userId: row[0],
        type: row[1],
        rating: row[2],
        message: row[3],
        timestamp: row[4],
      }))

      // Merge with cache (remove duplicates)
      const allFeedback = [...sheetsFeedback]
      feedbackCache.forEach((cacheFeedback) => {
        const exists = sheetsFeedback.some(
          (sheetFeedback) =>
            sheetFeedback.userId === cacheFeedback.userId && sheetFeedback.timestamp === cacheFeedback.timestamp,
        )
        if (!exists) {
          allFeedback.push(cacheFeedback)
        }
      })

      console.log(
        `📊 Retrieved ${allFeedback.length} feedback entries (${sheetsFeedback.length} from sheets, ${feedbackCache.length} from cache)`,
      )
      return allFeedback
    }
  } catch (error) {
    console.error("Error fetching feedback from Google Sheets:", error)
  }

  // Fallback to cache
  return [...feedbackCache]
}

// Health tips management
async function addHealthTip(tip) {
  try {
    healthTipsCache.push(tip)
    console.log(`✅ Health tip added: ${tip.substring(0, 50)}...`)
  } catch (error) {
    console.error("Error adding health tip:", error)
    throw error
  }
}

async function getHealthTips() {
  try {
    return [...healthTipsCache]
  } catch (error) {
    console.error("Error fetching health tips:", error)
    return healthTipsCache
  }
}

// Analytics and reporting
async function getAnalytics() {
  try {
    const bookings = await getAllBookings()
    const waitingList = await getWaitingList()
    const feedback = await getAllFeedback()

    const today = new Date().toISOString().split("T")[0]
    const todayBookings = bookings.filter((row) => row[4] === today && row[7] !== "cancelled")

    const testCounts = {}
    bookings.forEach((booking) => {
      if (booking[7] !== "cancelled") {
        const test = booking[6]
        testCounts[test] = (testCounts[test] || 0) + 1
      }
    })

    return {
      totalBookings: bookings.filter((row) => row[7] !== "cancelled").length,
      todayAppointments: todayBookings.length,
      waitingList: waitingList.length,
      feedbackCount: feedback.length,
      popularTests: testCounts,
      averageRating: calculateAverageRating(feedback),
    }
  } catch (error) {
    console.error("Error getting analytics:", error)
    return {
      totalBookings: 0,
      todayAppointments: 0,
      waitingList: 0,
      feedbackCount: 0,
      popularTests: {},
      averageRating: 0,
    }
  }
}

function calculateAverageRating(feedback) {
  const ratings = feedback
    .filter((item) => item.rating && !isNaN(item.rating))
    .map((item) => Number.parseInt(item.rating))

  if (ratings.length === 0) return 0

  const sum = ratings.reduce((acc, rating) => acc + rating, 0)
  return (sum / ratings.length).toFixed(1)
}

// Enhanced booking management
async function updateBooking(userId, updates) {
  try {
    const bookings = await getAllBookings()
    const index = bookings.findIndex((row) => row[0] === userId && row[7] !== "cancelled")

    if (index === -1) return false

    const rowNumber = index + 2
    const booking = bookings[index]

    // Update specific fields
    if (updates.date) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${MAIN_SHEET}!E${rowNumber}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [[updates.date]] },
      })
    }

    if (updates.time) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${MAIN_SHEET}!F${rowNumber}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [[updates.time]] },
      })
    }

    if (updates.test) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${MAIN_SHEET}!G${rowNumber}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [[updates.test]] },
      })
    }

    console.log(`✅ Booking updated for user ${userId}`)
    return true
  } catch (error) {
    console.error("Error updating booking:", error)
    return false
  }
}

async function getBookingHistory(userId) {
  try {
    const bookings = await getAllBookings()
    return bookings.filter((row) => row[0] === userId)
  } catch (error) {
    console.error("Error fetching booking history:", error)
    return []
  }
}

// Export functionality
async function exportBookingsToExcel() {
  try {
    const bookings = await getAllBookings()
    const headers = ["User ID", "Name", "Age", "Gender", "Date", "Time", "Test", "Status", "Created"]
    const wb = xlsx.utils.book_new()
    const ws = xlsx.utils.aoa_to_sheet([headers, ...bookings])
    xlsx.utils.book_append_sheet(wb, ws, "Bookings")

    // Add feedback sheet
    const feedback = await getAllFeedback()
    if (feedback.length > 0) {
      const feedbackHeaders = ["User ID", "Type", "Rating", "Message", "Created"]
      const feedbackData = feedback.map((f) => [f.userId, f.type, f.rating, f.message, f.timestamp])
      const feedbackWs = xlsx.utils.aoa_to_sheet([feedbackHeaders, ...feedbackData])
      xlsx.utils.book_append_sheet(wb, feedbackWs, "Feedback")
    }

    // Add waiting list sheet
    const waitingList = await getWaitingList()
    if (waitingList.length > 0) {
      const waitingHeaders = ["User ID", "Name", "Date", "Time", "Test", "Created"]
      const waitingData = waitingList.map((w) => [w.userId, w.name, w.date, w.time, w.test, w.timestamp])
      const waitingWs = xlsx.utils.aoa_to_sheet([waitingHeaders, ...waitingData])
      xlsx.utils.book_append_sheet(wb, waitingWs, "WaitingList")
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const filePath = `./bookings_export_${timestamp}.xlsx`
    xlsx.writeFile(wb, filePath)

    console.log(`✅ Bookings exported to ${filePath}`)
    return filePath
  } catch (error) {
    console.error("Error exporting bookings to Excel:", error)
    throw error
  }
}

// Initialize feedback sheet
async function initializeFeedbackSheet() {
  try {
    // Try to get the feedback sheet
    const feedbackRes = await sheets.spreadsheets.values
      .get({
        spreadsheetId: SPREADSHEET_ID,
        range: "Feedback!A1:E1",
      })
      .catch(() => null)

    if (!feedbackRes || !feedbackRes.data.values || feedbackRes.data.values.length === 0) {
      // Create feedback sheet if it doesn't exist
      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: "Feedback",
                  },
                },
              },
            ],
          },
        })
        console.log("✅ Feedback sheet created")
      } catch (createError) {
        // Sheet might already exist, just add headers
        console.log("📝 Feedback sheet exists, adding headers")
      }

      // Add headers to feedback sheet
      const feedbackHeaders = ["User ID", "Type", "Rating", "Message", "Created"]
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: "Feedback!A1:E1",
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [feedbackHeaders],
        },
      })
      console.log("✅ Feedback sheet headers initialized")
    } else {
      console.log("✅ Feedback sheet headers already exist")
    }
  } catch (error) {
    console.error("❌ Error initializing feedback sheet:", error)
  }
}

// Initialize main sheet and feedback sheet
async function initializeAllSheets() {
  try {
    console.log("🔧 Initializing Google Sheets connection...")

    await auth.authorize()
    console.log("✅ Authentication successful")

    // Check if the main sheet has proper headers
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${MAIN_SHEET}!A1:I1`,
    })

    if (!res.data.values || res.data.values.length === 0) {
      // Add headers if they don't exist
      const headers = ["User ID", "Name", "Age", "Gender", "Date", "Time", "Test", "Status", "Created"]
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${MAIN_SHEET}!A1:I1`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [headers],
        },
      })
      console.log("✅ Main sheet headers initialized")
    } else {
      console.log("✅ Main sheet headers already exist")
    }

    // Initialize feedback sheet
    await initializeFeedbackSheet()

    console.log("🎉 Google Sheets initialized successfully")
  } catch (error) {
    console.error("❌ Error initializing sheets:", error)
    // Don't throw error, let the bot continue with cache-based features
  }
}

// Sync feedback cache to Google Sheets
async function syncFeedbackToSheets() {
  try {
    if (feedbackCache.length === 0) return

    const existingFeedback = await getAllFeedback()
    const newFeedback = feedbackCache.filter(
      (cacheFeedback) =>
        !existingFeedback.some(
          (existing) => existing.userId === cacheFeedback.userId && existing.timestamp === cacheFeedback.timestamp,
        ),
    )

    if (newFeedback.length > 0) {
      const values = newFeedback.map((feedback) => [
        feedback.userId,
        feedback.type,
        feedback.rating || "",
        feedback.message,
        feedback.timestamp,
      ])

      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: "Feedback!A1:E1",
        valueInputOption: "USER_ENTERED",
        requestBody: { values },
      })

      console.log(`✅ Synced ${newFeedback.length} feedback entries to Google Sheets`)
    }
  } catch (error) {
    console.error("❌ Error syncing feedback to Google Sheets:", error)
  }
}

// Export all functions
module.exports = {
  // Original functions
  appendBooking,
  isSlotAvailable,
  hasUserBooked,
  getUserBooking,
  getBookingsBySlot,
  getAllBookings,
  exportBookingsToExcel,
  cancelUserBooking,
  getAllBookingsForToday,

  // Enhanced functions
  updateUserPreferences,
  getUserPreferences,
  addToWaitingList,
  getWaitingList,
  removeFromWaitingList,
  addFeedback,
  getBookingHistory,
  updateBooking,
  getAnalytics,
  addHealthTip,
  getHealthTips,
  getAllFeedback,
  initializeAllSheets,
  syncFeedbackToSheets,
}

// Sync feedback to sheets every 5 minutes
setInterval(syncFeedbackToSheets, 5 * 60 * 1000)

// Initialize sheets on module load
initializeAllSheets().catch((error) => {
  console.error("Failed to initialize sheets:", error)
})
