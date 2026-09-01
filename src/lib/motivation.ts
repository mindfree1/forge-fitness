const sessionMessages = [
  'Session banked. Recover well and come back ready.',
  'Strong work. The next session starts from what you built today.',
  'Good session. Consistency over time is what makes this count.',
  'Done for today. Let recovery do its part now.',
  'Another useful session in the books.',
  'Work complete. Next time, build from today rather than starting over.',
];

export function getSessionMessage(seed = 0) {
  const index = Math.abs(Math.round(seed)) % sessionMessages.length;
  return sessionMessages[index];
}
