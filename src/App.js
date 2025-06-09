import React, { useState, useEffect, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, query, orderBy, onSnapshot, serverTimestamp, addDoc, deleteDoc } from 'firebase/firestore';

// Context for Auth and Firestore
const AppContext = createContext();

// App component
function App() {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [user, setUser] = useState(null);
  const [userId, setUserId] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentPage, setCurrentPage] = useState('home'); // 'home', 'aiChat', 'professionals', 'freedomWall', 'community', 'profile'
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [isPremium, setIsPremium] = useState(false); // Simple premium flag for demo

  // Initialize Firebase and set up authentication listener
  useEffect(() => {
    try {
      // Access global variables provided by the Canvas environment
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-padayon-app';
      const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
      const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

      if (Object.keys(firebaseConfig).length === 0) {
        console.error("Firebase config is missing. App may not function correctly.");
        setLoading(false);
        return;
      }

      // Initialize Firebase app
      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const authService = getAuth(app);

      setDb(firestore);
      setAuth(authService);

      // Listen for authentication state changes
      const unsubscribe = onAuthStateChanged(authService, async (currentUser) => {
        if (currentUser) {
          // User is signed in
          setUser(currentUser);
          setUserId(currentUser.uid);
          setIsAuthenticated(true);
          // In a real app, you'd fetch premium status from Firestore user profile
          // For this demo, we'll assume premium is false unless specifically set or managed.
          // For now, let's say a user who signs in with email is premium for demo purposes
          setIsPremium(currentUser.email ? true : false); // Example: email users are premium
          setAuthError('');
        } else {
          // User is signed out or not yet authenticated
          setUser(null);
          setUserId(crypto.randomUUID()); // Use a random ID for anonymous users
          setIsAuthenticated(false);
          setIsPremium(false);
          // Attempt to sign in anonymously if no initial token
          if (!initialAuthToken) {
            try {
              await signInAnonymously(authService);
            } catch (error) {
              console.error("Error signing in anonymously:", error);
            }
          }
        }
        setLoading(false);
      });

      // Sign in with custom token if available
      const signInWithToken = async () => {
        if (authService && initialAuthToken) {
          try {
            await signInWithCustomToken(authService, initialAuthToken);
            setAuthError('');
          } catch (error) {
            console.error("Error signing in with custom token:", error);
            setAuthError(`Failed to sign in with token: ${error.message}`);
            // Fallback to anonymous sign-in if token fails
            try {
              await signInAnonymously(authService);
            } catch (anonError) {
              console.error("Error signing in anonymously after token failure:", anonError);
            }
          }
        }
      };
      signInWithToken();

      return () => unsubscribe(); // Cleanup auth listener on component unmount
    } catch (error) {
      console.error("Failed to initialize Firebase:", error);
      setAuthError(`Failed to initialize app: ${error.message}`);
      setLoading(false);
    }
  }, []);

  // Handle user logout
  const handleLogout = async () => {
    if (auth) {
      try {
        await signOut(auth);
        setCurrentPage('home'); // Redirect to home after logout
      } catch (error) {
        console.error("Error logging out:", error);
        setAuthError(`Logout failed: ${error.message}`);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-100 to-purple-100 font-inter">
        <div className="text-center p-8 bg-white rounded-xl shadow-lg">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg text-gray-700">Loading Padayon...</p>
        </div>
      </div>
    );
  }

  return (
    <AppContext.Provider value={{ db, auth, user, userId, isAuthenticated, setIsAuthenticated, isPremium, setIsPremium, authError, setAuthError }}>
      <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-100 flex flex-col font-inter text-gray-800">
        {/* Header */}
        <header className="bg-white shadow-md p-4 sticky top-0 z-50 rounded-b-xl">
          <div className="container mx-auto flex flex-col md:flex-row items-center justify-between">
            <h1 className="text-3xl font-bold text-blue-600 mb-2 md:mb-0">Padayon</h1>
            <nav className="flex flex-wrap justify-center md:justify-end gap-2 md:gap-4">
              <NavLink text="Home" page="home" currentPage={currentPage} setCurrentPage={setCurrentPage} />
              <NavLink text="AI Chat" page="aiChat" currentPage={currentPage} setCurrentPage={setCurrentPage} />
              <NavLink text="Professionals" page="professionals" currentPage={currentPage} setCurrentPage={setCurrentPage} />
              <NavLink text="Freedom Wall" page="freedomWall" currentPage={currentPage} setCurrentPage={setCurrentPage} />
              <NavLink text="Community" page="community" currentPage={currentPage} setCurrentPage={setCurrentPage} />
              {isAuthenticated ? (
                <>
                  <NavLink text="Profile" page="profile" currentPage={currentPage} setCurrentPage={setCurrentPage} />
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg shadow hover:bg-red-600 transition-colors text-sm"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <NavLink text="Login/Sign Up" page="home" currentPage={currentPage} setCurrentPage={setCurrentPage} />
              )}
            </nav>
          </div>
        </header>

        {/* Auth Error Display */}
        {authError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md relative mx-auto mt-4 w-11/12 max-w-4xl" role="alert">
            <strong className="font-bold">Error:</strong>
            <span className="block sm:inline ml-2">{authError}</span>
            <span className="absolute top-0 bottom-0 right-0 px-4 py-3" onClick={() => setAuthError('')}>
              <svg className="fill-current h-6 w-6 text-red-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.103l-2.651 3.746a1.2 1.2 0 0 1-1.697-1.697l3.746-2.651-3.746-2.651a1.2 1.2 0 0 1 1.697-1.697L10 8.897l2.651-3.746a1.2 1.2 0 0 1 1.697 1.697L11.103 10l3.746 2.651a1.2 1.2 0 0 1 0 1.697z"/></svg>
            </span>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-grow container mx-auto p-2 sm:p-4 flex flex-col items-center"> {/* Adjusted padding for smaller screens */}
          {/* User ID Display */}
          {isAuthenticated && (
            <div className="bg-blue-50 text-blue-700 p-2 rounded-md mb-4 text-sm text-center w-full max-w-md">
              Your User ID: <span className="font-mono break-all">{userId}</span>
            </div>
          )}

          {/* Conditional Page Rendering */}
          <div className="w-full max-w-4xl bg-white p-4 sm:p-6 rounded-xl shadow-lg"> {/* Adjusted padding for smaller screens */}
            {currentPage === 'home' && <Home />}
            {currentPage === 'aiChat' && <AIChat />}
            {currentPage === 'professionals' && <Professionals />}
            {currentPage === 'freedomWall' && <FreedomWall />}
            {currentPage === 'community' && <Community />}
            {currentPage === 'profile' && <Profile />}
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-blue-600 text-white p-4 text-center rounded-t-xl mt-8">
          <p>&copy; 2025 Padayon. All rights reserved.</p>
          <p className="text-sm">Your journey to a healthier mind, one step at a time.</p>
        </footer>
      </div>
    </AppContext.Provider>
  );
}

// Reusable Navigation Link Component
const NavLink = ({ text, page, currentPage, setCurrentPage }) => (
  <button
    onClick={() => setCurrentPage(page)}
    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      currentPage === page
        ? 'bg-blue-500 text-white shadow-md'
        : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600'
    }`}
  >
    {text}
  </button>
);

// Home Component (Login/SignUp)
const Home = () => {
  const { auth, setIsAuthenticated, setAuthError } = useContext(AppContext);
  const [isLogin, setIsLogin] = useState(true); // Toggle between Login and Sign Up
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Handle Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (!auth) {
      setAuthError('Firebase Auth not initialized.');
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setIsAuthenticated(true);
      // Assuming successful login, user will be redirected by parent component or context
    } catch (error) {
      console.error("Login error:", error);
      setAuthError(`Login failed: ${error.message}`);
    }
  };

  // Handle Sign Up
  const handleSignUp = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (!auth) {
      setAuthError('Firebase Auth not initialized.');
      return;
    }
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      setIsAuthenticated(true);
      // Assuming successful sign up, user will be redirected by parent component or context
    } catch (error) {
      console.error("Sign up error:", error);
      setAuthError(`Sign up failed: ${error.message}`);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-4 sm:p-6"> {/* Adjusted padding */}
      <h2 className="text-2xl sm:text-3xl font-semibold text-blue-700 mb-6">{isLogin ? 'Welcome Back!' : 'Join Padayon!'}</h2> {/* Adjusted font size */}
      <form onSubmit={isLogin ? handleLogin : handleSignUp} className="w-full max-w-sm bg-white p-6 sm:p-8 rounded-lg shadow-lg"> {/* Adjusted padding */}
        <div className="mb-4">
          <label htmlFor="email" className="block text-gray-700 text-sm font-bold mb-2">Email:</label>
          <input
            type="email"
            id="email"
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            aria-label="Email address"
          />
        </div>
        <div className="mb-6">
          <label htmlFor="password" className="block text-gray-700 text-sm font-bold mb-2">Password:</label>
          <input
            type="password"
            id="password"
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            aria-label="Password"
          />
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-0"> {/* Flex-col on small, row on small+ */}
          <button
            type="submit"
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors shadow-md text-base"
          >
            {isLogin ? 'Login' : 'Sign Up'}
          </button>
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="inline-block align-baseline font-bold text-sm text-blue-500 hover:text-blue-800 mt-2 sm:mt-0"
          >
            {isLogin ? 'Need an account? Sign Up' : 'Already have an account? Login'}
          </button>
        </div>
      </form>
      <p className="mt-4 text-gray-600 text-sm text-center">
        For demo purposes, you can sign up with any email and password to experience the "premium" features.
        Otherwise, you can continue to use the app anonymously for "free" features.
      </p>
    </div>
  );
};

// AI Chat Component
const AIChat = () => {
  const { isPremium } = useContext(AppContext);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatHistoryRef = React.useRef(null); // Ref for scrolling to latest message

  // Scroll to the bottom of the chat when messages update
  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle sending a message to the AI
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { sender: 'user', text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      let chatHistory = messages.map(msg => ({ role: msg.sender === 'user' ? 'user' : 'model', parts: [{ text: msg.text }] }));
      chatHistory.push({ role: 'user', parts: [{ text: input }] });

      const payload = {
        contents: chatHistory,
        // Optional: Add generationConfig for structured responses (Premium feature idea)
        // For a simple text chat, we'll keep it basic.
        // If isPremium, you might add:
        // generationConfig: {
        //   responseMimeType: "application/json",
        //   responseSchema: { ... } // Define schema for structured mental health advice
        // }
      };

      const apiKey = ""; // Canvas will provide this if empty for allowed models
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (result.candidates && result.candidates.length > 0 &&
          result.candidates[0].content && result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0) {
        const aiText = result.candidates[0].content.parts[0].text;
        setMessages((prev) => [...prev, { sender: 'ai', text: aiText }]);
      } else {
        setMessages((prev) => [...prev, { sender: 'ai', text: "I'm sorry, I couldn't generate a response. Please try again." }]);
      }
    } catch (error) {
      console.error("Error communicating with AI:", error);
      setMessages((prev) => [...prev, { sender: 'ai', text: "There was an error connecting to the AI. Please check your internet connection." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-[400px] sm:h-[600px] bg-white rounded-lg shadow-lg"> {/* Adjusted height for better mobile fit */}
      <h2 className="text-xl sm:text-2xl font-semibold text-blue-700 p-3 sm:p-4 border-b border-gray-200">Padayon AI Chat <span className="text-xs sm:text-sm font-normal text-gray-500">{isPremium ? '(Premium Enabled)' : '(Free Version)'}</span></h2> {/* Adjusted font sizes, padding */}
      <div ref={chatHistoryRef} className="flex-grow p-3 sm:p-4 overflow-y-auto bg-gray-50"> {/* Adjusted padding */}
        {messages.length === 0 && (
          <div className="text-center text-gray-500 italic mt-5 sm:mt-10 text-sm sm:text-base"> {/* Adjusted margin, font sizes */}
            Start a conversation with Padayon AI! Ask about stress, academic worries, or coping strategies.
            {isPremium && <p className="mt-2 text-blue-600">As a Premium user, expect more personalized and in-depth support.</p>}
          </div>
        )}
        {messages.map((msg, index) => (
          <div key={index} className={`mb-3 flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`p-2 sm:p-3 rounded-lg shadow-md max-w-[80%] text-sm sm:text-base ${ /* Max width for chat bubbles */
              msg.sender === 'user'
                ? 'bg-blue-500 text-white rounded-br-none'
                : 'bg-gray-200 text-gray-800 rounded-bl-none'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="mb-3 flex justify-start">
            <div className="p-2 sm:p-3 rounded-lg bg-gray-200 text-gray-800 rounded-bl-none">
              <div className="flex items-center">
                <div className="animate-pulse h-2 w-2 bg-gray-500 rounded-full mr-1"></div>
                <div className="animate-pulse h-2 w-2 bg-gray-500 rounded-full mr-1 delay-75"></div>
                <div className="animate-pulse h-2 w-2 bg-gray-500 rounded-full delay-150"></div>
              </div>
            </div>
          </div>
        )}
      </div>
      <form onSubmit={handleSendMessage} className="p-3 sm:p-4 border-t border-gray-200 flex"> {/* Adjusted padding */}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          className="flex-grow p-2 sm:p-3 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm sm:text-base"
          aria-label="Chat input"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 sm:px-6 py-2 sm:py-3 bg-blue-600 text-white rounded-r-lg shadow hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
          aria-label="Send message"
        >
          {loading ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  );
};

// Professionals Component
const Professionals = () => {
  const { isPremium } = useContext(AppContext);

  const professionals = [
    { id: 1, name: 'Dr. Anya Sharma', specialization: 'Stress Management', rate: '$80/hr', availability: 'Mon, Wed, Fri' },
    { id: 2, name: 'Ms. Ben Tan', specialization: 'Academic Anxiety', rate: '$75/hr', availability: 'Tue, Thu' },
    { id: 3, name: 'Mr. Carlo Dizon', specialization: 'Motivation & Focus', rate: '$70/hr', availability: 'Mon-Fri' },
    { id: 4, name: 'Dr. Jane Smith', specialization: 'CBT & Depression', rate: '$90/hr', availability: 'Flexible' },
  ];

  return (
    <div className="p-4 sm:p-6"> {/* Adjusted padding */}
      <h2 className="text-xl sm:text-2xl font-semibold text-blue-700 mb-4 sm:mb-6">Connect with Professionals</h2> {/* Adjusted font size, margin */}
      <p className="text-gray-700 mb-4 text-sm sm:text-base"> {/* Adjusted font size */}
        Browse profiles of licensed mental health professionals.
        {isPremium ? (
          <span className="text-blue-600 font-medium"> As a Premium user, you get unlimited direct booking and discounted rates!</span>
        ) : (
          <span className="text-gray-600 italic"> Upgrade to Premium for direct booking and exclusive discounts.</span>
        )}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6"> {/* Adjusted gap */}
        {professionals.map((prof) => (
          <div key={prof.id} className="bg-gray-50 p-4 sm:p-6 rounded-lg shadow-md border border-gray-200"> {/* Adjusted padding */}
            <h3 className="text-lg sm:text-xl font-bold text-purple-700 mb-1 sm:mb-2">{prof.name}</h3> {/* Adjusted font size, margin */}
            <p className="text-gray-600 text-sm sm:text-base">Specialization: <span className="font-medium">{prof.specialization}</span></p> {/* Adjusted font size */}
            <p className="text-gray-600 text-sm sm:text-base">Rate: <span className="font-medium">{prof.rate}</span></p> {/* Adjusted font size */}
            <p className="text-gray-600 mb-3 sm:mb-4 text-sm sm:text-base">Availability: <span className="font-medium">{prof.availability}</span></p> {/* Adjusted margin, font size */}
            {isPremium ? (
              <button className="w-full bg-green-500 text-white py-2 rounded-lg shadow-md hover:bg-green-600 transition-colors text-base font-semibold"> {/* Adjusted font size */}
                Book Session (Premium)
              </button>
            ) : (
              <button className="w-full bg-blue-400 text-white py-2 rounded-lg shadow-md cursor-not-allowed opacity-70 text-base" disabled> {/* Adjusted font size */}
                Upgrade to Book
              </button>
            )}
          </div>
        ))}
      </div>

      {!isPremium && (
        <div className="mt-6 sm:mt-8 bg-blue-100 p-4 sm:p-6 rounded-lg border border-blue-200 text-blue-800 text-center"> {/* Adjusted margin, padding */}
          <h3 className="text-lg sm:text-xl font-semibold mb-2">Unlock Premium Benefits!</h3> {/* Adjusted font size */}
          <p className="text-sm sm:text-base">Upgrade to access unlimited direct booking, discounted rates, and exclusive workshops with our professionals.</p> {/* Adjusted font size */}
          <button className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition-colors font-bold text-sm sm:text-base"> {/* Adjusted font size */}
            Learn More About Premium
          </button>
        </div>
      )}
    </div>
  );
};

// Freedom Wall Component
const FreedomWall = () => {
  const { db, user, userId, isAuthenticated, isPremium } = useContext(AppContext);
  const [posts, setPosts] = useState([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [postAnonymously, setPostAnonymously] = useState(false);
  const [message, setMessage] = useState(''); // For user feedback
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [llmSuggestion, setLlmSuggestion] = useState('');

  // Fetch posts from Firestore
  useEffect(() => {
    if (!db) return;

    // Collection path for public data
    const postsColRef = collection(db, `artifacts/${typeof __app_id !== 'undefined' ? __app_id : 'default-padayon-app'}/public/data/freedom_wall_posts`);
    // Order by timestamp in descending order
    const q = query(postsColRef); // Removed orderBy as per instructions; will sort in client

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedPosts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort posts by timestamp in descending order on the client side
      fetchedPosts.sort((a, b) => (b.timestamp?.toDate() || 0) - (a.timestamp?.toDate() || 0));
      setPosts(fetchedPosts);
    }, (error) => {
      console.error("Error fetching freedom wall posts:", error);
      setMessage("Error loading posts.");
    });

    return () => unsubscribe(); // Cleanup listener
  }, [db]);

  // Handle new post submission
  const handlePost = async (e) => {
    e.preventDefault();
    if (!newPostContent.trim()) {
      setMessage('Post content cannot be empty.');
      return;
    }
    if (!db || !isAuthenticated) {
      setMessage('You must be logged in to post.');
      return;
    }

    try {
      const postsColRef = collection(db, `artifacts/${typeof __app_id !== 'undefined' ? __app_id : 'default-padayon-app'}/public/data/freedom_wall_posts`);
      await addDoc(postsColRef, {
        content: newPostContent,
        authorId: userId,
        authorName: postAnonymously ? 'Anonymous' : (user?.email || 'Guest'), // Use email or 'Guest' if no email
        isAnonymous: postAnonymously,
        timestamp: serverTimestamp(),
        reactions: 0 // Initialize reactions counter
      });
      setNewPostContent('');
      setPostAnonymously(false);
      setLlmSuggestion(''); // Clear any previous suggestion
      setMessage('Your thought has been shared!');
    } catch (error) {
      console.error("Error adding post:", error);
      setMessage(`Failed to share thought: ${error.message}`);
    }
    setTimeout(() => setMessage(''), 3000); // Clear message after 3 seconds
  };

  // Handle deleting a post (Premium feature for own posts)
  const handleDeletePost = async (postId, postAuthorId) => {
    if (!db || !isAuthenticated) {
      setMessage('You must be logged in to delete posts.');
      return;
    }
    // Only allow premium users to delete their own posts for this demo
    if (isPremium && postAuthorId === userId) {
      try {
        const postDocRef = doc(db, `artifacts/${typeof __app_id !== 'undefined' ? __app_id : 'default-padayon-app'}/public/data/freedom_wall_posts`, postId);
        await deleteDoc(postDocRef);
        setMessage('Post deleted successfully.');
      } catch (error) {
        console.error("Error deleting post:", error);
        setMessage(`Failed to delete post: ${error.message}`);
      }
    } else {
      setMessage('You do not have permission to delete this post.');
    }
    setTimeout(() => setMessage(''), 3000);
  };

  // Handle adding a reaction
  const handleAddReaction = async (postId, currentReactions) => {
    if (!db || !isAuthenticated) {
      setMessage('You must be logged in to react.');
      return;
    }
    try {
      const postDocRef = doc(db, `artifacts/${typeof __app_id !== 'undefined' ? __app_id : 'default-padayon-app'}/public/data/freedom_wall_posts`, postId);
      await updateDoc(postDocRef, {
        reactions: (currentReactions || 0) + 1
      });
      setMessage('Reaction added!');
    } catch (error) {
      console.error("Error adding reaction:", error);
      setMessage(`Failed to add reaction: ${error.message}`);
    }
    setTimeout(() => setMessage(''), 3000);
  };

  // LLM call to get a suggestion for the post content
  const getPostSuggestion = async () => {
    if (!newPostContent.trim()) {
      setLlmSuggestion('Please write something first to get a suggestion.');
      return;
    }
    setSuggestionLoading(true);
    setLlmSuggestion(''); // Clear previous suggestion

    try {
      const prompt = `Analyze the following student's thought for general sentiment (e.g., stress, hope, struggle, achievement) and provide a very short, supportive, and general affirmation or coping tip (max 20 words). Do NOT act as a therapist. Just a brief, positive, encouraging note. Example: "Feeling overwhelmed? Take a deep breath and break it down."\n\nStudent's thought: "${newPostContent}"`;
      let chatHistory = [];
      chatHistory.push({ role: "user", parts: [{ text: prompt }] });
      const payload = { contents: chatHistory };
      const apiKey = "";
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (result.candidates && result.candidates.length > 0 &&
          result.candidates[0].content && result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0) {
        const suggestionText = result.candidates[0].content.parts[0].text;
        setLlmSuggestion(suggestionText);
      } else {
        setLlmSuggestion("Couldn't get a suggestion. Please try again.");
      }
    } catch (error) {
      console.error("Error getting post suggestion from AI:", error);
      setLlmSuggestion("Error generating suggestion. Please try again later.");
    } finally {
      setSuggestionLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6"> {/* Adjusted padding */}
      <h2 className="text-xl sm:text-2xl font-semibold text-blue-700 mb-4 sm:mb-6">Freedom Wall (Mindscape)</h2> {/* Adjusted font size, margin */}
      <p className="text-gray-700 mb-4 text-sm sm:text-base"> {/* Adjusted font size */}
        Share your thoughts and feelings here. You can choose to be anonymous.
        <span className="text-xs sm:text-sm font-normal text-gray-500">{isPremium ? ' (Premium: Delete own posts, get AI suggestions)' : ' (Free: View posts only)'}</span>
      </p>

      {message && (
        <div className="bg-blue-100 border border-blue-400 text-blue-700 px-3 py-2 sm:px-4 sm:py-3 rounded-md mb-4 text-sm" role="alert"> {/* Adjusted padding, font size */}
          {message}
        </div>
      )}

      {isAuthenticated ? (
        <form onSubmit={handlePost} className="mb-6 sm:mb-8 p-4 sm:p-6 bg-blue-50 rounded-lg shadow-inner"> {/* Adjusted margin, padding */}
          <textarea
            className="w-full p-2 sm:p-3 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 mb-3 sm:mb-4 text-sm sm:text-base"
            rows="4"
            placeholder="What's on your mind? Share your thoughts here..."
            value={newPostContent}
            onChange={(e) => setNewPostContent(e.target.value)}
            required
            aria-label="New post content"
          ></textarea>
          <div className="flex flex-col sm:flex-row items-center justify-between mb-3 sm:mb-4 gap-2 sm:gap-0"> {/* Flex-col on small, row on small+ */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="postAnonymously"
                checked={postAnonymously}
                onChange={(e) => setPostAnonymously(e.target.checked)}
                className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                aria-label="Post anonymously checkbox"
              />
              <label htmlFor="postAnonymously" className="text-gray-700 text-sm sm:text-base">Post Anonymously</label> {/* Adjusted font size */}
            </div>
            {isPremium && (
              <button
                type="button"
                onClick={getPostSuggestion}
                disabled={suggestionLoading || !newPostContent.trim()}
                className="w-full sm:w-auto px-4 py-2 bg-purple-600 text-white rounded-lg shadow hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center mt-2 sm:mt-0"
              >
                {suggestionLoading ? (
                  <span className="flex items-center">
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                    Getting Suggestion...
                  </span>
                ) : (
                  '✨ Get Suggestion'
                )}
              </button>
            )}
          </div>
          {llmSuggestion && (
            <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-md mb-4 text-sm">
              <p className="font-semibold mb-1">Padayon's Insight:</p>
              <p>{llmSuggestion}</p>
            </div>
          )}
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 sm:py-3 rounded-lg shadow-md hover:bg-blue-700 transition-colors text-base sm:text-lg font-semibold"
          >
            Share Thought
          </button>
        </form>
      ) : (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-3 py-2 sm:px-4 sm:py-3 rounded-md mb-4 text-center text-sm sm:text-base"> {/* Adjusted padding, font size */}
          Please login or sign up to share your thoughts on the Freedom Wall.
        </div>
      )}


      <div className="space-y-3 sm:space-y-4"> {/* Adjusted spacing */}
        {posts.length === 0 ? (
          <p className="text-center text-gray-500 italic text-sm sm:text-base">No thoughts shared yet. Be the first!</p> /* Adjusted font size */
        ) : (
          posts.map((post) => (
            <div key={post.id} className="bg-gray-50 p-4 sm:p-5 rounded-lg shadow-md border border-gray-200"> {/* Adjusted padding */}
              <p className="text-gray-800 mb-2 sm:mb-3 text-sm sm:text-base">{post.content}</p> {/* Adjusted margin, font size */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs sm:text-sm text-gray-500"> {/* Adjusted alignment, font size */}
                <span className="font-medium">
                  {post.isAnonymous ? 'Anonymous' : (post.authorName || 'Unknown User')}
                </span>
                <span className="text-xs mt-1 sm:mt-0">
                  {post.timestamp ? new Date(post.timestamp.toDate()).toLocaleString() : 'Loading date...'}
                </span>
              </div>
              <div className="flex items-center mt-2 sm:mt-3 gap-2 sm:gap-3"> {/* Adjusted margin, gap */}
                <button
                  onClick={() => handleAddReaction(post.id, post.reactions)}
                  className="flex items-center px-2 py-1 bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200 transition-colors text-xs sm:text-sm"
                  aria-label="Support this post"
                >
                  <span className="mr-1">❤️</span> Support ({post.reactions || 0})
                </button>
                {/* Premium feature: Delete own post */}
                {isPremium && post.authorId === userId && (
                  <button
                    onClick={() => handleDeletePost(post.id, post.authorId)}
                    className="flex items-center px-2 py-1 bg-red-100 text-red-700 rounded-full hover:bg-red-200 transition-colors text-xs sm:text-sm"
                    aria-label="Delete this post"
                  >
                    🗑️ Delete
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// Community Component
const Community = () => {
  const { db, userId, isAuthenticated, user, isPremium } = useContext(AppContext);
  const [messages, setMessages] = useState([]);
  const [newMessageContent, setNewMessageContent] = useState('');
  const [messageError, setMessageError] = useState('');
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const chatBottomRef = React.useRef(null); // Ref for scrolling to latest message

  // Fetch messages from Firestore
  useEffect(() => {
    if (!db) return;

    const messagesColRef = collection(db, `artifacts/${typeof __app_id !== 'undefined' ? __app_id : 'default-padayon-app'}/public/data/community_messages`);
    const q = query(messagesColRef); // Removed orderBy as per instructions; will sort in client

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort messages by timestamp on the client side
      fetchedMessages.sort((a, b) => (a.timestamp?.toDate() || 0) - (b.timestamp?.toDate() || 0));
      setMessages(fetchedMessages);
    }, (error) => {
      console.error("Error fetching community messages:", error);
      setMessageError("Error loading community messages.");
    });

    return () => unsubscribe();
  }, [db]);

  // Scroll to the bottom of the chat when messages update
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollTop = chatBottomRef.current.scrollHeight;
    }
  }, [messages]);


  // Handle sending a new message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessageContent.trim()) {
      setMessageError('Message cannot be empty.');
      return;
    }
    if (!db || !isAuthenticated) {
      setMessageError('You must be logged in to chat.');
      return;
    }

    try {
      const messagesColRef = collection(db, `artifacts/${typeof __app_id !== 'undefined' ? __app_id : 'default-padayon-app'}/public/data/community_messages`);
      await addDoc(messagesColRef, {
        content: newMessageContent,
        authorId: userId,
        authorName: user?.email || 'Guest', // Using email as username for demo
        timestamp: serverTimestamp(),
      });
      setNewMessageContent('');
      setMessageError(''); // Clear any previous error
    } catch (error) {
      console.error("Error sending message:", error);
      setMessageError(`Failed to send message: ${error.message}`);
    }
    setTimeout(() => setMessageError(''), 3000); // Clear error after 3 seconds
  };

  // LLM call to get a conversation starter
  const getConversationStarter = async () => {
    setSuggestionLoading(true);
    try {
      const prompt = `Generate a very short, open-ended conversation starter question for a student mental health support community chat. The question should encourage sharing and empathy, and be related to academic struggles, stress, or well-being. Max 20 words. Example: "How do you handle academic pressure during exam season?"`;
      let chatHistory = [];
      chatHistory.push({ role: "user", parts: [{ text: prompt }] });
      const payload = { contents: chatHistory };
      const apiKey = "";
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (result.candidates && result.candidates.length > 0 &&
          result.candidates[0].content && result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0) {
        const starterText = result.candidates[0].content.parts[0].text;
        setNewMessageContent(starterText); // Pre-fill the input with the starter
        setMessageError('Generated a conversation starter! Feel free to edit before sending.');
      } else {
        setMessageError("Couldn't get a conversation starter. Please try again.");
      }
    } catch (error) {
      console.error("Error getting conversation starter from AI:", error);
      setMessageError("Error generating conversation starter. Please try again later.");
    } finally {
      setSuggestionLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-[400px] sm:h-[600px] bg-white rounded-lg shadow-lg"> {/* Adjusted height */}
      <h2 className="text-xl sm:text-2xl font-semibold text-blue-700 p-3 sm:p-4 border-b border-gray-200">Community Circles</h2> {/* Adjusted font size, padding */}
      <p className="text-gray-700 px-3 pt-2 text-sm sm:text-base"> {/* Adjusted padding, font size */}
        Connect with other students and offer support!
        {isPremium ? (
          <span className="text-blue-600 font-medium"> (Premium: Create private groups, unlimited private messaging, get AI conversation starters)</span>
        ) : (
          <span className="text-gray-600 italic"> (Free: Public chat only. Upgrade for private features.)</span>
        )}
      </p>

      {messageError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 sm:px-4 sm:py-3 rounded-md mx-3 mt-2 text-sm" role="alert"> {/* Adjusted padding, margin, font size */}
          {messageError}
        </div>
      )}

      <div ref={chatBottomRef} className="flex-grow p-3 sm:p-4 overflow-y-auto bg-gray-50"> {/* Adjusted padding */}
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 italic mt-5 sm:mt-10 text-sm sm:text-base"> {/* Adjusted margin, font size */}
            No messages yet. Start a conversation!
            {isPremium && (
              <p className="mt-2">
                <button
                  onClick={getConversationStarter}
                  disabled={suggestionLoading}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center mx-auto mt-2"
                >
                  {suggestionLoading ? (
                    <span className="flex items-center">
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                      Generating...
                    </span>
                  ) : (
                    '✨ Generate Starter'
                  )}
                </button>
              </p>
            )}
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="mb-3">
              <div className="flex items-baseline text-xs sm:text-sm text-gray-600"> {/* Adjusted font size */}
                <span className="font-bold text-blue-800 mr-2">
                  {msg.authorId === userId ? 'You' : msg.authorName || 'Unknown User'}
                </span>
                <span className="text-xs">
                  {msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString() : 'Loading time...'}
                </span>
              </div>
              <div className="p-2 sm:p-3 bg-white rounded-lg shadow-sm max-w-full break-words border border-gray-200 text-sm sm:text-base"> {/* Adjusted padding, font size */}
                {msg.content}
              </div>
            </div>
          ))
        )}
      </div>

      {isAuthenticated ? (
        <form onSubmit={handleSendMessage} className="p-3 sm:p-4 border-t border-gray-200 flex flex-col sm:flex-row gap-2"> {/* Adjusted padding, flex-col on small, row on small+, gap */}
          <input
            type="text"
            value={newMessageContent}
            onChange={(e) => setNewMessageContent(e.target.value)}
            placeholder="Type your message to the community..."
            className="flex-grow p-2 sm:p-3 border border-gray-300 rounded-lg sm:rounded-l-lg sm:rounded-r-none focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm sm:text-base"
            aria-label="Community chat input"
          />
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              type="submit"
              className="flex-grow sm:flex-grow-0 px-4 sm:px-6 py-2 sm:py-3 bg-blue-600 text-white rounded-lg sm:rounded-r-lg sm:rounded-l-none shadow hover:bg-blue-700 transition-colors text-sm sm:text-base"
              aria-label="Send community message"
            >
              Send
            </button>
            {isPremium && (
              <button
                type="button"
                onClick={getConversationStarter}
                disabled={suggestionLoading}
                className="flex-grow sm:flex-grow-0 px-4 py-2 sm:py-3 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center"
              >
                {suggestionLoading ? (
                  <span className="flex items-center">
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                    Generating...
                  </span>
                ) : (
                  '✨ Starter'
                )}
              </button>
            )}
          </div>
        </form>
      ) : (
        <div className="p-3 sm:p-4 border-t border-gray-200 text-center text-gray-500 text-sm sm:text-base"> {/* Adjusted padding, font size */}
          Login or sign up to join the community chat!
        </div>
      )}
    </div>
  );
};

// Profile Component
const Profile = () => {
  const { user, userId, isAuthenticated, isPremium } = useContext(AppContext);

  if (!isAuthenticated) {
    return (
      <div className="p-4 sm:p-6 text-center text-gray-600"> {/* Adjusted padding */}
        Please log in to view your profile.
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6"> {/* Adjusted padding */}
      <h2 className="text-xl sm:text-2xl font-semibold text-blue-700 mb-4 sm:mb-6">Your Profile</h2> {/* Adjusted font size, margin */}

      <div className="bg-gray-50 p-4 sm:p-6 rounded-lg shadow-md border border-gray-200"> {/* Adjusted padding */}
        <div className="mb-3 sm:mb-4"> {/* Adjusted margin */}
          <p className="text-base sm:text-lg font-medium text-gray-700">Email:</p> {/* Adjusted font size */}
          <p className="text-lg sm:text-xl font-bold text-blue-800 break-all">{user?.email || 'N/A'}</p> {/* Adjusted font size */}
        </div>
        <div className="mb-3 sm:mb-4"> {/* Adjusted margin */}
          <p className="text-base sm:text-lg font-medium text-gray-700">User ID:</p> {/* Adjusted font size */}
          <p className="text-lg sm:text-xl font-bold text-blue-800 break-all">{userId}</p> {/* Adjusted font size */}
        </div>
        <div className="mb-3 sm:mb-4"> {/* Adjusted margin */}
          <p className="text-base sm:text-lg font-medium text-gray-700">Account Type:</p> {/* Adjusted font size */}
          <p className={`text-lg sm:text-xl font-bold ${isPremium ? 'text-green-600' : 'text-orange-600'}`}> {/* Adjusted font size */}
            {isPremium ? 'Premium User ✨' : 'Free User'}
          </p>
          {!isPremium && (
            <p className="text-gray-600 text-xs sm:text-sm mt-1 sm:mt-2"> {/* Adjusted font size, margin */}
              Upgrade to Premium for exclusive features like advanced AI chat, direct professional bookings, and more!
            </p>
          )}
        </div>
        <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-purple-50 border border-purple-200 rounded-lg text-purple-800"> {/* Adjusted margin, padding */}
          <h3 className="text-base sm:text-lg font-semibold mb-1 sm:mb-2">About Premium</h3> {/* Adjusted font size, margin */}
          <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm"> {/* Adjusted font size */}
            <li>Personalized AI Chat with deeper insights.</li>
            <li>Unlimited direct booking with professionals (session fees apply).</li>
            <li>Discounted rates on professional sessions.</li>
            <li>Enhanced anonymity options on Freedom Wall.</li>
            <li>Ability to create private support groups.</li>
            <li>Ad-free experience.</li>
            <li>✨ **AI-Powered Post Suggestions** on Freedom Wall.</li>
            <li>✨ **AI-Generated Conversation Starters** in Community Circles.</li>
          </ul>
          {!isPremium && (
            <button className="mt-3 sm:mt-4 px-4 sm:px-6 py-2 sm:py-3 bg-purple-600 text-white rounded-lg shadow-md hover:bg-purple-700 transition-colors font-bold text-sm sm:text-base"> {/* Adjusted margin, padding, font size */}
              Upgrade to Premium Now
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
