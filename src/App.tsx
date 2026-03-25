import { useState, useEffect, useMemo, useRef } from 'react';
import { auth, db } from './lib/firebase';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, getDoc, getDocs } from 'firebase/firestore';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { FloatingDashboard, TopicNode, SceneControls } from './components/ThreeDashboard';
import { generateRoadmap, solveDoubt, generateQuiz, generateRevisionNotes, findYouTubeVideo, generateTopicSummary } from './lib/gemini';
import { Loader2, Send, BookOpen, CheckCircle, Plus, FileText, HelpCircle, Download, LogIn, LogOut, ArrowLeft, Share2, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { jsPDF } from 'jspdf';
import * as THREE from 'three';

function Starfield() {
  const points = useMemo(() => {
    const p = new Float32Array(5000 * 3);
    for (let i = 0; i < 5000; i++) {
      const r = 100;
      const theta = 2 * Math.PI * Math.random();
      const phi = Math.acos(2 * Math.random() - 1);
      p[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      p[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      p[i * 3 + 2] = r * Math.cos(phi);
    }
    return p;
  }, []);

  const timeRef = useRef(0);
  const pointsRef = useRef<THREE.Points>(null);

  useFrame((_state, delta) => {
    timeRef.current += delta;
    const t = timeRef.current;
    if (pointsRef.current) {
      pointsRef.current.rotation.y = t * 0.02;
      pointsRef.current.rotation.x = t * 0.01;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={5000}
          array={points}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.15} color="white" transparent opacity={0.8} sizeAttenuation={true} />
    </points>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [roadmaps, setRoadmaps] = useState<any[]>([]);
  const [selectedRoadmap, setSelectedRoadmap] = useState<any>(null);
  const [selectedTopic, setSelectedTopic] = useState<any>(null);
  const [syllabus, setSyllabus] = useState('');
  const [generating, setGenerating] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [quiz, setQuiz] = useState<any>(null);
  const [quizAnswers, setQuizAnswers] = useState<any>({});
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [currentQuizDocId, setCurrentQuizDocId] = useState<string | null>(null);
  const [topicNotes, setTopicNotes] = useState<any[]>([]);
  const [topicQuizzes, setTopicQuizzes] = useState<any[]>([]);
  const [noteContent, setNoteContent] = useState('');
  const [revisionNotes, setRevisionNotes] = useState<string | null>(null);
  const [generatingNotes, setGeneratingNotes] = useState(false);
  const [youtubeVideo, setYoutubeVideo] = useState<string | null>(null);
  const [findingVideo, setFindingVideo] = useState(false);
  const [editingDetailedDescription, setEditingDetailedDescription] = useState(false);
  const [detailedDescriptionInput, setDetailedDescriptionInput] = useState('');
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sharedRoadmapId, setSharedRoadmapId] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState('beginner');
  const [topicSummary, setTopicSummary] = useState<string | null>(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roadmapId = urlParams.get('roadmapId');
    if (roadmapId) {
      setSharedRoadmapId(roadmapId);
    }
  }, []);

  useEffect(() => {
    if (sharedRoadmapId) {
      const fetchSharedRoadmap = async () => {
        try {
          const roadmapDoc = await getDoc(doc(db, 'roadmaps', sharedRoadmapId));
          if (roadmapDoc.exists()) {
            const data = { id: roadmapDoc.id, ...roadmapDoc.data() };
            setSelectedRoadmap(data);
          }
        } catch (error) {
          console.error("Error fetching shared roadmap:", error);
        }
      };
      fetchSharedRoadmap();
    }
  }, [sharedRoadmapId]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      const q = query(collection(db, 'roadmaps'), where('userId', '==', user.uid));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setRoadmaps(data);
      });
      return () => unsubscribe();
    }
  }, [user]);

  useEffect(() => {
    const loadTopicReferences = async () => {
      if (!selectedTopic || !user) {
        setTopicNotes([]);
        return;
      }

      try {
        const noteQuery = query(
          collection(db, 'notes'),
          where('userId', '==', user.uid),
          where('topicId', '==', selectedTopic.id)
        );
        const noteSnap = await getDocs(noteQuery);
        setTopicNotes(noteSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        const quizQuery = query(
          collection(db, 'quizzes'),
          where('userId', '==', user.uid),
          where('topicId', '==', selectedTopic.id)
        );
        const quizSnap = await getDocs(quizQuery);
        setTopicQuizzes(quizSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error('Error loading topic notes:', error);
      }
    };

    loadTopicReferences();
  }, [selectedTopic, user]);

  const handleShareRoadmap = async () => {
    if (!selectedRoadmap || !user) return;
    setSharing(true);
    try {
      await updateDoc(doc(db, 'roadmaps', selectedRoadmap.id), {
        isPublic: true
      });
      const shareUrl = `${window.location.origin}${window.location.pathname}?roadmapId=${selectedRoadmap.id}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      setSelectedRoadmap({ ...selectedRoadmap, isPublic: true });
    } catch (error) {
      console.error(error);
    } finally {
      setSharing(false);
    }
  };

  const handleCloneRoadmap = async () => {
    if (!selectedRoadmap || !user) return;
    setGenerating(true);
    try {
      const { id, ...roadmapData } = selectedRoadmap;
      await addDoc(collection(db, 'roadmaps'), {
        ...roadmapData,
        userId: user.uid,
        createdAt: new Date().toISOString(),
        isPublic: false
      });
      alert('Roadmap cloned to your protocols!');
    } catch (error) {
      console.error(error);
    } finally {
      setGenerating(false);
    }
  };

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const handleCreateRoadmap = async () => {
    if (!syllabus || !user) return;
    setGenerating(true);
    try {
      const topics = await generateRoadmap(syllabus, difficulty);
      await addDoc(collection(db, 'roadmaps'), {
        userId: user.uid,
        title: syllabus.slice(0, 30) + '...',
        syllabus,
        difficulty,
        topics: topics.map((t: any) => ({ ...t, completed: false })),
        createdAt: new Date().toISOString()
      });
      setSyllabus('');
    } catch (error) {
      console.error(error);
    } finally {
      setGenerating(false);
    }
  };

  const toggleTopicCompletion = async (roadmapId: string, topicId: string) => {
    const roadmap = roadmaps.find(r => r.id === roadmapId);
    if (!roadmap) return;
    const updatedTopics = roadmap.topics.map((t: any) => 
      t.id === topicId ? { ...t, completed: !t.completed } : t
    );
    await updateDoc(doc(db, 'roadmaps', roadmapId), { topics: updatedTopics });
  };

  const handleUpdateDetailedDescription = async () => {
    if (!selectedRoadmap || !selectedTopic) return;
    const updatedTopics = selectedRoadmap.topics.map((t: any) => 
      t.id === selectedTopic.id ? { ...t, detailedDescription: detailedDescriptionInput } : t
    );
    await updateDoc(doc(db, 'roadmaps', selectedRoadmap.id), { topics: updatedTopics });
    setSelectedTopic({ ...selectedTopic, detailedDescription: detailedDescriptionInput });
    setEditingDetailedDescription(false);
  };

  const handleSolveDoubt = async () => {
    if (!chatInput || !selectedTopic) return;
    const userMsg = { role: 'user', content: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    try {
      const answer = await solveDoubt(selectedTopic.title, chatInput);
      setChatMessages(prev => [...prev, { role: 'ai', content: answer }]);
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddNote = async () => {
    if (!selectedTopic || !user || !noteContent.trim()) return;
    try {
      await addDoc(collection(db, 'notes'), {
        userId: user.uid,
        topicId: selectedTopic.id,
        roadmapId: selectedRoadmap?.id || null,
        content: noteContent.trim(),
        updatedAt: new Date().toISOString(),
      });
      setNoteContent('');
      const noteQuery = query(
        collection(db, 'notes'),
        where('userId', '==', user.uid),
        where('topicId', '==', selectedTopic.id)
      );
      const noteSnap = await getDocs(noteQuery);
      setTopicNotes(noteSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error('Error adding note:', error);
    }
  };

  const handleGenerateQuiz = async () => {
    if (!selectedTopic || !user) return;
    setGenerating(true);
    try {
      const q = await generateQuiz(selectedTopic.title, selectedTopic.description);
      setQuiz(q);
      setQuizAnswers({});
      setQuizScore(null);

      const quizDoc = await addDoc(collection(db, 'quizzes'), {
        userId: user.uid,
        topicId: selectedTopic.id,
        roadmapId: selectedRoadmap?.id || null,
        questions: q,
        score: 0,
        completed: false,
        createdAt: new Date().toISOString(),
      });
      setCurrentQuizDocId(quizDoc.id);
    } catch (error) {
      console.error(error);
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateRevisionNotes = async () => {
    if (!selectedTopic) return;
    setGeneratingNotes(true);
    try {
      const notes = await generateRevisionNotes(selectedTopic.description);
      setRevisionNotes(notes);
    } catch (error) {
      console.error(error);
    } finally {
      setGeneratingNotes(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (!selectedTopic) return;
    setGeneratingSummary(true);
    try {
      const summary = await generateTopicSummary(selectedTopic.title, selectedTopic.detailedDescription || selectedTopic.description);
      setTopicSummary(summary);
    } catch (error) {
      console.error(error);
    } finally {
      setGeneratingSummary(false);
    }
  };

  const handleFindVideo = async () => {
    if (!selectedTopic) return;
    setFindingVideo(true);
    try {
      const video = await findYouTubeVideo(selectedTopic.title, selectedTopic.description);
      setYoutubeVideo(video);
    } catch (error) {
      console.error(error);
    } finally {
      setFindingVideo(false);
    }
  };

  const submitQuiz = async () => {
    if (!quiz) return;
    let score = 0;
    quiz.forEach((q: any, i: number) => {
      if (quizAnswers[i] === q.correctAnswer) score++;
    });
    setQuizScore(score);

    if (currentQuizDocId) {
      try {
        await updateDoc(doc(db, 'quizzes', currentQuizDocId), {
          score,
          completed: true,
          updatedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Error updating quiz score:', error);
      }
    }
  };

  const exportPDF = () => {
    if (!selectedTopic) return;
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text(selectedTopic.title, 10, 20);
    doc.setFontSize(12);
    doc.text(selectedTopic.description, 10, 30);
    doc.save(`${selectedTopic.title}_Notes.pdf`);
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-950 text-white">
        <Loader2 className="animate-spin w-12 h-12 text-indigo-500" />
      </div>
    );
  }

  if (!user && !selectedRoadmap) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-black text-white p-4 overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-40">
          <Canvas>
            <Starfield />
            <FloatingDashboard />
            <OrbitControls enableZoom={false} />
          </Canvas>
        </div>
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="z-10 text-center space-y-8 max-w-4xl"
        >
          <div className="inline-block px-4 py-1 border border-neon-green/30 rounded-full text-xs font-black uppercase tracking-[0.3em] text-neon-green mb-4">
            Neural Learning Protocol v2.0
          </div>
          <h1 className="text-8xl md:text-9xl font-black tracking-tighter uppercase leading-[0.85] drop-shadow-[0_0_30px_rgba(0,255,102,0.3)]">
            Lumina <br /> <span className="text-neon-green">Learn</span>
          </h1>
          <p className="text-xl text-slate-400 max-w-xl mx-auto font-medium leading-relaxed">
            The next generation of AI-powered education. <br />
            Interactive 3D roadmaps, instant doubt solving, and personalized learning paths.
          </p>
          <div className="pt-8">
            <button 
              onClick={handleLogin}
              className="group relative px-12 py-5 bg-neon-green text-black font-black text-xl uppercase tracking-tighter transition-all hover:scale-105 active:scale-95 overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
              <span className="relative flex items-center gap-3">
                <LogIn className="w-6 h-6" />
                Initialize Access
              </span>
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex bg-black text-white overflow-hidden font-display">
      {/* Sidebar */}
      <div className="w-80 border-r border-white/10 flex flex-col p-6 bg-black">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-12 h-12 bg-neon-green rounded-none flex items-center justify-center rotate-45">
            <BookOpen className="w-6 h-6 text-black -rotate-45" />
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tighter">Lumina</h2>
        </div>

        <div className="flex-1 space-y-8 overflow-y-auto">
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] px-2">Active Protocols</h3>
            {user ? roadmaps.map(r => (
              <button
                key={r.id}
                onClick={() => setSelectedRoadmap(r)}
                className={`w-full text-left p-4 transition-all flex items-center gap-4 group border-l-2 ${selectedRoadmap?.id === r.id ? 'bg-neon-green/10 border-neon-green text-neon-green' : 'border-transparent hover:bg-white/5 text-slate-500 hover:text-white'}`}
              >
                <div className={`w-2 h-2 rounded-none rotate-45 ${selectedRoadmap?.id === r.id ? 'bg-neon-green shadow-[0_0_8px_rgba(0,255,102,1)]' : 'bg-slate-700'}`} />
                <span className="font-black uppercase tracking-tighter text-sm truncate">{r.title}</span>
              </button>
            )) : (
              <div className="p-4 text-[10px] font-black uppercase tracking-widest text-white/20">Login to see your roadmaps</div>
            )}
          </div>

          {user && (
            <div className="p-6 bg-white/5 border border-white/10 space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">Inject Syllabus</h4>
              <textarea
                placeholder="Paste raw data..."
                value={syllabus}
                onChange={(e) => setSyllabus(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-none p-4 text-xs font-mono focus:border-neon-green outline-none h-32 resize-none transition-colors"
              />
              <div className="space-y-2">
                <h5 className="text-[8px] font-black uppercase tracking-[0.2em] text-white/30">Difficulty Level</h5>
                <div className="flex gap-1">
                  {['beginner', 'intermediate', 'advanced'].map((level) => (
                    <button
                      key={level}
                      onClick={() => setDifficulty(level)}
                      className={`flex-1 py-1 text-[8px] font-black uppercase tracking-tighter border transition-all ${
                        difficulty === level 
                          ? 'bg-neon-green border-neon-green text-black' 
                          : 'border-white/10 text-white/30 hover:text-white'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleCreateRoadmap}
                disabled={generating || !syllabus}
                className="w-full py-4 bg-white text-black hover:bg-neon-green disabled:opacity-50 font-black text-xs uppercase tracking-tighter transition-all flex items-center justify-center gap-2"
              >
                {generating ? <Loader2 className="animate-spin w-4 h-4" /> : <Plus className="w-4 h-4" />}
                Generate Roadmap
              </button>
            </div>
          )}
        </div>

        <div className="pt-6 border-t border-white/10 flex items-center justify-between">
          {user ? (
            <>
              <div className="flex items-center gap-3">
                <img src={user.photoURL || ''} className="w-10 h-10 border border-white/20 grayscale hover:grayscale-0 transition-all" />
                <div className="flex flex-col">
                  <span className="text-xs font-black uppercase tracking-tighter">{user.displayName}</span>
                  <span className="text-[10px] text-slate-500 font-mono">AUTHORIZED</span>
                </div>
              </div>
              <button onClick={() => auth.signOut()} className="p-2 hover:text-neon-green transition-colors">
                <LogOut className="w-5 h-5" />
              </button>
            </>
          ) : (
            <button 
              onClick={handleLogin}
              className="w-full py-3 bg-white text-black font-black uppercase tracking-tighter text-xs hover:bg-neon-green transition-all"
            >
              Initialize Access
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 relative flex flex-col">
        {!selectedRoadmap ? (
          <div className="flex-1 overflow-y-auto p-12">
            <div className="max-w-6xl mx-auto space-y-16">
              <header className="space-y-4">
                <div className="text-neon-green font-mono text-xs tracking-[0.3em] uppercase">Status: Online</div>
                <h2 className="text-7xl font-black uppercase tracking-tighter leading-[0.9]">Learning <br /> Dashboard</h2>
                <p className="text-slate-500 font-medium max-w-xl">Welcome back, {user.displayName}. Your cognitive enhancement protocols are ready.</p>
              </header>

              {roadmaps.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 border border-dashed border-white/10">
                  <BookOpen className="w-16 h-16 text-white/10 mb-6" />
                  <p className="text-white/30 font-black uppercase tracking-widest text-sm">No Active Protocols Found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {roadmaps.map(r => {
                    const completed = r.topics.filter((t: any) => t.completed).length;
                    const total = r.topics.length;
                    const percent = Math.round((completed / total) * 100);
                    
                    return (
                      <motion.button
                        key={r.id}
                        whileHover={{ y: -10, scale: 1.02 }}
                        onClick={() => setSelectedRoadmap(r)}
                        className="p-8 bg-white/5 border border-white/10 hover:border-neon-green transition-all text-left group relative overflow-hidden"
                      >
                        <div className="absolute top-0 right-0 p-4 font-mono text-[10px] text-white/20">
                          {r.id.slice(0, 8)}
                        </div>
                        {r.difficulty && (
                          <div className="absolute top-0 left-0 p-4">
                            <span className="px-2 py-0.5 border border-neon-green/30 text-[8px] font-black uppercase tracking-widest text-neon-green">
                              {r.difficulty}
                            </span>
                          </div>
                        )}
                        <div className="w-14 h-14 bg-white/5 border border-white/10 flex items-center justify-center mb-8 group-hover:bg-neon-green transition-colors">
                          <BookOpen className="w-7 h-7 text-white group-hover:text-black" />
                        </div>
                        <h3 className="text-2xl font-black uppercase tracking-tighter mb-4 truncate">{r.title}</h3>
                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500 mb-6">
                          <span>Progress: {completed}/{total}</span>
                          <span className="text-neon-green">{percent}%</span>
                        </div>
                        <div className="w-full h-1 bg-white/5 overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${percent}%` }}
                            className="h-full bg-neon-green shadow-[0_0_10px_rgba(0,255,102,0.5)]"
                          />
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* 3D View */}
            <div className="h-2/3 w-full relative bg-black">
              <motion.button
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                whileHover={{ x: -5 }}
                onClick={() => {
                  setSelectedRoadmap(null);
                  setSelectedTopic(null);
                }}
                className="absolute top-6 left-6 z-30 flex items-center gap-2 px-4 py-2 bg-black/60 backdrop-blur-md border border-white/10 hover:border-neon-green text-white/50 hover:text-neon-green transition-all font-black uppercase tracking-widest text-[10px]"
              >
                <ArrowLeft className="w-4 h-4" />
                Return to Dashboard
              </motion.button>

              <Canvas camera={{ position: [0, 0, 10], fov: 50 }}>
                <Starfield />
                <ambientLight intensity={0.8} />
                <pointLight position={[10, 10, 10]} intensity={1.5} />
                <directionalLight position={[-5, 5, 5]} intensity={1} color="#00ff66" />
                {selectedRoadmap.topics.map((topic: any, idx: number) => (
                  <TopicNode
                    key={topic.id}
                    position={[
                      Math.sin(idx * 1.5) * 4,
                      Math.cos(idx * 1.5) * 4,
                      0
                    ]}
                    title={topic.title}
                    completed={topic.completed}
                    onClick={() => {
                      setSelectedTopic(topic);
                      setChatMessages([]);
                      setQuiz(null);
                      setRevisionNotes(null);
                      setTopicSummary(null);
                      setYoutubeVideo(null);
                      setEditingDetailedDescription(false);
                    }}
                  />
                ))}
                <SceneControls />
              </Canvas>
              <div className="absolute top-20 left-6 p-8 bg-black/80 backdrop-blur-xl border border-white/10">
                <div className="text-[10px] font-black text-neon-green uppercase tracking-[0.3em] mb-2">
                  Active Roadmap {selectedRoadmap.difficulty && `| ${selectedRoadmap.difficulty}`}
                </div>
                <div className="flex items-center gap-4">
                  <h2 className="text-4xl font-black uppercase tracking-tighter">{selectedRoadmap.title}</h2>
                  {user && user.uid === selectedRoadmap.userId ? (
                    <button 
                      onClick={handleShareRoadmap}
                      disabled={sharing}
                      className="p-2 bg-white/5 border border-white/10 hover:border-neon-green hover:text-neon-green transition-all"
                      title="Share Roadmap"
                    >
                      {sharing ? <Loader2 className="w-4 h-4 animate-spin" /> : copied ? <Check className="w-4 h-4 text-neon-green" /> : <Share2 className="w-4 h-4" />}
                    </button>
                  ) : user ? (
                    <button 
                      onClick={handleCloneRoadmap}
                      disabled={generating}
                      className="px-4 py-2 bg-neon-green text-black font-black uppercase tracking-tighter text-[10px] hover:scale-105 transition-all"
                    >
                      {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Clone to My Protocols'}
                    </button>
                  ) : (
                    <button 
                      onClick={handleLogin}
                      className="px-4 py-2 bg-white text-black font-black uppercase tracking-tighter text-[10px] hover:bg-neon-green transition-all"
                    >
                      Login to Clone
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-6">
                  <div className="w-48 h-1 bg-white/10 overflow-hidden">
                    <div 
                      className="h-full bg-neon-green shadow-[0_0_10px_rgba(0,255,102,0.5)] transition-all duration-1000" 
                      style={{ width: `${(selectedRoadmap.topics.filter((t: any) => t.completed).length / selectedRoadmap.topics.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-black text-neon-green uppercase tracking-widest">
                    {Math.round((selectedRoadmap.topics.filter((t: any) => t.completed).length / selectedRoadmap.topics.length) * 100)}% COMPLETE
                  </span>
                </div>
              </div>
            </div>

            {/* Topic Details / Chat */}
            <AnimatePresence>
              {selectedTopic && (
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  className="absolute bottom-0 left-0 right-0 h-1/2 bg-black border-t border-white/10 flex overflow-hidden z-20"
                >
                  {/* Topic Info */}
                  <div className="w-1/3 border-r border-white/10 p-10 overflow-y-auto space-y-8">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="text-[10px] font-black text-neon-green uppercase tracking-[0.2em]">Topic Module</div>
                        <h3 className="text-4xl font-black uppercase tracking-tighter">{selectedTopic.title}</h3>
                      </div>
                      <button 
                        onClick={() => toggleTopicCompletion(selectedRoadmap.id, selectedTopic.id)}
                        className={`p-4 transition-all border ${selectedTopic.completed ? 'bg-neon-green border-neon-green text-black' : 'bg-transparent border-white/10 text-white/30 hover:text-white'}`}
                      >
                        <CheckCircle className="w-8 h-8" />
                      </button>
                    </div>
                    <p className="text-slate-400 leading-relaxed font-medium">{selectedTopic.description}</p>
                    
                    <div className="pt-6 border-t border-white/10 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-black text-neon-green uppercase tracking-[0.2em]">Detailed Intelligence</h4>
                        {!editingDetailedDescription && (
                          <button 
                            onClick={() => {
                              setEditingDetailedDescription(true);
                              setDetailedDescriptionInput(selectedTopic.detailedDescription || '');
                            }}
                            className="text-[10px] font-black text-white/30 hover:text-neon-green uppercase tracking-widest transition-colors"
                          >
                            {selectedTopic.detailedDescription ? '[ Edit ]' : '[ Add ]'}
                          </button>
                        )}
                      </div>
                      
                      {editingDetailedDescription ? (
                        <div className="space-y-4">
                          <textarea
                            value={detailedDescriptionInput}
                            onChange={(e) => setDetailedDescriptionInput(e.target.value)}
                            placeholder="Input detailed topic intelligence..."
                            className="w-full h-32 bg-white/5 border border-white/10 p-4 outline-none focus:border-neon-green font-mono text-xs text-slate-300 transition-colors"
                          />
                          <div className="flex gap-2">
                            <button 
                              onClick={handleUpdateDetailedDescription}
                              className="flex-1 py-2 bg-neon-green text-black font-black uppercase tracking-tighter text-xs"
                            >
                              Save Logic
                            </button>
                            <button 
                              onClick={() => setEditingDetailedDescription(false)}
                              className="flex-1 py-2 bg-white/5 border border-white/10 text-white font-black uppercase tracking-tighter text-xs"
                            >
                              Abort
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="min-h-[60px]">
                          {selectedTopic.detailedDescription ? (
                            <div className="prose prose-invert prose-sm max-w-none">
                              <ReactMarkdown>{selectedTopic.detailedDescription}</ReactMarkdown>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center p-8 border border-dashed border-white/10 rounded-lg">
                              <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-4">No Detailed Data Found</p>
                              <button 
                                onClick={() => {
                                  setEditingDetailedDescription(true);
                                  setDetailedDescriptionInput('');
                                }}
                                className="px-4 py-2 bg-white/5 border border-white/10 hover:border-neon-green hover:text-neon-green text-white/50 font-black uppercase tracking-tighter text-[10px] transition-all"
                              >
                                Initialize Detailed Description
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {topicSummary && (
                      <div className="p-6 bg-neon-green/10 border border-neon-green/20 space-y-4">
                        <h4 className="text-[10px] font-black text-neon-green uppercase tracking-[0.2em]">Quick Review Summary</h4>
                        <p className="text-sm text-slate-300 leading-relaxed italic">"{topicSummary}"</p>
                      </div>
                    )}

                    {revisionNotes && (
                      <div className="p-6 bg-white/5 border border-white/10 space-y-4">
                        <h4 className="text-[10px] font-black text-neon-green uppercase tracking-[0.2em]">Revision Notes</h4>
                        <div className="prose prose-invert prose-sm">
                          <ReactMarkdown>{revisionNotes}</ReactMarkdown>
                        </div>
                      </div>
                    )}

                    <div className="p-6 bg-white/5 border border-white/10 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-black text-neon-green uppercase tracking-[0.2em]">Topic Notes</h4>
                        <span className="text-[8px] text-white/50 uppercase tracking-widest">{topicNotes.length} entries</span>
                      </div>

                      <textarea
                        value={noteContent}
                        onChange={(e) => setNoteContent(e.target.value)}
                        placeholder="Capture targeted notes for this topic..."
                        className="w-full h-24 bg-black border border-white/10 p-4 outline-none focus:border-neon-green font-mono text-xs text-slate-300 transition-colors"
                      />
                      <button
                        onClick={handleAddNote}
                        disabled={!noteContent.trim()}
                        className="w-full py-2 bg-neon-green text-black font-black uppercase tracking-tighter text-xs hover:scale-105 transition-all disabled:opacity-50"
                      >
                        Save Topic Note
                      </button>

                      <div className="space-y-2 max-h-48 overflow-y-auto pt-2">
                        {topicNotes.length === 0 ? (
                          <p className="text-[10px] text-white/30 uppercase tracking-widest">No notes yet.</p>
                        ) : (
                          topicNotes.map((note) => (
                            <div key={note.id} className="p-2 bg-black/60 border border-white/10 text-xs text-slate-300 rounded">
                              <div className="text-[8px] text-white/40">{new Date(note.updatedAt).toLocaleString()}</div>
                              <p>{note.content}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="p-6 bg-black/80 border border-white/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-black text-neon-green uppercase tracking-[0.2em]">Saved Quizzes</h4>
                        <span className="text-[8px] text-white/30 uppercase tracking-widest">{topicQuizzes.length}</span>
                      </div>
                      {topicQuizzes.length === 0 ? (
                        <p className="text-[10px] text-white/30 uppercase tracking-widest">No saved quizzes yet.</p>
                      ) : (
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {topicQuizzes.map((q) => (
                            <div key={q.id} className="p-2 bg-white/5 border border-white/10 rounded text-xs">
                              <div className="flex items-center justify-between">
                                <span className="font-black uppercase tracking-wider">{q.completed ? 'Completed' : 'Draft'}</span>
                                <span className="text-[8px] text-white/40">{q.score}/{q.questions?.length || 0}</span>
                              </div>
                              <div className="text-[8px] text-white/40">{new Date(q.createdAt || q.updatedAt || '').toLocaleString()}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      <button 
                        onClick={handleGenerateSummary} 
                        disabled={generatingSummary}
                        className="flex items-center justify-center gap-3 p-5 bg-white/5 border border-white/10 hover:bg-white/10 transition-all font-black uppercase tracking-tighter text-sm disabled:opacity-50"
                      >
                        {generatingSummary ? <Loader2 className="animate-spin w-5 h-5" /> : <FileText className="w-5 h-5" />}
                        {generatingSummary ? 'Summarizing...' : 'Quick Review Summary'}
                      </button>
                      <button 
                        onClick={handleGenerateRevisionNotes} 
                        disabled={generatingNotes}
                        className="flex items-center justify-center gap-3 p-5 bg-white/5 border border-white/10 hover:bg-white/10 transition-all font-black uppercase tracking-tighter text-sm disabled:opacity-50"
                      >
                        {generatingNotes ? <Loader2 className="animate-spin w-5 h-5" /> : <FileText className="w-5 h-5" />}
                        {generatingNotes ? 'Generating...' : 'Generate Revision Notes'}
                      </button>
                      <button onClick={handleGenerateQuiz} className="flex items-center justify-center gap-3 p-5 bg-white text-black hover:bg-neon-green transition-all font-black uppercase tracking-tighter text-sm">
                        <HelpCircle className="w-5 h-5" /> Initialize Quiz
                      </button>
                      <button onClick={exportPDF} className="flex items-center justify-center gap-3 p-5 bg-white/5 border border-white/10 hover:bg-white/10 transition-all font-black uppercase tracking-tighter text-sm">
                        <Download className="w-5 h-5" /> Data Export (PDF)
                      </button>
                    </div>

                    <div className="pt-8 border-t border-white/10">
                      <h4 className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-6">External Intelligence</h4>
                      <div className="space-y-4">
                        {youtubeVideo ? (
                          <div className="p-5 bg-red-500/5 border border-red-500/20 text-red-500 space-y-4">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-red-500 flex items-center justify-center">
                                <Plus className="w-5 h-5 text-white" />
                              </div>
                              <span className="text-sm font-black uppercase tracking-tighter">AI Recommended Video</span>
                            </div>
                            <div className="prose prose-invert prose-sm text-slate-300">
                              <ReactMarkdown>{youtubeVideo}</ReactMarkdown>
                            </div>
                            <button 
                              onClick={() => setYoutubeVideo(null)}
                              className="text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-white"
                            >
                              [ Clear ]
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={handleFindVideo}
                            disabled={findingVideo}
                            className="w-full flex items-center gap-4 p-5 bg-red-500/5 border border-red-500/20 hover:bg-red-500/10 text-red-500 transition-all disabled:opacity-50"
                          >
                            <div className="w-10 h-10 bg-red-500 flex items-center justify-center">
                              {findingVideo ? <Loader2 className="animate-spin w-5 h-5 text-white" /> : <Plus className="w-5 h-5 text-white" />}
                            </div>
                            <span className="text-sm font-black uppercase tracking-tighter">
                              {findingVideo ? 'Searching YouTube...' : 'Find Matching YouTube Video'}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Chat / Quiz Area */}
                  <div className="flex-1 flex flex-col bg-black">
                    {quiz ? (
                      <div className="flex-1 p-12 overflow-y-auto">
                        <div className="max-w-3xl mx-auto space-y-12">
                          <div className="flex items-center justify-between">
                            <h3 className="text-4xl font-black uppercase tracking-tighter">Assessment Protocol</h3>
                            <button onClick={() => setQuiz(null)} className="text-white/30 hover:text-white font-black uppercase tracking-widest text-xs">Terminate</button>
                          </div>
                          {quiz.map((q: any, i: number) => (
                            <div key={i} className="space-y-6 p-10 bg-white/5 border border-white/10">
                              <p className="text-2xl font-black uppercase tracking-tighter leading-tight">{q.question}</p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {q.options.map((opt: string) => (
                                  <button
                                    key={opt}
                                    onClick={() => setQuizAnswers({ ...quizAnswers, [i]: opt })}
                                    className={`p-6 text-left transition-all border font-black uppercase tracking-tighter text-sm ${quizAnswers[i] === opt ? 'bg-neon-green border-neon-green text-black' : 'bg-black border-white/10 hover:border-white/30'}`}
                                  >
                                    {opt}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                          {quizScore === null ? (
                            <button 
                              onClick={submitQuiz}
                              className="w-full py-6 bg-neon-green text-black font-black text-xl uppercase tracking-tighter hover:scale-[1.02] active:scale-[0.98] transition-all"
                            >
                              Submit Assessment
                            </button>
                          ) : (
                            <div className="text-center p-16 bg-neon-green/10 border border-neon-green/30">
                              <div className="text-[10px] font-black text-neon-green uppercase tracking-[0.5em] mb-4">Results Compiled</div>
                              <h4 className="text-8xl font-black uppercase tracking-tighter mb-4">{quizScore} / {quiz.length}</h4>
                              <p className="text-neon-green font-black uppercase tracking-widest text-sm">Cognitive Sync Successful</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 p-10 overflow-y-auto space-y-6">
                          {chatMessages.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-white/10">
                              <HelpCircle className="w-20 h-20 mb-6 opacity-10" />
                              <p className="font-black uppercase tracking-[0.3em] text-sm">Awaiting Query...</p>
                            </div>
                          )}
                          {chatMessages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[80%] p-6 ${msg.role === 'user' ? 'bg-neon-green text-black font-black uppercase tracking-tighter' : 'bg-white/5 border border-white/10 text-slate-300'}`}>
                                <div className="prose prose-invert prose-sm">
                                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="p-6 border-t border-white/10 bg-black">
                          <div className="flex gap-4">
                            <input
                              type="text"
                              value={chatInput}
                              onChange={(e) => setChatInput(e.target.value)}
                              onKeyPress={(e) => e.key === 'Enter' && handleSolveDoubt()}
                              placeholder="Input query for AI processing..."
                              className="flex-1 bg-white/5 border border-white/10 px-6 py-5 outline-none focus:border-neon-green font-mono text-sm transition-colors"
                            />
                            <button 
                              onClick={handleSolveDoubt}
                              className="px-8 bg-neon-green text-black font-black uppercase tracking-tighter transition-all hover:scale-105 active:scale-95"
                            >
                              <Send className="w-6 h-6" />
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  );
}
