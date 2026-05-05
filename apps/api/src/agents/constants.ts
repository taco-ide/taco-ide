export const AGENT_FALLBACK_RESPONSE =
  "Não posso ajudar com isso. Vamos focar no exercício de programação? Se tiver dúvidas sobre o código ou o problema, estou aqui para ajudar!";

/**
 * Maximum number of previous turns to include in conversation history.
 * Set to 20 turns = 40 messages max to avoid token blowup while maintaining
 * sufficient context for progressive hints (Socratic method).
 */
export const TA_HISTORY_TURN_CAP = 20;
