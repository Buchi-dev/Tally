// Submit all survey answers at once
app.post('/api/survey/submit-all', async (req, res) => {
  try {
    const { userId, userName, answers } = req.body;
    if (!userId || !userName || !answers || typeof answers !== 'object') {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Prepare SurveyResponse documents for each answer
    const responses = Object.entries(answers).map(([questionId, selectedOption]) => ({
      userId,
      userName,
      questionId,
      selectedOption
    }));

    // Save all responses in bulk
    await SurveyResponse.insertMany(responses);

    res.status(201).json({ success: true, count: responses.length });
  } catch (error) {
    console.error('Error submitting all survey responses:', error);
    res.status(500).json({ error: 'Failed to submit all survey responses' });
  }
});
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const connectDB = require('./config/config.mongoose');
const User = require('./models/User');
const SurveyResponse = require('./models/SurveyResponse');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "https://tally-orpin.vercel.app/",
    methods: ["GET", "POST"]
  }
});

const PORT = 3001;

// Middleware
app.use(cors({
  origin: "https://tally-orpin.vercel.app/",
  credentials: true
}));
app.use(express.json());

// Connect to MongoDB
connectDB();

// Routes
// Register user
app.post('/api/users/register', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const user = new User({ name: name.trim() });
    await user.save();
    
    res.status(201).json({ 
      success: true, 
      user: { id: user._id, name: user.name } 
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

    const response = new SurveyResponse({
      userId,
      userName,
      questionId,
      selectedOption
    });
    
    await response.save();
    
    res.status(201).json({ 
      success: true, 
      response: { 
        id: response._id, 
        questionId: response.questionId, 
        selectedOption: response.selectedOption 
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
    const tallies = await SurveyResponse.aggregate([
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

    // Format the response to match frontend expectations
    const formattedTallies = {};
    tallies.forEach(item => {
      formattedTallies[item._id] = {};
      item.options.forEach(opt => {
        formattedTallies[item._id][opt.option] = opt.count;
      });
    });

    res.json(formattedTallies);
  } catch (error) {
    console.error('Error fetching tallies:', error);
    res.status(500).json({ error: 'Failed to fetch tallies' });
  }
});

// Get all responses for admin
app.get('/api/survey/responses', async (req, res) => {
  try {
    const responses = await SurveyResponse.find()
      .sort({ timestamp: -1 })
      .limit(100); // Limit to last 100 responses
    
    res.json(responses);
  } catch (error) {
    console.error('Error fetching responses:', error);
    res.status(500).json({ error: 'Failed to fetch responses' });
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

// MongoDB Change Streams for real-time updates
const mongoose = require('mongoose');

mongoose.connection.once('open', () => {
  console.log('📡 Setting up MongoDB Change Streams...');
  
  // Watch for changes in survey responses
  const changeStream = SurveyResponse.watch();
  
  changeStream.on('change', async (change) => {
    console.log('📊 Survey response change detected:', change.operationType);
    
    if (change.operationType === 'insert') {
      try {
        // Recalculate tallies and broadcast to all connected clients
        const tallies = await SurveyResponse.aggregate([
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

        // Format the response
        const formattedTallies = {};
        tallies.forEach(item => {
          formattedTallies[item._id] = {};
          item.options.forEach(opt => {
            formattedTallies[item._id][opt.option] = opt.count;
          });
        });

        // Broadcast to all connected clients
        io.emit('tallies-updated', formattedTallies);
        
        // Broadcast new response to admin
        const newResponse = change.fullDocument;
        io.to('admin').emit('new-response', newResponse);
        
        console.log('📡 Broadcasted real-time update to all clients');
      } catch (error) {
        console.error('Error processing change stream:', error);
      }
    }
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.IO server ready for connections`);
});
