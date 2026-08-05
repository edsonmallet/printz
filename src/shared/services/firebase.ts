// Import the functions you need from the SDKs you need

import { getAnalytics } from "firebase/analytics";
import { initializeApp } from "firebase/app";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA2nM7LOtGTM7iV4muPT4faUIAe0ehbwsY",
  authDomain: "printz-1558b.firebaseapp.com",
  projectId: "printz-1558b",
  storageBucket: "printz-1558b.firebasestorage.app",
  messagingSenderId: "984862738538",
  appId: "1:984862738538:web:ae901902d3e9ae9319a213",
  measurementId: "G-4WPDS8RQD9",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
