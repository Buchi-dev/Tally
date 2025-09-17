import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const API_BASE_URL = 'https://tally-server-alpha.vercel.app/api';
const socket = io('https://tally-server-alpha.vercel.app');

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
    // Listen for real-time tally updates
    socket.on('tallies-updated', (newTallies) => {
      console.log('📡 Received real-time tally update:', newTallies);
      setTallies(newTallies);
    });

    // Listen for new responses (admin view)
    socket.on('new-response', (newResponse) => {
      console.log('📡 Received new response:', newResponse);
      setResponses(prev => [newResponse, ...prev.slice(0, 99)]); // Keep last 100
    });

    // Load initial tallies
    loadTallies();

    return () => {
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

  const submitResponse = async (questionId, selectedOption) => {
    if (!user) return;

    try {
      const response = await fetch(`${API_BASE_URL}/survey/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          userName: user.name,
          questionId: questionId.toString(),
          selectedOption
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit response');
      }

      console.log('✅ Response submitted:', data.response);
    } catch (err) {
      console.error('❌ Error submitting response:', err);
      setError(err.message);
    }
  };

  const loadTallies = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/survey/tallies`);
      const data = await response.json();
      setTallies(data);
    } catch (err) {
      console.error('❌ Error loading tallies:', err);
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

  // Handle option selection
  const handleOptionClick = async (question, option) => {
    await submitResponse(question, option);
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
          {Object.entries(sectionData.questions).map(([questionNum, questionData]) => (
            <div key={questionNum} className="question">
              <h3>Q{questionNum}</h3>
              <p className="question-text">{questionData.text}</p>
              <div className="options">
                {questionData.options.map(option => (
                  <button
                    key={option}
                    onClick={() => handleOptionClick(questionNum, option)}
                    className="option-button"
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
        {Object.entries(sectionData.questions).map(([questionNum, questionText]) => (
          <div key={questionNum} className="question">
            <h3>Q{questionNum}</h3>
            <p className="question-text">{questionText}</p>
            <div className="options">
              {sectionData.options.map(option => (
                <button
                  key={option}
                  onClick={() => handleOptionClick(questionNum, option)}
                  className="option-button"
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Render tally results
  const renderTallies = () => {
    return Object.entries(tallies).map(([question, options]) => (
      <div key={question} className="tally-row">
        <h3>Q{question}</h3>
        <div className="tally-options">
          {Object.entries(options).map(([option, count]) => (
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
              {responses.map((response, index) => (
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
  return (
    <div className="app-container">
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
          {Object.entries(surveyStructure).map(([section, data]) =>
            renderSection(section, data)
          )}
        </div>
        
        <div className="results-container">
          <h2>📊 Live Results</h2>
          <div className="real-time-indicator">
            <div className="pulse-dot"></div>
            Real-time updates enabled
          </div>
          {renderTallies()}
        </div>
      </div>
    </div>
  );
}

export default App;
