// src/config/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore"; 
import { getStorage } from "firebase/storage"; // <--- AGREGAR ESTO

const firebaseConfig = {
  apiKey: "AIzaSyCIPnSQkdWm6YgdYlIZ8G5V4wu-oTFFTfg",
  authDomain: "srs-feacb.firebaseapp.com",
  projectId: "srs-feacb",
  storageBucket: "srs-feacb.firebasestorage.app",
  messagingSenderId: "568441727812",
  appId: "1:568441727812:web:ddc7f3ab84e2a5ab440511",
  measurementId: "G-1RR7H5R4PB"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app); 
export const storage = getStorage(app); 
export default app;