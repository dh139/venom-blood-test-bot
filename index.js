// Enhanced Telegram Blood Test Bot with Keep-Alive Mechanism
const TelegramBot = require("node-telegram-bot-api")
const QRCode = require("qrcode")
const fs = require("fs")
const path = require("path")
const express = require("express")
const http = require("http")

const {
  appendBooking,
  isSlotAvailable,
  hasUserBooked,
  getUserBooking,
  getBookingsBySlot,
  getAllBookings,
  exportBookingsToExcel,
  cancelUserBooking,
  getAllBookingsForToday,
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
  initializeAllSheets,
  getAllFeedback,
} = require("./sheets")

// Initialize Express app for keep-alive mechanism
const app = express()
const PORT = process.env.PORT || 3000

// Keep-alive configuration
const KEEP_ALIVE_INTERVAL = 5 * 60 * 1000 // 5 minutes in milliseconds
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`

// Middleware
app.use(express.json())

// Health check endpoint
app.get("/", (req, res) => {
  res.status(200).json({
    status: "alive",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    message: "Telegram Bot is running successfully! 🤖",
  })
})

// Additional health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    bot: "active",
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage(),
    uptime: process.uptime(),
  })
})

// Keep-alive ping endpoint
app.get("/ping", (req, res) => {
  res.status(200).json({
    pong: true,
    timestamp: new Date().toISOString(),
  })
})

// Start Express server
const server = app.listen(PORT, () => {
  console.log(`🚀 Express server running on port ${PORT}`)
  console.log(`🌐 Health check available at: ${RENDER_URL}`)
})

// Keep-alive mechanism
function keepAlive() {
  const url = `${RENDER_URL}/ping`

  // Use http.get for internal ping
  const request = http.get(url, (res) => {
    console.log(`✅ Keep-alive ping successful - Status: ${res.statusCode} - ${new Date().toISOString()}`)
  })

  request.on("error", (error) => {
    console.error(`❌ Keep-alive ping failed: ${error.message} - ${new Date().toISOString()}`)
  })

  request.setTimeout(10000, () => {
    console.error(`⏰ Keep-alive ping timeout - ${new Date().toISOString()}`)
    request.destroy()
  })
}

// Start keep-alive mechanism
console.log(`🔄 Starting keep-alive mechanism - pinging every ${KEEP_ALIVE_INTERVAL / 1000 / 60} minutes`)
setInterval(keepAlive, KEEP_ALIVE_INTERVAL)

// Initial ping after 30 seconds
setTimeout(keepAlive, 30000)

// Initialize sheets when bot starts
initializeAllSheets()
  .then(() => {
    console.log("📊 All sheets initialized successfully")
  })
  .catch((error) => {
    console.error("⚠️ Sheet initialization failed, using fallback mode:", error.message)
  })

// Replace with your actual bot token
const TOKEN = "7988607860:AAFJAGr2srGlwehPFQwHK6rlf2PGpNFH1p4"
const bot = new TelegramBot(TOKEN, { polling: true })

// Enhanced configuration
const CONFIG = {
  TEST_OPTIONS: [
    { id: "cbc", name: "CBC (Complete Blood Count)", price: "₹500", duration: "15 min", fasting: false },
    { id: "lft", name: "LFT (Liver Function Test)", price: "₹800", duration: "20 min", fasting: true },
    { id: "kft", name: "KFT (Kidney Function Test)", price: "₹700", duration: "20 min", fasting: false },
    { id: "diabetes", name: "Diabetes Panel", price: "₹600", duration: "15 min", fasting: true },
    { id: "thyroid", name: "Thyroid Panel", price: "₹900", duration: "25 min", fasting: false },
    { id: "lipid", name: "Lipid Profile", price: "₹650", duration: "15 min", fasting: true },
    { id: "vitamin", name: "Vitamin D3", price: "₹1200", duration: "10 min", fasting: false },
    { id: "hba1c", name: "HbA1c", price: "₹550", duration: "15 min", fasting: false },
  ],
  TIME_SLOTS: ["9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "2:00 PM", "3:00 PM", "4:00 PM"],
  SLOT_LIMIT: 3,
  LANGUAGES: {
    en: "English 🇺🇸",
    hi: "हिंदी 🇮🇳",
    es: "Español 🇪🇸",
  },
  ADMIN_IDS: ["1058372563"], // Add admin user IDs
  CLINIC_INFO: {
    name: "HealthCare Lab",
    address: "123 Medical Street, Health City",
    phone: "+91-9773065512",
    email: "info@healthcarelab.com",
    website: "www.healthcarelab.com",
  },
}

// Multi-language support
const MESSAGES = {
  en: {
    welcome:
      "👋 Welcome to *HealthCare Lab Bot*!\n\n🩺 Your health, our priority. Book blood tests easily and get timely reminders.\n\n🌟 *New Features:*\n• Multi-language support\n• Waiting list for full slots\n• Health tips & reminders\n• Booking history\n• Feedback system",
    choose_language: "🌍 Choose your preferred language:",
    language_set: "✅ Language set to English",
    main_menu: "📋 *Main Menu*\n\nWhat would you like to do?",
    booking_confirmed: "✅ *Booking Confirmed!*",
    slot_full: "⚠️ This slot is full. Would you like to join the waiting list?",
    added_to_waitlist: "📝 You've been added to the waiting list. We'll notify you if a slot opens up!",
    health_tip: "💡 *Health Tip*",
    feedback_thanks: "🙏 Thank you for your feedback! It helps us improve our services.",
  },
  hi: {
    welcome: "👋 *हेल्थकेयर लैब बॉट* में आपका स्वागत है!\n\n🩺 आपका स्वास्थ्य, हमारी प्राथमिकता। आसानी से ब्लड टेस्ट बुक करें।",
    choose_language: "🌍 अपनी पसंदीदा भाषा चुनें:",
    language_set: "✅ भाषा हिंदी में सेट की गई",
    main_menu: "📋 *मुख्य मेनू*\n\nआप क्या करना चाहते हैं?",
    booking_confirmed: "✅ *बुकिंग पुष्ट!*",
    slot_full: "⚠️ यह स्लॉट भरा है। क्या आप प्रतीक्षा सूची में शामिल होना चाहते हैं?",
    added_to_waitlist: "📝 आपको प्रतीक्षा सूची में जोड़ दिया गया है।",
    health_tip: "💡 *स्वास्थ्य सुझाव*",
    feedback_thanks: "🙏 आपकी प्रतिक्रिया के लिए धन्यवाद!",
  },
}

// User states and data
const userStates = {}
const userPreferences = {}
const remindersSent = new Set()

// Utility functions
function clearUserState(userId) {
  delete userStates[userId]
  setTimeout(() => delete userStates[userId], 15 * 60 * 1000) // Clear after 15 minutes
}

function getUserLanguage(userId) {
  return userPreferences[userId]?.language || "en"
}

function getMessage(userId, key) {
  const lang = getUserLanguage(userId)
  return MESSAGES[lang]?.[key] || MESSAGES.en[key] || key
}

// Enhanced reminder system
async function checkAndSendReminders() {
  const now = new Date()
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()

  // Send reminders at 7:00 AM
  if (currentHour === 7 && currentMinute === 0) {
    const todayStr = now.toISOString().split("T")[0]
    if (remindersSent.has(todayStr)) return

    try {
      // Today's appointments
      const todayBookings = await getAllBookingsForToday(todayStr)
      for (const booking of todayBookings) {
        await sendAppointmentReminder(booking, "today")
      }

      // Tomorrow's appointments
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowStr = tomorrow.toISOString().split("T")[0]
      const tomorrowBookings = await getAllBookingsForToday(tomorrowStr)
      for (const booking of tomorrowBookings) {
        await sendAppointmentReminder(booking, "tomorrow")
      }

      // Send health tips
      await sendDailyHealthTips()
      remindersSent.add(todayStr)
    } catch (error) {
      console.error("Error in reminder system:", error)
    }
  }

  // Clear old reminders at midnight
  if (currentHour === 0 && currentMinute === 0) {
    remindersSent.clear()
  }
}

async function sendAppointmentReminder(booking, type) {
  const [userId, name, age, gender, date, time, test] = booking
  const lang = getUserLanguage(userId)

  try {
    const testInfo = CONFIG.TEST_OPTIONS.find((t) => t.name.includes(test))
    const fastingInfo = testInfo?.fasting ? "\n🚫 Remember to fast for 8-12 hours before the test." : ""

    const message =
      type === "today"
        ? `⏰ *Today's Appointment*\n\nHello ${name}! Your *${test}* test is TODAY at *${time}*.\n\n📍 ${CONFIG.CLINIC_INFO.address}\n⏱️ Please arrive 15 minutes early${fastingInfo}\n\n🎟️ Don't forget your QR code!`
        : `⏰ *Tomorrow's Appointment*\n\nHello ${name}! Your *${test}* test is TOMORROW (${date}) at *${time}*.\n\n📍 ${CONFIG.CLINIC_INFO.address}\n⏱️ Please arrive 15 minutes early${fastingInfo}\n\n💤 Get a good night's sleep!`

    await bot.sendMessage(userId, message, { parse_mode: "Markdown" })
  } catch (error) {
    console.error(`Failed to send reminder to ${userId}:`, error)
  }
}

async function sendDailyHealthTips() {
  try {
    const tips = await getHealthTips()
    if (tips.length === 0) return

    const randomTip = tips[Math.floor(Math.random() * tips.length)]
    const allBookings = await getAllBookings()
    const uniqueUsers = [...new Set(allBookings.map((b) => b[0]))]

    for (const userId of uniqueUsers) {
      try {
        const prefs = await getUserPreferences(userId)
        if (prefs?.healthTips !== false) {
          await bot.sendMessage(userId, `💡 *Daily Health Tip*\n\n${randomTip}`, { parse_mode: "Markdown" })
        }
      } catch (error) {
        console.error(`Failed to send health tip to ${userId}:`, error)
      }
    }
  } catch (error) {
    console.error("Error sending health tips:", error)
  }
}

// Set up reminder checking
setInterval(checkAndSendReminders, 60 * 1000)

// Enhanced command handlers
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id
  const userId = msg.from.id.toString()

  try {
    // Check if user has language preference
    const prefs = await getUserPreferences(userId)
    if (!prefs?.language) {
      return showLanguageSelection(chatId, userId)
    }
    await showMainMenu(chatId, userId)
  } catch (error) {
    console.error("Error in /start command:", error)
    await bot.sendMessage(chatId, "❌ An error occurred. Please try again.")
  }
})

bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id
  const helpMessage = `🤖 *Enhanced Blood Test Bot Help*\n\n📋 *Available Features:*\n• 🩺 Book blood tests\n• 📅 View your bookings\n• 🔄 Reschedule appointments\n• ❌ Cancel bookings\n• 📊 View test information\n• 🌍 Multi-language support\n• 📝 Waiting list for full slots\n• 💬 Feedback system\n• 💡 Daily health tips\n\n⏰ *Available Time Slots:*\n${CONFIG.TIME_SLOTS.join(", ")}\n\n🧪 *Available Tests:*\n${CONFIG.TEST_OPTIONS.map((test, i) => `${i + 1}. ${test.name} - ${test.price}`).join("\n")}`

  await bot.sendMessage(chatId, helpMessage, { parse_mode: "Markdown" })
})

bot.onText(/\/admin/, async (msg) => {
  const chatId = msg.chat.id
  const userId = msg.from.id.toString()

  if (!CONFIG.ADMIN_IDS.includes(userId)) {
    return bot.sendMessage(chatId, "❌ Unauthorized access.")
  }

  await showAdminPanel(chatId, userId)
})

async function showLanguageSelection(chatId, userId) {
  const keyboard = {
    reply_markup: {
      inline_keyboard: Object.entries(CONFIG.LANGUAGES).map(([code, name]) => [
        { text: name, callback_data: `lang_${code}` },
      ]),
    },
  }

  await bot.sendMessage(chatId, "🌍 Choose your preferred language / अपनी भाषा चुनें:", keyboard)
}

async function showMainMenu(chatId, userId) {
  try {
    const hasBooking = await hasUserBooked(userId)
    const menuButtons = [
      [{ text: "🩺 Book Test", callback_data: "menu_book" }],
      [{ text: "📋 My Bookings", callback_data: "menu_bookings" }],
      [{ text: "📊 Test Information", callback_data: "menu_tests" }],
      [{ text: "📍 Clinic Info", callback_data: "menu_clinic" }],
      [{ text: "⚙️ Settings", callback_data: "menu_settings" }],
      [{ text: "💬 Feedback", callback_data: "menu_feedback" }],
    ]

    if (hasBooking) {
      menuButtons.splice(1, 0, [{ text: "📝 Reschedule", callback_data: "menu_reschedule" }])
      menuButtons.splice(2, 0, [{ text: "❌ Cancel Booking", callback_data: "menu_cancel" }])
      menuButtons.splice(3, 0, [{ text: "📋 Booking History", callback_data: "menu_history" }])
    }

    if (CONFIG.ADMIN_IDS.includes(userId)) {
      menuButtons.push([{ text: "👨‍💼 Admin Panel", callback_data: "admin_panel" }])
    }

    const keyboard = { reply_markup: { inline_keyboard: menuButtons } }
    const welcomeMsg = getMessage(userId, "welcome")

    await bot.sendMessage(chatId, `${welcomeMsg}\n\n${getMessage(userId, "main_menu")}`, {
      parse_mode: "Markdown",
      ...keyboard,
    })
  } catch (error) {
    console.error("Error showing main menu:", error)
    await bot.sendMessage(chatId, "❌ An error occurred. Please try again.")
  }
}

// Enhanced booking flow
async function startBookingFlow(chatId, userId) {
  try {
    const hasBooking = await hasUserBooked(userId)
    if (hasBooking) {
      return bot.sendMessage(chatId, "✅ You already have a booking. Please cancel it first to book a new one.")
    }

    userStates[userId] = { step: "name", data: {} }
    const keyboard = {
      reply_markup: {
        inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "back_menu" }]],
      },
    }

    await bot.sendMessage(chatId, "👤 Please enter your full name:", keyboard)
  } catch (error) {
    console.error("Error starting booking flow:", error)
    await bot.sendMessage(chatId, "❌ An error occurred. Please try again.")
  }
}

// Test information display
async function showTestInformation(chatId, userId) {
  let message = "🧪 *Available Tests*\n\n"

  CONFIG.TEST_OPTIONS.forEach((test, index) => {
    const fastingIcon = test.fasting ? "🚫" : "✅"
    message += `${index + 1}. *${test.name}*\n`
    message += `   💰 Price: ${test.price}\n`
    message += `   ⏱️ Duration: ${test.duration}\n`
    message += `   ${fastingIcon} Fasting: ${test.fasting ? "Required" : "Not Required"}\n\n`
  })

  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📅 Book Now", callback_data: "menu_book" }],
        [{ text: "🔙 Back to Menu", callback_data: "back_menu" }],
      ],
    },
  }

  await bot.sendMessage(chatId, message, { parse_mode: "Markdown", ...keyboard })
}

// Clinic information
async function showClinicInfo(chatId, userId) {
  const message =
    `🏥 *${CONFIG.CLINIC_INFO.name}*\n\n` +
    `📍 *Address:*\n${CONFIG.CLINIC_INFO.address}\n\n` +
    `📞 *Phone:* ${CONFIG.CLINIC_INFO.phone}\n` +
    `📧 *Email:* ${CONFIG.CLINIC_INFO.email}\n` +
    `🌐 *Website:* ${CONFIG.CLINIC_INFO.website}\n\n` +
    `⏰ *Working Hours:*\n` +
    `Monday - Saturday: 8:00 AM - 6:00 PM\n` +
    `Sunday: 9:00 AM - 2:00 PM\n\n` +
    `🚗 *Parking:* Free parking available\n` +
    `♿ *Accessibility:* Wheelchair accessible`

  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📍 Get Directions", url: "https://maps.google.com" }],
        [{ text: "📞 Call Now", url: `tel:${CONFIG.CLINIC_INFO.phone}` }],
        [{ text: "🔙 Back to Menu", callback_data: "back_menu" }],
      ],
    },
  }

  await bot.sendMessage(chatId, message, { parse_mode: "Markdown", ...keyboard })
}

// Settings menu
async function showSettings(chatId, userId) {
  try {
    const prefs = await getUserPreferences(userId)
    const message =
      `⚙️ *Settings*\n\n` +
      `🌍 Language: ${CONFIG.LANGUAGES[prefs?.language || "en"]}\n` +
      `🔔 Reminders: ${prefs?.reminders !== false ? "Enabled" : "Disabled"}\n` +
      `💡 Health Tips: ${prefs?.healthTips !== false ? "Enabled" : "Disabled"}`

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🌍 Change Language", callback_data: "settings_language" }],
          [{ text: "🔔 Toggle Reminders", callback_data: "settings_reminders" }],
          [{ text: "💡 Toggle Health Tips", callback_data: "settings_health_tips" }],
          [{ text: "📊 My Statistics", callback_data: "settings_stats" }],
          [{ text: "🔙 Back to Menu", callback_data: "back_menu" }],
        ],
      },
    }

    await bot.sendMessage(chatId, message, { parse_mode: "Markdown", ...keyboard })
  } catch (error) {
    console.error("Error showing settings:", error)
    await bot.sendMessage(chatId, "❌ An error occurred. Please try again.")
  }
}

// Feedback system
async function showFeedbackMenu(chatId, userId) {
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: "⭐ Rate Service", callback_data: "feedback_rate" }],
        [{ text: "💬 Write Review", callback_data: "feedback_review" }],
        [{ text: "🐛 Report Issue", callback_data: "feedback_issue" }],
        [{ text: "💡 Suggest Feature", callback_data: "feedback_feature" }],
        [{ text: "🔙 Back to Menu", callback_data: "back_menu" }],
      ],
    },
  }

  await bot.sendMessage(chatId, "💬 *Feedback*\n\nYour feedback helps us improve our services:", {
    parse_mode: "Markdown",
    ...keyboard,
  })
}

// Admin panel
async function showAdminPanel(chatId, userId) {
  try {
    if (!CONFIG.ADMIN_IDS.includes(userId)) {
      return bot.sendMessage(chatId, "❌ Unauthorized access.")
    }

    const analytics = await getAnalytics()
    const message =
      `👨‍💼 *Admin Panel*\n\n` +
      `📊 *Today's Stats:*\n` +
      `• Total Bookings: ${analytics.totalBookings}\n` +
      `• Today's Appointments: ${analytics.todayAppointments}\n` +
      `• Waiting List: ${analytics.waitingList}\n` +
      `• Feedback Count: ${analytics.feedbackCount}\n` +
      `• Average Rating: ${analytics.averageRating}/5 ⭐`

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📊 Full Analytics", callback_data: "admin_analytics" }],
          [{ text: "📤 Export Data", callback_data: "admin_export" }],
          [{ text: "📝 Manage Waiting List", callback_data: "admin_waitlist" }],
          [{ text: "💡 Add Health Tip", callback_data: "admin_health_tip" }],
          [{ text: "📢 Broadcast Message", callback_data: "admin_broadcast" }],
          [{ text: "🔙 Back to Menu", callback_data: "back_menu" }],
        ],
      },
    }

    await bot.sendMessage(chatId, message, { parse_mode: "Markdown", ...keyboard })
  } catch (error) {
    console.error("Error showing admin panel:", error)
    await bot.sendMessage(chatId, "❌ An error occurred. Please try again.")
  }
}

