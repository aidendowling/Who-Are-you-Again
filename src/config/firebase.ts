import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: "API_KEY",
    authDomain: "PROJECT.firebaseapp.com",
    projectId: "PROJECT_ID",
    storageBucket: "PROJECT.appspot.com",
    messagingSenderId: "SENDER_ID",
    appId: "APP_ID",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export default app;
