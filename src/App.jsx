import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, 
  Search, Bell, LogOut, User, Settings, Image as ImageIcon, 
  Moon, Sun, X, Link as LinkIcon, Edit3, Lock, Eye, EyeOff,
  Github, Twitter, Linkedin, Mail, Send, Check
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, 
  signOut, onAuthStateChanged, updateProfile, updatePassword,
  signInWithCustomToken, signInAnonymously 
} from 'firebase/auth';
import { 
  getFirestore, collection, addDoc, query, where, orderBy, 
  onSnapshot, doc, updateDoc, arrayUnion, arrayRemove, 
  serverTimestamp, getDoc, setDoc, deleteDoc, runTransaction, 
  getDocs 
} from 'firebase/firestore';

// Guarded Firebase initialization: if global `__firebase_config` is not provided
// the app will run in offline/demo mode without attempting Firestore/auth calls.
let firebaseEnabled = false;
let app = null;
let auth = null;
let db = null;
let appId = 'default-app-id';

try {
  if (typeof __firebase_config !== 'undefined' && __firebase_config) {
    const firebaseConfig = JSON.parse(__firebase_config);
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    firebaseEnabled = true;
  }
} catch (e) {
  console.warn('Firebase config parse/init failed — running in offline mode.', e);
}

export default function App() {
  // The big component was ported here but many firestore/auth effects are
  // guarded with `firebaseEnabled` so the app doesn't crash when config is missing.
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [view, setView] = useState('login');
  const [profileId, setProfileId] = useState(null);

  const [availableUsers, setAvailableUsers] = useState([]);
  const [activeRecipient, setActiveRecipient] = useState(null);

  const [notifications, setNotifications] = useState([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  const [posts, setPosts] = useState([]);
  const [profileData, setProfileData] = useState(null);
  const [userStats, setUserStats] = useState({ followers: [], following: [] });
  const [searchQuery, setSearchQuery] = useState('');

  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isFooterModalOpen, setIsFooterModalOpen] = useState(false);
  const [footerModalContent, setFooterModalContent] = useState({ title: '', body: '' });

  const emailRef = useRef();
  const passwordRef = useRef();
  const nameRef = useRef();
  const postDescRef = useRef();
  const postLinkRef = useRef();
  const postImageRef = useRef();

  // Helpers
  const getChatId = (userA, userB) => [userA, userB].sort().join('_');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }

    if (!firebaseEnabled) {
      // Offline/demo mode: provide some mocked data for UI
      setLoading(false);
      setPosts([]);
      return;
    }

    setLoading(true);
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        try { await signInWithCustomToken(auth, __initial_auth_token); } catch (e) { console.error(e); }
      }

      const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        setUser(currentUser);
        if (currentUser) {
          if (view === 'login' || view === 'register') setView('home');
          const userDocRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'profile', 'info');
          const docSnap = await getDoc(userDocRef);
          if (!docSnap.exists()) {
            await setDoc(userDocRef, {
              displayName: currentUser.displayName || 'Usuário',
              photoURL: currentUser.photoURL,
              coverURL: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1000&q=80',
              bio: 'Olá! Sou novo no Postlinkss.',
              notificationsEnabled: true,
              followers: [],
              following: []
            });
          }
        } else {
          setView('login');
        }
        setLoading(false);
      });

      return () => unsubscribe();
    };

    initAuth();
  }, []); // eslint-disable-line

  // Fetch posts (guarded)
  useEffect(() => {
    if (!firebaseEnabled || !user) return;
    const postsRef = collection(db, 'artifacts', appId, 'public', 'data', 'posts');
    const q = view === 'profile' && profileId ? query(postsRef, where('authorId', '==', profileId)) : query(postsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      if (view === 'profile' && profileId) {
        fetched.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      }
      setPosts(fetched);
    }, (err) => console.error(err));

    return () => unsubscribe();
  }, [user, view, profileId]);

  // Minimal handlers that early-return when Firebase is not configured
  const handleLogin = async (e) => {
    e?.preventDefault?.();
    if (!firebaseEnabled) return alert('Firebase não configurado.');
    try { await signInWithEmailAndPassword(auth, emailRef.current.value, passwordRef.current.value); } catch (err) { alert(err.message); }
  };

  const handleRegister = async (e) => {
    e?.preventDefault?.();
    if (!firebaseEnabled) return alert('Firebase não configurado.');
    try {
      const email = emailRef.current.value; const password = passwordRef.current.value; const name = nameRef.current.value;
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: name, photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}` });
      await setDoc(doc(db, 'artifacts', appId, 'users', userCredential.user.uid, 'profile', 'info'), {
        displayName: name, email, photoURL: userCredential.user.photoURL,
        coverURL: 'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=1000&q=80', bio: 'Novo membro do Postlinkss', notificationsEnabled: true, followers: [], following: []
      });
      await signOut(auth);
      alert('Conta criada com sucesso! Faça login.');
      setView('login');
    } catch (err) { console.error(err); alert(err.message); }
  };

  const handleCreatePost = async (e) => {
    e?.preventDefault?.();
    if (!firebaseEnabled) return alert('Firebase não configurado.');
    if (!postDescRef.current.value && !postImageRef.current.value) return;
    try {
      const newPostRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'posts'), {
        description: postDescRef.current.value, link: postLinkRef.current.value || '', imageURL: postImageRef.current.value || '',
        authorId: user.uid, authorName: user.displayName || 'Usuário', authorPhoto: user.photoURL, createdAt: serverTimestamp(), likes: [], bookmarks: []
      });
      postDescRef.current.value = ''; postLinkRef.current.value = ''; postImageRef.current.value = '';
    } catch (err) { console.error(err); }
  };

  const handleShare = async (text) => {
    try {
      if (navigator.share) { await navigator.share({ title: 'Postlinkss', text, url: window.location.href }); }
      else if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(window.location.href); alert('Link copiado para a área de transferência!'); }
      else { alert('Compartilhamento não suportado neste navegador.'); }
    } catch (err) { console.error(err); }
  };

  if (loading) return <div className={`loading-screen ${darkMode ? 'dark' : ''}`}>A iniciar Postlinkss...</div>;

  // Simple UI rendered; many advanced interactions require Firebase configuration.
  return (
    <div className={`app-root ${darkMode ? 'dark' : ''}`}>
      <header className="container header">
        <div className="brand" onClick={() => { setView('home'); setProfileId(null); }}>
          <div className="logo">P</div>
          <h1 className="title">Postlinkss</h1>
        </div>

        <div className="controls">
          <div className="search-input">
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Pesquisar..." />
          </div>
          <button onClick={() => setIsNotificationsOpen(true)} className="icon-btn"><Bell /></button>
          <button onClick={() => { setDarkMode(!darkMode); document.documentElement.classList.toggle('dark'); }} className="icon-btn">{darkMode ? <Sun /> : <Moon />}</button>
        </div>
      </header>

      <main className="container main">
        <div className={`card ${darkMode ? 'dark' : ''}`}>
          <h2 className="card-title">Bem-vindo ao Postlinkss</h2>
          <p className={`muted ${darkMode ? 'dark' : ''}`}>{firebaseEnabled ? 'Firebase configurado.' : 'Rodando em modo offline — configure `__firebase_config` para habilitar funcionalidades.'}</p>
          <div className="post-row">
            <input ref={postDescRef} placeholder="O que você está pensando?" className="input" />
            <button onClick={handleCreatePost} className="btn-primary">Publicar</button>
          </div>
        </div>

        <section className="posts">
          {posts.length === 0 ? (
            <div className="empty">Nenhum post ainda.</div>
          ) : posts.map(post => (
            <div key={post.id} className={`post-card ${darkMode ? 'dark' : ''}`}>
              <div className="post-top">
                <div className="author">
                  <img src={post.authorPhoto} className="avatar" />
                  <div>
                    <div className="font-semibold">{post.authorName}</div>
                    <div className="date">{new Date(post.createdAt?.toMillis?.() || Date.now()).toLocaleString()}</div>
                  </div>
                </div>
                <div className="controls">
                  <button onClick={() => handleShare(post.description)} className="share-btn"><Share2 /></button>
                </div>
              </div>
              <div className={`post-desc ${darkMode ? 'dark' : ''}`}>{post.description}</div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
