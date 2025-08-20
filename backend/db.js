import mongoose from "mongoose";

export async function connectDB() {
  try {
    const uri = process.env.MONGO_URI; // Put your MongoDB Atlas URI in .env file
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ MongoDB Atlas Connected");
  } catch (err) {
    console.error("❌ MongoDB Connection Error:", err.message);
    process.exit(1);
  }
}

const activitySchema = new mongoose.Schema({
  url: { type: String, required: true },
  domain: { type: String, required: true },
  time_spent: { type: Number, required: true },
  classification: { type: String, default: "Uncategorized" },
  timestamp: { type: Date, default: Date.now },
});

export const ActivityLog = mongoose.model("ActivityLog", activitySchema);
