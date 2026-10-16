/* ============ firebase-config.js — conexión con tu proyecto de Firebase ============
 * Pega aquí la configuración de tu app web de Firebase (Consola de Firebase >
 * Configuración del proyecto > Tus apps > SDK setup and configuration > Config).
 * Los pasos completos están en docs/FIREBASE.md.
 *
 * Estos datos NO son secretos: Firebase los diseña para ir en la web. Lo que
 * protege las partidas son las reglas de Firestore (firestore.rules).
 *
 * Si se pone a null, el juego funciona en modo local (sólo en el navegador).
 */
// Proyecto Firebase propio de Megamon (megamon-2164e). Estos datos no son secretos:
// Firebase los diseña para ir en la web; lo que protege las partidas son las
// reglas de Firestore y de Realtime Database.
G.FIREBASE_CONFIG = {
  apiKey: 'AIzaSyD5cjBD5L7Bbnu0QTV-MUjNaTrrZZs9cEk',
  authDomain: 'megamon-2164e.firebaseapp.com',
  projectId: 'megamon-2164e',
  storageBucket: 'megamon-2164e.firebasestorage.app',
  messagingSenderId: '4975853875',
  appId: '1:4975853875:web:0151426f89d9a9ea843e46',
  databaseURL: 'https://megamon-2164e-default-rtdb.europe-west1.firebasedatabase.app'
};

/* Ejemplo de cómo debe quedar:
G.FIREBASE_CONFIG = {
  apiKey: 'AIza...',
  authDomain: 'tu-proyecto.firebaseapp.com',
  projectId: 'tu-proyecto',
  storageBucket: 'tu-proyecto.firebasestorage.app',
  messagingSenderId: '1234567890',
  appId: '1:1234567890:web:abc123'
};
*/
