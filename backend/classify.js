
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { classifyActivity, saveActivity } from "./classify.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

const ActivitySchema = new mongoose.Schema({
  url: String,
  domain: String,
  category: String,
  duration: Number,
  timestamp: { type: Date, default: Date.now },
});

const Activity = mongoose.model("Activity", ActivitySchema);


app.post("/api/track", async (req, res) => {
  try {
    const { url, domain, duration } = req.body;

    const result = await saveActivity({ url, domain, duration });
    if (result.success) {
      res.json({ success: true, message: "Activity saved", category: result.category });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (err) {
    console.error("❌ Error saving activity:", err);
    res.status(500).json({ success: false, error: "Failed to save activity" });
  }
});

app.get("/api/activities", async (req, res) => {
  try {
    const activities = await Activity.find().sort({ timestamp: -1 });
    res.json(activities);
  } catch (err) {
    console.error("❌ Error fetching activities:", err);
    res.status(500).json({ success: false, error: "Failed to fetch activities" });
  }
});

app.get("/api/analytics", async (req, res) => {
  try {
    const analytics = await Activity.aggregate([
      {
        $group: {
          _id: "$category",
          totalTime: { $sum: "$duration" },
          count: { $sum: 1 },
        },
      },
    ]);
    res.json(analytics);
  } catch (err) {
    console.error("❌ Error fetching analytics:", err);
    res.status(500).json({ success: false, error: "Failed to fetch analytics" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
