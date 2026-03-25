import { getAuth, GoogleAuthProvider } from "firebase/auth";
import firebaseApp from "./app";

// Firebase Auth instance
export const auth = getAuth(firebaseApp);

// Google Auth Provider for OAuth sign-in
export const googleProvider = new GoogleAuthProvider();

export default auth;
