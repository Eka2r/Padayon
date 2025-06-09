/* global __app_id, __firebase_config, __initial_auth_token */
// Ang linya sa ibabaw nagsulti sa ESLint nga kining mga variable (`__app_id`, `__firebase_config`, `__initial_auth_token`) kay global nga gihubit.
// Kini makapugong sa "is not defined" nga mga sayop sa ESLint sa panahon sa pagtukod.

import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, updateDoc, collection, query, onSnapshot, serverTimestamp, addDoc, deleteDoc } from 'firebase/firestore';

// Gumawa ng React Context para sa mga instance ng Firebase at Auth
const AppContext = createContext();

// Pangunahing Bahagi ng App
function App() {
  // Mga state variable para sa Firebase, Auth, User, at pamamahala ng UI
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [user, setUser] = useState(null);
  const [userId, setUserId] = useState(''); // Nagtatabi ng Firebase UID o random ID para sa anonymous users
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentPage, setCurrentPage] = useState('home'); // Nagkokontrol kung aling pangunahing pahina ng content ang ipinapakita
  const [loading, setLoading] = useState(true); // Nagpapamahala sa inisyal na estado ng paglo-load ng app
  const [authError, setAuthError] = useState(''); // Nagtatabi ng mga mensahe ng error na may kaugnayan sa authentication
  const [isPremium, setIsPremium] = useState(false); // Simpleng flag para gayahin ang premium features

  // Hook ng Effect para sa inisyal na Firebase at pagbabago sa estado ng authentication
  useEffect(() => {
    try {
      // Access ang mga environment variable na ibinigay ng Netlify (REACT_APP_ prefix)
      // Fallback sa global na __ variables para sa Canvas environment o default values kung hindi pa nakatakda
      // Ang pag-check sa `typeof process !== 'undefined'` ay nagsisiguro na ang code ay tatakbo sa parehong build at runtime environments.
      const appId = typeof process !== 'undefined' && process.env.REACT_APP_APP_ID ? process.env.REACT_APP_APP_ID : (typeof __app_id !== 'undefined' ? __app_id : 'default-padayon-app');
      const firebaseConfigString = typeof process !== 'undefined' && process.env.REACT_APP_FIREBASE_CONFIG ? process.env.REACT_APP_FIREBASE_CONFIG : (typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
      let firebaseConfig = {};
      try {
        firebaseConfig = JSON.parse(firebaseConfigString);
      } catch (e) {
        console.error("Error sa pag-parse ng FIREBASE_CONFIG JSON:", e);
        setAuthError("Hindi balido ang configuration ng Firebase. Pakisuri ang environment variables.");
        setLoading(false);
        return;
      }
      const initialAuthToken = typeof process !== 'undefined' && process.env.REACT_APP_INITIAL_AUTH_TOKEN ? process.env.REACT_APP_INITIAL_AUTH_TOKEN : (typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null);

      // Suriin kung balido ang configuration ng Firebase
      if (Object.keys(firebaseConfig).length === 0 || !firebaseConfig.apiKey) {
        console.error("Nawawala o hindi kumpleto ang config ng Firebase. Maaaring hindi gumana nang tama ang app.");
        setAuthError("Nawawala ang configuration ng Firebase. Pakitakda ang REACT_APP_FIREBASE_CONFIG.");
        setLoading(false);
        return;
      }

      // Initialize ang Firebase app gamit ang nakuha na configuration
      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const authService = getAuth(app);

      // Itakda ang mga instance ng Firebase sa state
      setDb(firestore);
      setAuth(authService);

      // I-set up ang listener ng estado ng authentication
      const unsubscribe = onAuthStateChanged(authService, async (currentUser) => {
        if (currentUser) {
          // Ang user ay naka-sign in
          setUser(currentUser);
          setUserId(currentUser.uid);
          setIsAuthenticated(true);
          // Tukuyin ang premium status batay sa user (hal. kung naka-sign in gamit ang email)
          setIsPremium(!!currentUser.email); // `!!` nagko-convert sa truthy/falsy sa true/false boolean
          setAuthError(''); // I-clear ang anumang nakaraang auth errors
        } else {
          // Ang user ay naka-sign out o hindi pa naka-authenticate
          setUser(null);
          // Gumamit ng random UUID para sa anonymous users para matukoy ang kanilang data sa Firestore
          setUserId(crypto.randomUUID());
          setIsAuthenticated(false);
          setIsPremium(false);

          // Subukan ang anonymous sign-in kung walang custom token na ibinigay (para sa pangkalahatang access)
          if (!initialAuthToken) {
            try {
              await signInAnonymously(authService);
            } catch (error) {
              console.error("Error sa pag-sign in nang anonymous:", error);
              setAuthError(`Nabigo ang pag-sign in nang anonymous: ${error.message}`);
            }
          }
        }
        setLoading(false); // Kumpleto na ang pagsusuri ng authentication, ihinto ang paglo-load
      });

      // Subukan ang pag-sign in gamit ang custom token kung ibinigay (hal. mula sa Canvas environment)
      const signInWithToken = async () => {
        if (authService && initialAuthToken) {
          try {
            await signInWithCustomToken(authService, initialAuthToken);
            setAuthError('');
          } catch (error) {
            console.error("Error sa pag-sign in gamit ang custom token:", error);
            setAuthError(`Nabigo ang pag-sign in gamit ang token: ${error.message}`);
            // Fallback sa anonymous sign-in kung nabigo ang custom token
            try {
              await signInAnonymously(authService);
            } catch (anonError) {
              console.error("Error sa pag-sign in nang anonymous matapos mabigo ang token:", anonError);
            }
          }
        }
      };
      signInWithToken();

      // I-cleanup ang auth listener kapag na-unmount ang component
      return () => unsubscribe();
    } catch (error) {
      console.error("Nabigo ang pag-initialize ng Firebase:", error);
      setAuthError(`Nabigo ang pag-initialize ng app: ${error.message}`);
      setLoading(false);
    }
  }, []); // Ang walang laman na dependency array ay nagsisiguro na ang effect na ito ay tumatakbo isang beses lamang sa mount

  // Function para sa pag-logout ng user
  const handleLogout = async () => {
    if (auth) {
      try {
        await signOut(auth); // I-sign out ang kasalukuyang user
        setCurrentPage('home'); // Ire-redirect sa home page matapos ang matagumpay na pag-logout
        setAuthError(''); // I-clear ang anumang auth errors
      } catch (error) {
        console.error("Error sa pag-logout:", error);
        setAuthError(`Nabigo ang pag-logout: ${error.message}`);
      }
    }
  };

  // Magpakita ng loading spinner habang nag-i-initialize ang Firebase
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-red-50 to-orange-50 font-inter">
        <div className="text-center p-8 bg-white rounded-xl shadow-lg">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto mb-4"></div>
          <p className="text-lg text-gray-700">Naglo-load ng Padayon...</p>
        </div>
      </div>
    );
  }

  // Pangunahing layout at routing ng aplikasyon
  return (
    <AppContext.Provider value={{ db, auth, user, userId, isAuthenticated, setIsAuthenticated, isPremium, setIsPremium, authError, setAuthError }}>
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex flex-col font-inter text-gray-800">
        {/* Header section na may pamagat ng app at nabigasyon */}
        <header className="bg-white shadow-md p-4 sticky top-0 z-50 rounded-b-xl">
          <div className="container mx-auto flex flex-col md:flex-row items-center justify-between">
            <h1 className="text-3xl font-bold text-red-800 mb-2 md:mb-0">Padayon</h1>
            <nav className="flex flex-wrap justify-center md:justify-end gap-2 md:gap-4">
              {/* Mga link ng nabigasyon para sa iba't ibang seksyon ng app */}
              <NavLink text="Home" page="home" currentPage={currentPage} setCurrentPage={setCurrentPage} />
              <NavLink text="AI Chat" page="aiChat" currentPage={currentPage} setCurrentPage={setCurrentPage} />
              <NavLink text="Mga Propesyonal" page="professionals" currentPage={currentPage} setCurrentPage={setCurrentPage} />
              <NavLink text="Freedom Wall" page="freedomWall" currentPage={currentPage} setCurrentPage={setCurrentPage} />
              <NavLink text="Komunidad" page="community" currentPage={currentPage} setCurrentPage={setCurrentPage} />
              {/* Conditional rendering para sa mga pindutan ng Login/Signup o Profile/Logout */}
              {isAuthenticated ? (
                <>
                  <NavLink text="Profile" page="profile" currentPage={currentPage} setCurrentPage={setCurrentPage} />
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg shadow hover:bg-red-600 transition-colors text-sm"
                    aria-label="Logout"
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

        {/* Display ng Auth Error */}
        {authError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md relative mx-auto mt-4 w-11/12 max-w-4xl" role="alert">
            <strong className="font-bold">Error:</strong>
            <span className="block sm:inline ml-2">{authError}</span>
            {/* Pindutan ng close para sa mensahe ng error */}
            <span className="absolute top-0 bottom-0 right-0 px-4 py-3" onClick={() => setAuthError('')} role="button" aria-label="Isara ang mensahe ng error">
              <svg className="fill-current h-6 w-6 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Isara</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.103l-2.651 3.746a1.2 1.2 0 0 1-1.697-1.697l3.746-2.651-3.746-2.651a1.2 1.2 0 0 1 1.697-1.697L10 8.897l2.651-3.746a1.2 1.2 0 0 1 1.697 1.697L11.103 10l3.746 2.651a1.2 1.2 0 0 1 0 1.697z"/></svg>
            </span>
          </div>
        )}

        {/* Pangunahing Lugar ng Content */}
        <main className="flex-grow container mx-auto p-2 sm:p-4 flex flex-col items-center">
          {/* Display ng User ID */}
          {isAuthenticated && (
            <div className="bg-red-50 text-red-700 p-2 rounded-md mb-4 text-sm text-center w-full max-w-md">
              Ang Iyong User ID: <span className="font-mono break-all">{userId}</span>
            </div>
          )}

          {/* Conditional Rendering ng Pahina */}
          <div className="w-full max-w-4xl bg-white p-4 sm:p-6 rounded-xl shadow-lg">
            {currentPage === 'home' && <Home />}
            {currentPage === 'aiChat' && <AIChat />}
            {currentPage === 'professionals' && <Professionals />}
            {currentPage === 'freedomWall' && <FreedomWall />}
            {currentPage === 'community' && <Community />}
            {currentPage === 'profile' && <Profile />}
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-red-800 text-white p-4 text-center rounded-t-xl mt-8">
          <p>&copy; 2025 Padayon. Lahat ng karapatan ay nakalaan.</p>
          <p className="text-sm">Ang iyong paglalakbay sa mas malusog na pag-iisip, isang hakbang sa isang pagkakataon.</p>
        </footer>
      </div>
    </AppContext.Provider>
  );
}

