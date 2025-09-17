import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const API_BASE_URL = 'https://tally-1-8mql.onrender.com/api';
const socket = io('https://tally-1-8mql.onrender.com');

function App() {
  // User state
  const [user, setUser] = useState(null);
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Survey state
  const [currentView, setCurrentView] = useState('survey'); // 'survey' or 'admin'
  const [tallies, setTallies] = useState({});
  const [responses, setResponses] = useState([]);
  // Store answers for all questions
  const [answers, setAnswers] = useState({});
  const [submitLoading, setSubmitLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [talliesLoading, setTalliesLoading] = useState(true);
  const [dataUpdated, setDataUpdated] = useState(false);

  // Define survey sections and their options
  const surveyStructure = {
    A: {
      title: "Water Fountain Usage Patterns",
      questions: {
        1: "How often do you use the water fountains on campus?",
        2: "How confident are you about the quality of water provided by campus fountains?"
      },
      options: ["Never", "Rarely", "Sometimes", "Often", "Always"]
    },
    B: {
      title: "Water Quality Issues Experience",
      questions: {
        3: "How often have you experienced unusual taste in fountain water?",
        4: "How often have you experienced unusual odor in fountain water?",
        5: "How often have you noticed unusual appearance (cloudiness, discoloration) in fountain water?",
        6: "How often have you experienced low water pressure from the fountains?",
        7: "How often have you found water fountains to be out of service/not working?"
      },
      options: ["Never", "Rarely", "Sometimes", "Often", "Always"]
    },
    C: {
      title: "Problem Reporting and Response",
      questions: {
        11: {
          text: "Have you ever avoided using a water fountain due to quality concerns?",
          options: ["Yes", "No"]
        },
        12: {
          text: "Have you ever reported a problem with a water fountain to campus facilities/maintenance?",
          options: ["Yes", "No"]
        },
        13: {
          text: "If you reported a problem, how satisfied were you with how quickly it was resolved?",
          options: ["Very dissatisfied", "Dissatisfied", "Neutral", "Satisfied", "Very satisfied", "N/A (Never reported)"]
        }
      }
    },
    D: {
      title: "User Preferences and Needs",
      questions: {
        14: "How important is it for you to know when a water fountain was last serviced/cleaned?",
        15: "How important is it for you to have more water fountains available on campus?",
        16: "How important is it for you to have water bottle filling stations in addition to traditional fountains?"
      },
      options: ["Not important at all", "Slightly important", "Moderately important", "Very important", "Extremely important"]
    },
    E: {
      title: "Health and Usage Impact",
      questions: {
        17: "I trust the campus water fountains to provide safe drinking water",
        18: "I would use water fountains more often if I was confident about water quality",
        19: "Water fountain quality affects my daily hydration habits on campus",
        20: "I believe improving water fountains would benefit the campus community"
      },
      options: ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"]
    },
    F: {
      title: "Alternative Water Sources",
      questions: {
        21: "How often do you bring your own water bottle instead of using campus fountains?",
        22: "How often do you purchase bottled water instead of using campus fountains?"
      },
      options: ["Never", "Rarely", "Sometimes", "Often", "Always"]
    },
    Demographics: {
      title: "Demographics (Optional)",
      questions: {
        23: {
          text: "What is your role on campus?",
          options: ["Student", "Graduate student", "Faculty", "Staff", "Visitor"]
        },
        24: {
          text: "How long have you been on SMU campus?",
          options: ["Less than 1 year", "1-2 years", "3-4 years", "5+ years"]
        }
      }
    },
    Comments: {
      question: 25,
      schools: ["SEAIT", "SAB", "SHANS", "STEH", "SHS"]
    }
  };

  // Socket.IO setup
  useEffect(() => {
    // Socket connection events
    socket.on('connect', () => {
      console.log('🔗 Socket connected');
      setSocketConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('🔌 Socket disconnected');
      setSocketConnected(false);
    });

    // Listen for real-time tally updates
    socket.on('tallies-updated', (newTallies) => {
      console.log('📡 Received real-time tally update:', newTallies);
      setTallies(newTallies);
      setTalliesLoading(false); // Stop loading when real-time data arrives
      
      // Show update indicator
      setDataUpdated(true);
      setTimeout(() => setDataUpdated(false), 2000);
    });

    // Listen for new responses (admin view)
    socket.on('new-response', (newResponse) => {
      console.log('📡 Received new response:', newResponse);
      setResponses(prev => [newResponse, ...prev.slice(0, 99)]); // Keep last 100
    });

    // Load initial tallies
    loadTallies();

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('tallies-updated');
      socket.off('new-response');
    };
  }, []);

  // Join admin room when switching to admin view
  useEffect(() => {
    if (currentView === 'admin') {
      socket.emit('join-admin');
      loadResponses();
    }
  }, [currentView]);

  // API calls
  const registerUser = async () => {
    if (!userName.trim()) {
      setError('Please enter your name');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: userName.trim() })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to register');
      }

      setUser(data.user);
      console.log('✅ User registered:', data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };


  // Submit all answers at once
  const submitAllResponses = async () => {
    if (!user) return;
    setSubmitLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/survey/submit-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          userName: user.name,
          answers
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit responses');
      }
      // Optionally reset answers or show a thank you message
      setAnswers({});
      // Show toast notification
      setShowToast(true);
      // Hide toast after 4 seconds
      setTimeout(() => setShowToast(false), 4000);
      
      // Immediately request updated tallies for instant feedback
      loadTallies();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  const loadTallies = async () => {
    try {
      setTalliesLoading(true);
      const response = await fetch(`${API_BASE_URL}/survey/tallies`);
      const data = await response.json();
      setTallies(data);
    } catch (err) {
      console.error('❌ Error loading tallies:', err);
    } finally {
      setTalliesLoading(false);
    }
  };

  const loadResponses = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/survey/responses`);
      const data = await response.json();
      setResponses(data);
    } catch (err) {
      console.error('❌ Error loading responses:', err);
    }
  };

  // Handle option selection (just update local state)
  const handleOptionClick = (question, option) => {
    setAnswers(prev => ({ ...prev, [question]: option }));
  };

  // User Registration Screen
  if (!user) {
    return (
      <div className="registration-container">
        <div className="registration-card">
          <h1>Welcome to Survey Tally System</h1>
          <p>Please enter your name to participate in the survey</p>
          
          {error && <div className="error-message">{error}</div>}
          
          <div className="input-group">
            <input
              type="text"
              placeholder="Enter your name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && registerUser()}
              disabled={loading}
              className="name-input"
            />
            <button 
              onClick={registerUser} 
              disabled={loading || !userName.trim()}
              className="register-button"
            >
              {loading ? 'Registering...' : 'Start Survey'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render question section
  const renderSection = (section, sectionData) => {
    if (section === 'C') {
      return (
        <div key={section} className="section">
          <h2>Section {section}: {sectionData.title}</h2>
          {sectionData.questions && Object.entries(sectionData.questions).map(([questionNum, questionData]) => (
            <div key={questionNum} className="question">
              <h3>Q{questionNum}</h3>
              <p className="question-text">{questionData.text}</p>
              <div className="options">
                {Array.isArray(questionData.options) && questionData.options.map(option => (
                  <button
                    key={option}
                    onClick={() => handleOptionClick(questionNum, option)}
                    className={`option-button${answers[questionNum] === option ? ' selected' : ''}`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div key={section} className="section">
        <h2>Section {section}: {sectionData.title}</h2>
        {sectionData.questions && Object.entries(sectionData.questions).map(([questionNum, questionValue]) => {
          // If questionValue is an object (with text/options), handle like section C
          if (typeof questionValue === 'object' && questionValue !== null && 'text' in questionValue && 'options' in questionValue) {
            return (
              <div key={questionNum} className="question">
                <h3>Q{questionNum}</h3>
                <p className="question-text">{questionValue.text}</p>
                <div className="options">
                  {Array.isArray(questionValue.options) && questionValue.options.map(option => (
                    <button
                      key={option}
                      onClick={() => handleOptionClick(questionNum, option)}
                      className={`option-button${answers[questionNum] === option ? ' selected' : ''}`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            );
          } else {
            // Otherwise, treat as string question
            return (
              <div key={questionNum} className="question">
                <h3>Q{questionNum}</h3>
                <p className="question-text">{questionValue}</p>
                <div className="options">
                  {Array.isArray(sectionData.options) && sectionData.options.map(option => (
                    <button
                      key={option}
                      onClick={() => handleOptionClick(questionNum, option)}
                      className={`option-button${answers[questionNum] === option ? ' selected' : ''}`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            );
          }
        })}
      </div>
    );
  };

  // Render tally results
  const renderTallies = () => {
    return tallies && Object.entries(tallies).map(([question, options]) => (
      <div key={question} className="tally-row">
        <h3>Q{question}</h3>
        <div className="tally-options">
          {options && Object.entries(options).map(([option, count]) => (
            <div key={option} className="tally-option">
              <span className="option-name">{option}</span>
              <span className="option-count">{count}</span>
              <div className="option-bar">
                <div 
                  className="option-bar-fill" 
                  style={{ 
                    width: `${Math.max(
                      (count / Math.max(...Object.values(options))) * 100, 
                      5
                    )}%` 
                  }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    ));
  };

  // Admin view
  if (currentView === 'admin') {
    return (
      <div className="admin-container">
        <div className="admin-header">
          <h1>📊 Admin Dashboard</h1>
          <div className="admin-nav">
            <button 
              onClick={() => setCurrentView('survey')} 
              className="nav-button"
            >
              👤 Survey View
            </button>
            <span className="user-info">Logged in as: {user.name}</span>
          </div>
        </div>

        <div className="admin-content">
          <div className="admin-section">
            <h2>📈 Real-time Tally Results</h2>
            <div className="tallies-grid">
              {renderTallies()}
            </div>
          </div>

          <div className="admin-section">
            <h2>📝 Recent Responses ({responses.length})</h2>
            <div className="responses-list">
              {Array.isArray(responses) && responses.map((response, index) => (
                <div key={response._id || index} className="response-item">
                  <div className="response-header">
                    <span className="response-user">{response.userName}</span>
                    <span className="response-time">
                      {new Date(response.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="response-content">
                    <span className="response-question">Q{response.questionId}</span>
                    <span className="response-arrow">→</span>
                    <span className="response-option">{response.selectedOption}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Survey view
  // Get all required question numbers (excluding Demographics/Comments if optional)
  const requiredQuestions = [];
  Object.entries(surveyStructure).forEach(([section, sectionData]) => {
    if (section === 'Demographics' || section === 'Comments') return; // skip optional
    if (section === 'C') {
      Object.keys(sectionData.questions).forEach(q => requiredQuestions.push(q));
    } else {
      Object.keys(sectionData.questions).forEach(q => requiredQuestions.push(q));
    }
  });
  const allAnswered = requiredQuestions.every(q => answers[q]);

  return (
    <div className="app-container">
      {/* Toast Notification */}
      {showToast && (
        <div className="toast-notification">
          <div className="toast-content">
            <span className="toast-icon">✅</span>
            <span className="toast-message">Survey Recorded</span>
          </div>
        </div>
      )}
      
      <div className="app-header">
        <h1>📋 Survey Participation</h1>
        <div className="user-nav">
          <span className="user-info">Welcome, {user.name}!</span>
          <button 
            onClick={() => setCurrentView('admin')} 
            className="nav-button"
          >
            📊 Admin View
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      
      <div className="main-content">
        <div className="questions-container">
          <h2>Survey Questions</h2>
          {surveyStructure && Object.entries(surveyStructure).map(([section, data]) =>
            renderSection(section, data)
          )}
          <div className="submit-section">
            <div className="submit-container">
              <button
                className={`submit-button ${!allAnswered ? 'disabled' : ''} ${submitLoading ? 'loading' : ''}`}
                onClick={submitAllResponses}
                disabled={!allAnswered || submitLoading}
              >
                {submitLoading ? (
                  <>
                    <div className="loading-spinner"></div>
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <span className="submit-icon">📝</span>
                    <span>Submit All Answers</span>
                    <span className="submit-count">({Object.keys(answers).length} answered)</span>
                  </>
                )}
              </button>
              {!allAnswered && (
                <div className="submit-warning">
                  <span className="warning-icon">⚠️</span>
                  Please answer all questions before submitting.
                </div>
              )}
              {allAnswered && !submitLoading && (
                <div className="submit-ready">
                  <span className="ready-icon">✅</span>
                  Ready to submit your responses
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="results-container">
          <h2>📊 Live Results</h2>
          <div className="real-time-indicator">
            <div className={`pulse-dot ${socketConnected ? 'connected' : 'disconnected'}`}></div>
            <span className="connection-status">
              {socketConnected ? 'Real-time updates enabled' : 'Connecting...'}
            </span>
            {dataUpdated && (
              <span className="data-updated-indicator">
                ✨ Updated
              </span>
            )}
          </div>
          {talliesLoading ? (
            <div className="loading-tallies">
              <div className="loading-spinner-large"></div>
              <p>Loading live results...</p>
            </div>
          ) : (
            <div className={`tallies-container ${dataUpdated ? 'data-updated' : ''}`}>
              {renderTallies()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
