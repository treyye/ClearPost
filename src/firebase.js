// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCR9CMOhlx-No9S2q4GfV_NDfxn8Febm8k",
  authDomain: "clearpost-8d0a7.firebaseapp.com",
  databaseURL: "https://clearpost-8d0a7-default-rtdb.firebaseio.com",
  projectId: "clearpost-8d0a7",
  storageBucket: "clearpost-8d0a7.firebasestorage.app",
  messagingSenderId: "297839438788",
  appId: "1:297839438788:web:79b7292696359d7db3d291",
  measurementId: "G-8Z4F5NCCXQ"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