// Show full analytics (admin only)
async function showFullAnalytics(chatId, userId) {
  if (!CONFIG.ADMIN_IDS.includes(userId)) {
    return bot.sendMessage(chatId, "❌ Unauthorized access.")
  }

  try {
    const analytics = await getAnalytics()
    const allBookings = await getAllBookings()
    const allFeedback = await getAllFeedback()
    const waitingList = await getWaitingList()

    // Calculate additional stats
    const today = new Date().toISOString().split("T")[0]
    const thisWeek = new Date()
    thisWeek.setDate(thisWeek.getDate() - 7)
    const thisWeekStr = thisWeek.toISOString().split("T")[0]

    const weeklyBookings = allBookings.filter((booking) => booking[4] >= thisWeekStr && booking[7] !== "cancelled")
    const cancelledBookings = allBookings.filter((booking) => booking[7] === "cancelled")

    // Most popular tests
    let popularTestsText = "No data"
    if (Object.keys(analytics.popularTests).length > 0) {
      popularTestsText = Object.entries(analytics.popularTests)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([test, count]) => `• ${test}: ${count}`)
        .join("\n")
    }

    // Recent feedback
    let recentFeedbackText = "No feedback yet"
    if (allFeedback.length > 0) {
      const recentFeedback = allFeedback.slice(-3).reverse()
      recentFeedbackText = recentFeedback
        .map((feedback) => {
          const rating = feedback.rating ? `${feedback.rating}⭐` : ""
          const type = feedback.type.charAt(0).toUpperCase() + feedback.type.slice(1)
          return `• ${type} ${rating}: ${feedback.message.substring(0, 50)}${feedback.message.length > 50 ? "..." : ""}`
        })
        .join("\n")
    }

    const message =
      `📊 *Full Analytics Report*\n\n` +
      `📈 *Booking Statistics:*\n` +
      `• Total Bookings: ${analytics.totalBookings}\n` +
      `• Active Bookings: ${analytics.totalBookings - cancelledBookings.length}\n` +
      `• Cancelled Bookings: ${cancelledBookings.length}\n` +
      `• This Week: ${weeklyBookings.length}\n` +
      `• Today: ${analytics.todayAppointments}\n\n` +
      `🧪 *Most Popular Tests:*\n${popularTestsText}\n\n` +
      `💬 *Feedback Summary:*\n` +
      `• Total Feedback: ${analytics.feedbackCount}\n` +
      `• Average Rating: ${analytics.averageRating}/5 ⭐\n\n` +
      `📝 *Recent Feedback:*\n${recentFeedbackText}\n\n` +
      `⏳ *Waiting List:*\n` +
      `• Users Waiting: ${analytics.waitingList}\n\n` +
      `📅 *Time Slot Usage:*\n` +
      `${await getTimeSlotUsage()}`

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📤 Export Full Report", callback_data: "admin_export" }],
          [{ text: "🔄 Refresh", callback_data: "admin_analytics" }],
          [{ text: "🔙 Back to Admin", callback_data: "admin_panel" }],
        ],
      },
    }

    await bot.sendMessage(chatId, message, { parse_mode: "Markdown", ...keyboard })
  } catch (error) {
    console.error("Error showing full analytics:", error)
    await bot.sendMessage(chatId, "❌ An error occurred while generating analytics.")
  }
}

