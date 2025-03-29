import { useEffect, useState } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  getDocs
} from "firebase/firestore";
import { PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

const firebaseConfig = {
  apiKey: "AIzaSyCR9CMOhlx-No9S2q4GfV_NDfxn8Febm8k",
  authDomain: "clearpost-8d0a7.firebaseapp.com",
  projectId: "clearpost-8d0a7",
  storageBucket: "clearpost-8d0a7.firebasestorage.app",
  messagingSenderId: "297839438788",
  appId: "1:297839438788:web:79b7292696359d7db3d291",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

function App() {
  const [user, setUser] = useState(null);
  const [tweets, setTweets] = useState([]);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);

        try {
          const fetchRes = await fetch("https://clearpost.onrender.com/fetch-twitter", {
            credentials: "include"
          });
          const result = await fetchRes.json();
          if (result.error) throw new Error(result.error);

          const tweets2 = result.tweets;
          if (!Array.isArray(tweets2)) throw new Error("Tweets not received correctly");

          const analyzedTweets = [];
          for (const tweet of tweets2) {
            try {
              const aiRes = await fetch("https://clearpost.onrender.com/analyze-tweet", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: tweet.text })
              });

              const aiResult = await aiRes.json();
              if (!Array.isArray(aiResult)) throw new Error("Invalid AI response");

              const topLabels = aiResult.filter((r) => r.score > 0.5).map((r) => r.label);
              const score = Math.max(...aiResult.map((r) => r.score));
              const risk = score > 0.8 ? "High" : score > 0.4 ? "Medium" : "Low";
              const reason = topLabels.length
                ? `Detected: ${topLabels.join(", ")}`
                : "No strong signals detected.";

              const tweetDoc = {
                userId: currentUser.uid,
                tweetId: tweet.id,
                text: tweet.text,
                risk,
                reason,
                createdAt: new Date()
              };

              analyzedTweets.push(tweetDoc);
              await addDoc(collection(db, "tweets"), tweetDoc);
              await new Promise((res) => setTimeout(res, 1500));
            } catch (error) {
              console.error("❌ AI error:", error);
              analyzedTweets.push({ ...tweet, risk: "Unknown", reason: "AI failure" });
            }
          }

          console.log("✅ Finished AI analysis, saving to state");
          setTweets(analyzedTweets);
        } catch (err) {
          console.error("❌ Failed to fetch/analyze tweets:", err);
        }

        const q = query(collection(db, "tweets"), where("userId", "==", currentUser.uid));
        const existingDocs = await getDocs(q);
        const saved = existingDocs.docs.map(doc => doc.data());
        if (saved.length > 0 && saved.length > tweets.length) {
          console.log("📁 Loaded tweets from Firebase");
          setTweets(saved);
        }
      } else {
        setUser(null);
        setTweets([]);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      setUser(result.user);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setTweets([]);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const connectTwitter = () => {
    window.location.href = "https://clearpost.onrender.com/auth/twitter"; // starts OAuth 1.0a flow
  };

  const getRiskEmoji = (risk) => {
    switch (risk) {
      case "High": return "🔴";
      case "Medium": return "🟠";
      case "Low": return "🟢";
      default: return "⚪️";
    }
  };

  // Define risk colors for the pie chart
  const colors = { High: "#ef4444", Medium: "#f59e0b", Low: "#10b981", Unknown: "#9ca3af" };

  // Compute data for the pie chart
  const riskData = [
    { name: "High", value: tweets.filter((t) => t.risk === "High").length },
    { name: "Medium", value: tweets.filter((t) => t.risk === "Medium").length },
    { name: "Low", value: tweets.filter((t) => t.risk === "Low").length },
    { name: "Unknown", value: tweets.filter((t) => t.risk === "Unknown").length }
  ];

  // Inline styles with dark mode support and updated background colors
  const styles = {
    container: {
      padding: "2rem",
      fontFamily: "'Roboto', Arial, sans-serif",
      width: "100vw",
      height: "100vh",
      backgroundColor: darkMode ? "#18191A" : "#f0f2f5",
      color: darkMode ? "#e4e6eb" : "#1c1e21",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      boxSizing: "border-box",
      overflowY: "auto",
      transition: "background-color 0.3s ease, color 0.3s ease"
    },
    header: {
      fontSize: "3rem",
      fontWeight: "bold",
      marginBottom: "1.5rem",
      textAlign: "center",
      color: darkMode ? "#2e89ff" : "#1877f2",
      transition: "color 0.3s ease"
    },
    button: {
      padding: "0.75rem 1.5rem",
      margin: "0.5rem",
      fontSize: "1rem",
      border: "none",
      borderRadius: "0.375rem",
      cursor: "pointer",
      transition: "background-color 0.3s ease",
      backgroundColor: darkMode ? "#2e89ff" : "#1877f2",
      color: "#fff"
    },
    card: {
      width: "100%",
      maxWidth: "600px",
      padding: "1rem",
      backgroundColor: darkMode ? "#242526" : "#fff",
      borderRadius: "0.5rem",
      boxShadow: darkMode ? "0 4px 6px rgba(0, 0, 0, 0.8)" : "0 4px 6px rgba(0, 0, 0, 0.1)",
      marginBottom: "2rem",
      transition: "background-color 0.3s ease, box-shadow 0.3s ease"
    },
    listItem: {
      backgroundColor: darkMode ? "#242526" : "#fff",
      padding: "1rem",
      borderRadius: "0.375rem",
      boxShadow: darkMode ? "0 2px 4px rgba(0, 0, 0, 0.8)" : "0 2px 4px rgba(0, 0, 0, 0.05)",
      marginBottom: "1rem",
      width: "100%",
      transition: "transform 0.2s, box-shadow 0.2s, background-color 0.3s ease"
    },
    tweetText: {
      margin: "0.5rem 0"
    },
    textCenter: {
      textAlign: "center"
    }
  };

  return (
    <div className="container animated-background" style={styles.container}>
      {/* CSS for animations, hover effects, and improved background gradients */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-in {
          animation: fadeIn 0.5s ease-out;
        }
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animated-background {
          background: ${darkMode 
            ? "linear-gradient(135deg, #232526, #414345, #232526, #414345)" 
            : "linear-gradient(135deg, #f0f2f5, #d9e2ef, #f0f2f5, #d9e2ef)"};
          background-size: 400% 400%;
          animation: gradient 15s ease infinite;
        }
        .button:hover {
          background-color: ${darkMode ? "#1a73e8" : "#145db2"} !important;
        }
        .list-item:hover {
          transform: scale(1.02);
          box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
      `}</style>
      {/* Dark mode toggle button */}
      <div style={{ position: "absolute", top: "1rem", right: "1rem" }}>
        <button className="button fade-in" style={styles.button} onClick={() => setDarkMode(!darkMode)}>
          {darkMode ? "Light Mode" : "Dark Mode"}
        </button>
      </div>
      <h1 className="fade-in" style={styles.header}>ClearPost</h1>
      {!user ? (
        <button className="button fade-in" style={styles.button} onClick={handleLogin}>
          Sign in with Google
        </button>
      ) : (
        <>
          <p className="fade-in" style={styles.textCenter}>Welcome, {user.displayName}</p>
          <div className="fade-in">
            <button className="button" style={styles.button} onClick={connectTwitter}>
              Connect Twitter
            </button>
            <button className="button" style={styles.button} onClick={handleLogout}>
              Log Out
            </button>
          </div>
          <h2 className="fade-in" style={{ ...styles.header, fontSize: "1.5rem", marginTop: "2rem" }}>
            📊 Risk Breakdown
          </h2>
          <div className="card fade-in" style={styles.card}>
            {tweets.length === 0 ? (
              <p className="fade-in" style={styles.textCenter}>No Data</p>
            ) : (
              <PieChart width={300} height={300}>
                <Pie
                  data={riskData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                  isAnimationActive
                >
                  {riskData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={colors[entry.name]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            )}
          </div>
          <h2 className="fade-in" style={{ ...styles.header, fontSize: "1.5rem" }}>
            Your Analyzed Tweets:
          </h2>
          <ul style={{ listStyleType: "none", padding: 0, width: "100%", maxWidth: "600px" }}>
            {tweets.map((tweet, index) => (
              <li key={tweet.tweetId || index} className="list-item fade-in" style={styles.listItem}>
                <strong>{getRiskEmoji(tweet.risk)} {tweet.risk} Risk</strong>
                <p style={styles.tweetText}>{tweet.text}</p>
                <em>Reason: {tweet.reason}</em>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default App;











