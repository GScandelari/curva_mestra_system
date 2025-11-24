import {onRequest} from "firebase-functions/v2/https";

export const helloWorld = onRequest((req, res) => {
  res.json({message: "Hello from Firebase!"});
});
