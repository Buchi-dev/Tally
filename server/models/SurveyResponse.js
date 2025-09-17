const mongoose = require('mongoose');

const surveyResponseSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  questionId: {
    type: String,
    required: true
  },
  selectedOption: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient querying
surveyResponseSchema.index({ questionId: 1, selectedOption: 1 });
surveyResponseSchema.index({ userId: 1 });

const SurveyResponse = mongoose.model('SurveyResponse', surveyResponseSchema);
module.exports = SurveyResponse;