// Get time slot usage statistics
async function getTimeSlotUsage() {
  try {
    const allBookings = await getAllBookings()
    const activeBookings = allBookings.filter((booking) => booking[7] !== "cancelled")
    const slotUsage = {}

    CONFIG.TIME_SLOTS.forEach((slot) => {
      slotUsage[slot] = 0
    })

    activeBookings.forEach((booking) => {
      const time = booking[5]
      if (slotUsage.hasOwnProperty(time)) {
        slotUsage[time]++
      }
    })

    return Object.entries(slotUsage)
      .map(([slot, count]) => `• ${slot}: ${count} bookings`)
      .join("\n")
  } catch (error) {
    console.error("Error calculating time slot usage:", error)
    return "Unable to calculate slot usage"
  }
}

async function showUserBookings(chatId, userId) {
  try {
    const booking = await getUserBooking(userId)
    if (!booking) {
      return bot.sendMessage(chatId, "❌ No booking found. Use the menu to make a booking.")
    }

    const [_, name, age, gender, date, time, test] = booking
    const testInfo = CONFIG.TEST_OPTIONS.find((t) => t.name.includes(test))

    const message =
      `📝 *Your Booking Details*\n\n` +
      `👤 Name: ${name}\n` +
      `🎂 Age: ${age}\n` +
      `⚧️ Gender: ${gender}\n` +
      `🧪 Test: ${test}\n` +
      `💰 Price: ${testInfo?.price || "N/A"}\n` +
      `📅 Date: ${date}\n` +
      `⏰ Time: ${time}\n\n` +
      `✅ Your booking is confirmed!`

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📝 Reschedule", callback_data: "menu_reschedule" }],
          [{ text: "❌ Cancel", callback_data: "menu_cancel" }],
          [{ text: "🔙 Back to Menu", callback_data: "back_menu" }],
        ],
      },
    }

    await bot.sendMessage(chatId, message, { parse_mode: "Markdown", ...keyboard })
  } catch (error) {
    console.error("Error showing user bookings:", error)
    await bot.sendMessage(chatId, "❌ An error occurred. Please try again.")
  }
}

