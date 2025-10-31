// js/firebase-init.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyDAG0YbhjF9U0d0vt_5qnrllIMCQXjMFtk",
    authDomain: "chatflix-bc859.firebaseapp.com",
    databaseURL: "https://chatflix-bc859-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "chatflix-bc859",
    // storageBucket kullanılmıyor (isteğe bağlı): "chatflix-bc859.appspot.com",
    messagingSenderId: "108064882491",
    appId: "1:108064882491:web:2f48897cff1fe2f2a6811e",
    measurementId: "G-9R5TYCF1J6"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Tek global
window.Chatflix = { app, auth, db };
console.log("✅ Firebase initialized for chatflix-bc859");
