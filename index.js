// index.js - Telegram Blood Test Bot with Reminder System
const TelegramBot = require('node-telegram-bot-api');
const QRCode = require('qrcode');
const fs = require('fs');
const {
  appendBooking,
  isSlotAvailable,
  hasUserBooked,
  getUserBooking,
  getBookingsBySlot,
  getAllBookings,
  exportBookingsToExcel,
  cancelUserBooking,
  getAllBookingsForToday
} = require('./sheets');

// Replace with your actual bot token from @BotFather
const TOKEN = '7988607860:AAFJAGr2srGlwehPFQwHK6rlf2PGpNFH1p4';
const bot = new TelegramBot(TOKEN, { polling: true });

const TEST_OPTIONS = ['CBC', 'LFT', 'KFT', 'Diabetes', 'Thyroid'];
const TIME_SLOTS = ['9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM'];
const SLOT_LIMIT = 3;

let userStates = {};
let bookedUsers = new Set();
let remindersSent = new Set(); // Track which dates we've sent reminders for

function clearUserState(userId) {
  delete userStates[userId];
}

// Function to check and send daily reminders
async function checkAndSendReminders() {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  // Send reminders at 7:00 AM (you can change this time)
  if (currentHour === 7 && currentMinute === 0) {
    const todayStr = now.toISOString().split('T')[0];
    
    // Check if we already sent reminders for today
    if (remindersSent.has(todayStr)) {
      return;
    }
    
    try {
      // Get tomorrow's date for "day before" reminders
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      
      // Send reminders for TODAY's appointments
      const todayBookings = await getAllBookingsForToday(todayStr);
      console.log(`Sending ${todayBookings.length} same-day reminders for ${todayStr}`);
      
      for (const [userId, name, age, gender, date, time, test] of todayBookings) {
        try {
          await bot.sendMessage(userId, `⏰ *Today's Reminder*\n\nHello ${name}! Your *${test}* test is scheduled TODAY at *${time}*.\n\n📍 Please arrive 15 minutes early.\n🧪 Remember to follow any pre-test instructions.\n\nThank you! 🩺`, { parse_mode: 'Markdown' });
          console.log(`Same-day reminder sent to ${userId} for ${test} at ${time}`);
        } catch (error) {
          console.error(`Failed to send same-day reminder to ${userId}:`, error);
        }
      }
      
      // Send reminders for TOMORROW's appointments (day before reminder)
      const tomorrowBookings = await getAllBookingsForToday(tomorrowStr);
      console.log(`Sending ${tomorrowBookings.length} day-before reminders for ${tomorrowStr}`);
      
      for (const [userId, name, age, gender, date, time, test] of tomorrowBookings) {
        try {
          await bot.sendMessage(userId, `⏰ *Tomorrow's Reminder*\n\nHello ${name}! Your *${test}* test is scheduled TOMORROW (${date}) at *${time}*.\n\n📍 Please arrive 15 minutes early.\n🧪 Remember to follow any pre-test instructions.\n💧 Fast for 8-12 hours if required for your test.\n\nThank you! 🩺`, { parse_mode: 'Markdown' });
          console.log(`Day-before reminder sent to ${userId} for ${test} at ${time} on ${date}`);
        } catch (error) {
          console.error(`Failed to send day-before reminder to ${userId}:`, error);
        }
      }
      
      // Mark this date as processed
      remindersSent.add(todayStr);
      
    } catch (error) {
      console.error('Error fetching bookings for reminders:', error);
    }
  }
  
  // Clear old reminder tracking at midnight
  if (currentHour === 0 && currentMinute === 0) {
    remindersSent.clear();
  }
}

// Set up reminder checking every minute
setInterval(async () => {
  await checkAndSendReminders();
}, 60 * 1000); // Check every minute

