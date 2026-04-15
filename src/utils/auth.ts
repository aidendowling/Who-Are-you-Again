import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { auth } from "../config/firebase";

let uidPromise: Promise<string> | null = null;

export async function ensureAnonymousUid(): Promise<string> {
    if (auth.currentUser?.uid) {
        return auth.currentUser.uid;
    }

    if (!uidPromise) {
        uidPromise = (async () => {
            try {
                const credential = await signInAnonymously(auth);
                return credential.user.uid;
            } catch {
                // A concurrent request may have already completed sign-in.
                if (auth.currentUser?.uid) {
                    return auth.currentUser.uid;
                }

                // Fallback to auth state listener for edge cases where sign-in succeeds
                // but the credential promise rejects due to transient webview/storage issues.
                const fallbackUid = await new Promise<string>((resolve, reject) => {
                    const unsubscribe = onAuthStateChanged(
                        auth,
                        (user) => {
                            if (!user?.uid) return;
                            unsubscribe();
                            resolve(user.uid);
                        },
                        (error) => {
                            unsubscribe();
                            reject(error);
                        }
                    );
                });

                return fallbackUid;
            }
        })();
    }

    try {
        return await uidPromise;
    } catch (error) {
        uidPromise = null;
        throw error;
    }
}