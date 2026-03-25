import { getFirestore } from "firebase/firestore";
import firebaseApp from "./app";

// Firestore instance
export const db = getFirestore(firebaseApp);

export default db;
