// ============================================================================
// frontend/src/components/CognitiveTestInterface.js
// 5 Cognitive Tests
// ============================================================================

import React, { useState } from 'react';

const TEST_TYPES = {
  sart: {
    name: 'SART - Sustained Attention Response Task',
    description: 'Click when you see a number EXCEPT 3. Test your sustained attention and impulse control.',
    duration: 15
  },
  digit_span: {
    name: 'Digit Span Test',
    description: 'Remember and repeat sequences of numbers of increasing length.',
    duration: 10
  },
  trail_making: {
    name: 'Trail Making Test',
    description: 'Connect numbers in sequence as quickly as possible.',
    duration: 5
  },
  go_no_go: {
    name: 'Go/No-Go Task',
    description: 'Respond to target stimuli, inhibit responses to non-targets.',
    duration: 10
  },
  stroop: {
    name: 'Stroop Color-Word Test',
    description: 'Name the color of the text (not the word itself).',
    duration: 5
  }
};

function CognitiveTestInterface({ user, api, onComplete }) {
  const [selectedTest, setSelectedTest] = useState(null);
  const [testStarted, setTestStarted] = useState(false);
  const [testData, setTestData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [completedTests, setCompletedTests] = useState([]);

  const startTest = (testType) => {
    if (completedTests.includes(testType)) {
      alert('You have already completed this test.');
      return;
    }
    setSelectedTest(testType);
    setTestStarted(true);

    // Initialize test specific data
    setTestData({
      test_type: testType,
      start_time: new Date(),
      responses: [],
      score: 0,
      accuracy: 0,
      reaction_time_ms: 0
    });
  };

  const completeTest = async (finalResults) => {
    // NOTE: finalResults param allows tests to pass specific data back
    const resultsToSubmit = finalResults || {
      test_type: testData.test_type,
      raw_score: testData.score || Math.random() * 100, // Fallback for tests not using new system yet
      standardized_score: 100,
      percentile: 50,
      performance_data: {
        responses: testData.responses,
        accuracy: testData.accuracy || 0
      }
    };

    setLoading(true);
    try {
      const end_time = new Date();
      const duration = (end_time - testData.start_time) / 1000;

      // Ensure performance_data exists
      if (!resultsToSubmit.performance_data) {
        resultsToSubmit.performance_data = {};
      }

      resultsToSubmit.performance_data.duration_seconds = duration;

      await api.post('/tests/submit', resultsToSubmit);

      const newCompleted = [...completedTests, testData.test_type];
      setCompletedTests(newCompleted);

      alert(`${TEST_TYPES[testData.test_type].name} completed!`);

      setTestStarted(false);
      setSelectedTest(null);
      setTestData(null);

      // Check if all 5 tests are done
      if (newCompleted.length === 5) { // 5 tests total
        if (onComplete) onComplete();
      }

    } catch (error) {
      alert('Failed to submit test results: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!testStarted) {
    return (
      <div className="cognitive-tests">
        <h2>🧠 Cognitive Tests ({completedTests.length}/5 Completed)</h2>
        <p>You must complete all 5 tests to finish the session.</p>

        <div className="tests-grid">
          {Object.entries(TEST_TYPES).map(([key, test]) => (
            <div key={key} className={`test-card ${completedTests.includes(key) ? 'completed' : ''}`}>
              <h3>{test.name} {completedTests.includes(key) && '✓'}</h3>
              <p>{test.description}</p>
              <p className="duration">⏱ {test.duration} minutes</p>
              <button
                onClick={() => startTest(key)}
                disabled={loading || completedTests.includes(key)}
                className={completedTests.includes(key) ? "btn-secondary" : "btn-primary"}
              >
                {completedTests.includes(key) ? 'Completed' : 'Start Test'}
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="test-running">
      <h2>{TEST_TYPES[selectedTest].name}</h2>
      <p>Follow the instructions carefully.</p>

      <div className="test-content">
        {selectedTest === 'sart' && (
          <SARTTest testData={testData} setTestData={setTestData} onFinish={completeTest} />
        )}
        {selectedTest === 'digit_span' && (
          <DigitSpanTest testData={testData} setTestData={setTestData} onFinish={completeTest} />
        )}
        {selectedTest === 'trail_making' && (
          <TrailMakingTest testData={testData} setTestData={setTestData} onFinish={completeTest} />
        )}
        {selectedTest === 'go_no_go' && (
          <GoNoGoTest testData={testData} setTestData={setTestData} onFinish={completeTest} />
        )}
        {selectedTest === 'stroop' && (
          <StroopTest testData={testData} setTestData={setTestData} onFinish={completeTest} />
        )}
      </div>

      <div className="test-actions">
        {/* Buttons are now inside individual tests for better flow, but kept cancel here */}
        <button onClick={() => setTestStarted(false)} className="btn-secondary">
          Cancel Test
        </button>
      </div>
    </div>
  );
}

// Test Components
function SARTTest({ testData, setTestData, onFinish }) {
  const [currentNumber, setCurrentNumber] = useState(null);
  const [trials, setTrials] = useState(0);
  const MAX_TRIALS = 30;
  const [gameOver, setGameOver] = useState(false);

  // Detailed Stats
  const [stats, setStats] = useState({
    correctGo: 0,       // Clicked on Non-3 (Good)
    correctNoGo: 0,     // Didn't click on 3 (Good)
    commissionErrors: 0,// Clicked on 3 (Bad)
    omissionErrors: 0   // Missed Non-3 (Bad)
  });

  const [hasClicked, setHasClicked] = useState(false);

  // Game Loop
  React.useEffect(() => {
    if (trials >= MAX_TRIALS) {
      setGameOver(true);
      return;
    }

    // Start Trial
    const nextNum = Math.floor(Math.random() * 10);
    setCurrentNumber(nextNum);
    setHasClicked(false);

    // End Trial after 1.5s (Fixed Pacing)
    const timer = setTimeout(() => {
      // Evaluate if no click happened
      if (!hasClicked) {
        if (nextNum === 3) {
          // Correctly withheld
          setStats(prev => ({ ...prev, correctNoGo: prev.correctNoGo + 1 }));
          setTestData(prev => ({ ...prev, score: (prev.score || 0) + 1 }));
        } else {
          // Missed a target
          setStats(prev => ({ ...prev, omissionErrors: prev.omissionErrors + 1 }));
        }
      }
      setTrials(t => t + 1);
    }, 1500);

    return () => clearTimeout(timer);
  }, [trials]); // Re-run when trial count increments

  const handleClick = () => {
    if (gameOver || hasClicked) return;
    setHasClicked(true);

    if (currentNumber !== 3) {
      // Correct Go
      setStats(prev => ({ ...prev, correctGo: prev.correctGo + 1 }));
      setTestData(prev => ({
        ...prev,
        score: (prev.score || 0) + 1
      }));
    } else {
      // Commission Error (Clicked 3)
      setStats(prev => ({ ...prev, commissionErrors: prev.commissionErrors + 1 }));
      // No score penalty, just doesn't get the point
    }
  };

  const handleComplete = () => {
    const totalCorrect = stats.correctGo + stats.correctNoGo;
    const accuracy = (totalCorrect / MAX_TRIALS) * 100;

    onFinish({
      test_type: 'sart',
      raw_score: totalCorrect,
      standardized_score: 100,
      percentile: 50,
      performance_data: {
        trials: MAX_TRIALS,
        accuracy: accuracy,
        correct_answers: totalCorrect,
        correct_clicks: stats.correctGo,
        correct_withholds: stats.correctNoGo,
        commission_errors: stats.commissionErrors,
        omission_errors: stats.omissionErrors
      }
    });
  };

  return (
    <div className="test-area">
      <h3>Trial: {trials + 1}/{MAX_TRIALS}</h3>
      {!gameOver ? (
        <>
          <div className="sart-display" style={{ fontSize: '5rem', margin: '20px' }}>{currentNumber}</div>
          <p>Click BUTTON when you see any number <b>EXCEPT 3</b></p>
          <button onClick={handleClick} className="btn-large" style={{ padding: '20px 40px', fontSize: '1.5rem' }} disabled={hasClicked}>
            {hasClicked ? 'Wait...' : 'CLICK HERE'}
          </button>
        </>
      ) : (
        <div className="completion-screen">
          <h3>Test Complete!</h3>
          <p>Total Correct: {stats.correctGo + stats.correctNoGo}/{MAX_TRIALS}</p>
          <div style={{ fontSize: '0.9rem', marginBottom: '10px', textAlign: 'left', display: 'inline-block' }}>
            <li>Hurried Clicks (Errors): {stats.commissionErrors}</li>
            <li>Missed Clicks (Errors): {stats.omissionErrors}</li>
          </div>
          <br />
          <button onClick={handleComplete} className="btn-primary">Finish Test</button>
        </div>
      )}
    </div>
  );
}

function DigitSpanTest({ testData, setTestData, onFinish }) {
  const [sequence, setSequence] = useState([]);
  const [input, setInput] = useState('');
  const [level, setLevel] = useState(3); // Start with 3 digits
  const [phase, setPhase] = useState('memorize'); // 'memorize', 'input', 'result'
  const [strikes, setStrikes] = useState(0);

  // Generate sequence
  React.useEffect(() => {
    if (phase === 'memorize') {
      const newSequence = Array.from({ length: level }, () => Math.floor(Math.random() * 10));
      setSequence(newSequence);

      // Hide after 3 seconds + 0.5s per digit
      const timeout = setTimeout(() => {
        setPhase('input');
      }, 2000 + (level * 500));

      return () => clearTimeout(timeout);
    }
  }, [level, phase]);

  const handleSubmit = () => {
    const correct = input === sequence.join('');

    if (correct) {
      alert('Correct! Sequence length increasing.');
      setLevel(prev => prev + 1);
      setTestData(prev => ({
        ...prev,
        score: level, // Max digits successfully remembered
        accuracy: 100
      }));
      setInput('');
      setPhase('memorize');
    } else {
      const newStrikes = strikes + 1;
      setStrikes(newStrikes);
      alert(`Incorrect. The sequence was ${sequence.join('')}. Strikes: ${newStrikes}/3`);

      if (newStrikes >= 3) {
        setPhase('complete');
      } else {
        setInput('');
        setPhase('memorize'); // Retry same level or could decrease
      }
    }
  };

  const handleFinish = () => {
    onFinish({
      test_type: 'digit_span',
      raw_score: level - 1,
      standardized_score: 100,
      percentile: 50,
      performance_data: {
        max_digits: level - 1,
        strikes: 3
      }
    });
  };

  return (
    <div className="test-area">
      <h3>Max Digits: {level} | Strikes: {strikes}/3</h3>

      {phase === 'memorize' && (
        <div className="sequence-display" style={{ fontSize: '3rem', letterSpacing: '10px', margin: '40px' }}>
          {sequence.join(' ')}
        </div>
      )}

      {phase === 'input' && (
        <div className="input-phase">
          <p>Enter the numbers you just saw:</p>
          <input
            type="text" // Number type is annoying with leading zeros
            value={input}
            onChange={(e) => setInput(e.target.value.replace(/[^0-9]/g, ''))} // Only numbers
            placeholder="123..."
            autoFocus
            style={{ fontSize: '1.5rem', padding: '10px', letterSpacing: '5px' }}
          />
          <br /><br />
          <button onClick={handleSubmit} className="btn-primary">Submit</button>
        </div>
      )}

      {phase === 'complete' && (
        <div className="completion-screen">
          <h3>Test Complete!</h3>
          <p>Max Digits Remembered: {level - 1}</p>
          <button onClick={handleFinish} className="btn-primary">Finish Test</button>
        </div>
      )}
    </div>
  );
}

function TrailMakingTest({ testData, setTestData, onFinish }) {
  const [nodes, setNodes] = useState([]);
  const [nextNumber, setNextNumber] = useState(1);
  const [lines, setLines] = useState([]);
  const [completed, setCompleted] = useState(false);
  const [startTime] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);

  // Timer
  React.useEffect(() => {
    if (completed) return;
    const timer = setInterval(() => setElapsed(((Date.now() - startTime) / 1000).toFixed(1)), 100);
    return () => clearInterval(timer);
  }, [completed, startTime]);

  // Initialize random nodes on mount
  React.useEffect(() => {
    const generateNodes = () => {
      const newNodes = [];
      const minDistance = 40; // Reduced from 50 to ensure fit

      for (let i = 1; i <= 20; i++) {
        let attempts = 0;
        let valid = false;
        let x, y;

        while (!valid && attempts < 200) {
          x = Math.random() * 350 + 25; // 25-375
          y = Math.random() * 250 + 25; // 25-275

          valid = true;
          for (const node of newNodes) {
            const dx = node.x - x;
            const dy = node.y - y;
            if (Math.sqrt(dx * dx + dy * dy) < minDistance) {
              valid = false;
              break;
            }
          }
          attempts++;
        }
        newNodes.push({ id: i, x, y, status: 'default' });
      }
      return newNodes;
    };

    setNodes(generateNodes());
  }, []);

  const handleNodeClick = (clickedNode) => {
    if (completed) return;

    if (clickedNode.id === nextNumber) {
      // Correct click
      setNodes(prev => prev.map(n =>
        n.id === clickedNode.id ? { ...n, status: 'active' } : n
      ));

      if (nextNumber > 1) {
        const prevNode = nodes.find(n => n.id === nextNumber - 1);
        setLines(prev => [...prev, {
          x1: prevNode.x, y1: prevNode.y,
          x2: clickedNode.x, y2: clickedNode.y
        }]);
      }

      setTestData(prev => ({
        ...prev,
        score: nextNumber, // Score is number of connected nodes
        accuracy: 100
      }));

      if (nextNumber === 20) {
        setCompleted(true);
      }

      setNextNumber(prev => prev + 1);
    } else {
      // Incorrect click - penalty logic
      setTestData(prev => ({ ...prev, accuracy: Math.max(0, (prev.accuracy || 100) - 5) }));
    }
  };

  const handleFinish = () => {
    onFinish({
      test_type: 'trail_making',
      raw_score: elapsed, // Lower is better
      standardized_score: 100,
      percentile: 50,
      performance_data: {
        time_seconds: elapsed,
        accuracy: testData.accuracy || 100,
        correct_clicks: 20, // Always 20 if completed
        incorrect_clicks: Math.round((100 - (testData.accuracy || 100)) / 5) // Reverse engineered from accuracy
      }
    });
  };

  return (
    <div className="test-area">
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '400px', margin: '0 auto' }}>
        <p>Connect 1-20</p>
        <p>⏱ {elapsed}s</p>
      </div>

      <div style={{ position: 'relative', width: '400px', height: '300px', border: '1px solid #ccc', margin: '0 auto', background: '#f9f9f9' }}>
        <svg width="400" height="300" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
          {lines.map((line, i) => (
            <line key={i} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke="blue" strokeWidth="2" />
          ))}
        </svg>

        {nodes.map(node => (
          <div
            key={node.id}
            onClick={() => handleNodeClick(node)}
            style={{
              position: 'absolute',
              left: node.x - 15,
              top: node.y - 15,
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              background: node.status === 'active' ? '#4CAF50' : 'white',
              border: `2px solid ${node.status === 'active' ? '#4CAF50' : 'black'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontWeight: 'bold',
              color: node.status === 'active' ? 'white' : 'black',
              zIndex: 10,
              transition: 'all 0.2s'
            }}
          >
            {node.id}
          </div>
        ))}
      </div>
      {completed && (
        <div style={{ marginTop: '20px' }}>
          <p style={{ color: 'green', fontWeight: 'bold' }}>Done in {elapsed}s!</p>
          <button onClick={handleFinish} className="btn-primary">Complete Test</button>
        </div>
      )}
    </div>
  );
}

function GoNoGoTest({ testData, setTestData, onFinish }) {
  const [stimulus, setStimulus] = useState(null);
  const [trials, setTrials] = useState(0);
  const MAX_TRIALS = 30;
  const [gameOver, setGameOver] = useState(false);
  const [message, setMessage] = useState('');

  React.useEffect(() => {
    if (trials >= MAX_TRIALS) {
      setGameOver(true);
      setStimulus(null);
      return;
    }

    const delay = Math.random() * 1000 + 1000;
    const timer = setTimeout(() => {
      setStimulus(Math.random() > 0.3 ? 'X' : 'O'); // 70% Go (X), 30% No-Go (O)
      setMessage('');
    }, delay);

    return () => clearTimeout(timer);
  }, [trials]);

  const handleResponse = () => {
    if (gameOver || !stimulus) return;

    if (stimulus === 'X') {
      // Correct Go
      setTestData(prev => ({ ...prev, score: (prev.score || 0) + 1 }));
      setMessage('Good!');
    } else {
      // Incorrect No-Go (Commission Error)
      setMessage('Oops! DONT click O');
      setTestData(prev => ({ ...prev, accuracy: (prev.accuracy || 100) - 5 }));
    }
    setStimulus(null); // Hide immediately
    setTrials(t => t + 1);
  };

  // Auto-advance if no click after 1.5s (Omission error if X, Correct if O)
  React.useEffect(() => {
    if (!stimulus) return;

    const timeout = setTimeout(() => {
      if (stimulus === 'X') {
        setMessage('Missed!'); // Omission
      } else {
        setTestData(prev => ({ ...prev, score: (prev.score || 0) + 1 })); // Correct rejection
        setMessage('Good hold!');
      }
      setStimulus(null);
      setTrials(t => t + 1);
    }, 1500);

    return () => clearTimeout(timeout);
  }, [stimulus]);

  // Clear message after short duration (500ms)
  React.useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(''), 500);
      return () => clearTimeout(timer);
    }
  }, [message]);

  return (
    <div className="test-area">
      <h3>Trial: {trials}/{MAX_TRIALS}</h3>
      {!gameOver ? (
        <>
          <div className="stimulus-display" style={{ height: '100px', fontSize: '4rem' }}>
            {stimulus}
          </div>
          <p style={{ minHeight: '24px', color: message.includes('Oops') || message.includes('Missed') ? 'red' : 'green' }}>{message}</p>
          <p>CLICK 'RESPONSE' whenever you see <b>X</b>. Do NOT click for <b>O</b>.</p>
          <button onClick={handleResponse} className="btn-large" style={{ width: '200px', height: '80px', fontSize: '1.2rem' }}>RESPONSE</button>
        </>
      ) : (
        <div>
          <h3>Test Complete!</h3>
          <button onClick={() => onFinish({ test_type: 'go_no_go', raw_score: testData.score, performance_data: { trials: MAX_TRIALS } })} className="btn-primary">
            Finish Test
          </button>
        </div>
      )}
    </div>
  );
}

function StroopTest({ testData, setTestData, onFinish }) {
  const colors = ['Red', 'Blue', 'Green', 'Yellow', 'Purple'];
  const [word, setWord] = React.useState('Red');
  const [color, setColor] = React.useState('#FF0000');
  const [trials, setTrials] = React.useState(0);
  const MAX_TRIALS = 20;

  React.useEffect(() => {
    if (trials < MAX_TRIALS) {
      const wordIndex = Math.floor(Math.random() * colors.length);
      const colorIndex = Math.floor(Math.random() * colors.length);
      setWord(colors[wordIndex]);
      const colorMap = {
        0: '#FF0000', 1: '#0000FF', 2: '#008000',
        3: '#CCCC00', 4: '#800080'
      };
      setColor(colorMap[colorIndex]);
    }
  }, [trials]);

  const handleClick = (selectedColor) => {
    const colorMapNames = { '#FF0000': 'Red', '#0000FF': 'Blue', '#008000': 'Green', '#CCCC00': 'Yellow', '#800080': 'Purple' };
    const correctColorName = colorMapNames[color]; // The actual color of the font

    // Stroop Logic: Did they pick the COLOR of the font? (Not the word text)
    // Actually, usually stroop asks for the Ink Color.
    // My colors array uses Names. The buttons pass 'Red', 'Blue'.
    // `color` state is a hex code.
    // If color is Red (#FF0000), and I click 'Red', correct.

    const isCorrect = selectedColor === colorMapNames[color];

    if (isCorrect) {
      setTestData(prev => ({
        ...prev,
        score: (prev.score || 0) + 1,
        accuracy: (((prev.score || 0) + 1) / MAX_TRIALS) * 100
      }));
    }
    setTrials(prev => prev + 1);
  };

  if (trials >= MAX_TRIALS) {
    return (
      <div className="test-area">
        <h3>Test Complete!</h3>
        <p>Score: {testData.score}/{MAX_TRIALS}</p>
        <button onClick={() => onFinish({
          test_type: 'stroop',
          raw_score: testData.score,
          performance_data: {
            trials: MAX_TRIALS,
            accuracy: testData.accuracy || 0
          }
        })} className="btn-primary">
          Finish Test
        </button>
      </div>
    );
  }

  return (
    <div className="test-area">
      <h3>Trial: {trials + 1}/{MAX_TRIALS}</h3>
      <div style={{ fontSize: '48px', color: color, marginBottom: '20px', fontWeight: 'bold' }}>
        {word}
      </div>
      <p>Click the color of the <b>INK</b> (not the word)</p>
      <div className="color-buttons" style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
        {colors.map((c) => (
          <button
            key={c}
            onClick={() => handleClick(c)}
            className="color-btn"
            style={{ backgroundColor: c.toLowerCase() === 'yellow' ? '#FFFFAA' : c.toLowerCase(), color: c === 'Yellow' ? 'black' : 'white', padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}

export default CognitiveTestInterface;