import React, { CSSProperties, useEffect, useState } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User
} from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  DocumentData
} from "firebase/firestore";
import { PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

// Define a union type for risk levels
type Risk = "High" | "Medium" | "Low" | "Unknown";

// Define a Tweet interface
interface Tweet {
  userId: string;
  tweetId: string;
  text: string;
  risk: Risk;
  reason: string;
  createdAt: Date;
}

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
  // Explicitly type user and tweets
  const [user, setUser] = useState<User | null>(null);
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [darkMode, setDarkMode] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);

        try {
          const fetchRes = await fetch("http://localhost:3001/fetch-twitter", {
            credentials: "include"
          });
          const result = await fetchRes.json();
          if (result.error) throw new Error(result.error);

          const tweets2 = result.tweets;
          if (!Array.isArray(tweets2)) throw new Error("Tweets not received correctly");

          const analyzedTweets: Tweet[] = [];
          for (const tweet of tweets2) {
            try {
              const aiRes = await fetch("http://localhost:3001/analyze-tweet", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: tweet.text })
              });

              const aiResult = await aiRes.json();
              if (!Array.isArray(aiResult)) throw new Error("Invalid AI response");

              const topLabels = aiResult
                .filter((r: any) => r.score > 0.5)
                .map((r: any) => r.label);
              const score = Math.max(...aiResult.map((r: any) => r.score));
              const risk: Risk = score > 0.8 ? "High" : score > 0.4 ? "Medium" : "Low";
              const reason = topLabels.length
                ? `Detected: ${topLabels.join(", ")}`
                : "No strong signals detected.";

              const tweetDoc: Tweet = {
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
              analyzedTweets.push({
                userId: currentUser.uid,
                tweetId: tweet.id,
                text: tweet.text,
                risk: "Unknown",
                reason: "AI failure",
                createdAt: new Date()
              });
            }
          }

          console.log("✅ Finished AI analysis, saving to state");
          setTweets(analyzedTweets);
        } catch (err) {
          console.error("❌ Failed to fetch/analyze tweets:", err);
        }

        const q = query(
          collection(db, "tweets"),
          where("userId", "==", currentUser.uid)
        );
        const existingDocs = await getDocs(q);
        const saved: DocumentData[] = existingDocs.docs.map((doc) => doc.data());
        if (saved.length > 0 && saved.length > tweets.length) {
          console.log("📁 Loaded tweets from Firebase");
          setTweets(saved as Tweet[]);
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
    window.location.href = "http://localhost:3001/auth/twitter"; // starts OAuth 1.0a flow
  };

  // Explicitly type risk parameter as Risk
  const getRiskEmoji = (risk: Risk): string => {
    switch (risk) {
      case "High":
        return "🔴";
      case "Medium":
        return "🟠";
      case "Low":
        return "🟢";
      default:
        return "⚪️";
    }
  };

  // Define risk colors as a Record with keys of type Risk
  const colors: Record<Risk, string> = {
    High: "#ef4444",
    Medium: "#f59e0b",
    Low: "#10b981",
    Unknown: "#9ca3af"
  };

  // Compute data for the pie chart
  const riskData: { name: Risk; value: number }[] = [
    { name: "High", value: tweets.filter((t) => t.risk === "High").length },
    { name: "Medium", value: tweets.filter((t) => t.risk === "Medium").length },
    { name: "Low", value: tweets.filter((t) => t.risk === "Low").length },
    { name: "Unknown", value: tweets.filter((t) => t.risk === "Unknown").length }
  ];

  // Inline styles with explicit typing and literal casts where needed
  const containerStyle: CSSProperties = {
    padding: "2rem",
    fontFamily: "'Roboto', Arial, sans-serif",
    width: "100vw",
    height: "100vh",
    backgroundColor: darkMode ? "#18191A" : "#f0f2f5",
    color: darkMode ? "#e4e6eb" : "#1c1e21",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    boxSizing: "border-box" as "border-box",
    overflowY: "auto",
    transition: "background-color 0.3s ease, color 0.3s ease"
  };

  const headerStyle: CSSProperties = {
    fontSize: "3rem",
    fontWeight: "bold",
    marginBottom: "1.5rem",
    textAlign: "center" as "center",
    color: darkMode ? "#2e89ff" : "#1877f2",
    transition: "color 0.3s ease"
  };

  const buttonStyle: CSSProperties = {
    padding: "0.75rem 1.5rem",
    margin: "0.5rem",
    fontSize: "1rem",
    border: "none",
    borderRadius: "0.375rem",
    cursor: "pointer",
    transition: "background-color 0.3s ease",
    backgroundColor: darkMode ? "#2e89ff" : "#1877f2",
    color: "#fff"
  };

  const cardStyle: CSSProperties = {
    width: "100%",
    maxWidth: "600px",
    padding: "1rem",
    backgroundColor: darkMode ? "#242526" : "#fff",
    borderRadius: "0.5rem",
    boxShadow: darkMode
      ? "0 4px 6px rgba(0, 0, 0, 0.8)"
      : "0 4px 6px rgba(0, 0, 0, 0.1)",
    marginBottom: "2rem",
    transition: "background-color 0.3s ease, box-shadow 0.3s ease"
  };

  const listItemStyle: CSSProperties = {
    backgroundColor: darkMode ? "#242526" : "#fff",
    padding: "1rem",
    borderRadius: "0.375rem",
    boxShadow: darkMode
      ? "0 2px 4px rgba(0, 0, 0, 0.8)"
      : "0 2px 4px rgba(0, 0, 0, 0.05)",
    marginBottom: "1rem",
    width: "100%",
    transition: "transform 0.2s, box-shadow 0.2s, background-color 0.3s ease"
  };

  const tweetTextStyle: CSSProperties = {
    margin: "0.5rem 0"
  };

  const textCenterStyle: CSSProperties = {
    textAlign: "center" as "center"
  };

  return (
    <div className="container animated-background" style={containerStyle}>
      {/* CSS for animations and dynamic background */}
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
          background: ${
            darkMode
              ? "linear-gradient(135deg, #232526, #414345, #232526, #414345)"
              : "linear-gradient(135deg, #f0f2f5, #d9e2ef, #f0f2f5, #d9e2ef)"
          };
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
      {/* Dark mode toggle */}
      <div style={{ position: "absolute", top: "1rem", right: "1rem" }}>
        <button className="button fade-in" style={buttonStyle} onClick={() => setDarkMode(!darkMode)}>
          {darkMode ? "Light Mode" : "Dark Mode"}
        </button>
      </div>
      <h1 className="fade-in" style={headerStyle}>ClearPost</h1>
      {!user ? (
        <button className="button fade-in" style={buttonStyle} onClick={handleLogin}>
          Sign in with Google
        </button>
      ) : (
        <>
          <p className="fade-in" style={textCenterStyle}>Welcome, {user.displayName}</p>
          <div className="fade-in">
            <button className="button" style={buttonStyle} onClick={connectTwitter}>
              Connect Twitter
            </button>
            <button className="button" style={buttonStyle} onClick={handleLogout}>
              Log Out
            </button>
          </div>
          <h2 className="fade-in" style={{ ...headerStyle, fontSize: "1.5rem", marginTop: "2rem" }}>
            📊 Risk Breakdown
          </h2>
          <div className="card fade-in" style={cardStyle}>
            {tweets.length === 0 ? (
              <p className="fade-in" style={textCenterStyle}>No Data</p>
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
          <h2 className="fade-in" style={{ ...headerStyle, fontSize: "1.5rem" }}>
            Your Analyzed Tweets:
          </h2>
          <ul style={{ listStyleType: "none", padding: 0, width: "100%", maxWidth: "600px" }}>
            {tweets.map((tweet, index) => (
              <li key={tweet.tweetId || index} className="list-item fade-in" style={listItemStyle}>
                <strong>{getRiskEmoji(tweet.risk)} {tweet.risk} Risk</strong>
                <p style={tweetTextStyle}>{tweet.text}</p>
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