// Show user booking history
async function showBookingHistory(chatId, userId) {
  try {
    const history = await getBookingHistory(userId)
    if (history.length === 0) {
      return bot.sendMessage(chatId, "📋 No booking history found.")
    }

    let message = "📋 *Your Booking History*\n\n"
    history.forEach((booking, index) => {
      const [_, name, age, gender, date, time, test, status] = booking
      const statusIcon = status === "cancelled" ? "❌" : "✅"
      message += `${index + 1}. ${statusIcon} *${test}*\n`
      message += `   📅 ${date} at ${time}\n`
      message += `   📊 Status: ${status || "confirmed"}\n\n`
    })

    const keyboard = {
      reply_markup: {
        inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "back_menu" }]],
      },
    }

    await bot.sendMessage(chatId, message, { parse_mode: "Markdown", ...keyboard })
  } catch (error) {
    console.error("Error showing booking history:", error)
    await bot.sendMessage(chatId, "❌ An error occurred while fetching your booking history.")
  }
}

// Show waiting list (admin only)
async function showWaitingListAdmin(chatId, userId) {
  if (!CONFIG.ADMIN_IDS.includes(userId)) {
    return bot.sendMessage(chatId, "❌ Unauthorized access.")
  }

  try {
    const waitingList = await getWaitingList()
    if (waitingList.length === 0) {
      return bot.sendMessage(chatId, "📝 No users in waiting list.")
    }

    let message = "📝 *Waiting List*\n\n"
    waitingList.forEach((item, index) => {
      message += `${index + 1}. *${item.name}*\n`
      message += `   🧪 ${item.test}\n`
      message += `   📅 ${item.date} at ${item.time}\n`
      message += `   👤 User ID: ${item.userId}\n\n`
    })

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔄 Refresh", callback_data: "admin_waitlist" }],
          [{ text: "🔙 Back to Admin", callback_data: "admin_panel" }],
        ],
      },
    }

    await bot.sendMessage(chatId, message, { parse_mode: "Markdown", ...keyboard })
  } catch (error) {
    console.error("Error showing waiting list:", error)
    await bot.sendMessage(chatId, "❌ An error occurred while fetching the waiting list.")
  }
}

