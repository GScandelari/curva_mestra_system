/**
 * Firebase Functions - Minimal version for testing deploy
 */

import {onRequest} from "firebase-functions/v2/https";

// Function placeholder para evitar erro de "no functions"
export const placeholder = onRequest(
  {region: "southamerica-east1"},
  (req, res) => {
    res.json({message: "Firebase Functions configuradas com sucesso"});
  }
);
