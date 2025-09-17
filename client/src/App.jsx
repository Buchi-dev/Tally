import { useState } from 'react';
import './App.css';

function App() {
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

  // Initialize tally state
  const [tallies, setTallies] = useState({});

  // Handle option selection
  const handleOptionClick = (question, option) => {
    setTallies(prev => ({
      ...prev,
      [question]: {
        ...(prev[question] || {}),
        [option]: (prev[question]?.[option] || 0) + 1
      }
    }));
  };

  // Reset all tallies
  const handleReset = () => {
    setTallies({});
  };

  // Download CSV
  const handleDownload = () => {
    let csv = 'Question,Option,Count\n';
    
    Object.entries(tallies).forEach(([question, options]) => {
      Object.entries(options).forEach(([option, count]) => {
        csv += `Q${question},${option},${count}\n`;
      });
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'survey-tallies.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Render question section
  const renderSection = (section, sectionData) => {
    if (section === 'Comments') {
      return (
        <div key={section} className="section">
          <h2>SCHOOL (Q{sectionData.question})</h2>
          <div className="options">
            {sectionData.schools.map(school => (
              <button
                key={school}
                onClick={() => handleOptionClick(sectionData.question, school)}
                className="option-button"
              >
                {school}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (section === 'C' || section === 'Demographics') {
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
              {option}: {count}
            </div>
          ))}
        </div>
      </div>
    ));
  };

  return (
    <div className="app-container">
      <div className="questions-container">
        {Object.entries(surveyStructure).map(([section, data]) =>
          renderSection(section, data)
        )}
      </div>
      
      <div className="results-container">
        <h2>Tally Results</h2>
        {renderTallies()}
      </div>
      
      <div className="controls">
        <button onClick={handleReset} className="control-button">
          Reset Tallies
        </button>
        <button onClick={handleDownload} className="control-button">
          Download CSV
        </button>
      </div>
    </div>
  );
}

export default App;
