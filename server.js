const express = require('express');
const bcrypt = require('bcrypt');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URL)
    .then(() => console.log("Database connected successfully! "))
    .catch((err) => console.error("Database connection error: ", err));

const userData = new mongoose.Schema({
    userId: { type: String, required: true },
    height: { type: Number, required: true },
    weight: { type: Number, required: true },
    bmi: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now }
})

const User = mongoose.model('User', userData);

const accountSchema = new mongoose.Schema({
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
})


const Account = mongoose.model('Account', accountSchema);

const dietSchema = new mongoose.Schema({
    userId: { type: String, default: "" },
    category: { type: String, default: "" },
    weeklyDiet: [
        {
            day: String,
            breakfast: String,
            lunch: String,
            dinner: String
        }
    ],

    updatedAt: { type: Date, default: Date.now }
});

const Diet = mongoose.model("Diet", dietSchema);

app.post('/save-diet', async (req, res) => {
    const { userId, category, dietData } = req.body;
    if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
    }
    try {
        const updatedDiet = await Diet.findOneAndUpdate(
            { userId: userId },
            {
                category: category,
                weeklyDiet: dietData,
                updatedAt: Date.now()
            },
            { upsert: true, returnDocument: 'after' }
        );
        res.json({ message: "Diet plan saved successfully!", data: updatedDiet });
    } catch (error) {
        console.error("Save error:", error);
        res.status(500).json({ error: "Failed to save diet plan" });
    }
});

// GET DIET ROUTE 
app.get('/get-diet', async (req, res) => {
    const { userId } = req.query;
    if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
    }
    try {
        const diet = await Diet.findOne({ userId: userId });
        res.json({
            data: diet ? diet.weeklyDiet : [],
            category: diet ? diet.category : null
        });
    } catch (error) {
        console.error("Fetch error:", error);
        res.status(500).json({ error: "Failed to fetch diet plan" });
    }
});

app.post('/signup', async (req, res) => {
    const { username, email, password } = req.body || {};
    if (!email || !password) {
        return res.status(400).json({ error: "Please provide username, email and password" });
    }
    try {
        const existingUser = await Account.findOne({ email: email });
        if (existingUser) {
            return res.status(400).json({ error: "Email already exists! Please login." })
        }
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const newAccount = new Account({
            username: username,
            email: email,
            password: hashedPassword
        });
        const savedUser = await newAccount.save();
        res.json({
            message: "User registered successfully!",
            user: { email: savedUser.email, id: savedUser._id } 
        });
    } catch (error) {
        console.error("Signup error:", error);
        res.status(500).json({ error: "Failed to register user" });
    }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: "Please provide email and password" });
    }
    try {
        const user = await Account.findOne({ email: email });
        if (!user) {
            return res.status(400).json({ error: "User not found! Please signup first." });
        }

        const isPasswordCorrect = await bcrypt.compare(password, user.password);
        if (!isPasswordCorrect) {
            return res.status(400).json({ error: "Invalid password! Please try again." });
        }

        res.json({
            message: "Login successful! Welcome back.",
            user: { email: user.email, id: user._id }
        })
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Login failed" });
    }
});

app.get('/', (req, res) => {
    res.send("Welcome to Fitness App Backend!");
});

app.post('/calculate-bmi', async (req, res) => {
    const { userId, weight, height } = req.body;
    if (!weight || !height) {
        return res.status(400).json({ error: "Please provide weight and height" });
    }
    const heightInMeters = height / 100;
    const bmi = (weight / (heightInMeters * heightInMeters)).toFixed(1);
    try {
        const user = new User({
            userId: userId, 
            height: Number(height),
            weight: Number(weight),
            bmi: Number(bmi),
        });
        const savedData = await user.save();
        res.json({
            message: "BMI calculated and saved to database successfully!",
            userBMI: bmi,
            savedData: savedData,
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to save data to database" });
    }
});
app.get('/get-user-history', async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ success: false, message: "User ID is required" });
        }

        const db = mongoose.connection.db;
        
        const historyCollection = db.collection('histories');

        const userHistory = await historyCollection.find({
            $or: [
                { userId: userId },
                { userId: String(userId) }
            ]
        }).sort({ createdAt: -1 }).toArray();

        return res.status(200).json({
            success: true,
            data: userHistory
        });

    } catch (error) {
        console.error("Error", error);
        return res.status(500).json({
            success: false,
            message: "Server internal error",
            error: error.message
        });
    }
});

