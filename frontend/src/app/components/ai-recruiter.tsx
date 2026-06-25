import React, { useState, useEffect, useRef } from "react";
import { Sidebar } from "./sidebar";
import { useAuth } from "../context/auth-context";
import { startLiveInterview, evaluateLiveAnswer, finishLiveInterview } from "../../api";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Loader2, Mic, MicOff, Video, VideoOff, BrainCircuit, Activity, CheckCircle, ShieldAlert, Award, User } from "lucide-react";

type Phase = "setup" | "audio_test" | "intro" | "interview" | "evaluating" | "finished";

const BODY_LANGUAGE_TIPS = [
  "Maintain eye contact with the camera.",
  "Try to sit upright and look confident.",
  "Avoid looking away frequently.",
  "Keep a natural smile.",
  "Ensure your face is clearly visible."
];

export const AIRecruiter: React.FC = () => {
  const { user, refreshLiveHistory } = useAuth();
  
  const [phase, setPhase] = useState<Phase>("setup");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cameraOn, setCameraOn] = useState(true);
  
  const [questions, setQuestions] = useState<string[]>([]);
  const [currentIdx, setCurrentIdx] = useState(-1);
  
  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(false);
  const [transcript, setTranscript] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const [scores, setScores] = useState({ comm: 0, conf: 0, tech: 0, prof: 0 });
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  
  const [bodyLangScore, setBodyLangScore] = useState(100);
  const [currentTip, setCurrentTip] = useState("");
  
  const [finalReport, setFinalReport] = useState<any>(null);
  
  const [audioTestRetries, setAudioTestRetries] = useState(0);
  const [showMicError, setShowMicError] = useState(false);
  const [lastSpokenTime, setLastSpokenTime] = useState<number>(Date.now());
  const [silenceWarnings, setSilenceWarnings] = useState(0);
  const [showSilenceButtons, setShowSilenceButtons] = useState(false);
  const [interviewStartTime, setInterviewStartTime] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (interviewStartTime > 0 && phase !== "finished") {
      const interval = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - interviewStartTime) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [interviewStartTime, phase]);

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const recogRef = useRef<any>(null);
  
  // Initialization
  useEffect(() => {
    synthRef.current = window.speechSynthesis;
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRec) {
      recogRef.current = new SpeechRec();
      recogRef.current.continuous = true;
      recogRef.current.interimResults = false;
      recogRef.current.onresult = (e: any) => {
        let currentTranscript = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          currentTranscript += e.results[i][0].transcript;
        }
        setTranscript(prev => prev + " " + currentTranscript);
      };
      recogRef.current.onend = () => {
        if (isRecordingRef.current) {
          try { recogRef.current.start(); } catch(e) {}
        } else {
          setIsRecording(false);
        }
      };
    }
    
    // Enable Camera
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(err => console.error("Camera error:", err));

    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(t => t.stop());
      }
      if (synthRef.current) synthRef.current.cancel();
    };
  }, []);

  // Mock Body Language Loop
  useEffect(() => {
    if (phase !== "interview") return;
    const interval = setInterval(() => {
      if (Math.random() > 0.6) {
        setCurrentTip(BODY_LANGUAGE_TIPS[Math.floor(Math.random() * BODY_LANGUAGE_TIPS.length)]);
        setBodyLangScore(prev => Math.max(0, prev - Math.floor(Math.random() * 5)));
        setTimeout(() => setCurrentTip(""), 5000);
      }
    }, 12000);
    return () => clearInterval(interval);
  }, [phase]);

  const speak = (text: string, onEnd?: () => void) => {
    if (!synthRef.current) return;
    synthRef.current.cancel();
    setIsSpeaking(true);
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    u.pitch = 1.0;
    const voices = synthRef.current.getVoices();
    const goodVoice = voices.find(v => v.lang.includes("en-US") || v.lang.includes("en-GB"));
    if (goodVoice) u.voice = goodVoice;
    
    u.onend = () => {
      setIsSpeaking(false);
      if (onEnd) onEnd();
    };
    synthRef.current.speak(u);
  };

  const startInterview = async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const res = await startLiveInterview(user.username);
      if (res.success && res.questions) {
        setQuestions(res.questions);
        setQuestions(res.questions);
        setPhase("audio_test");
        const testText = `Hello ${user.username}. Can you hear me clearly?`;
        speak(testText, () => {
          setTranscript("");
          if (!isRecording && recogRef.current) {
             isRecordingRef.current = true;
             try { recogRef.current.start(); } catch(e) {}
             setIsRecording(true);
          }
        });
      } else {
        setError(res.error || "Failed to start interview.");
      }
    } catch (err) {
      setError("Connection error.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (phase === "interview" && currentIdx >= 0 && currentIdx < questions.length) {
      speak(questions[currentIdx]);
      setTranscript("");
    }
  }, [currentIdx, phase, questions]);

  useEffect(() => {
    let timeout: any;
    if (phase === "audio_test" && !isSpeaking && !showMicError) {
      if (transcript.trim().length > 0) {
        setTranscript("");
        setPhase("intro");
        setInterviewStartTime(Date.now());
        speak("Microphone check successful. I have reviewed your resume and would like to discuss your background, projects, skills, and career goals. Let's begin.", () => {
          setTimeout(() => {
            setCurrentIdx(0);
            setPhase("interview");
          }, 1000);
        });
      } else {
        timeout = setTimeout(() => {
          if (audioTestRetries === 0) {
            setAudioTestRetries(1);
            speak("I couldn't hear your response. Please check your microphone and speaker settings. Can you hear me now?", () => {
              setTranscript("");
            });
          } else {
            setShowMicError(true);
          }
        }, 8000);
      }
    }
    return () => clearTimeout(timeout);
  }, [phase, isSpeaking, transcript, audioTestRetries, showMicError]);

  useEffect(() => {
    if (!isSpeaking) {
      setLastSpokenTime(Date.now());
    }
  }, [isSpeaking]);

  useEffect(() => {
    if (phase !== "interview" || !isRecording || isSpeaking) return;
    setSilenceWarnings(0);
    setLastSpokenTime(Date.now());
    setShowSilenceButtons(false);
  }, [transcript, phase, isRecording]);

  useEffect(() => {
    if (phase !== "interview" || !isRecording || isSpeaking) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = now - lastSpokenTime;
      
      if (transcript.trim()) {
        // Auto-submit after 4 seconds of silence IF they have spoken
        if (diff > 4000) {
          submitAnswer();
        }
      } else {
        // Smart Silence when they haven't spoken
        if (diff > 30000 && silenceWarnings < 3) {
          setSilenceWarnings(3);
          speak("Let me repeat the question. " + questions[currentIdx]);
          setLastSpokenTime(Date.now());
        } else if (diff > 20000 && silenceWarnings < 2) {
          setSilenceWarnings(2);
          setShowSilenceButtons(true);
          speak("Can you hear me properly? Would you like me to repeat the question?");
        } else if (diff > 10000 && silenceWarnings < 1) {
          setSilenceWarnings(1);
          speak("Take your time. Whenever you're ready, please answer.");
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, isRecording, isSpeaking, transcript, lastSpokenTime, silenceWarnings, currentIdx, questions]);

  const toggleCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setCameraOn(prev => !prev);
    }
  };

  const toggleRecording = () => {
    if (!recogRef.current) return;
    if (isRecording) {
      isRecordingRef.current = false;
      recogRef.current.stop();
      setIsRecording(false);
    } else {
      isRecordingRef.current = true;
      setTranscript("");
      try { recogRef.current.start(); } catch(e) {}
      setIsRecording(true);
    }
  };

  const submitAnswer = async () => {
    if (!user) return;
    // Prevent mic from automatically turning off
    // if (isRecording) toggleRecording();
    if (!transcript.trim()) return;

    setPhase("evaluating");
    try {
      const res = await evaluateLiveAnswer(user.username, questions[currentIdx], transcript);
      if (res.success) {
        const ev = res.evaluation;
        setFeedbacks(prev => [...prev, { q: questions[currentIdx], a: transcript, ev }]);
        setScores(prev => ({
          comm: prev.comm + ev.communication_score,
          conf: prev.conf + ev.confidence_score,
          tech: prev.tech + ev.technical_score,
          prof: prev.prof + ev.professionalism_score
        }));
        let aiResponse = "Thank you. Let's proceed to the next question.";
        const totalScore = (ev.communication_score + ev.technical_score) / 2;
        if (totalScore >= 85) aiResponse = "That's a good explanation. Thank you for sharing.";
        else if (totalScore >= 70) aiResponse = "Interesting. Thank you for sharing.";
        else if (totalScore < 50) aiResponse = "I see. Could you elaborate a little more next time? Moving on.";
        
        speak(aiResponse, () => {
          if (currentIdx + 1 < questions.length) {
            setCurrentIdx(prev => prev + 1);
            setPhase("interview");
          } else {
            finishInterview();
          }
        });
      }
    } catch (err) {
      if (currentIdx + 1 < questions.length) {
        setCurrentIdx(prev => prev + 1);
        setPhase("interview");
      } else {
        finishInterview();
      }
    }
  };

  const finishInterview = async () => {
    if (!user) return;
    setPhase("finished");
    setLoading(true);
    speak("That concludes our interview. I am now generating your final evaluation report.");
    
    const count = questions.length;
    const finalScores = {
      communication_score: Math.round(scores.comm / count),
      confidence_score: Math.round(scores.conf / count),
      technical_score: Math.round(scores.tech / count),
      professionalism_score: Math.round(scores.prof / count),
      body_language_score: bodyLangScore,
      questions_answers_json: JSON.stringify(feedbacks)
    };

    try {
      const res = await finishLiveInterview(user.username, finalScores);
      if (res.success) {
        setFinalReport({ ...finalScores, ...res });
        if(refreshLiveHistory) refreshLiveHistory();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#020817] text-slate-100 overflow-hidden font-sans selection:bg-blue-500/30">
      {(phase === "setup" || phase === "finished") && <Sidebar />}
      <div className={`flex-1 overflow-y-auto ${phase === "setup" || phase === "finished" ? "p-4 md:p-8" : "p-0"}`}>
        <div className={`${phase === "setup" || phase === "finished" ? "max-w-7xl mx-auto space-y-6" : "w-full h-full relative"}`}>
          
          {(phase === "setup" || phase === "finished") && (
            <header className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent flex items-center gap-2">
                  <BrainCircuit className="w-8 h-8 text-blue-500" /> AI Recruiter Live Interview
                </h1>
                <p className="text-slate-400 mt-1">Realistic voice interview powered by your resume</p>
              </div>
            </header>
          )}

          {error && (phase === "setup" || phase === "finished") && (
            <div className="bg-red-900/30 border border-red-700 text-red-300 p-4 rounded-lg flex items-center gap-3">
              <ShieldAlert className="w-5 h-5" /> {error}
            </div>
          )}

          {phase === "finished" && finalReport ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="text-2xl text-center text-blue-400 flex flex-col items-center gap-2">
                    <Award className="w-12 h-12 text-yellow-400" />
                    Final Hiring Decision
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-8">
                  <div className="text-center">
                    <div className="text-5xl font-extrabold mb-2 text-white">
                      {finalReport.hiring_decision}
                    </div>
                    <div className="text-lg text-slate-400">
                      Probability of passing a real interview: <span className="text-blue-400 font-bold">{finalReport.hiring_probability}%</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[
                      { label: "Communication", val: finalReport.communication_score, color: "text-blue-400" },
                      { label: "Confidence", val: finalReport.confidence_score, color: "text-purple-400" },
                      { label: "Technical", val: finalReport.technical_score, color: "text-green-400" },
                      { label: "Professionalism", val: finalReport.professionalism_score, color: "text-yellow-400" },
                      { label: "Body Language", val: finalReport.body_language_score, color: "text-pink-400" }
                    ].map((s, i) => (
                      <div key={i} className="bg-slate-800/50 p-4 rounded-xl text-center border border-slate-700/50">
                        <div className={`text-3xl font-bold ${s.color}`}>{s.val}</div>
                        <div className="text-xs text-slate-400 mt-1 uppercase tracking-wider">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-green-950/20 border border-green-900/50 p-6 rounded-xl">
                      <h3 className="text-green-400 font-bold mb-2 flex items-center gap-2"><CheckCircle className="w-5 h-5"/> Strengths</h3>
                      <p className="text-slate-300">{finalReport.strengths}</p>
                    </div>
                    <div className="bg-red-950/20 border border-red-900/50 p-6 rounded-xl">
                      <h3 className="text-red-400 font-bold mb-2 flex items-center gap-2"><Activity className="w-5 h-5"/> Areas to Improve</h3>
                      <p className="text-slate-300">{finalReport.improvements}</p>
                    </div>
                  </div>
                  
                  <div className="bg-blue-950/20 border border-blue-900/50 p-6 rounded-xl text-center">
                    <h3 className="text-blue-400 font-bold mb-2">Recommended Skills to Focus On</h3>
                    <p className="text-slate-300">{finalReport.recommended_skills}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className={`relative w-full overflow-hidden bg-slate-900 ${phase === "setup" ? "h-[calc(100vh-140px)] rounded-2xl shadow-2xl border border-slate-800" : "h-full"}`}>
              {/* Main Background: Generic dark gradient for Interview Phase */}
              {phase !== "setup" && (
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-slate-950 to-black z-0" />
              )}
              
              {/* User Webcam */}
              <div className={phase === "setup" 
                ? "absolute inset-0 bg-slate-950 flex flex-col items-center justify-center z-0"
                : "absolute bottom-6 left-6 w-72 aspect-video bg-slate-900 rounded-3xl border border-slate-700/50 overflow-hidden shadow-2xl z-20 flex flex-col items-center justify-center transition-all duration-700"}>
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${cameraOn ? 'opacity-100' : 'opacity-0'}`}
                />
                {!cameraOn && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 bg-slate-900">
                    <VideoOff className={`${phase === "setup" ? "w-16 h-16" : "w-8 h-8"} mb-2`} />
                    <p className={phase === "setup" ? "text-base" : "text-xs"}>Camera off</p>
                  </div>
                )}
                {phase === "setup" && (
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/40 to-slate-950/80 pointer-events-none" />
                )}
              </div>

              {/* Top Status Bar */}
              {phase !== "setup" && (
                <div className="absolute top-0 left-0 right-0 bg-slate-900/80 backdrop-blur-md border-b border-slate-700/50 p-4 flex items-center justify-between z-30 shadow-lg">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-300 bg-slate-800/50 px-3 py-1.5 rounded-full">
                      <div className={`w-2 h-2 rounded-full ${cameraOn ? 'bg-green-500' : 'bg-red-500'}`} />
                      Camera {cameraOn ? 'Connected' : 'Off'}
                    </div>
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-300 bg-slate-800/50 px-3 py-1.5 rounded-full">
                      <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-green-500' : 'bg-slate-500'}`} />
                      Mic {isRecording ? 'Listening' : 'Ready'}
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-xl font-bold font-mono text-white tracking-widest bg-slate-800/50 px-4 py-1.5 rounded-full border border-slate-700">
                      {formatTime(elapsedSeconds)}
                    </div>
                    {phase === "interview" && currentIdx >= 0 && (
                      <div className="bg-blue-600/20 border border-blue-500/30 text-blue-300 px-4 py-1.5 rounded-full text-sm font-bold tracking-wide">
                        Question {currentIdx + 1} / {questions.length}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Central Questions / Subtitles */}
              {phase !== "setup" && !showMicError && (
                <div className="absolute bottom-40 left-0 right-0 flex justify-center px-8 z-10 pointer-events-none">
                  <h3 className="text-base md:text-lg font-medium text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] text-center max-w-2xl bg-black/60 px-6 py-3 rounded-xl backdrop-blur-md border border-white/10">
                    {phase === "audio_test" ? "To test your microphone, please say: Hello, I can hear you." :
                     phase === "intro" ? "Reviewing resume..." : 
                     phase === "evaluating" ? "Evaluating your answer..." : questions[currentIdx]}
                  </h3>
                </div>
              )}

              {/* Mic Error Popup */}
              {showMicError && (
                <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/80 backdrop-blur-sm">
                  <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl shadow-2xl max-w-md text-center space-y-6">
                    <ShieldAlert className="w-16 h-16 text-yellow-500 mx-auto" />
                    <div>
                      <h3 className="text-2xl font-bold text-white">Microphone may not be working</h3>
                      <p className="text-slate-400 mt-2">I couldn't hear your response. Please check your browser permissions and physical microphone.</p>
                    </div>
                    <div className="flex justify-center gap-4">
                      <button onClick={() => {
                        setShowMicError(false);
                        setAudioTestRetries(0);
                      }} className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition">
                        Retry
                      </button>
                      <button onClick={() => {
                        setShowMicError(false);
                        setTranscript("Mock response"); // Bypass test
                      }} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition font-medium">
                        Continue Anyway
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Right Side Panel: AI Assistant */}
              {phase !== "setup" && (
                <div className="absolute top-1/2 -translate-y-1/2 right-8 w-72 bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 rounded-3xl shadow-2xl z-20 flex flex-col items-center p-6 transition-all duration-500 hover:shadow-blue-900/20 hover:border-slate-600">
                  <div className="w-32 h-32 rounded-full bg-slate-800 border-4 border-slate-700 flex items-center justify-center shadow-inner relative mb-6">
                    <BrainCircuit className={`w-16 h-16 ${isSpeaking ? 'text-blue-400 animate-pulse' : 'text-slate-500'}`} />
                    {isSpeaking && (
                      <div className="absolute inset-0 rounded-full border-2 border-blue-400 animate-ping opacity-20" />
                    )}
                  </div>
                  
                  <div className="flex items-center justify-center gap-1.5 h-10 w-full bg-slate-950/50 rounded-xl p-2 border border-slate-800">
                    {[1,2,3,4,5,6,7,8,9,10].map(i => (
                      <div
                        key={i}
                        className={`w-2 rounded-full transition-all ${isSpeaking ? "bg-blue-400" : "bg-slate-700"}`}
                        style={{
                          height: isSpeaking ? `${Math.random() * 24 + 8}px` : "6px",
                          animation: isSpeaking ? `wave ${0.4 + i * 0.1}s ease-in-out infinite alternate` : "none",
                          animationDelay: `${i * 0.05}s`,
                        }}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 font-medium mt-4 uppercase tracking-widest flex items-center gap-2">
                    {isSpeaking ? <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span></span> : null}
                    {isSpeaking ? "AI is speaking" : "AI Recruiter"}
                  </p>
                </div>
              )}

              {/* Bottom Live Captions */}
              {phase !== "setup" && (
                <div className="absolute bottom-24 left-0 right-0 flex justify-center z-20 pointer-events-none">
                  <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/50 px-6 py-3 rounded-2xl max-w-xl w-full text-center shadow-lg transition-all duration-300 min-h-[60px] flex items-center justify-center">
                    {isSpeaking ? (
                      <div className="text-blue-300 font-medium text-sm italic">
                        "Listening to AI..."
                      </div>
                    ) : transcript ? (
                      <div className="text-white text-base font-medium drop-shadow-md">
                        {transcript}
                      </div>
                    ) : (
                      <div className="text-slate-500 text-sm italic">
                        {isRecording ? "Listening..." : "Microphone off"}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Floating Controls */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 z-30 bg-slate-900/90 p-3 rounded-full backdrop-blur-xl border border-slate-700/50 shadow-2xl">
                
                {phase === "setup" ? (
                  <button
                    onClick={startInterview}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-full font-bold text-xl shadow-lg transition flex items-center gap-3"
                  >
                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <BrainCircuit className="w-6 h-6" />}
                    Start Live Interview
                  </button>
                ) : (
                  <>
                    <button
                      onClick={toggleCamera}
                      className={`p-4 rounded-full transition shadow-lg ${!cameraOn ? 'bg-red-500 hover:bg-red-600' : 'bg-slate-700 hover:bg-slate-600'}`}
                      title={cameraOn ? "Turn off camera" : "Turn on camera"}
                    >
                      {cameraOn ? <Video className="w-6 h-6 text-white" /> : <VideoOff className="w-6 h-6 text-white" />}
                    </button>
                    <button
                      onClick={toggleRecording}
                      className={`p-4 rounded-full transition shadow-lg ${isRecording ? 'bg-green-500 hover:bg-green-600 animate-pulse' : 'bg-slate-700 hover:bg-slate-600'} ml-2`}
                      title={isRecording ? "Turn off microphone" : "Turn on microphone"}
                    >
                      {isRecording ? <Mic className="w-6 h-6 text-white" /> : <MicOff className="w-6 h-6 text-white" />}
                    </button>
                  </>
                )}
              </div>

              {/* Silence Buttons */}
              {showSilenceButtons && phase === "interview" && !isSpeaking && (
                <div className="absolute bottom-28 left-1/2 -translate-x-1/2 flex items-center gap-4 z-40 bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-2xl animate-in slide-in-from-bottom-4">
                  <button onClick={() => {
                    speak(questions[currentIdx]);
                    setShowSilenceButtons(false);
                    setLastSpokenTime(Date.now());
                  }} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition">
                    Repeat Question
                  </button>
                  <button onClick={() => {
                    setShowSilenceButtons(false);
                    setTranscript("I'll skip this question.");
                    submitAnswer();
                  }} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition">
                    Skip Question
                  </button>
                  <button onClick={() => {
                    setShowSilenceButtons(false);
                    setLastSpokenTime(Date.now());
                  }} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition">
                    Continue
                  </button>
                </div>
              )}

              {/* Body Language Tooltip */}
              {currentTip && cameraOn && phase !== "setup" && (
                <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-yellow-500/90 text-yellow-950 px-6 py-3 rounded-full font-bold text-sm animate-bounce shadow-2xl flex items-center gap-2 z-20">
                  <Activity className="w-5 h-5" /> {currentTip}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes wave {
          from { height: 4px; }
          to { height: 40px; }
        }
      `}} />
    </div>
  );
};
