const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Normalize line endings for reliable replacement
content = content.replace(/\r\n/g, '\n');

// 1. Imports
content = content.replace(
  "import { auth, db } from './lib/firebase';\nimport { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User, signInAnonymously } from 'firebase/auth';\nimport { collection, query, where, onSnapshot, addDoc, updateDoc, doc, getDoc, getDocs } from 'firebase/firestore';\n",
  "import { supabase } from './lib/supabase';\nimport { User } from '@supabase/supabase-js';\n"
);

// 2. State & effects
content = content.replace(
  "const [user, setUser] = useState<User | null>(null);",
  "const [user, setUser] = useState<User | null>(null);\n  const [authEmail, setAuthEmail] = useState('');\n  const [authPassword, setAuthPassword] = useState('');\n  const [isSignUp, setIsSignUp] = useState(false);\n  const [authError, setAuthError] = useState<string | null>(null);\n  const [authLoading, setAuthLoading] = useState(false);"
);

content = content.replace(
  `  useEffect(() => {
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
  }, [user]);`,
  `  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  const loadRoadmaps = async () => {
    if (!user) return;
    const { data } = await supabase.from('roadmaps').select('*').eq('userId', user.id);
    if (data) setRoadmaps(data);
  };

  useEffect(() => {
    loadRoadmaps();
  }, [user]);`
);

// 3. Shared Roadmap & loadTopicReferences
content = content.replace(
  `          const roadmapDoc = await getDoc(doc(db, 'roadmaps', sharedRoadmapId));
          if (roadmapDoc.exists()) {
            const data = { id: roadmapDoc.id, ...roadmapDoc.data() };
            setSelectedRoadmap(data);
          }`,
  `          const { data } = await supabase.from('roadmaps').select('*').eq('id', sharedRoadmapId).single();
          if (data) setSelectedRoadmap(data);`
);

content = content.replace(
  `        const noteQuery = query(
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
        setTopicQuizzes(quizSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));`,
  `        const { data: notes } = await supabase.from('notes').select('*').eq('userId', user.id).eq('topicId', selectedTopic.id);
        const { data: quizzes } = await supabase.from('quizzes').select('*').eq('userId', user.id).eq('topicId', selectedTopic.id);
        setTopicNotes(notes || []);
        setTopicQuizzes(quizzes || []);`
);

// 4. Appending to handle functions
content = content.replace(
  `      await updateDoc(doc(db, 'roadmaps', selectedRoadmap.id), {
        isPublic: true
      });`,
  `      await supabase.from('roadmaps').update({ isPublic: true }).eq('id', selectedRoadmap.id);`
);

content = content.replace(
  `      await addDoc(collection(db, 'roadmaps'), {
        ...roadmapData,
        userId: user.uid,
        createdAt: new Date().toISOString(),
        isPublic: false
      });`,
  `      await supabase.from('roadmaps').insert([{
        title: roadmapData.title,
        syllabus: roadmapData.syllabus,
        difficulty: roadmapData.difficulty,
        topics: roadmapData.topics,
        userId: user.id,
        createdAt: new Date().toISOString(),
        isPublic: false
      }]);
      loadRoadmaps();`
);

// Auth Login replace
content = content.replace(
  `  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      if (error.code === 'auth/unauthorized-domain') {
        console.warn("Domain not authorized for Google Login. Falling back to Anonymous Auth for local testing...");
        try {
          await signInAnonymously(auth);
        } catch (anonError) {
          console.error("Anonymous auth also failed:", anonError);
          alert("Could not log in via Google or Anonymously. Please check your Firebase project settings or use your own Firebase config.");
        }
      } else {
        console.error(error);
        alert(error.message);
      }
    }
  };`,
  `  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
        if (error) throw error;
        alert('Check your email to confirm registration or sign in directly.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
        if (error) throw error;
      }
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };`
);

// Roadmap creation
content = content.replace(
  `      await addDoc(collection(db, 'roadmaps'), {
        userId: user.uid,
        title: syllabus.slice(0, 30) + '...',
        syllabus,
        difficulty,
        topics: topics.map((t: any) => ({ ...t, completed: false })),
        createdAt: new Date().toISOString()
      });`,
  `      await supabase.from('roadmaps').insert([{
        userId: user.id,
        title: syllabus.slice(0, 30) + '...',
        syllabus,
        difficulty,
        topics: topics.map((t: any) => ({ ...t, completed: false })),
        createdAt: new Date().toISOString()
      }]);
      loadRoadmaps();`
);

// Toggle Topic - App.tsx line ~225
content = content.replace(
  `    await updateDoc(doc(db, 'roadmaps', roadmapId), { topics: updatedTopics });`,
  `    await supabase.from('roadmaps').update({ topics: updatedTopics }).eq('id', roadmapId);
    loadRoadmaps();`
);

// Update Detailed Description - block 1
content = content.replace(
  `    await updateDoc(doc(db, 'roadmaps', selectedRoadmap.id), { topics: updatedTopics });`,
  `    await supabase.from('roadmaps').update({ topics: updatedTopics }).eq('id', selectedRoadmap.id);
    loadRoadmaps();`
);