// Add health tip (admin only)
async function handleAddHealthTip(chatId, userId) {
  if (!CONFIG.ADMIN_IDS.includes(userId)) {
    return bot.sendMessage(chatId, "❌ Unauthorized access.")
  }

  userStates[userId] = { step: "add_health_tip", data: {} }
  await bot.sendMessage(chatId, "💡 Please enter the new health tip:")
}

// Broadcast message (admin only)
async function handleBroadcastMessage(chatId, userId) {
  if (!CONFIG.ADMIN_IDS.includes(userId)) {
    return bot.sendMessage(chatId, "❌ Unauthorized access.")
  }

  userStates[userId] = { step: "broadcast_message", data: {} }
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📢 All Users", callback_data: "broadcast_all" }],
        [{ text: "📅 Today's Appointments", callback_data: "broadcast_today" }],
        [{ text: "📋 Active Bookings", callback_data: "broadcast_active" }],
        [{ text: "🔙 Back to Admin", callback_data: "admin_panel" }],
      ],
    },
  }

  await bot.sendMessage(chatId, "📢 *Broadcast Message*\n\nWho would you like to send the message to?", {
    parse_mode: "Markdown",
    ...keyboard,
  })
}

// Handle broadcast target selection
async function handleBroadcastTarget(callbackQuery) {
  const msg = callbackQuery.message
  const chatId = msg.chat.id
  const userId = callbackQuery.from.id.toString()
  const data = callbackQuery.data

  if (!CONFIG.ADMIN_IDS.includes(userId)) {
    return bot.sendMessage(chatId, "❌ Unauthorized access.")
  }

  const state = userStates[userId]
  if (!state || state.step !== "broadcast_message") return

  let targetType = ""
  let targetDescription = ""

  switch (data) {
    case "broadcast_all":
      targetType = "all"
      targetDescription = "all users who have ever used the bot"
      break
    case "broadcast_today":
      targetType = "today"
      targetDescription = "users with appointments today"
      break
    case "broadcast_active":
      targetType = "active"
      targetDescription = "users with active bookings"
      break
    default:
      return
  }

  state.data.targetType = targetType
  state.step = "broadcast_compose"

  await bot.editMessageText(`📢 *Broadcast to ${targetDescription}*\n\nPlease type your message:`, {
    chat_id: chatId,
    message_id: msg.message_id,
    parse_mode: "Markdown",
  })
}

// Send broadcast message
async function sendBroadcastMessage(chatId, userId, message, targetType) {
  if (!CONFIG.ADMIN_IDS.includes(userId)) {
    return bot.sendMessage(chatId, "❌ Unauthorized access.")
  }

  try {
    let targetUsers = []
    const allBookings = await getAllBookings()

    switch (targetType) {
      case "all":
        // Get all unique user IDs who have ever used the bot
        targetUsers = [...new Set(allBookings.map((booking) => booking[0]))]
        break
      case "today":
        // Get users with appointments today
        const today = new Date().toISOString().split("T")[0]
        const todayBookings = await getAllBookingsForToday(today)
        targetUsers = [...new Set(todayBookings.map((booking) => booking[0]))]
        break
      case "active":
        // Get users with active (non-cancelled) bookings
        const activeBookings = allBookings.filter((booking) => booking[7] !== "cancelled")
        targetUsers = [...new Set(activeBookings.map((booking) => booking[0]))]
        break
    }

    if (targetUsers.length === 0) {
      return bot.sendMessage(chatId, "❌ No users found for the selected target group.")
    }

    // Show confirmation
    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Send Message", callback_data: `confirm_broadcast_${targetType}` },
            { text: "❌ Cancel", callback_data: "admin_panel" },
          ],
        ],
      },
    }

    const previewMessage =
      `📢 *Broadcast Preview*\n\n` +
      `👥 Target: ${targetUsers.length} users\n` +
      `📝 Message:\n\n${message}\n\n` +
      `Are you sure you want to send this message?`

    // Store message in user state for confirmation
    userStates[userId].data.message = message
    userStates[userId].data.targetUsers = targetUsers

    await bot.sendMessage(chatId, previewMessage, {
      parse_mode: "Markdown",
      ...keyboard,
    })
  } catch (error) {
    console.error("Error preparing broadcast:", error)
    await bot.sendMessage(chatId, "❌ Error preparing broadcast message.")
  }
}