// Handle /start command
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  
  const alreadyBooked = await hasUserBooked(userId);
  if (alreadyBooked) {
    bookedUsers.add(userId);
    return bot.sendMessage(chatId, '✅ You already have a booking. Use /summary to view it.');
  }

  const welcomeMessage = `👋 Welcome to *Blood Test Bot*!\n\n🩺 Available Commands:\n/booktest - Start booking a test\n/summary - View your booking\n/cancel - Cancel your booking\n/help - Show help\n/support - Contact support\n\n💬 To book a test, I'll need: Name, Age, Gender, Test type, Date, and Time.`;
  
  bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
});

// Handle /help command
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const helpMessage = `🤖 *Help - Available Commands*\n\n/booktest - Start booking a blood test\n/summary - View your current booking\n/cancel - Cancel your current booking\n/support - Contact support\n\n📋 *Booking Process:*\n1️⃣ Provide your full name\n2️⃣ Enter your age\n3️⃣ Select gender\n4️⃣ Choose test type\n5️⃣ Pick date (YYYY-MM-DD format)\n6️⃣ Select time slot\n\n⏰ *Available Time Slots:*\n• 9:00 AM\n• 10:00 AM\n• 11:00 AM\n• 12:00 PM\n\n🧪 *Available Tests:*\n• CBC (Complete Blood Count)\n• LFT (Liver Function Test)\n• KFT (Kidney Function Test)\n• Diabetes Panel\n• Thyroid Panel`;
  
  bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
});

// Handle /summary command
bot.onText(/\/summary/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  
  const booking = await getUserBooking(userId);
  if (!booking) {
    return bot.sendMessage(chatId, '❌ No booking found. Use /booktest to make a booking.');
  }
  
  const [_, name, age, gender, date, time, test] = booking;
  const summaryMessage = `📝 *Your Booking Details*\n\n👤 Name: ${name}\n🎂 Age: ${age}\n⚧️ Gender: ${gender}\n🧪 Test: ${test}\n📅 Date: ${date}\n⏰ Time: ${time}\n\n✅ Your booking is confirmed!`;
  
  bot.sendMessage(chatId, summaryMessage, { parse_mode: 'Markdown' });
});

// Handle /cancel command
bot.onText(/\/cancel/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  
  const cancelled = await cancelUserBooking(userId);
  if (cancelled) {
    bookedUsers.delete(userId);
    clearUserState(userId);
    bot.sendMessage(chatId, '❌ Your booking has been cancelled successfully.');
  } else {
    bot.sendMessage(chatId, '⚠️ No booking found to cancel.');
  }
});

// Handle /support command
bot.onText(/\/support/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, '📞 *Support Contact*\n\nPhone: +91-9773065512\n\nFor any queries or assistance, please contact us during business hours.', { parse_mode: 'Markdown' });
});

// Handle /booktest command
bot.onText(/\/booktest/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  
  if (await hasUserBooked(userId) || bookedUsers.has(userId)) {
    bookedUsers.add(userId);
    return bot.sendMessage(chatId, '✅ You already have a booking. Use /summary to view it.');
  }
  
  userStates[userId] = { step: 1, data: {}, locked: false };
  
  // Clear state after 15 minutes of inactivity
  setTimeout(() => clearUserState(userId), 15 * 60 * 1000);
  
  bot.sendMessage(chatId, '👤 Please enter your full name:');
});