// Add Note
content = content.replace(
  `      await addDoc(collection(db, 'notes'), {
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
      setTopicNotes(noteSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));`,
  `      await supabase.from('notes').insert([{
        userId: user.id,
        topicId: selectedTopic.id,
        roadmapId: selectedRoadmap?.id || null,
        content: noteContent.trim(),
        updatedAt: new Date().toISOString(),
      }]);
      setNoteContent('');
      const { data: notes } = await supabase.from('notes').select('*').eq('userId', user.id).eq('topicId', selectedTopic.id);
      setTopicNotes(notes || []);`
);

// Generate Quiz
content = content.replace(
  `      const quizDoc = await addDoc(collection(db, 'quizzes'), {
        userId: user.uid,
        topicId: selectedTopic.id,
        roadmapId: selectedRoadmap?.id || null,
        questions: q,
        score: 0,
        completed: false,
        createdAt: new Date().toISOString(),
      });
      setCurrentQuizDocId(quizDoc.id);`,
  `      const { data: quizData } = await supabase.from('quizzes').insert([{
        userId: user.id,
        topicId: selectedTopic.id,
        roadmapId: selectedRoadmap?.id || null,
        questions: q,
        score: 0,
        completed: false,
        createdAt: new Date().toISOString(),
      }]).select().single();
      if (quizData) setCurrentQuizDocId(quizData.id);`
);

// Submit Quiz
content = content.replace(
  `        await updateDoc(doc(db, 'quizzes', currentQuizDocId), {
          score,
          completed: true,
          updatedAt: new Date().toISOString(),
        });`,
  `        await supabase.from('quizzes').update({
          score,
          completed: true,
          updatedAt: new Date().toISOString(),
        }).eq('id', currentQuizDocId);`
);

// User UI replacements
content = content.replace(/user\.uid/g, "user.id");
content = content.replace(/{user\.displayName}/g, "{user.email?.split('@')[0]}");
content = content.replace(
  `onClick={() => auth.signOut()}`,
  `onClick={() => supabase.auth.signOut()}`
);

// Inject logic into UI screen
content = content.replace(
  `          <div className="pt-8">
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
      </div>`,
  `          <div className="pt-8 max-w-sm mx-auto w-full">
            <form onSubmit={handleAuth} className="p-8 bg-black/80 backdrop-blur-xl border border-white/10 space-y-4">
              <div className="flex gap-2 mb-6 border-b border-white/10 pb-4">
                <button type="button" onClick={() => setIsSignUp(false)} className={\`flex-1 font-black uppercase text-xs tracking-widest \${!isSignUp ? 'text-neon-green' : 'text-slate-500 hover:text-white'}\`}>Log In</button>
                <button type="button" onClick={() => setIsSignUp(true)} className={\`flex-1 font-black uppercase text-xs tracking-widest \${isSignUp ? 'text-neon-green' : 'text-slate-500 hover:text-white'}\`}>Sign Up</button>
              </div>
              {authError && <div className="p-3 bg-red-500/20 text-red-500 text-xs font-mono mb-4">{authError}</div>}
              <div>
                <input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} required placeholder="CODENAME (EMAIL)" className="w-full bg-white/5 border border-white/10 px-4 py-3 font-mono text-sm uppercase outline-none focus:border-neon-green transition-colors" />
              </div>
              <div>
                <input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} required placeholder="ACCESS KEY (PASSWORD)" className="w-full bg-white/5 border border-white/10 px-4 py-3 font-mono text-sm uppercase outline-none focus:border-neon-green transition-colors" />
              </div>
              <button disabled={authLoading} type="submit" className="w-full mt-4 bg-neon-green text-black font-black py-4 uppercase tracking-tighter hover:scale-[1.02] flex items-center justify-center gap-3 disabled:opacity-50">
                {authLoading ? <Loader2 className="animate-spin w-5 h-5"/> : <LogIn className="w-5 h-5"/> }
                {isSignUp ? 'Initialize Profile' : 'Access System'}
              </button>
            </form>
          </div>
        </motion.div>
      </div>`
);

content = content.replace(
  `            <button 
              onClick={handleLogin}
              className="w-full py-3 bg-white text-black font-black uppercase tracking-tighter text-xs hover:bg-neon-green transition-all"
            >
              Initialize Access
            </button>`,
  `            <div className="w-full flex justify-center text-xs font-black uppercase tracking-widest text-white/50">
              Awaiting Auth...
            </div>`
);

content = content.replace(
  `<button 
                      onClick={handleLogin}
                      className="px-4 py-2 bg-white text-black font-black uppercase tracking-tighter text-[10px] hover:bg-neon-green transition-all"
                    >
                      Login to Clone
                    </button>`,
  `<button 
                      onClick={() => window.location.reload()}
                      className="px-4 py-2 bg-white text-black font-black uppercase tracking-tighter text-[10px] hover:bg-neon-green transition-all"
                    >
                      Login Required
                    </button>`
);

// Restore line endings
content = content.replace(/\n/g, '\r\n');

fs.writeFileSync('src/App.tsx', content);

// Simple check
const newContent = fs.readFileSync('src/App.tsx', 'utf-8');
if (newContent.includes('supabase')) {
  console.log("SUCCESS: Supabase imports injected.");
} else {
  console.log("FAIL: Refactor missed the mark.");
}