// Confirm and execute broadcast
async function executeBroadcast(chatId, userId, targetType) {
  if (!CONFIG.ADMIN_IDS.includes(userId)) {
    return bot.sendMessage(chatId, "❌ Unauthorized access.")
  }

  const state = userStates[userId]
  if (!state || !state.data.message || !state.data.targetUsers) {
    return bot.sendMessage(chatId, "❌ Broadcast data not found. Please try again.")
  }

  const { message, targetUsers } = state.data
  let successCount = 0
  let failCount = 0

  // Send progress message
  const progressMsg = await bot.sendMessage(chatId, "📤 Sending broadcast message... 0%")

  // Send message to all target users
  for (let i = 0; i < targetUsers.length; i++) {
    const targetUserId = targetUsers[i]
    try {
      // Add admin signature to message
      const broadcastMessage = `📢 *Message from ${CONFIG.CLINIC_INFO.name}*\n\n${message}\n\n---\n_This is a broadcast message from the clinic._`

      await bot.sendMessage(targetUserId, broadcastMessage, { parse_mode: "Markdown" })
      successCount++
    } catch (error) {
      console.error(`Failed to send broadcast to ${targetUserId}:`, error)
      failCount++
    }

    // Update progress every 10 messages or at the end
    if ((i + 1) % 10 === 0 || i === targetUsers.length - 1) {
      const progress = Math.round(((i + 1) / targetUsers.length) * 100)
      try {
        await bot.editMessageText(
          `📤 Sending broadcast message... ${progress}%\n\n✅ Sent: ${successCount}\n❌ Failed: ${failCount}`,
          {
            chat_id: chatId,
            message_id: progressMsg.message_id,
          },
        )
      } catch (editError) {
        // Ignore edit errors
      }
    }

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  // Final result
  const resultMessage =
    `📊 *Broadcast Complete*\n\n` +
    `✅ Successfully sent: ${successCount}\n` +
    `❌ Failed to send: ${failCount}\n` +
    `📊 Total attempted: ${targetUsers.length}`

  await bot.sendMessage(chatId, resultMessage, { parse_mode: "Markdown" })

  // Clear user state
  clearUserState(userId)

  // Show admin panel again
  setTimeout(() => showAdminPanel(chatId, userId), 2000)
}

// Enhanced callback query handler
bot.on("callback_query", async (callbackQuery) => {
  const msg = callbackQuery.message
  const chatId = msg.chat.id
  const userId = callbackQuery.from.id.toString()
  const data = callbackQuery.data

  await bot.answerCallbackQuery(callbackQuery.id)

  try {
    // Language selection
    if (data.startsWith("lang_")) {
      const language = data.split("_")[1]
      await updateUserPreferences(userId, { language })
      userPreferences[userId] = { ...userPreferences[userId], language }
      await bot.editMessageText(getMessage(userId, "language_set"), {
        chat_id: chatId,
        message_id: msg.message_id,
      })
      setTimeout(() => showMainMenu(chatId, userId), 1000)
      return
    }

    // Main menu navigation
    switch (data) {
      case "menu_book":
        await startBookingFlow(chatId, userId)
        break
      case "menu_bookings":
        await showUserBookings(chatId, userId)
        break
      case "menu_tests":
        await showTestInformation(chatId, userId)
        break
      case "menu_clinic":
        await showClinicInfo(chatId, userId)
        break
      case "menu_settings":
        await showSettings(chatId, userId)
        break
      case "menu_feedback":
        await showFeedbackMenu(chatId, userId)
        break
      case "menu_reschedule":
        await handleReschedule(chatId, userId)
        break
      case "menu_cancel":
        await handleCancellation(chatId, userId)
        break
      case "back_menu":
        await showMainMenu(chatId, userId)
        break
      case "admin_panel":
        await showAdminPanel(chatId, userId)
        break
      case "admin_export":
        await handleAdminExport(chatId, userId)
        break
      case "menu_history":
        await showBookingHistory(chatId, userId)
        break
      case "admin_waitlist":
        await showWaitingListAdmin(chatId, userId)
        break
      case "admin_health_tip":
        await handleAddHealthTip(chatId, userId)
        break
      case "admin_broadcast":
        await handleBroadcastMessage(chatId, userId)
        break
      case "admin_analytics":
        await showFullAnalytics(chatId, userId)
        break
    }

    // Handle booking flow callbacks
    await handleBookingCallbacks(callbackQuery)
    await handleSettingsCallbacks(callbackQuery)
    await handleFeedbackCallbacks(callbackQuery)

    // Handle broadcast callbacks
    if (data.startsWith("broadcast_")) {
      await handleBroadcastTarget(callbackQuery)
      return
    }

    if (data.startsWith("confirm_broadcast_")) {
      const targetType = data.replace("confirm_broadcast_", "")
      await executeBroadcast(chatId, userId, targetType)
      return
    }
  } catch (error) {
    console.error("Callback query error:", error)
    await bot.sendMessage(chatId, "❌ An error occurred. Please try again.")
  }
})

async function handleReschedule(chatId, userId) {
  const booking = await getUserBooking(userId)
  if (!booking) {
    return bot.sendMessage(chatId, "❌ No booking found to reschedule.")
  }

  userStates[userId] = { step: "reschedule_date", data: { originalBooking: booking } }
  await bot.sendMessage(chatId, "📅 Please enter the new date for your test (YYYY-MM-DD format):")
}

async function handleCancellation(chatId, userId) {
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Yes, Cancel", callback_data: "confirm_cancel" },
          { text: "❌ No, Keep Booking", callback_data: "back_menu" },
        ],
      ],
    },
  }

  await bot.sendMessage(chatId, "⚠️ Are you sure you want to cancel your booking?", keyboard)
}

// Handle rescheduling completion
async function completeReschedule(chatId, userId, newDate, newTime) {
  try {
    const success = await updateBooking(userId, { date: newDate, time: newTime })
    if (success) {
      await bot.sendMessage(
        chatId,
        `✅ *Booking Rescheduled Successfully!*\n\n📅 New Date: ${newDate}\n⏰ New Time: ${newTime}`,
        { parse_mode: "Markdown" },
      )

      // Generate new QR code
      try {
        const booking = await getUserBooking(userId)
        if (booking) {
          const [_, name, age, gender, date, time, test] = booking
          const qrData = `Name: ${name}\nTest: ${test}\nDate: ${date}\nTime: ${time}\nClinic: ${CONFIG.CLINIC_INFO.name}`
          const qrBuffer = await QRCode.toBuffer(qrData)
          await bot.sendPhoto(chatId, qrBuffer, {
            caption: "🎟️ Your Updated Booking QR Code\n\nPlease show this QR code at the clinic.",
          })
        }
      } catch (qrError) {
        console.error("Error generating QR code:", qrError)
      }
    } else {
      await bot.sendMessage(chatId, "❌ Failed to reschedule booking. Please try again.")
    }
    clearUserState(userId)
  } catch (error) {
    console.error("Error completing reschedule:", error)
    await bot.sendMessage(chatId, "❌ An error occurred while rescheduling.")
  }
}