// Reusable na Bahagi ng Link sa Nabigasyon para sa pare-parehong styling
const NavLink = ({ text, page, currentPage, setCurrentPage }) => (
  <button
    onClick={() => setCurrentPage(page)}
    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      currentPage === page
        ? 'bg-red-700 text-white shadow-md' // Styling ng aktibong estado
        : 'text-gray-700 hover:bg-gray-100 hover:text-red-600' // Styling ng hindi aktibong estado
    }`}
    aria-label={`Pumunta sa pahina ng ${text}`}
  >
    {text}
  </button>
);

// Home Component: Nagpapamahala sa pag-login at pag-signup ng user
const Home = () => {
  const { auth, setIsAuthenticated, setAuthError } = useContext(AppContext);
  const [isLogin, setIsLogin] = useState(true); // I-toggle sa pagitan ng Login at Sign Up forms
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Pamahalaan ang pagtatangka sa pag-login ng user
  const handleLogin = async (e) => {
    e.preventDefault(); // Pigilan ang default na pag-submit ng form
    setAuthError(''); // I-clear ang anumang nakaraang error sa authentication
    if (!auth) {
      setAuthError('Hindi pa na-initialize ang Firebase Auth.');
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setIsAuthenticated(true); // I-update ang estado ng authentication sa tagumpay
      // Ang onAuthStateChanged listener ng Parent App component ang bahala sa karagdagang update ng estado
    } catch (error) {
      console.error("Error sa pag-login:", error);
      setAuthError(`Nabigo ang pag-login: ${error.message}`);
    }
  };

  // Pamahalaan ang pagtatangka sa pag-signup ng bagong user
  const handleSignUp = async (e) => {
    e.preventDefault(); // Pigilan ang default na pag-submit ng form
    setAuthError(''); // I-clear ang anumang nakaraang error sa authentication
    if (!auth) {
      setAuthError('Hindi pa na-initialize ang Firebase Auth.');
      return;
    }
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      setIsAuthenticated(true); // I-update ang estado ng authentication sa tagumpay
      // Ang onAuthStateChanged listener ng Parent App component ang bahala sa karagdagang update ng estado
    } catch (error) {
      console.error("Error sa pag-signup:", error);
      setAuthError(`Nabigo ang pag-signup: ${error.message}`);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-4 sm:p-6">
      <h2 className="text-2xl sm:text-3xl font-semibold text-red-700 mb-6">{isLogin ? 'Balik, Maligayang Pagdating!' : 'Sumali sa Padayon!'}</h2>
      <form onSubmit={isLogin ? handleLogin : handleSignUp} className="w-full max-w-sm bg-white p-6 sm:p-8 rounded-lg shadow-lg">
        {/* Input field ng email */}
        <div className="mb-4">
          <label htmlFor="email" className="block text-gray-700 text-sm font-bold mb-2">Email:</label>
          <input
            type="email"
            id="email"
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-red-400"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            aria-label="Email address"
          />
        </div>
        {/* Input field ng password */}
        <div className="mb-6">
          <label htmlFor="password" className="block text-gray-700 text-sm font-bold mb-2">Password:</label>
          <input
            type="password"
            id="password"
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:ring-2 focus:ring-red-400"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            aria-label="Password"
          />
        </div>
        {/* Mga pindutan ng aksyon (Login/Signup toggle) */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-0">
          <button
            type="submit"
            className="w-full sm:w-auto bg-red-800 hover:bg-red-900 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors shadow-md text-base"
            aria-label={isLogin ? 'Mag-login' : 'Mag-signup'}
          >
            {isLogin ? 'Mag-login' : 'Mag-signup'}
          </button>
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)} // I-toggle sa pagitan ng login at signup forms
            className="inline-block align-baseline font-bold text-sm text-red-600 hover:text-red-800 mt-2 sm:mt-0"
            aria-label={isLogin ? 'Kailangan ng account? Mag-signup' : 'May account na? Mag-login'}
          >
            {isLogin ? 'Kailangan ng account? Mag-signup' : 'May account na? Mag-login'}
          </button>
        </div>
      </form>
      <p className="mt-4 text-gray-600 text-sm text-center">
        Para sa mga layunin ng demo, maaari kang mag-signup gamit ang anumang email at password para maranasan ang "premium" features.
        Kung hindi, maaari mong ipagpatuloy ang paggamit ng app nang anonymous para sa "libreng" features.
      </p>
    </div>
  );
};

// AI Chat Component: Nagbibigay ng interactive na chat sa isang AI na pinapagana ng Gemini
const AIChat = () => {
  const { isPremium } = useContext(AppContext);
  const [messages, setMessages] = useState([]); // Nagtatabi ng kasaysayan ng chat
  const [input, setInput] = useState(''); // Nagtatabi ng kasalukuyang input ng user
  const [loading, setLoading] = useState(false); // Nagpapahiwatig kung ang tugon ng AI ay nilo-load
  const chatHistoryRef = useRef(null); // Ref para paganahin ang auto-scrolling ng chat window

  // Effect para mag-scroll sa ibaba ng kasaysayan ng chat tuwing nag-a-update ang mga mensahe
  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [messages]);

  // Pamahalaan ang pagpapadala ng mensahe sa AI
  const handleSendMessage = async (e) => {
    e.preventDefault(); // Pigilan ang default na pag-reload ng pahina sa pag-submit ng form
    if (!input.trim()) return; // Huwag magpadala ng walang laman na mensahe

    const userMessage = { sender: 'user', text: input };
    setMessages((prev) => [...prev, userMessage]); // Idagdag ang mensahe ng user sa kasaysayan ng chat
    setInput(''); // I-clear ang input field
    setLoading(true); // Simulan ang loading indicator

    try {
      // Ihanda ang kasaysayan ng chat para sa AI model API call
      // I-mapa ang kasalukuyang mga mensahe sa format na inaasahan ng Gemini API (role at parts)
      let chatHistory = messages.map(msg => ({ role: msg.sender === 'user' ? 'user' : 'model', parts: [{ text: msg.text }] }));
      chatHistory.push({ role: 'user', parts: [{ text: input }] }); // Idagdag ang bagong mensahe ng user

      const payload = {
        contents: chatHistory,
      };

      // API key para sa Gemini API (Ang Canvas ang maglalagay ng key kung ang ibinigay ay walang laman na string)
      const apiKey = "";
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

      // Gawin ang API call sa Gemini
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json(); // I-parse ang JSON response

      // Kunin at idagdag ang tugon ng AI sa kasaysayan ng chat
      if (result.candidates && result.candidates.length > 0 &&
          result.candidates[0].content && result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0) {
        const aiText = result.candidates[0].content.parts[0].text;
        setMessages((prev) => [...prev, { sender: 'ai', text: aiText }]);
      } else {
        // Pamahalaan ang mga kaso kung saan ang tugon ng AI ay hindi tama ang format o walang laman
        setMessages((prev) => [...prev, { sender: 'ai', text: "Pasensya, hindi ako makagawa ng tugon. Pakisubukang muli." }]);
      }
    } catch (error) {
      console.error("Error sa komunikasyon sa AI:", error);
      // Magpakita ng user-friendly na mensahe ng error
      setMessages((prev) => [...prev, { sender: 'ai', text: "Nagkaroon ng error sa pagkonekta sa AI. Pakisuri ang iyong koneksyon sa internet." }]);
    } finally {
      setLoading(false); // Ihinto ang loading indicator anuman ang tagumpay o pagkabigo
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-[400px] sm:h-[600px] bg-white rounded-lg shadow-lg">
      <h2 className="text-xl sm:text-2xl font-semibold text-red-700 p-3 sm:p-4 border-b border-gray-200">
        Padayon AI Chat <span className="text-xs sm:text-sm font-normal text-gray-500">{isPremium ? '(Premium Enabled)' : '(Libreng Bersyon)'}</span>
      </h2>
      {/* Lugar ng display ng kasaysayan ng chat, auto-scrolling */}
      <div ref={chatHistoryRef} className="flex-grow p-3 sm:p-4 overflow-y-auto bg-gray-50">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 italic mt-5 sm:mt-10 text-sm sm:text-base">
            Simulan ang isang pag-uusap sa Padayon AI! Magtanong tungkol sa stress, mga alalahanin sa akademiko, o mga estratehiya sa pagharap.
            {isPremium && <p className="mt-2 text-orange-600">Bilang isang Premium user, asahan ang mas personal at malalim na suporta.</p>}
          </div>
        )}
        {messages.map((msg, index) => (
          <div key={index} className={`mb-3 flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`p-2 sm:p-3 rounded-lg shadow-md max-w-[80%] text-sm sm:text-base ${
              msg.sender === 'user'
                ? 'bg-red-700 text-white rounded-br-none'
                : 'bg-gray-200 text-gray-800 rounded-bl-none'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {/* Loading indicator para sa tugon ng AI */}
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
      {/* Form ng input ng chat */}
      <form onSubmit={handleSendMessage} className="p-3 sm:p-4 border-t border-gray-200 flex">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="I-type ang iyong mensahe..."
          className="flex-grow p-2 sm:p-3 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-red-400 text-sm sm:text-base"
          aria-label="Input ng chat"
        />
        <button
          type="submit"
          disabled={loading} // I-disable ang send button habang naglo-load
          className="px-4 sm:px-6 py-2 sm:py-3 bg-red-800 text-white rounded-r-lg shadow hover:bg-red-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
          aria-label="Ipadala ang mensahe"
        >
          {loading ? 'Ipinapadala...' : 'Ipadala'}
        </button>
      </form>
    </div>
  );
};

// Professionals Component: Nagpapakita ng listahan ng mga propesyonal sa kalusugan ng isip
const Professionals = () => {
  const { isPremium } = useContext(AppContext);

  // Hardcoded na listahan ng mga propesyonal para sa demonstrasyon
  const professionals = [
    { id: 1, name: 'Dr. Anya Sharma', specialization: 'Pamamahala ng Stress', rate: '$80/oras', availability: 'Lun, Miy, Biy' },
    { id: 2, name: 'Ms. Ben Tan', specialization: 'Pagkabahala sa Akademiko', rate: '$75/oras', availability: 'Mar, Huwebes' },
    { id: 3, name: 'G. Carlo Dizon', specialization: 'Motibasyon at Pokus', rate: '$70/oras', availability: 'Lun-Biy' },
    { id: 4, name: 'Dr. Jane Smith', specialization: 'CBT at Depresyon', rate: '$90/oras', availability: 'Flexible' },
  ];

  return (
    <div className="p-4 sm:p-6">
      <h2 className="text-xl sm:text-2xl font-semibold text-red-700 mb-4 sm:mb-6">Kumonekta sa mga Propesyonal</h2>
      <p className="text-gray-700 mb-4 text-sm sm:text-base">
        Mag-browse ng mga profile ng lisensiyadong propesyonal sa kalusugan ng isip.
        {isPremium ? (
          <span className="text-orange-600 font-medium"> Bilang isang Premium user, nakakakuha ka ng walang limitasyong direktang booking at diskwentong presyo!</span>
        ) : (
          <span className="text-gray-600 italic"> Mag-upgrade sa Premium para sa direktang booking at eksklusibong diskwento.</span>
        )}
      </p>

      {/* Grid layout para sa pagpapakita ng mga professional card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {professionals.map((prof) => (
          <div key={prof.id} className="bg-gray-50 p-4 sm:p-6 rounded-lg shadow-md border border-gray-200">
            <h3 className="text-lg sm:text-xl font-bold text-orange-700 mb-1 sm:mb-2">{prof.name}</h3>
            <p className="text-gray-600 text-sm sm:text-base">Espesyalidad: <span className="font-medium">{prof.specialization}</span></p>
            <p className="text-gray-600 text-sm sm:text-base">Presyo: <span className="font-medium">{prof.rate}</span></p>
            <p className="text-gray-600 mb-3 sm:mb-4 text-sm sm:text-base">Availability: <span className="font-medium">{prof.availability}</span></p>
            {isPremium ? (
              <button className="w-full bg-green-500 text-white py-2 rounded-lg shadow-md hover:bg-green-600 transition-colors text-base font-semibold" aria-label={`I-book ang sesyon kay ${prof.name}`}>
                I-book ang Sesyon (Premium)
              </button>
            ) : (
              <button className="w-full bg-gray-400 text-white py-2 rounded-lg shadow-md cursor-not-allowed opacity-70 text-base" disabled aria-label="Mag-upgrade para makapag-book">
                Mag-upgrade para Mag-book
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Call to action para sa mga non-premium users */}
      {!isPremium && (
        <div className="mt-6 sm:mt-8 bg-red-100 p-4 sm:p-6 rounded-lg border border-red-200 text-red-800 text-center">
          <h3 className="text-lg sm:text-xl font-semibold mb-2">I-unlock ang mga Benepisyo ng Premium!</h3>
          <p className="text-sm sm:text-base">Mag-upgrade para ma-access ang walang limitasyong direktang booking, diskwentong presyo, at eksklusibong mga workshop sa aming mga propesyonal.</p>
          <button className="mt-4 px-6 py-3 bg-red-800 text-white rounded-lg shadow-md hover:bg-red-900 transition-colors font-bold text-sm sm:text-base" aria-label="Matuto pa tungkol sa Premium">
            Matuto Pa Tungkol sa Premium
          </button>
        </div>
      )}
    </div>
  );
};

// Freedom Wall Component: Isang pampublikong espasyo para sa pagbabahagi ng mga saloobin at damdamin
const FreedomWall = () => {
  // Access ang Firebase, impormasyon ng user, at premium status mula sa context
  const { db, user, userId, isAuthenticated, isPremium } = useContext(AppContext);
  const [posts, setPosts] = useState([]); // Nagtatabi ng mga nakuha na post mula sa Firestore
  const [newPostContent, setNewPostContent] = useState(''); // Nilalaman para sa bagong post
  const [postAnonymously, setPostAnonymously] = useState(false); // Flag para sa anonymous posting
  const [message, setMessage] = useState(''); // Mga mensahe ng feedback ng user (hal. tagumpay/error)
  const [suggestionLoading, setSuggestionLoading] = useState(false); // Nagpapahiwatig kung ang AI suggestion ay nilo-load
  const [llmSuggestion, setLlmSuggestion] = useState(''); // Nagtatabi ng nabuong suggestion ng AI

  // Hook ng Effect para kumuha ng mga post mula sa Firestore nang real-time
  useEffect(() => {
    if (!db) return; // Siguraduhin na na-initialize ang Firestore

    // Kunin ang application ID mula sa environment variables o gumamit ng default
    const currentAppId = typeof process !== 'undefined' && process.env.REACT_APP_APP_ID ? process.env.REACT_APP_APP_ID : (typeof __app_id !== 'undefined' ? __app_id : 'default-padayon-app');
    // I-construct ang Firestore collection reference para sa public posts
    const postsColRef = collection(db, `artifacts/${currentAppId}/public/data/freedom_wall_posts`);
    
    // Gumawa ng query para kunin ang lahat ng dokumento mula sa collection
    // Tandaan: Ang `orderBy` ay sadyang inalis ayon sa mga espesyal na tagubilin, ang pag-oorganisa ay ginagawa sa client-side.
    const q = query(postsColRef);

    // I-set up ang real-time listener para sa mga pagbabago sa collection
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedPosts = snapshot.docs.map(doc => ({
        id: doc.id, // ID ng Dokumento
        ...doc.data() // Lahat ng data ng dokumento
      }));
      // I-sort ang mga post ayon sa timestamp sa descending order (pinakabago muna) sa client-side
      fetchedPosts.sort((a, b) => (b.timestamp?.toDate() || 0) - (a.timestamp?.toDate() || 0));
      setPosts(fetchedPosts); // I-update ang state gamit ang naka-sort na mga post
    }, (error) => {
      // Pamahalaan ang mga error sa panahon ng pagkuha ng data
      console.error("Error sa pagkuha ng freedom wall posts:", error);
      setMessage("Error sa paglo-load ng mga post.");
    });

    // I-cleanup ang listener kapag na-unmount ang component
    return () => unsubscribe();
  }, [db]); // I-re-run ang effect kung magbago ang `db` instance

  // Pamahalaan ang pag-submit ng bagong post
  const handlePost = async (e) => {
    e.preventDefault(); // Pigilan ang default na pag-submit ng form
    if (!newPostContent.trim()) {
      setMessage('Hindi maaaring walang laman ang nilalaman ng post.');
      return;
    }
    if (!db || !isAuthenticated) {
      setMessage('Kailangan mong naka-login para makapag-post.');
      return;
    }

    try {
      const currentAppId = typeof process !== 'undefined' && process.env.REACT_APP_APP_ID ? process.env.REACT_APP_APP_ID : (typeof __app_id !== 'undefined' ? __app_id : 'default-padayon-app');
      const postsColRef = collection(db, `artifacts/${currentAppId}/public/data/freedom_wall_posts`);
      await addDoc(postsColRef, {
        content: newPostContent,
        authorId: userId,
        // Gumamit ng 'Anonymous' kung `postAnonymously` ay true, kung hindi ay gamitin ang email ng user o 'Bisita'
        authorName: postAnonymously ? 'Anonymous' : (user?.email || 'Bisita'),
        isAnonymous: postAnonymously,
        timestamp: serverTimestamp(), // Gumamit ng server timestamp para sa pare-parehong pag-oorganisa
        reactions: 0 // I-initialize ang bilang ng mga reaksyon
      });
      setNewPostContent(''); // I-clear ang input field
      setPostAnonymously(false); // I-reset ang anonymous checkbox
      setLlmSuggestion(''); // I-clear ang anumang nakaraang AI suggestion
      setMessage('Naibahagi ang iyong saloobin!'); // Magbigay ng feedback sa tagumpay
    } catch (error) {
      console.error("Error sa pagdaragdag ng post:", error);
      setMessage(`Nabigo ang pagbabahagi ng saloobin: ${error.message}`);
    }
    setTimeout(() => setMessage(''), 3000); // I-clear ang mensahe ng feedback pagkatapos ng 3 segundo
  };

  // Pamahalaan ang pagtanggal ng post (magagamit para sa premium users sa kanilang sariling mga post)
  const handleDeletePost = async (postId, postAuthorId) => {
    if (!db || !isAuthenticated) {
      setMessage('Kailangan mong naka-login para makapag-delete ng post.');
      return;
    }
    // Suriin kung ang user ay premium at ang author ng post
    if (isPremium && postAuthorId === userId) {
      try {
        const currentAppId = typeof process !== 'undefined' && process.env.REACT_APP_APP_ID ? process.env.REACT_APP_APP_ID : (typeof __app_id !== 'undefined' ? __app_id : 'default-padayon-app');
        const postDocRef = doc(db, `artifacts/${currentAppId}/public/data/freedom_wall_posts`, postId);
        await deleteDoc(postDocRef); // Tanggalin ang dokumento mula sa Firestore
        setMessage('Matagumpay na natanggal ang post.');
      } catch (error) {
        console.error("Error sa pagtanggal ng post:", error);
        setMessage(`Nabigo ang pagtanggal ng post: ${error.message}`);
      }
    } else {
      setMessage('Wala kang pahintulot na tanggalin ang post na ito.');
    }
    setTimeout(() => setMessage(''), 3000); // I-clear ang mensahe pagkatapos ng 3 segundo
  };

  // Pamahalaan ang pagdaragdag ng reaksyon (hal. isang "puso" o "suporta") sa isang post
  const handleAddReaction = async (postId, currentReactions) => {
    if (!db || !isAuthenticated) {
      setMessage('Kailangan mong naka-login para makapag-react.');
      return;
    }
    try {
      const currentAppId = typeof process !== 'undefined' && process.env.REACT_APP_APP_ID ? process.env.REACT_APP_APP_ID : (typeof __app_id !== 'undefined' ? __app_id : 'default-padayon-app');
      const postDocRef = doc(db, `artifacts/${currentAppId}/public/data/freedom_wall_posts`, postId);
      await updateDoc(postDocRef, {
        reactions: (currentReactions || 0) + 1 // Taasan ang bilang ng mga reaksyon
      });
      setMessage('Nadaragdagan ang reaksyon!');
    } catch (error) {
      console.error("Error sa pagdaragdag ng reaksyon:", error);
      setMessage(`Nabigo ang pagdaragdag ng reaksyon: ${error.message}`);
    }
    setTimeout(() => setMessage(''), 3000); // I-clear ang mensahe pagkatapos ng 3 segundo
  };

  // Tawagan ang LLM para makakuha ng supportive na suggestion para sa nilalaman ng post (Premium feature)
  const getPostSuggestion = async () => {
    if (!newPostContent.trim()) {
      setLlmSuggestion('Pakisulat muna ang isang bagay para makakuha ng suggestion.');
      return;
    }
    setSuggestionLoading(true); // I-activate ang loading indicator
    setLlmSuggestion(''); // I-clear ang anumang nakaraang suggestion

    try {
      // I-construct ang prompt para sa AI model
      const prompt = `Suriin ang sumusunod na saloobin ng estudyante para sa pangkalahatang damdamin (hal. stress, pag-asa, pakikibaka, tagumpay) at magbigay ng napakaikli, sumusuporta, at pangkalahatang affirmation o coping tip (max 20 salita). HUWAG kumilos bilang isang therapist. Isang maikli, positibo, nakapagpapalakas na tala lamang. Halimbawa: "Nao-overwhelm? Huminga nang malalim at hatiin ito."\n\nSaloobin ng Estudyante: "${newPostContent}"`;
      let chatHistory = [];
      chatHistory.push({ role: "user", parts: [{ text: prompt }] }); // Idagdag ang prompt ng user sa kasaysayan ng chat para sa API call

      const payload = { contents: chatHistory };
      const apiKey = ""; // Ang Canvas ang magbibigay nito kung walang laman para sa pinapayagang mga model
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

      // Gawin ang API call
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json(); // I-parse ang tugon

      // Kunin at itakda ang suggestion ng AI
      if (result.candidates && result.candidates.length > 0 &&
          result.candidates[0].content && result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0) {
        const suggestionText = result.candidates[0].content.parts[0].text;
        setLlmSuggestion(suggestionText);
      } else {
        setLlmSuggestion("Hindi makakuha ng suggestion. Pakisubukang muli.");
      }
    } catch (error) {
      console.error("Error sa pagkuha ng post suggestion mula sa AI:", error);
      setLlmSuggestion("Error sa pagbuo ng suggestion. Pakisubukang muli mamaya.");
    } finally {
      setSuggestionLoading(false); // I-deactivate ang loading indicator
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <h2 className="text-xl sm:text-2xl font-semibold text-red-700 mb-4 sm:mb-6">Freedom Wall (Mindscape)</h2>
      <p className="text-gray-700 mb-4 text-sm sm:text-base">
        Ibahagi ang iyong mga saloobin at damdamin dito. Maaari kang maging anonymous.
        <span className="text-xs sm:text-sm font-normal text-gray-500">
          {isPremium ? ' (Premium: Tanggalin ang sariling mga post, kumuha ng mga suhestiyon ng AI)' : ' (Libre: Tingnan lang ang mga post)'}
        </span>
      </p>

      {/* Ipakita ang mga mensahe ng feedback ng user */}
      {message && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 sm:px-4 sm:py-3 rounded-md mb-4 text-sm" role="alert">
          {message}
        </div>
      )}

      {/* Form ng paggawa ng post, makikita lang kung naka-authenticate */}
      {isAuthenticated ? (
        <form onSubmit={handlePost} className="mb-6 sm:mb-8 p-4 sm:p-6 bg-red-50 rounded-lg shadow-inner">
          <textarea
            className="w-full p-2 sm:p-3 border border-red-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300 mb-3 sm:mb-4 text-sm sm:text-base"
            rows="4"
            placeholder="Ano ang nasa isip mo? Ibahagi ang iyong mga saloobin dito..."
            value={newPostContent}
            onChange={(e) => setNewPostContent(e.target.value)}
            required
            aria-label="Nilalaman ng bagong post"
          ></textarea>
          <div className="flex flex-col sm:flex-row items-center justify-between mb-3 sm:mb-4 gap-2 sm:gap-0">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="postAnonymously"
                checked={postAnonymously}
                onChange={(e) => setPostAnonymously(e.target.checked)}
                className="mr-2 h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                aria-label="Anonymous post checkbox"
              />
              <label htmlFor="postAnonymously" className="text-gray-700 text-sm sm:text-base">Anonymous na Post</label>
            </div>
            {/* Pindutan ng AI suggestion para sa premium users */}
            {isPremium && (
              <button
                type="button"
                onClick={getPostSuggestion}
                disabled={suggestionLoading || !newPostContent.trim()}
                className="w-full sm:w-auto px-4 py-2 bg-orange-600 text-white rounded-lg shadow hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center mt-2 sm:mt-0"
                aria-label="Kumuha ng AI suggestion para sa post"
              >
                {suggestionLoading ? (
                  <span className="flex items-center">
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                    Kumukuha ng Suggestion...
                  </span>
                ) : (
                  '✨ Kumuha ng Suggestion'
                )}
              </button>
            )}
          </div>
          {/* Ipakita ang AI suggestion kung magagamit */}
          {llmSuggestion && (
            <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-md mb-4 text-sm">
              <p className="font-semibold mb-1">Pananaw ng Padayon:</p>
              <p>{llmSuggestion}</p>
            </div>
          )}
          <button
            type="submit"
            className="w-full bg-red-800 text-white py-2 sm:py-3 rounded-lg shadow-md hover:bg-red-900 transition-colors text-base sm:text-lg font-semibold"
            aria-label="Ibahagi ang iyong saloobin"
          >
            Ibahagi ang Saloobin
          </button>
        </form>
      ) : (
        <div className="bg-orange-100 border border-orange-400 text-orange-700 px-3 py-2 sm:px-4 sm:py-3 rounded-md mb-4 text-center text-sm sm:text-base">
          Mangyaring mag-login o mag-signup para ibahagi ang iyong mga saloobin sa Freedom Wall.
        </div>
      )}

      {/* Lugar ng display para sa mga kasalukuyang post */}
      <div className="space-y-3 sm:space-y-4">
        {posts.length === 0 ? (
          <p className="text-center text-gray-500 italic text-sm sm:text-base">Wala pang naibabahaging saloobin. Ikaw ang mauuna!</p>
        ) : (
          posts.map((post) => (
            <div key={post.id} className="bg-gray-50 p-4 sm:p-5 rounded-lg shadow-md border border-gray-200">
              <p className="text-gray-800 mb-2 sm:mb-3 text-sm sm:text-base">{post.content}</p>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs sm:text-sm text-gray-500">
                <span className="font-medium">
                  {post.isAnonymous ? 'Anonymous' : (post.authorName || 'Hindi Kilalang User')}
                </span>
                <span className="text-xs mt-1 sm:mt-0">
                  {post.timestamp ? new Date(post.timestamp.toDate()).toLocaleString() : 'Naglo-load ng petsa...'}
                </span>
              </div>
              <div className="flex items-center mt-2 sm:mt-3 gap-2 sm:gap-3">
                <button
                  onClick={() => handleAddReaction(post.id, post.reactions)}
                  className="flex items-center px-2 py-1 bg-orange-100 text-orange-700 rounded-full hover:bg-orange-200 transition-colors text-xs sm:text-sm"
                  aria-label={`Suportahan ang post na ito na may ${post.reactions || 0} na reaksyon`}
                >
                  <span className="mr-1">❤️</span> Suporta ({post.reactions || 0})
                </button>
                {/* Pindutan ng delete para sa premium users sa kanilang sariling mga post */}
                {isPremium && post.authorId === userId && (
                  <button
                    onClick={() => handleDeletePost(post.id, post.authorId)}
                    className="flex items-center px-2 py-1 bg-red-100 text-red-700 rounded-full hover:bg-red-200 transition-colors text-xs sm:text-sm"
                    aria-label="Tanggalin ang post na ito"
                  >
                    🗑️ Tanggalin
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

// Community Component: Isang pampublikong espasyo ng chat para sa interaksyon ng komunidad
const Community = () => {
  // Access ang Firebase, impormasyon ng user, at premium status mula sa context
  const { db, userId, isAuthenticated, user, isPremium } = useContext(AppContext);
  const [messages, setMessages] = useState([]); // Nagtatabi ng mga mensahe ng community chat
  const [newMessageContent, setNewMessageContent] = useState(''); // Nilalaman para sa bagong mensahe
  const [messageError, setMessageError] = useState(''); // Feedback para sa mga error sa pagpapadala ng mensahe
  const [suggestionLoading, setSuggestionLoading] = useState(false); // Nagpapahiwatig kung ang AI suggestion ay nilo-load
  const chatBottomRef = useRef(null); // Ref para sa auto-scrolling ng chat window

  // Hook ng Effect para kumuha ng mga mensahe mula sa Firestore nang real-time
  useEffect(() => {
    if (!db) return; // Siguraduhin na na-initialize ang Firestore

    const currentAppId = typeof process !== 'undefined' && process.env.REACT_APP_APP_ID ? process.env.REACT_APP_APP_ID : (typeof __app_id !== 'undefined' ? __app_id : 'default-padayon-app');
    const messagesColRef = collection(db, `artifacts/${currentAppId}/public/data/community_messages`);
    
    // Gumawa ng query para kunin ang lahat ng dokumento mula sa collection
    // Tandaan: Ang `orderBy` ay sadyang inalis ayon sa mga espesyal na tagubilin, ang pag-oorganisa ay ginagawa sa client-side.
    const q = query(messagesColRef);

    // I-set up ang real-time listener para sa mga pagbabago
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // I-sort ang mga mensahe ayon sa timestamp sa ascending order (pinakaluma muna, para sa daloy ng chat) sa client-side
      fetchedMessages.sort((a, b) => (a.timestamp?.toDate() || 0) - (b.timestamp?.toDate() || 0));
      setMessages(fetchedMessages); // I-update ang state gamit ang naka-sort na mga mensahe
    }, (error) => {
      // Pamahalaan ang mga error sa panahon ng pagkuha
      console.error("Error sa pagkuha ng mga mensahe ng komunidad:", error);
      setMessageError("Error sa paglo-load ng mga mensahe ng komunidad.");
    });

    // I-cleanup ang listener kapag na-unmount ang component
    return () => unsubscribe();
  }, [db]); // I-re-run ang effect kung magbago ang `db` instance

  // Hook ng Effect para mag-scroll sa ibaba ng chat kapag dumating ang mga bagong mensahe
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollTop = chatBottomRef.current.scrollHeight;
    }
  }, [messages]);

  // Pamahalaan ang pagpapadala ng bagong mensahe sa community chat
  const handleSendMessage = async (e) => {
    e.preventDefault(); // Pigilan ang default na pag-submit ng form
    if (!newMessageContent.trim()) {
      setMessageError('Hindi maaaring walang laman ang mensahe.');
      return;
    }
    if (!db || !isAuthenticated) {
      setMessageError('Kailangan mong naka-login para makapag-chat.');
      return;
    }

    try {
      const currentAppId = typeof process !== 'undefined' && process.env.REACT_APP_APP_ID ? process.env.REACT_APP_APP_ID : (typeof __app_id !== 'undefined' ? __app_id : 'default-padayon-app');
      const messagesColRef = collection(db, `artifacts/${currentAppId}/public/data/community_messages`);
      await addDoc(messagesColRef, {
        content: newMessageContent,
        authorId: userId,
        authorName: user?.email || 'Bisita', // Gumamit ng email ng user bilang pangalan para sa demo
        timestamp: serverTimestamp(), // Gumamit ng server timestamp para sa pare-parehong pag-oorganisa
      });
      setNewMessageContent(''); // I-clear ang input field
      setMessageError(''); // I-clear ang anumang nakaraang error
    } catch (error) {
      console.error("Error sa pagpapadala ng mensahe:", error);
      setMessageError(`Nabigo ang pagpapadala ng mensahe: ${error.message}`);
    }
    setTimeout(() => setMessageError(''), 3000); // I-clear ang mensahe ng error pagkatapos ng 3 segundo
  };

  // Tawagan ang LLM para makakuha ng conversation starter para sa community chat (Premium feature)
  const getConversationStarter = async () => {
    setSuggestionLoading(true); // I-activate ang loading indicator
    try {
      // I-construct ang prompt para sa AI model
      const prompt = `Bumuo ng napakaikli, open-ended na tanong para sa pangkalahatang talakayan sa isang komunidad ng suporta sa kalusugan ng kaisipan ng estudyante. Dapat hikayatin ng tanong ang pagbabahagi at empatiya, at may kaugnayan sa mga pakikibaka sa akademiko, stress, o kagalingan. Max 20 salita. Halimbawa: "Paano mo hinaharap ang pressure sa akademiko tuwing panahon ng pagsusulit?"`;
      let chatHistory = [];
      chatHistory.push({ role: "user", parts: [{ text: prompt }] }); // Idagdag ang prompt sa kasaysayan ng chat para sa API call

      const payload = { contents: chatHistory };
      const apiKey = ""; // Ang Canvas ang magbibigay nito kung walang laman para sa pinapayagang mga model
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

      // Gawin ang API call
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json(); // I-parse ang tugon
      if (result.candidates && result.candidates.length > 0 &&
          result.candidates[0].content && result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0) {
        const starterText = result.candidates[0].content.parts[0].text;
        setNewMessageContent(starterText); // I-pre-fill ang input gamit ang nabuong starter
        setMessageError('Nabuo ang isang conversation starter! Huwag mag-atubiling i-edit bago ipadala.');
      } else {
        setMessageError("Hindi makakuha ng conversation starter. Pakisubukang muli.");
      }
    } catch (error) {
      console.error("Error sa pagkuha ng conversation starter mula sa AI:", error);
      setMessageError("Error sa pagbuo ng conversation starter. Pakisubukang muli mamaya.");
    } finally {
      setSuggestionLoading(false); // I-de-activate ang loading indicator
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-[400px] sm:h-[600px] bg-white rounded-lg shadow-lg">
      <h2 className="text-xl sm:text-2xl font-semibold text-red-700 p-3 sm:p-4 border-b border-gray-200">Mga Sumpay sa Komunidad</h2>
      <p className="text-gray-700 px-3 pt-2 text-sm sm:text-base">
        Kumonekta sa iba pang mga estudyante at mag-alok ng suporta!
        {isPremium ? (
          <span className="text-orange-600 font-medium"> (Premium: Gumawa ng mga pribadong grupo, walang limitasyong pribadong pagmemensahe, kumuha ng mga conversation starter ng AI)</span>
        ) : (
          <span className="text-gray-600 italic"> (Libre: Pampublikong chat lang. Mag-upgrade para sa mga pribadong feature.)</span>
        )}
      </p>

      {/* Ipakita ang mga mensahe ng error na may kaugnayan sa pagmemensahe */}
      {messageError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 sm:px-4 sm:py-3 rounded-md mx-3 mt-2 text-sm" role="alert">
          {messageError}
        </div>
      )}

      {/* Lugar ng display ng mga mensahe ng chat, na may auto-scrolling */}
      <div ref={chatBottomRef} className="flex-grow p-3 sm:p-4 overflow-y-auto bg-gray-50">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 italic mt-5 sm:mt-10 text-sm sm:text-base">
            Wala pang mga mensahe. Simulan ang isang pag-uusap!
            {isPremium && (
              <p className="mt-2">
                <button
                  onClick={getConversationStarter}
                  disabled={suggestionLoading}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg shadow hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center mx-auto mt-2"
                  aria-label="Gumawa ng conversation starter"
                >
                  {suggestionLoading ? (
                    <span className="flex items-center">
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                      Ginagawa...
                    </span>
                  ) : (
                    '✨ Starter'
                  )}
                </button>
              </p>
            )}
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="mb-3">
              <div className="flex items-baseline text-xs sm:text-sm text-gray-600">
                <span className="font-bold text-red-800 mr-2">
                  {msg.authorId === userId ? 'Ikaw' : msg.authorName || 'Hindi Kilalang User'}
                </span>
                <span className="text-xs">
                  {msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString() : 'Naglo-load ng oras...'}
                </span>
              </div>
              <div className="p-2 sm:p-3 bg-white rounded-lg shadow-sm max-w-full break-words border border-gray-200 text-sm sm:text-base">
                {msg.content}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Form ng input ng mensahe, makikita lang kung naka-authenticate */}
      {isAuthenticated ? (
        <form onSubmit={handleSendMessage} className="p-3 sm:p-4 border-t border-gray-200 flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={newMessageContent}
            onChange={(e) => setNewMessageContent(e.target.value)}
            placeholder="I-type ang iyong mensahe sa komunidad..."
            className="flex-grow p-2 sm:p-3 border border-gray-300 rounded-lg sm:rounded-l-lg sm:rounded-r-none focus:outline-none focus:ring-2 focus:ring-red-400 text-sm sm:text-base"
            aria-label="Input ng chat sa komunidad"
          />
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              type="submit"
              className="flex-grow sm:flex-grow-0 px-4 sm:px-6 py-2 sm:py-3 bg-red-800 text-white rounded-lg sm:rounded-r-lg sm:rounded-l-none shadow hover:bg-red-900 transition-colors text-sm sm:text-base"
              aria-label="Ipadala ang mensahe ng komunidad"
            >
              Ipadala
            </button>
            {/* Pindutan ng AI conversation starter para sa premium users */}
            {isPremium && (
              <button
                type="button"
                onClick={getConversationStarter}
                disabled={suggestionLoading}
                className="flex-grow sm:flex-grow-0 px-4 py-2 sm:py-3 bg-orange-600 text-white rounded-lg shadow hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center"
                aria-label="Gumawa ng conversation starter"
              >
                {suggestionLoading ? (
                  <span className="flex items-center">
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                    Ginagawa...
                  </span>
                ) : (
                  '✨ Starter'
                )}
              </button>
            )}
          </div>
        </form>
      ) : (
        <div className="p-3 sm:p-4 border-t border-gray-200 text-center text-gray-500 text-sm sm:text-base">
          Mag-login o mag-signup para sumali sa chat ng komunidad!
        </div>
      )}
    </div>
  );
};

// Profile Component: Nagpapakita ng impormasyon ng profile ng user at premium status
const Profile = () => {
  const { user, userId, isAuthenticated, isPremium } = useContext(AppContext);

  // Kung hindi naka-authenticate, hikayatin ang user na mag-login
  if (!isAuthenticated) {
    return (
      <div className="p-4 sm:p-6 text-center text-gray-600">
        Mangyaring mag-login para makita ang iyong profile.
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <h2 className="text-xl sm:text-2xl font-semibold text-red-700 mb-4 sm:mb-6">Ang Iyong Profile</h2>

      <div className="bg-gray-50 p-4 sm:p-6 rounded-lg shadow-md border border-gray-200">
        {/* Ipakita ang email ng user */}
        <div className="mb-3 sm:mb-4">
          <p className="text-base sm:text-lg font-medium text-gray-700">Email:</p>
          <p className="text-lg sm:text-xl font-bold text-red-800 break-all">{user?.email || 'N/A'}</p>
        </div>
        {/* Ipakita ang ID ng user */}
        <div className="mb-3 sm:mb-4">
          <p className="text-base sm:text-lg font-medium text-gray-700">User ID:</p>
          <p className="text-lg sm:text-xl font-bold text-red-800 break-all">{userId}</p>
        </div>
        {/* Ipakita ang uri ng account (Libre/Premium) */}
        <div className="mb-3 sm:mb-4">
          <p className="text-base sm:text-lg font-medium text-gray-700">Uri ng Account:</p>
          <p className={`text-lg sm:text-xl font-bold ${isPremium ? 'text-green-600' : 'text-orange-600'}`}>
            {isPremium ? 'Premium User ✨' : 'Libreng User'}
          </p>
          {!isPremium && (
            <p className="text-gray-600 text-xs sm:text-sm mt-1 sm:mt-2">
              Mag-upgrade sa Premium para sa eksklusibong features tulad ng advanced AI chat, direktang professional bookings, at marami pa!
            </p>
          )}
        </div>
        {/* Impormasyon tungkol sa mga benepisyo ng Premium */}
        <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-orange-50 border border-orange-200 rounded-lg text-orange-800">
          <h3 className="text-base sm:text-lg font-semibold mb-1 sm:mb-2">Tungkol sa Premium</h3>
          <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm">
            <li>Personalized AI Chat na may mas malalim na insight.</li>
            <li>Walang limitasyong direktang booking sa mga propesyonal (may bayad sa sesyon).</li>
            <li>Diskwentong presyo sa mga sesyon ng propesyonal.</li>
            <li>Pinahusay na mga opsyon sa anonymity sa Freedom Wall.</li>
            <li>Kakayahang gumawa ng pribadong support groups.</li>
            <li>Walang ad na karanasan.</li>
            <li>✨ **AI-Powered na Mga Suhestiyon sa Post** sa Freedom Wall.</li>
            <li>✨ **AI-Generated na Mga Conversation Starter** sa Mga Sumpay sa Komunidad.</li>
          </ul>
          {!isPremium && (
            <button className="mt-3 sm:mt-4 px-4 sm:px-6 py-2 sm:py-3 bg-red-800 text-white rounded-lg shadow-md hover:bg-red-900 transition-colors font-bold text-sm sm:text-base" aria-label="Mag-upgrade sa Premium Ngayon">
              Mag-upgrade sa Premium Ngayon
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
