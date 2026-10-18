/* ============ firebase-config.js — connection to your Firebase project ============
 * Paste your Firebase web app's configuration here (Firebase Console >
 * Project settings > Your apps > SDK setup and configuration > Config).
 * The full steps are in docs/FIREBASE.md.
 *
 * These values are NOT secret: Firebase designs them to live in the website. What
 * protects the saves are the Firestore rules (firestore.rules).
 *
 * If it's set to null, the game works in local mode (browser only).
 */
// Megamon's own Firebase project (megamon-2164e). These values aren't secret:
// Firebase designs them to live in the website; what protects the saves are the
// Firestore and Realtime Database rules.
G.FIREBASE_CONFIG = {
  apiKey: 'AIzaSyD5cjBD5L7Bbnu0QTV-MUjNaTrrZZs9cEk',
  authDomain: 'megamon-2164e.firebaseapp.com',
  projectId: 'megamon-2164e',
  storageBucket: 'megamon-2164e.firebasestorage.app',
  messagingSenderId: '4975853875',
  appId: '1:4975853875:web:0151426f89d9a9ea843e46',
  databaseURL: 'https://megamon-2164e-default-rtdb.europe-west1.firebasedatabase.app'
};

/* Example of how it should look:
G.FIREBASE_CONFIG = {
  apiKey: 'AIza...',
  authDomain: 'your-project.firebaseapp.com',
  projectId: 'your-project',
  storageBucket: 'your-project.firebasestorage.app',
  messagingSenderId: '1234567890',
  appId: '1:1234567890:web:abc123'
};
*/