async function handleBookingCallbacks(callbackQuery) {
  const msg = callbackQuery.message
  const chatId = msg.chat.id
  const userId = callbackQuery.from.id.toString()
  const data = callbackQuery.data
  const state = userStates[userId]

  if (!state) return

  if (data.startsWith("gender_")) {
    const gender = data.split("_")[1]
    state.data.gender = gender.charAt(0).toUpperCase() + gender.slice(1)
    state.step = "test"

    await bot.editMessageText(`⚧️ Gender selected: ${state.data.gender}`, {
      chat_id: chatId,
      message_id: msg.message_id,
    })

    // Show test selection
    const testButtons = CONFIG.TEST_OPTIONS.map((test, index) => [
      { text: `${test.name} - ${test.price}`, callback_data: `test_${index}` },
    ])

    const keyboard = {
      reply_markup: {
        inline_keyboard: [...testButtons, [{ text: "🔙 Back to Menu", callback_data: "back_menu" }]],
      },
    }

    await bot.sendMessage(chatId, "🧪 Please select a test:", keyboard)
  } else if (data.startsWith("test_")) {
    const testIndex = Number.parseInt(data.split("_")[1])
    const selectedTest = CONFIG.TEST_OPTIONS[testIndex]
    state.data.test = selectedTest.name
    state.step = "date"

    await bot.editMessageText(`🧪 Test selected: ${selectedTest.name}`, {
      chat_id: chatId,
      message_id: msg.message_id,
    })

    await bot.sendMessage(chatId, "📅 Please enter the date for your test (YYYY-MM-DD format):\n\nExample: 2024-01-15")
  } else if (data.startsWith("time_")) {
    const timeIndex = Number.parseInt(data.split("_")[1])
    const selectedTime = CONFIG.TIME_SLOTS[timeIndex]
    const { name, age, gender, date, test } = state.data

    // Check slot availability
    const bookingsAtSlot = await getBookingsBySlot(date, selectedTime)
    if (bookingsAtSlot.length >= CONFIG.SLOT_LIMIT) {
      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Join Waiting List", callback_data: `waitlist_${timeIndex}` },
              { text: "🔙 Choose Another Time", callback_data: "back_time_selection" },
            ],
          ],
        },
      }
      return bot.sendMessage(chatId, getMessage(userId, "slot_full"), keyboard)
    }

    try {
      state.locked = true
      await appendBooking(userId, name, age, gender, date, selectedTime, test)

      await bot.editMessageText(`⏰ Time selected: ${selectedTime}`, {
        chat_id: chatId,
        message_id: msg.message_id,
      })

      const confirmationMessage =
        `✅ *Booking Confirmed!*\n\n` +
        `👤 Name: ${name}\n` +
        `🎂 Age: ${age}\n` +
        `⚧️ Gender: ${gender}\n` +
        `🧪 Test: ${test}\n` +
        `📅 Date: ${date}\n` +
        `⏰ Time: ${selectedTime}\n\n` +
        `📱 You'll receive reminders before your appointment.\n` +
        `🎟️ QR code is being generated...`

      await bot.sendMessage(chatId, confirmationMessage, { parse_mode: "Markdown" })

      // Generate and send QR code
      try {
        const qrData = `Name: ${name}\nTest: ${test}\nDate: ${date}\nTime: ${selectedTime}\nClinic: ${CONFIG.CLINIC_INFO.name}`
        const qrBuffer = await QRCode.toBuffer(qrData)
        await bot.sendPhoto(chatId, qrBuffer, {
          caption: "🎟️ Your Booking QR Code\n\nPlease show this QR code at the clinic.",
        })
      } catch (qrError) {
        console.error("Error generating QR code:", qrError)
        bot.sendMessage(chatId, "⚠️ QR code generation failed, but your booking is confirmed.")
      }

      clearUserState(userId)
    } catch (err) {
      console.error("Booking error:", err)
      bot.sendMessage(chatId, "❌ Sorry, there was an error processing your booking. Please try again later.")
      clearUserState(userId)
    }
  } else if (data.startsWith("reschedule_time_")) {
    const timeIndex = Number.parseInt(data.split("_")[2])
    const selectedTime = CONFIG.TIME_SLOTS[timeIndex]
    const newDate = state.data.newDate

    // Check slot availability
    const bookingsAtSlot = await getBookingsBySlot(newDate, selectedTime)
    if (bookingsAtSlot.length >= CONFIG.SLOT_LIMIT) {
      return bot.sendMessage(chatId, "⚠️ This slot is full. Please choose another time slot.")
    }

    await completeReschedule(chatId, userId, newDate, selectedTime)
  } else if (data.startsWith("waitlist_")) {
    const timeIndex = Number.parseInt(data.split("_")[1])
    const selectedTime = CONFIG.TIME_SLOTS[timeIndex]
    const { name, date, test } = state.data

    try {
      await addToWaitingList(userId, name, date, selectedTime, test)
      await bot.sendMessage(chatId, getMessage(userId, "added_to_waitlist"))
      clearUserState(userId)
    } catch (error) {
      console.error("Error adding to waiting list:", error)
      await bot.sendMessage(chatId, "❌ Error adding to waiting list. Please try again.")
    }
  } else if (data === "confirm_cancel") {
    const cancelled = await cancelUserBooking(userId)
    if (cancelled) {
      clearUserState(userId)
      await bot.sendMessage(chatId, "❌ Your booking has been cancelled successfully.")
    } else {
      await bot.sendMessage(chatId, "⚠️ No booking found to cancel.")
    }
  }

  userStates[userId] = state
}

async function handleSettingsCallbacks(callbackQuery) {
  const msg = callbackQuery.message
  const chatId = msg.chat.id
  const userId = callbackQuery.from.id.toString()
  const data = callbackQuery.data

  if (data === "settings_language") {
    await showLanguageSelection(chatId, userId)
  } else if (data === "settings_reminders") {
    const prefs = await getUserPreferences(userId)
    const newValue = !prefs?.reminders
    await updateUserPreferences(userId, { reminders: newValue })
    await bot.sendMessage(chatId, `🔔 Reminders ${newValue ? "enabled" : "disabled"} successfully!`)
    setTimeout(() => showSettings(chatId, userId), 1000)
  } else if (data === "settings_health_tips") {
    const prefs = await getUserPreferences(userId)
    const newValue = !prefs?.healthTips
    await updateUserPreferences(userId, { healthTips: newValue })
    await bot.sendMessage(chatId, `💡 Health tips ${newValue ? "enabled" : "disabled"} successfully!`)
    setTimeout(() => showSettings(chatId, userId), 1000)
  }
}

