function handleServerMessage(rawData) {
  let message;
  try {
    message = JSON.parse(rawData);
  } catch (e) {
    console.error(e);
    return;
  }

  // Skip logging raw audio chunks — only log structurally useful messages
  const hasAudio = message?.serverContent?.modelTurn?.parts?.some(p => p?.inlineData?.data);
  if (!hasAudio) {
    console.log("RAW MESSAGE:", JSON.stringify(message));
  }

  if (message?.serverContent?.outputTranscription?.text) {
    window.advanceFocusToText(message.serverContent.outputTranscription.text);
  }

  if (message?.serverContent?.interrupted) {
    stopPlayback();
    return;
  }

  const parts = message?.serverContent?.modelTurn?.parts;
  if (!parts) return;

  for (const part of parts) {
    const audioBase64 = part?.inlineData?.data;
    if (audioBase64) playAudioChunk(audioBase64);
  }
}
