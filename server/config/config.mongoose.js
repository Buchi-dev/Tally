const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Use MongoDB Atlas connection string or local MongoDB
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tally_survey';
    
    await mongoose.connect(mongoURI);
    
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    console.error('Please ensure MongoDB is running on your system or provide a valid MONGODB_URI');
    process.exit(1);
  }
};

module.exports = connectDB;