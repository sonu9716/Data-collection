// ============================================================================
// frontend/src/components/SurveyForm.js
// Complete 97-item Survey with 8 Subscales
// ============================================================================

import React, { useState, useEffect } from 'react';

const SURVEY_ITEMS = {
  demographics: [
    { id: 1, text: 'What is your current year of study?', type: 'text' },
    { id: 2, text: 'What is your GPA?', type: 'number' },
    { id: 3, text: 'How many hours per day do you spend on academic work?', type: 'number' },
    { id: 4, text: 'How many hours per day do you sleep?', type: 'number' },
    { id: 5, text: 'Do you have any diagnosed attention disorders?', type: 'select', options: ['No', 'Yes', 'Prefer not to say'] },
    { id: 6, text: 'How would you rate your overall health?', type: 'select', options: ['Poor', 'Fair', 'Good', 'Excellent'] },
    { id: 7, text: 'How many cups of coffee/energy drinks do you consume daily?', type: 'number' },
    { id: 8, text: 'Do you have any dietary restrictions?', type: 'select', options: ['Yes', 'No'] },
    { id: 9, text: 'How much do you exercise per week (hours)?', type: 'number' },
    { id: 10, text: 'What is your major/field of study?', type: 'text' },
    { id: 11, text: 'How many years have you been using social media?', type: 'number' }
  ],
  social_media_usage: [
    { id: 12, text: 'How many minutes per day do you spend on TikTok?', type: 'number' },
    { id: 13, text: 'How many minutes per day do you spend on Instagram?', type: 'number' },
    { id: 14, text: 'How many minutes per day do you spend on Twitter/X?', type: 'number' },
    { id: 15, text: 'How many minutes per day do you spend on YouTube?', type: 'number' },
    { id: 16, text: 'How many minutes per day do you spend on Facebook?', type: 'number' },
    { id: 17, text: 'How many minutes per day do you spend on Snapchat?', type: 'number' },
    { id: 18, text: 'How many minutes per day do you spend on other social media?', type: 'number' },
    { id: 19, text: 'Do you check social media within 1 hour of waking up?', type: 'select', options: ['No', 'Yes'] },
    { id: 20, text: 'Do you check social media before bed?', type: 'select', options: ['No', 'Yes'] },
    { id: 21, text: 'How often do you experience FOMO (Fear of Missing Out)?', type: 'select', options: ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'] },
    { id: 22, text: 'Rate the impact of notifications on your focus', type: 'select', options: ['No impact', 'Minimal', 'Moderate', 'Significant', 'Severe'] },
    { id: 23, text: 'How often do you multi-task while using social media?', type: 'select', options: ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'] },
    { id: 24, text: 'How addicted do you feel to social media?', type: 'select', options: ['Not at all', 'Slightly', 'Moderately', 'Very', 'Extremely'] },
    { id: 25, text: 'Rate your ability to resist checking social media', type: 'select', options: ['Very weak', 'Weak', 'Moderate', 'Strong', 'Very strong'] },
    { id: 26, text: 'How often do you regret the time spent on social media?', type: 'select', options: ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'] },
    { id: 27, text: 'Do you use social media while studying?', type: 'select', options: ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'] },
    { id: 28, text: 'Have you tried to reduce social media usage?', type: 'select', options: ['No', 'Yes, unsuccessfully', 'Yes, with mixed results', 'Yes, successfully'] },
    { id: 29, text: 'Rate your engagement with negative content online', type: 'select', options: ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'] },
    { id: 30, text: 'How often do you compare yourself to others on social media?', type: 'select', options: ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'] },
    { id: 31, text: 'Does social media negatively affect your self-esteem?', type: 'select', options: ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'] },
    { id: 32, text: 'Rate the time impact of social media on academics', type: 'select', options: ['No impact', 'Minimal', 'Moderate', 'Significant', 'Severe'] },
    { id: 33, text: 'How much of your daily conversation is about social media content?', type: 'select', options: ['<5%', '5-10%', '10-20%', '20-40%', '>40%'] },
    { id: 34, text: 'Do you feel anxious when away from social media?', type: 'select', options: ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'] },
    { id: 35, text: 'Have you experienced cyberbullying?', type: 'select', options: ['No', 'Yes, once', 'Yes, multiple times'] },
    { id: 36, text: 'Rate your digital wellbeing overall', type: 'select', options: ['Poor', 'Fair', 'Good', 'Very good', 'Excellent'] },
    { id: 37, text: 'How many social media accounts do you maintain?', type: 'number' },
    { id: 38, text: 'How often do you post content?', type: 'select', options: ['Never', 'Weekly', '2-3x per week', 'Daily', 'Multiple times daily'] },
    { id: 39, text: 'Do you experience sleep disruption from social media?', type: 'select', options: ['No', 'Mild', 'Moderate', 'Severe'] },
    { id: 40, text: 'How often do you have phone-free time?', type: 'select', options: ['Never', 'Rarely', 'Sometimes', 'Often'] }
  ],
  attention_focus: [
    { id: 41, text: 'Rate your ability to concentrate on a single task', type: 'select', options: ['Very poor', 'Poor', 'Average', 'Good', 'Excellent'] },
    { id: 42, text: 'How often do you get distracted while studying?', type: 'select', options: ['Rarely', 'Sometimes', 'Often', 'Very often'] },
    { id: 43, text: 'Rate your ability to ignore distractions', type: 'select', options: ['Very poor', 'Poor', 'Average', 'Good', 'Excellent'] },
    { id: 44, text: 'How long can you focus without a break?', type: 'select', options: ['<10 min', '10-20 min', '20-40 min', '40-60 min', '>60 min'] },
    { id: 45, text: 'Do you experience brain fog?', type: 'select', options: ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'] },
    { id: 46, text: 'How often do you lose track of time?', type: 'select', options: ['Rarely', 'Sometimes', 'Often', 'Very often'] },
    { id: 47, text: 'Rate your attention span compared to peers', type: 'select', options: ['Much shorter', 'Shorter', 'Similar', 'Longer', 'Much longer'] },
    { id: 48, text: 'How often do you miss important details?', type: 'select', options: ['Rarely', 'Sometimes', 'Often', 'Very often'] },
    { id: 49, text: 'Do you procrastinate on tasks?', type: 'select', options: ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'] },
    { id: 50, text: 'Rate your ability to follow complex instructions', type: 'select', options: ['Very poor', 'Poor', 'Average', 'Good', 'Excellent'] },
    { id: 51, text: 'How often do you re-read text you just read?', type: 'select', options: ['Rarely', 'Sometimes', 'Often', 'Very often'] },
    { id: 52, text: 'Rate your speed of information processing', type: 'select', options: ['Very slow', 'Slow', 'Average', 'Fast', 'Very fast'] },
    { id: 53, text: 'Do you daydream in class or meetings?', type: 'select', options: ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'] },
    { id: 54, text: 'How well do you remember what you read?', type: 'select', options: ['Very poorly', 'Poorly', 'Average', 'Well', 'Very well'] },
    { id: 55, text: 'Rate your ability to sustain attention in lectures', type: 'select', options: ['Very poor', 'Poor', 'Average', 'Good', 'Excellent'] },
    { id: 56, text: 'Do you feel mentally fatigued after studying?', type: 'select', options: ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'] },
    { id: 57, text: 'How often do you check notifications involuntarily?', type: 'select', options: ['Rarely', 'Sometimes', 'Often', 'Very often'] },
    { id: 58, text: 'Rate your performance on tasks requiring focus', type: 'select', options: ['Very poor', 'Poor', 'Average', 'Good', 'Excellent'] },
    { id: 59, text: "How often do you start tasks but don't finish them?", type: 'select', options: ['Rarely', 'Sometimes', 'Often', 'Very often'] },
    { id: 60, text: 'Rate your ability to filter irrelevant information', type: 'select', options: ['Very poor', 'Poor', 'Average', 'Good', 'Excellent'] },
    { id: 61, text: 'Do you struggle with information overload?', type: 'select', options: ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'] },
    { id: 62, text: 'How often do you feel scattered or disorganized?', type: 'select', options: ['Rarely', 'Sometimes', 'Often', 'Very often'] },
    { id: 63, text: 'Rate your ability to maintain focus during conversations', type: 'select', options: ['Very poor', 'Poor', 'Average', 'Good', 'Excellent'] },
    { id: 64, text: 'How well do you perform under pressure?', type: 'select', options: ['Very poorly', 'Poorly', 'Average', 'Well', 'Very well'] }
  ],
  working_memory: [
    { id: 65, text: 'Rate your ability to remember a list of items', type: 'select', options: ['Very poor', 'Poor', 'Average', 'Good', 'Excellent'] },
    { id: 66, text: 'How easily do you forget what you were doing?', type: 'select', options: ['Rarely', 'Sometimes', 'Often', 'Very often'] },
    { id: 67, text: 'Can you hold multiple ideas in mind simultaneously?', type: 'select', options: ['With difficulty', 'With some difficulty', 'Moderately', 'Easily', 'Very easily'] },
    { id: 68, text: 'Rate your ability to do mental math', type: 'select', options: ['Very poor', 'Poor', 'Average', 'Good', 'Excellent'] },
    { id: 69, text: 'How often do you forget appointments or deadlines?', type: 'select', options: ['Rarely', 'Sometimes', 'Often', 'Very often'] },
    { id: 70, text: 'Rate your ability to remember names and faces', type: 'select', options: ['Very poor', 'Poor', 'Average', 'Good', 'Excellent'] },
    { id: 71, text: 'How well do you remember sequences or passwords?', type: 'select', options: ['Very poorly', 'Poorly', 'Average', 'Well', 'Very well'] },
    { id: 72, text: 'How well do you remember previous conversations?', type: 'select', options: ['Very poorly', 'Poorly', 'Average', 'Well', 'Very well'] },
    { id: 73, text: 'Can you repeat back what someone just said?', type: 'select', options: ['Rarely', 'Sometimes', 'Often', 'Very often'] },
    { id: 74, text: 'Rate your ability to organize complex information', type: 'select', options: ['Very poor', 'Poor', 'Average', 'Good', 'Excellent'] },
    { id: 75, text: 'Rate your working memory capacity', type: 'select', options: ['Very limited', 'Limited', 'Average', 'Good', 'Excellent'] },
    { id: 76, text: 'Can you track multiple conversations at once?', type: 'select', options: ['With difficulty', 'With some difficulty', 'Moderately', 'Easily', 'Very easily'] },
    { id: 77, text: 'Rate your ability to recall recently learned information', type: 'select', options: ['Very poor', 'Poor', 'Average', 'Good', 'Excellent'] },
    { id: 78, text: 'Do you forget the beginning of a sentence by the end?', type: 'select', options: ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'] },
    { id: 79, text: 'How well do you perform on memory tests?', type: 'select', options: ['Very poorly', 'Poorly', 'Average', 'Well', 'Very well'] }
  ],
  problem_solving: [
    { id: 80, text: 'Rate your ability to solve complex problems', type: 'select', options: ['Very poor', 'Poor', 'Average', 'Good', 'Excellent'] },
    { id: 81, text: 'How easily do you find creative solutions?', type: 'select', options: ['With difficulty', 'With some difficulty', 'Moderately', 'Easily', 'Very easily'] },
    { id: 82, text: 'Do you think through problems systematically?', type: 'select', options: ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'] },
    { id: 83, text: 'How quickly can you understand new concepts?', type: 'select', options: ['Very slowly', 'Slowly', 'Moderately', 'Quickly', 'Very quickly'] },
    { id: 84, text: 'Rate your ability to connect disparate ideas', type: 'select', options: ['Very poor', 'Poor', 'Average', 'Good', 'Excellent'] },
    { id: 85, text: 'Do you enjoy tackling difficult problems?', type: 'select', options: ['Not at all', 'Somewhat', 'Moderately', 'Very much', 'Extremely'] },
    { id: 86, text: 'How often do you give up on difficult tasks?', type: 'select', options: ['Rarely', 'Sometimes', 'Often', 'Very often'] },
    { id: 87, text: 'Rate your critical thinking skills', type: 'select', options: ['Very poor', 'Poor', 'Average', 'Good', 'Excellent'] },
    { id: 88, text: 'How well do you handle ambiguous situations?', type: 'select', options: ['Very poorly', 'Poorly', 'Average', 'Well', 'Very well'] },
    { id: 89, text: 'Do you seek multiple perspectives on problems?', type: 'select', options: ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'] },
    { id: 90, text: 'How often do you revisit assumptions?', type: 'select', options: ['Rarely', 'Sometimes', 'Often', 'Very often'] },
    { id: 91, text: 'Rate your decision-making skills', type: 'select', options: ['Very poor', 'Poor', 'Average', 'Good', 'Excellent'] },
    { id: 92, text: 'Do you consider consequences before acting?', type: 'select', options: ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'] },
    { id: 93, text: 'How often do you learn from mistakes?', type: 'select', options: ['Rarely', 'Sometimes', 'Often', 'Very often'] },
    { id: 94, text: 'Rate your adaptability to new situations', type: 'select', options: ['Very poor', 'Poor', 'Average', 'Good', 'Excellent'] },
    { id: 95, text: 'Do you develop multiple strategies for problems?', type: 'select', options: ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'] },
    { id: 96, text: 'How well do you explain your reasoning?', type: 'select', options: ['Very poorly', 'Poorly', 'Average', 'Well', 'Very well'] },
    { id: 97, text: 'Rate your confidence in your abilities', type: 'select', options: ['Very low', 'Low', 'Moderate', 'High', 'Very high'] }
  ]
};

function SurveyForm({ user, api, onComplete }) {
  const [responses, setResponses] = useState({});
  const [currentSection, setCurrentSection] = useState('demographics');
  const [loading, setLoading] = useState(false);
  const [startTime] = useState(new Date());



  const sections = Object.keys(SURVEY_ITEMS);
  const currentSectionIndex = sections.indexOf(currentSection);
  const totalSections = sections.length;

  useEffect(() => {
    // Session recording is now handled by Dashboard.js
  }, []);

  const handleResponseChange = (itemId, value) => {
    setResponses(prev => ({
      ...prev,
      [itemId]: value
    }));
  };

  const handleNext = () => {
    if (currentSectionIndex < totalSections - 1) {
      window.scrollTo(0, 0);
      setCurrentSection(sections[currentSectionIndex + 1]);
    }
  };

  const handlePrevious = () => {
    if (currentSectionIndex > 0) {
      window.scrollTo(0, 0);
      setCurrentSection(sections[currentSectionIndex - 1]);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // 1. Submit survey data first
      const endTime = new Date();
      const completionTime = (endTime - startTime) / 60000; // Convert to minutes

      const surveyData = {
        assessment_type: 'baseline',
        demographics: {},
        social_media_usage: {},
        attention_focus: {},
        working_memory: {},
        problem_solving: {},
        academic_performance: {},
        digital_wellness: {},
        sleep_wellbeing: {},
        completion_time_minutes: completionTime,
        device_info: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          screen: `${window.screen.width}x${window.screen.height}`
        }
      };

      // Organize responses by section
      sections.forEach(section => {
        const sectionResponses = {};
        SURVEY_ITEMS[section].forEach(item => {
          sectionResponses[item.id] = responses[item.id] || '';
        });
        surveyData[section] = sectionResponses;
      });

      await api.post('/survey/submit', surveyData);

      // 2. Notify parent and reset state
      console.log('Survey submitted successfully');
      setLoading(false);
      onComplete();

    } catch (error) {
      alert('Failed to submit survey: ' + error.message);
      setLoading(false);
    }
  };

  const items = SURVEY_ITEMS[currentSection];
  const progressPercentage = ((currentSectionIndex + 1) / totalSections) * 100;

  return (
    <div className="survey-form">
      {/* Video Recorder moved to Dashboard for continuous session */}

      <div className="survey-header">
        <h2>Research Survey - {currentSection.replace(/_/g, ' ').toUpperCase()}</h2>
        <p>Section {currentSectionIndex + 1} of {totalSections}</p>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progressPercentage}%` }}></div>
        </div>
      </div>

      <div className="survey-items">
        {items.map((item) => (
          <div key={item.id} className="survey-item">
            <label>{item.id}. {item.text}</label>
            {item.type === 'text' && (
              <input
                type="text"
                value={responses[item.id] || ''}
                onChange={(e) => handleResponseChange(item.id, e.target.value)}
                disabled={loading}
              />
            )}
            {item.type === 'number' && (
              <input
                type="number"
                value={responses[item.id] || ''}
                onChange={(e) => handleResponseChange(item.id, e.target.value)}
                disabled={loading}
              />
            )}
            {item.type === 'select' && (
              <select
                value={responses[item.id] || ''}
                onChange={(e) => handleResponseChange(item.id, e.target.value)}
                disabled={loading}
              >
                <option value="">Select an option...</option>
                {item.options.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            )}
          </div>
        ))}
      </div>

      <div className="survey-navigation">
        <button onClick={handlePrevious} disabled={currentSectionIndex === 0 || loading} className="btn-secondary">
          ← Previous
        </button>
        {currentSectionIndex === totalSections - 1 ? (
          <button onClick={handleSubmit} disabled={loading} className="btn-primary">
            {loading ? 'Submitting...' : 'Submit Survey'}
          </button>
        ) : (
          <button onClick={handleNext} disabled={loading} className="btn-primary">
            Next →
          </button>
        )}
      </div>
    </div>
  );
}

export default SurveyForm;