app.get('/get-all-history', async (req, res) => {
    try {
        const history = await User.find();
        res.json({
            message: "History fetched successfully! 📋",
            count: history.length,
            data: history
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to get users from database" });
    }
});
app.put('/update-bmi/:id', async (req, res) => {
    const { id } = req.params;
    const { height, weight, bmi } = req.body;
    try {
        const updatedData = await User.findByIdAndUpdate(id, { height, weight, bmi }, { returnDocument: 'after' });
        res.json(updatedData);
    } catch {
        res.status(500).json({ error: "Failed to update data" });
    }
});
app.delete('/delete-bmi/:id', async (req, res) => {
    const { id } = req.params;

    try {
        await User.findByIdAndDelete(id);
        res.json({
            message: "Record deleted successfully from database! 🗑️"
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete data" });
    }
});

const targetSchema = new mongoose.Schema({
    category: String,
    cal: Number,
    protein: Number
});
const Target = mongoose.model("Target", targetSchema);

const foodSchema = new mongoose.Schema({
    name: String,
    cal: Number,
    protein: Number
});
const Food = mongoose.model("Food", foodSchema);
const dietRecommendSchema = new mongoose.Schema({
    category: String,
    recommendedFoods: [String]
});
const DietRecommend = mongoose.model("DietRecommend", dietRecommendSchema);

app.get('/get-nutrition-config', async (req, res) => {
    try {
        const targetsData = await Target.find({});
        const foodData = await Food.find({});
        const dietDbData = await DietRecommend.find({});

        let targetsObj = {};
        targetsData.forEach(item => {
            targetsObj[item.category] = { cal: item.cal, protein: item.protein };
        });

        let foodObj = {};
        foodData.forEach(item => {
            foodObj[item.name] = { cal: item.cal, protein: item.protein };
        });

        let dietDbObj = {};
        dietDbData.forEach(item => {
            dietDbObj[item.category] = item.recommendedFoods;
        });

        res.json({
            targets: targetsObj,
            foodData: foodObj,
            dietDatabase: dietDbObj
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch nutrition data" });
    }
});

app.get('/seed-nutrition-data', async (req, res) => {
    try {
        await Target.deleteMany({});
        await Food.deleteMany({});
        await DietRecommend.deleteMany({});

        await Target.insertMany([
            { category: "Underweight", cal: 2800, protein: 145 },
            { category: "Underweight (Age 60+)", cal: 2100, protein: 120 },
            { category: "Normal Weight (BMI 18.5–24.5)", cal: 2200, protein: 150 },
            { category: "Normal Weight (Age 46–59)", cal: 2200, protein: 150 },
            { category: "Normal Weight (Age 60+)", cal: 1950, protein: 130 },
            { category: "Overweight (BMI >25)", cal: 1750, protein: 150 },
            { category: "Overweight (Age 46–59)", cal: 1700, protein: 140 },
            { category: "Overweight (Age 60+)", cal: 1650, protein: 130 }
        ]);

        await Food.insertMany([
            { name: "cup vegetables", cal: 60, protein: 2 },
            { name: "teaspoon oil", cal: 45, protein: 0 },
            { name: "cup rice", cal: 205, protein: 4.3 },
            { name: "rice", cal: 1.30, protein: 0.03 },
            { name: "fish", cal: 0.90, protein: 0.22 },
            { name: "chicken", cal: 2, protein: 0.3 },
            { name: "oats", cal: 3.89, protein: 0.17 },
            { name: "vegetables", cal: 0.50, protein: 0.02 },
            { name: "yogurt", cal: 0.6, protein: 0.035 },
            { name: "lentils", cal: 1.1, protein: 0.26 },
            { name: "egg", cal: 78, protein: 6.3 },
            { name: "bread", cal: 80, protein: 3 },
            { name: "banana", cal: 100, protein: 1 },
            { name: "milk", cal: 150, protein: 8 },
            { name: "buttermilk", cal: 110, protein: 9 },
            { name: "peanut butter", cal: 95, protein: 4 },
            { name: "shake", cal: 150, protein: 30 },
            { name: "chapati", cal: 120, protein: 4 },
            { name: "paneer", cal: 3.2, protein: 0.21 }
        ]);

        const defaultList = ["egg", "bread", "peanut butter", "banana", "milk", "oats", "honey", "rice", "fish", "chicken", "paneer", "vegetables", "yogurt", "legumes", "lentils", "beans", "shake"];
        await DietRecommend.insertMany([
            { category: "Underweight", recommendedFoods: defaultList },
            { category: "Underweight (Age 60+)", recommendedFoods: defaultList },
            { category: "Normal Weight (BMI 18.5–24.5)", recommendedFoods: defaultList },
            { category: "Normal Weight (Age 46–59)", recommendedFoods: defaultList },
            { category: "Normal Weight (Age 60+)", recommendedFoods: defaultList },
            { category: "Overweight (BMI >25)", recommendedFoods: defaultList },
            { category: "Overweight (Age 46–59)", recommendedFoods: defaultList },
            { category: "Overweight (Age 60+)", recommendedFoods: defaultList }
        ]);

        res.json({ message: "Data seeded successfully to MongoDB!" });
    } catch (err) {
        res.status(500).json({ error: "Seeding failed" });
    }
});

app.post('/forgot-password', async (req, res) => {
    try {
        const { email, newPassword } = req.body;

        if (!email || !newPassword) {
            return res.status(400).json({ 
                success: false, 
                message: "Email and new password are required" 
            });
        }

        const user = await Account.findOne({ email: email });
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: "User with this email does not exist!" 
            });
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        user.password = hashedPassword;
        await user.save();

        return res.status(200).json({
            success: true,
            message: "Password updated successfully"
        });

    } catch (error) {
        console.error("Error in forgot-password:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Server error", 
            error: error.message 
        });
    }
});
app.listen(PORT, () => {
    console.log(`Server successfully running on port ${PORT}`);
});