// Import required modules
const mongoose = require('mongoose');

// Define the MessageSchema
const messageSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true
  },
  author: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Export Message model
module.exports = mongoose.model('comment', messageSchema);