async function handleFeedbackCallbacks(callbackQuery) {
  const msg = callbackQuery.message
  const chatId = msg.chat.id
  const userId = callbackQuery.from.id.toString()
  const data = callbackQuery.data

  if (data.startsWith("feedback_")) {
    const type = data.split("_")[1]
    userStates[userId] = { step: "feedback", data: { type } }

    let message = ""
    switch (type) {
      case "rate":
        message = "⭐ Please rate our service from 1 to 5:"
        break
      case "review":
        message = "💬 Please write your review:"
        break
      case "issue":
        message = "🐛 Please describe the issue you encountered:"
        break
      case "feature":
        message = "💡 Please describe the feature you'd like to suggest:"
        break
    }

    await bot.sendMessage(chatId, message)
  }
}

async function handleAdminExport(chatId, userId) {
  if (!CONFIG.ADMIN_IDS.includes(userId)) {
    return bot.sendMessage(chatId, "❌ Unauthorized access.")
  }

  try {
    const filePath = await exportBookingsToExcel()
    await bot.sendDocument(chatId, filePath, {}, { filename: "bookings.xlsx" })
    fs.unlinkSync(filePath) // Clean up
  } catch (error) {
    console.error("Error exporting bookings:", error)
    bot.sendMessage(chatId, "❌ Error exporting bookings. Please try again later.")
  }
}

// Enhanced message handler
bot.on("message", async (msg) => {
  const chatId = msg.chat.id
  const userId = msg.from.id.toString()
  const text = msg.text || ""

  // Skip commands
  if (text.startsWith("/")) return

  const state = userStates[userId]
  if (!state) return

  try {
    switch (state.step) {
      case "name":
        if (text.trim().length < 2) {
          return bot.sendMessage(chatId, "❌ Please enter a valid name (at least 2 characters).")
        }
        state.data.name = text.trim()
        state.step = "age"
        await bot.sendMessage(chatId, "🎂 Please enter your age:")
        break

      case "age":
        const age = Number.parseInt(text)
        if (isNaN(age) || age < 0 || age > 120) {
          return bot.sendMessage(chatId, "❌ Please enter a valid age between 0 and 120.")
        }
        state.data.age = age
        state.step = "gender"

        const genderKeyboard = {
          reply_markup: {
            inline_keyboard: [
              [
                { text: "👨 Male", callback_data: "gender_male" },
                { text: "👩 Female", callback_data: "gender_female" },
              ],
              [{ text: "⚧️ Other", callback_data: "gender_other" }],
            ],
          },
        }

        await bot.sendMessage(chatId, "⚧️ Please select your gender:", genderKeyboard)
        break

      case "date":
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const inputDate = new Date(text)

        if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || inputDate < today) {
          return bot.sendMessage(
            chatId,
            "❌ Please enter a valid future date in YYYY-MM-DD format.\n\nExample: 2024-01-15",
          )
        }

        state.data.date = text
        state.step = "time"

        const timeKeyboard = {
          reply_markup: {
            inline_keyboard: CONFIG.TIME_SLOTS.map((slot, index) => [
              { text: `⏰ ${slot}`, callback_data: `time_${index}` },
            ]),
          },
        }

        await bot.sendMessage(chatId, "⏰ Please select your preferred time slot:", timeKeyboard)
        break

      case "feedback":
        const feedbackType = state.data.type
        let rating = null

        if (feedbackType === "rate") {
          rating = Number.parseInt(text)
          if (isNaN(rating) || rating < 1 || rating > 5) {
            return bot.sendMessage(chatId, "❌ Please enter a rating between 1 and 5.")
          }
        }

        // Fixed feedback logging
        try {
          await addFeedback(userId, feedbackType, rating, text)
          console.log(
            `✅ Feedback added: ${userId} - ${feedbackType} - ${rating || "no rating"} - "${text.substring(0, 50)}${text.length > 50 ? "..." : ""}"`,
          )
          await bot.sendMessage(chatId, getMessage(userId, "feedback_thanks"))
          clearUserState(userId)
          setTimeout(() => showMainMenu(chatId, userId), 1000)
        } catch (error) {
          console.error("Error adding feedback:", error)
          await bot.sendMessage(chatId, "❌ Error saving feedback. Please try again.")
        }
        break

      case "reschedule_date":
        const newDate = new Date(text)
        const todayForReschedule = new Date()
        todayForReschedule.setHours(0, 0, 0, 0)

        if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || newDate < todayForReschedule) {
          return bot.sendMessage(
            chatId,
            "❌ Please enter a valid future date in YYYY-MM-DD format.\n\nExample: 2024-01-15",
          )
        }

        state.data.newDate = text
        state.step = "reschedule_time"

        const rescheduleTimeKeyboard = {
          reply_markup: {
            inline_keyboard: CONFIG.TIME_SLOTS.map((slot, index) => [
              { text: `⏰ ${slot}`, callback_data: `reschedule_time_${index}` },
            ]),
          },
        }

        await bot.sendMessage(chatId, "⏰ Please select your new preferred time slot:", rescheduleTimeKeyboard)
        break

      case "add_health_tip":
        if (text.trim().length < 10) {
          return bot.sendMessage(chatId, "❌ Please enter a health tip with at least 10 characters.")
        }

        try {
          await addHealthTip(text.trim())
          await bot.sendMessage(chatId, "✅ Health tip added successfully!")
          clearUserState(userId)
          setTimeout(() => showAdminPanel(chatId, userId), 1000)
        } catch (error) {
          console.error("Error adding health tip:", error)
          await bot.sendMessage(chatId, "❌ Error adding health tip. Please try again.")
        }
        break

      case "broadcast_compose":
        if (text.trim().length < 5) {
          return bot.sendMessage(chatId, "❌ Please enter a message with at least 5 characters.")
        }

        const targetType = state.data.targetType
        await sendBroadcastMessage(chatId, userId, text.trim(), targetType)
        break
    }

    userStates[userId] = state
  } catch (error) {
    console.error("Message handling error:", error)
    await bot.sendMessage(chatId, "❌ An error occurred. Please try again.")
  }
})

// Error handling
bot.on("polling_error", (error) => {
  console.error("Polling error:", error)
})

bot.on("error", (error) => {
  console.error("Bot error:", error)
})

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM received, shutting down gracefully...")
  server.close(() => {
    console.log("✅ Express server closed")
    bot.stopPolling()
    process.exit(0)
  })
})

process.on("SIGINT", () => {
  console.log("🛑 SIGINT received, shutting down gracefully...")
  server.close(() => {
    console.log("✅ Express server closed")
    bot.stopPolling()
    process.exit(0)
  })
})

console.log("🤖 Enhanced Telegram Bot with Keep-Alive started successfully!")
console.log(`🔄 Keep-alive mechanism active - pinging every ${KEEP_ALIVE_INTERVAL / 1000 / 60} minutes`)
