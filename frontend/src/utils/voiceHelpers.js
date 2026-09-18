export const formatRecordingTime = (totalSec) => {
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

export const extractVoiceDuration = (textStr) => {
  if (!textStr) return '0:05';
  const match = textStr.match(/\((\d+:\d+)\)/);
  return match ? match[1] : '0:05';
};

export const formatVoiceProgress = (item, progress) => {
  const durStr = extractVoiceDuration(item?.text);
  const [m, s] = durStr.split(':').map(Number);
  const totalSec = (m || 0) * 60 + (s || 5);
  const currentSec = Math.floor(progress * totalSec);
  const cm = Math.floor(currentSec / 60);
  const cs = currentSec % 60;
  return `${cm}:${cs < 10 ? '0' : ''}${cs} / ${durStr}`;
};
