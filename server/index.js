const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { connectDB, mockDB } = require('./config/config.mongoose');
const User = require('./models/User');
const SurveyResponse = require('./models/SurveyResponse');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;
let dbMode = 'memory'; // Will be set after connection attempt

// Middleware
app.use(cors({
  origin: "http://localhost:5173",
  credentials: true
}));
app.use(express.json());

// Connect to database
(async () => {
  dbMode = await connectDB();
})();

// Helper function to simulate real-time updates for in-memory mode
const broadcastUpdate = async () => {
  try {
    let tallies;
    if (dbMode === 'mongodb') {
      // Use MongoDB aggregation
      const tallyData = await SurveyResponse.aggregate([
        {
          $group: {
            _id: {
              questionId: '$questionId',
              selectedOption: '$selectedOption'
            },
            count: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: '$_id.questionId',
            options: {
              $push: {
                option: '$_id.selectedOption',
                count: '$count'
              }
            }
          }
        }
      ]);

      tallies = {};
      tallyData.forEach(item => {
        tallies[item._id] = {};
        item.options.forEach(opt => {
          tallies[item._id][opt.option] = opt.count;
        });
      });
    } else {
      // Use in-memory data
      tallies = mockDB.getTallies();
    }

    // Broadcast to all connected clients
    io.emit('tallies-updated', tallies);
    console.log('📡 Broadcasted real-time update to all clients');
  } catch (error) {
    console.error('Error broadcasting update:', error);
  }
};

// Routes
// Register user
app.post('/api/users/register', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required' });
    }

    let user;
    if (dbMode === 'mongodb') {
      user = new User({ name: name.trim() });
      await user.save();
      user = { id: user._id, name: user.name };
    } else {
      user = mockDB.saveUser({ name: name.trim() });
      user = { id: user._id, name: user.name };
    }
    
    res.status(201).json({ 
      success: true, 
      user
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// Submit survey response
app.post('/api/survey/submit', async (req, res) => {
  try {
    const { userId, userName, questionId, selectedOption } = req.body;
    
    if (!userId || !userName || !questionId || !selectedOption) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    let response;
    if (dbMode === 'mongodb') {
      response = new SurveyResponse({
        userId,
        userName,
        questionId,
        selectedOption
      });
      await response.save();
    } else {
      response = mockDB.saveResponse({
        userId,
        userName,
        questionId,
        selectedOption
      });
      
      // Broadcast new response to admin in memory mode
      io.to('admin').emit('new-response', response);
    }
    
    // Broadcast updated tallies
    await broadcastUpdate();
    
    res.status(201).json({ 
      success: true, 
      response: { 
        id: response._id, 
        questionId: response.questionId || questionId, 
        selectedOption: response.selectedOption || selectedOption 
      } 
    });
  } catch (error) {
    console.error('Error submitting survey response:', error);
    res.status(500).json({ error: 'Failed to submit survey response' });
  }
});

// Get survey tallies
app.get('/api/survey/tallies', async (req, res) => {
  try {
    let tallies;
    if (dbMode === 'mongodb') {
      const tallyData = await SurveyResponse.aggregate([
        {
          $group: {
            _id: {
              questionId: '$questionId',
              selectedOption: '$selectedOption'
            },
            count: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: '$_id.questionId',
            options: {
              $push: {
                option: '$_id.selectedOption',
                count: '$count'
              }
            }
          }
        }
      ]);

      tallies = {};
      tallyData.forEach(item => {
        tallies[item._id] = {};
        item.options.forEach(opt => {
          tallies[item._id][opt.option] = opt.count;
        });
      });
    } else {
      tallies = mockDB.getTallies();
    }

    res.json(tallies);
  } catch (error) {
    console.error('Error fetching tallies:', error);
    res.status(500).json({ error: 'Failed to fetch tallies' });
  }
});

// Get all responses for admin
app.get('/api/survey/responses', async (req, res) => {
  try {
    let responses;
    if (dbMode === 'mongodb') {
      responses = await SurveyResponse.find()
        .sort({ timestamp: -1 })
        .limit(100);
    } else {
      responses = mockDB.getRecentResponses(100);
    }
    
    res.json(responses);
  } catch (error) {
    console.error('Error fetching responses:', error);
    res.status(500).json({ error: 'Failed to fetch responses' });
  }
});

// Reset data (useful for testing)
app.post('/api/reset', (req, res) => {
  if (dbMode === 'memory') {
    mockDB.clear();
    io.emit('tallies-updated', {});
    res.json({ success: true, message: 'Data reset successfully' });
  } else {
    res.status(400).json({ error: 'Reset only available in memory mode' });
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('👤 User connected:', socket.id);
  
  socket.on('join-admin', () => {
    socket.join('admin');
    console.log('👑 Admin joined:', socket.id);
  });
  
  socket.on('disconnect', () => {
    console.log('👋 User disconnected:', socket.id);
  });
});

// MongoDB Change Streams for real-time updates (only when using MongoDB)
const mongoose = require('mongoose');

if (dbMode === 'mongodb') {
  mongoose.connection.once('open', () => {
    console.log('📡 Setting up MongoDB Change Streams...');
    
    // Watch for changes in survey responses
    const changeStream = SurveyResponse.watch();
    
    changeStream.on('change', async (change) => {
      console.log('📊 Survey response change detected:', change.operationType);
      
      if (change.operationType === 'insert') {
        try {
          // Broadcast new response to admin
          const newResponse = change.fullDocument;
          io.to('admin').emit('new-response', newResponse);
          
          // Update tallies will be handled by broadcastUpdate in the submit route
          console.log('📡 Broadcasted new response to admin clients');
        } catch (error) {
          console.error('Error processing change stream:', error);
        }
      }
    });
  });
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    database: dbMode,
    message: dbMode === 'memory' ? 'Using in-memory storage (data will be lost on restart)' : 'Using MongoDB persistent storage'
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.IO server ready for connections`);
  console.log(`💾 Database mode: ${dbMode}`);
});