// Admin command to export bookings (only works for bot admin)
bot.onText(/\/exportall/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  
  // Add your admin user ID here
  const ADMIN_USER_ID = '1058372563'; // Replace with actual admin user ID
  
  if (userId !== ADMIN_USER_ID) {
    return bot.sendMessage(chatId, '❌ Unauthorized command.');
  }
  
  try {
    const filePath = await exportBookingsToExcel();
    await bot.sendDocument(chatId, filePath, {}, { filename: 'bookings.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    // Clean up the file
    fs.unlinkSync(filePath);
  } catch (error) {
    console.error('Error exporting bookings:', error);
    bot.sendMessage(chatId, '❌ Error exporting bookings. Please try again later.');
  }
});

// Admin command to test reminders
bot.onText(/\/testreminder/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  
  // Add your admin user ID here
  const ADMIN_USER_ID = '1058372563'; // Replace with actual admin user ID
  
  if (userId !== ADMIN_USER_ID) {
    return bot.sendMessage(chatId, '❌ Unauthorized command.');
  }
  
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  
  const todayBookings = await getAllBookingsForToday(todayStr);
  const tomorrowBookings = await getAllBookingsForToday(tomorrowStr);
  
  let messagesSent = 0;
  
  // Test same-day reminders
  for (const [userId, name, age, gender, date, time, test] of todayBookings) {
    try {
      await bot.sendMessage(userId, `🧪 *Test Same-Day Reminder*\n\nHello ${name}! This is a test reminder for your *${test}* test scheduled TODAY at *${time}*.\n\nThis was sent manually for testing purposes.`, { parse_mode: 'Markdown' });
      messagesSent++;
    } catch (error) {
      console.error(`Failed to send test reminder to ${userId}:`, error);
    }
  }
  
  // Test day-before reminders
  for (const [userId, name, age, gender, date, time, test] of tomorrowBookings) {
    try {
      await bot.sendMessage(userId, `🧪 *Test Day-Before Reminder*\n\nHello ${name}! This is a test reminder for your *${test}* test scheduled TOMORROW (${date}) at *${time}*.\n\nThis was sent manually for testing purposes.`, { parse_mode: 'Markdown' });
      messagesSent++;
    } catch (error) {
      console.error(`Failed to send test reminder to ${userId}:`, error);
    }
  }
  
  if (messagesSent > 0) {
    bot.sendMessage(chatId, `✅ Test reminders sent:\n📅 Today (${todayStr}): ${todayBookings.length} bookings\n📅 Tomorrow (${tomorrowStr}): ${tomorrowBookings.length} bookings\n📤 Total messages: ${messagesSent}`);
  } else {
    bot.sendMessage(chatId, `📭 No bookings found for today (${todayStr}) or tomorrow (${tomorrowStr}).`);
  }
});

// Handle all other messages (booking flow)
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const text = msg.text || '';
  
  // Skip if it's a command
  if (text.startsWith('/')) return;
  
  const state = userStates[userId];
  if (!state || state.locked) return;
  
  const body = text.trim().toLowerCase();
  
  switch (state.step) {
    case 1: // Name input
      state.data.name = text.trim();
      state.step = 2;
      bot.sendMessage(chatId, '🎂 Please enter your age:');
      break;
      
    case 2: // Age input
      const age = parseInt(text);
      if (isNaN(age) || age < 0 || age > 120) {
        return bot.sendMessage(chatId, '❌ Please enter a valid age between 0 and 120.');
      }
      state.data.age = age;
      state.step = 3;
      
      const genderKeyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '👨 Male', callback_data: 'gender_male' },
              { text: '👩 Female', callback_data: 'gender_female' }
            ],
            [
              { text: '⚧️ Other', callback_data: 'gender_other' }
            ]
          ]
        }
      };
      
      bot.sendMessage(chatId, '⚧️ Please select your gender:', genderKeyboard);
      break;
      
    case 4: // Test selection (after gender)
      const testIdx = parseInt(text) - 1;
      if (testIdx < 0 || testIdx >= TEST_OPTIONS.length) {
        return bot.sendMessage(chatId, '❌ Please select a valid test number from the list above.');
      }
      state.data.test = TEST_OPTIONS[testIdx];
      state.step = 5;
      bot.sendMessage(chatId, '📅 Please enter the date for your test (YYYY-MM-DD format):\n\nExample: 2024-01-15');
      break;
      
    case 5: // Date input
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const inputDate = new Date(text);
      
      if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(text) || inputDate < today) {
        return bot.sendMessage(chatId, '❌ Please enter a valid future date in YYYY-MM-DD format.\n\nExample: 2024-01-15');
      }
      
      state.data.date = text;
      state.step = 6;
      
      const timeKeyboard = {
        reply_markup: {
          inline_keyboard: TIME_SLOTS.map((slot, index) => [
            { text: `⏰ ${slot}`, callback_data: `time_${index}` }
          ])
        }
      };
      
      bot.sendMessage(chatId, '⏰ Please select your preferred time slot:', timeKeyboard);
      break;
      
    default:
      // Handle invalid input during booking process
      if (state.step > 1 && state.step < 7) {
        bot.sendMessage(chatId, '❌ Please follow the booking process. Use the buttons or enter the requested information.');
      }
      break;
  }
  
  userStates[userId] = state;
});

