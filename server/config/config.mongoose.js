const mongoose = require('mongoose');

// Mock in-memory data store for demo purposes
let mockUsers = [];
let mockResponses = [];

const connectDB = async () => {
  try {
    // Try to connect to MongoDB first
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tally_survey';
    
    try {
      await mongoose.connect(mongoURI, {
        serverSelectionTimeoutMS: 3000, // Timeout after 3 seconds
        socketTimeoutMS: 3000,
      });
      console.log('✅ MongoDB connected successfully');
      return 'mongodb';
    } catch (mongoError) {
      console.log('⚠️  MongoDB not available, using in-memory storage for demo');
      console.log('   Run MongoDB locally to enable persistent storage');
      return 'memory';
    }
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    console.log('📝 Using in-memory storage for demo purposes');
    return 'memory';
  }
};

// Mock database functions for in-memory storage
const mockDB = {
  saveUser: (userData) => {
    const user = {
      _id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: userData.name,
      timestamp: new Date()
    };
    mockUsers.push(user);
    return user;
  },

  saveResponse: (responseData) => {
    const response = {
      _id: `response_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: responseData.userId,
      userName: responseData.userName,
      questionId: responseData.questionId,
      selectedOption: responseData.selectedOption,
      timestamp: new Date()
    };
    mockResponses.push(response);
    return response;
  },

  getTallies: () => {
    const tallies = {};
    mockResponses.forEach(response => {
      if (!tallies[response.questionId]) {
        tallies[response.questionId] = {};
      }
      if (!tallies[response.questionId][response.selectedOption]) {
        tallies[response.questionId][response.selectedOption] = 0;
      }
      tallies[response.questionId][response.selectedOption]++;
    });
    return tallies;
  },

  getRecentResponses: (limit = 100) => {
    return mockResponses
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  },

  clear: () => {
    mockUsers = [];
    mockResponses = [];
  }
};

module.exports = { connectDB, mockDB };