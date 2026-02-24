import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyDhSGakyGYW4xGtSE7ny6IW95ZssytmYms",
    authDomain: "who-are-you-again.firebaseapp.com",
    projectId: "who-are-you-again",
    storageBucket: "who-are-you-again.firebasestorage.app",
    messagingSenderId: "419609342903",
    appId: "1:419609342903:web:c2fe54d6af0c23f25dee32",
    measurementId: "G-9ETBYF5YHQ",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export default app;