// Handle inline keyboard callbacks
bot.on('callback_query', async (callbackQuery) => {
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;
  const userId = callbackQuery.from.id.toString();
  const data = callbackQuery.data;
  
  const state = userStates[userId];
  if (!state || state.locked) {
    return bot.answerCallbackQuery(callbackQuery.id, 'Session expired. Please start over with /booktest');
  }
  
  if (data.startsWith('gender_')) {
    const gender = data.split('_')[1];
    state.data.gender = gender.charAt(0).toUpperCase() + gender.slice(1);
    state.step = 4;
    
    bot.answerCallbackQuery(callbackQuery.id);
    bot.editMessageText('⚧️ Gender selected: ' + state.data.gender, {
      chat_id: chatId,
      message_id: msg.message_id
    });
    
    const testList = TEST_OPTIONS.map((test, index) => `${index + 1}. ${test}`).join('\n');
    bot.sendMessage(chatId, `🧪 Please select a test by entering the number:\n\n${testList}`);
    
  } else if (data.startsWith('time_')) {
    const timeIdx = parseInt(data.split('_')[1]);
    const { name, age, gender, date, test } = state.data;
    const time = TIME_SLOTS[timeIdx];
    
    // Check slot availability
    const bookingsAtSlot = await getBookingsBySlot(date, time);
    if (bookingsAtSlot.length >= SLOT_LIMIT) {
      return bot.answerCallbackQuery(callbackQuery.id, '❌ This time slot is full. Please choose another slot.');
    }
    
    try {
      state.locked = true; // Prevent repeat submissions
      
      await appendBooking(userId, name, age, gender, date, time, test);
      
      bot.answerCallbackQuery(callbackQuery.id, '✅ Booking confirmed!');
      bot.editMessageText(`⏰ Time selected: ${time}`, {
        chat_id: chatId,
        message_id: msg.message_id
      });
      
      const confirmationMessage = `✅ *Booking Confirmed!*\n\n👤 Name: ${name}\n🎂 Age: ${age}\n⚧️ Gender: ${gender}\n🧪 Test: ${test}\n📅 Date: ${date}\n⏰ Time: ${time}\n\n📱 You'll receive reminders before your appointment.\n🎟️ QR code is being generated...`;
      
      await bot.sendMessage(chatId, confirmationMessage, { parse_mode: 'Markdown' });
      
      // Generate and send QR code
      try {
        const qrData = `Name: ${name}\nTest: ${test}\nDate: ${date}\nTime: ${time}`;
        const qrBuffer = await QRCode.toBuffer(qrData);
        await bot.sendPhoto(chatId, qrBuffer, { caption: '🎟️ Your Booking QR Code\n\nPlease show this QR code at the clinic.' });
      } catch (qrError) {
        console.error('Error generating QR code:', qrError);
        bot.sendMessage(chatId, '⚠️ QR code generation failed, but your booking is confirmed.');
      }
      
      bookedUsers.add(userId);
      clearUserState(userId);
      
    } catch (err) {
      console.error('Booking error:', err);
      bot.answerCallbackQuery(callbackQuery.id, '❌ Booking failed. Please try again.');
      bot.sendMessage(chatId, '❌ Sorry, there was an error processing your booking. Please try again later.');
      clearUserState(userId);
    }
  }
  
  userStates[userId] = state;
});

// Error handling
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

bot.on('error', (error) => {
  console.error('Bot error:', error);
});

console.log('🤖 Telegram Blood Test Bot started successfully!');
console.log('📝 Make sure to:');
console.log('1. Replace YOUR_BOT_TOKEN_HERE with your actual bot token');
console.log('2. Replace YOUR_ADMIN_USER_ID with your Telegram user ID');
console.log('3. Set up your Google Sheets credentials');