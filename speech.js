"use strict";

// Speech helpers.

function estimateSpeechTimeout(text) {
  const speechRate = Number(state.settings.speechRate);
  const rate = Number.isFinite(speechRate) ? Math.min(Math.max(speechRate, 0.6), 1.2) : 0.9;
  const milliseconds = Math.ceil((String(text).length / (12 * rate)) * 1000) + 1000;
  return Math.min(Math.max(milliseconds, 3000), 12000);
}

function speak(text, onComplete) {
  const finish = once(onComplete);
  if (!state.settings.audioFeedback) {
    finish();
    return;
  }
  if (!("speechSynthesis" in window)) {
    finish();
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = state.settings.speechRate || 0.9;
  utterance.addEventListener("end", finish);
  utterance.addEventListener("error", finish);
  window.speechSynthesis.speak(utterance);
}

function stopSpeech() {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

function once(callback) {
  let called = false;
  return () => {
    if (called || typeof callback !== "function") return;
    called = true;
    callback();
  };
}
