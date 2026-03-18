import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { auth } from "../config/firebase";

let uidPromise: Promise<string> | null = null;

export async function ensureAnonymousUid(): Promise<string> {
    if (auth.currentUser?.uid) {
        return auth.currentUser.uid;
    }

    if (!uidPromise) {
        uidPromise = new Promise<string>((resolve, reject) => {
            let settled = false;
            let signingIn = false;

            const unsubscribe = onAuthStateChanged(
                auth,
                async (user) => {
                    if (settled) return;

                    if (user?.uid) {
                        settled = true;
                        unsubscribe();
                        resolve(user.uid);
                        return;
                    }

                    if (signingIn) return;
                    signingIn = true;

                    try {
                        const credential = await signInAnonymously(auth);
                        if (settled) return;

                        settled = true;
                        unsubscribe();
                        resolve(credential.user.uid);
                    } catch (error) {
                        settled = true;
                        unsubscribe();
                        console.log("Anonymous auth sign-in failed:", error);
                        reject(error);
                    }
                },
                (error) => {
                    if (settled) return;

                    settled = true;
                    unsubscribe();
                    console.log("Anonymous auth state listener failed:", error);
                    reject(error);
                }
            );
        });
    }

    try {
        return await uidPromise;
    } catch (error) {
        uidPromise = null;
        throw error;
    }
}