import React, { useState, useEffect, useRef } from 'react';

// A difficult, abstract passage to induce cognitive load
const PASSAGE = `The phenomenon of cognitive dissonance usually manifests as a psychological stress experienced by an individual who holds two or more contradictory beliefs, ideas, or values. This mental discomfort triggers a motivational drive to reduce dissonance by altering existing cognitions, adding new ones to create a consistent belief system, or actively avoiding situations and information likely to increase the magnitude of the inconsistency.`;

function TypingFrustrationTest({ user, api, onComplete }) {
    const [input, setInput] = useState('');
    const [startTime] = useState(Date.now());
    const [errors, setErrors] = useState(0);
    const [backspaces, setBackspaces] = useState(0);
    const [timeLeft, setTimeLeft] = useState(60); // 60 seconds strict
    const [isTestActive, setIsTestActive] = useState(true);
    const [feedback, setFeedback] = useState(''); 
    const [finalResults, setFinalResults] = useState(null);

    const inputRef = useRef(null);

    // Timer simulation
    useEffect(() => {
        if (!isTestActive) return;

        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    finishTest(false); // Time's up
                    return 0;
                }
                // Frustration Trigger: Negative feedback at intervals
                if (prev === 45) setFeedback("⚠️ Speed too slow!");
                if (prev === 30) setFeedback("⚠️ Error rate increasing!");
                if (prev === 15) setFeedback("⚠️ TIME CRITICAL!");

                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [isTestActive]);

    const handleKeyDown = (e) => {
        if (!isTestActive) {
            e.preventDefault();
            return;
        }

        // Block Copy/Paste (Still annoying, but not "key blocking")
        if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'v')) {
            e.preventDefault();
            setFeedback("❌ Copy/Paste Disabled");
            return;
        }

        // Track Backspaces (Frustration metric)
        if (e.key === 'Backspace') {
            setBackspaces(prev => prev + 1);
        }
    };

    const handleChange = (e) => {
        if (!isTestActive) return;

        const val = e.target.value;
        const previousLength = input.length;

        // Check for new errors (Non-blocking)
        if (val.length > previousLength) {
            const charIndex = val.length - 1;
            if (charIndex < PASSAGE.length) {
                const expectedChar = PASSAGE[charIndex];
                const typedChar = val[charIndex];

                if (typedChar !== expectedChar) {
                    setErrors(prev => prev + 1);
                    setFeedback("❌ Incorrect Character");
                } else {
                    // Start clearing feedback if they get back on track
                    if (Math.random() > 0.7) setFeedback("");
                }
            }
        }

        setInput(val);

        // Check Completion
        if (val === PASSAGE) {
            finishTest(true);
        }
    };

    const finishTest = (completed) => {
        if (!isTestActive) return; 
        setIsTestActive(false);
        const duration = (Date.now() - startTime) / 1000;
        const wpm = (input.length / 5) / (duration / 60);

        let correctChars = 0;
        for (let i = 0; i < input.length; i++) {
            if (input[i] === PASSAGE[i]) correctChars++;
        }
        const accuracy = input.length > 0 ? (correctChars / input.length) * 100 : 0;

        // Store results for final manual submission
        setFinalResults({
            test_type: 'typing_frustration',
            raw_score: accuracy,
            performance_data: {
                completed: completed,
                duration_seconds: duration,
                wpm: wpm.toFixed(1),
                error_count: errors,
                backspace_count: backspaces,
                match_accuracy: accuracy.toFixed(1)
            }
        });
    };

    const handleFinalSubmit = () => {
        if (finalResults) {
            onComplete(finalResults);
        }
    };

    return (
        <div className="test-interface typing-test">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h2 style={{ color: timeLeft < 15 ? 'red' : 'inherit' }}>
                    ⏱️ {timeLeft}s
                </h2>
                {feedback && (
                    <div style={{
                        padding: '8px 15px',
                        background: '#dc3545',
                        color: 'white',
                        borderRadius: '4px',
                        fontWeight: 'bold',
                        animation: 'fadeIn 0.3s'
                    }}>
                        {feedback}
                    </div>
                )}
            </div>

            <div className="instructions" style={{ marginBottom: '20px', padding: '15px', background: '#e2e3e5', color: '#383d41', borderRadius: '5px' }}>
                <strong>Task:</strong> Type the text below as fast as possible.
            </div>

            <div className="passage-display" style={{
                padding: '20px',
                background: '#f8f9fa',
                lineHeight: '1.8',
                fontSize: '1.2rem',
                borderRadius: '8px',
                marginBottom: '20px',
                userSelect: 'none',
                fontFamily: 'monospace',
                border: '1px solid #dee2e6'
            }}>
                {PASSAGE.split('').map((char, index) => {
                    let color = '#6c757d'; // Default unused
                    let backgroundColor = 'transparent';
                    let textDecoration = 'none';

                    if (index < input.length) {
                        const typedChar = input[index];
                        if (typedChar === char) {
                            color = '#28a745'; // Correct
                        } else {
                            color = '#dc3545'; // Error
                            backgroundColor = '#f8d7da';
                            textDecoration = 'underline';
                        }
                    } else if (index === input.length) {
                        backgroundColor = '#ffc107'; // Cursor
                        color = 'black';
                    }

                    return (
                        <span key={index} style={{ color, backgroundColor, textDecoration, transition: 'all 0.1s' }}>{char}</span>
                    );
                })}
            </div>

            <textarea
                ref={inputRef}
                value={input}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onPaste={(e) => e.preventDefault()}
                style={{
                    width: '100%',
                    height: '150px',
                    padding: '15px',
                    fontSize: '1.2rem',
                    fontFamily: 'monospace',
                    border: feedback ? '2px solid #dc3545' : '1px solid #ced4da',
                    borderRadius: '8px',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                }}
                placeholder="Start typing..."
                autoFocus
            />

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>

            {!isTestActive && (
                <div className="test-completion-overlay" style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(255,255,255,0.95)', display: 'flex',
                    flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    zIndex: 10, borderRadius: '8px', border: '2px solid #28a745'
                }}>
                    <h3>{timeLeft === 0 ? "⏱️ Time's Up!" : "✅ Task Finished"}</h3>
                    <p>Your typing results have been captured.</p>
                    <div style={{ margin: '15px 0', textAlign: 'left', background: '#f8f9fa', padding: '15px', borderRadius: '5px' }}>
                        <div><strong>WPM:</strong> {finalResults?.performance_data.wpm}</div>
                        <div><strong>Accuracy:</strong> {finalResults?.performance_data.match_accuracy}%</div>
                        <div><strong>Errors:</strong> {finalResults?.performance_data.error_count}</div>
                    </div>
                    <button 
                        onClick={handleFinalSubmit} 
                        className="btn-primary"
                        style={{ padding: '12px 30px', fontSize: '1.1rem' }}
                    >
                        Finish Session & Submit Data →
                    </button>
                    <p style={{ marginTop: '10px', fontSize: '0.8rem', color: '#6c757d' }}>
                        Click the button above to securely upload your session recording and data.
                    </p>
                </div>
            )}
        </div>
    );
}

export default TypingFrustrationTest;
