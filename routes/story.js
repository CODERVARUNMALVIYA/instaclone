
const mongoose = require("mongoose");

const storySchema = mongoose.Schema({
  media: String,
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user"
  },
  mediaType: { type: String, enum: ["image", "video"] },
  createdAt: { type: Date, default: Date.now, expires: '24h' } 
});

module.exports = mongoose.model("story", storySchema);
