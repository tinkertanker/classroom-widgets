export interface PlayerCopy {
  locale: string;
  learningGoal: string;
  everythingCorrect: string;
  reviewFeedback: string;
  score: (correct: number, total: number) => string;
  tryAgain: string;
  checkAnswers: string;
  answerEveryQuestion: string;
  activityPages: string;
  previous: string;
  next: string;
  pageProgress: (current: number, total: number) => string;
  question: (number: number) => string;
  matchingInstructions: string;
  chooseMatch: string;
  sortingInstructions: string;
  chooseCategory: string;
  sequencingInstructions: string;
  moveEarlier: (label: string) => string;
  moveLater: (label: string) => string;
  moveBefore: string;
  earlierAfter: string;
  laterAfter: string;
  interactivePoints: string;
  chooseNumberedPoint: string;
  decrease: (label: string) => string;
  increase: (label: string) => string;
  decreaseBefore: string;
  increaseBefore: string;
  off: string;
  on: string;
  unavailable: string;
  graphDescription: (range: string, domain: string) => string;
  graphLines: string;
  imageUnavailable: (altText: string) => string;
  imageUnavailableShort: string;
  unsupportedTitle: string;
  unsupportedMessage: (kind?: string) => string;
  brokenReferenceTitle: (label: string) => string;
  brokenReferenceMessage: string;
  brokenReferenceLabels: Record<string, string>;
  chosen: string;
  readyToChoose: (count: number) => string;
  choose: string;
  resetChoices: string;
  allChosen: string;
  taskProgress: (complete: number, total: number) => string;
  clearChecks: string;
  pause: string;
  startAgain: string;
  start: string;
  reset: string;
  currentSignal: (label: string) => string;
  currentSignalBefore: string;
  reportWidget: string;
  reportThanks: string;
  reportConcern: string;
  reportReasons: Record<string, string>;
  sending: string;
  sendReport: string;
  reportFailed: string;
  noPageTitle: string;
  noPageMessage: string;
}

const english: PlayerCopy = {
  locale: 'en',
  learningGoal: 'Learning goal',
  everythingCorrect: 'Everything is correct.',
  reviewFeedback: 'Review the feedback, then try again.',
  score: (correct, total) => `${correct} of ${total}`,
  tryAgain: 'Try again',
  checkAnswers: 'Check answers',
  answerEveryQuestion: 'Answer every question to check your work.',
  activityPages: 'Activity pages',
  previous: 'Previous',
  next: 'Next',
  pageProgress: (current, total) => `Page ${current} of ${total}`,
  question: (number) => `Question ${number}`,
  matchingInstructions:
    'Choose the match for each item. Each menu works with touch, a keyboard or a screen reader.',
  chooseMatch: 'Choose a match',
  sortingInstructions: 'Place every item in a category.',
  chooseCategory: 'Choose a category',
  sequencingInstructions: 'Use the arrow buttons to put the steps in order.',
  moveEarlier: (label) => `Move ${label} earlier`,
  moveLater: (label) => `Move ${label} later`,
  moveBefore: 'Move',
  earlierAfter: 'earlier',
  laterAfter: 'later',
  interactivePoints: 'Interactive points',
  chooseNumberedPoint: 'Choose a numbered point to learn more.',
  decrease: (label) => `Decrease ${label}`,
  increase: (label) => `Increase ${label}`,
  decreaseBefore: 'Decrease',
  increaseBefore: 'Increase',
  off: 'Off',
  on: 'On',
  unavailable: 'Unavailable',
  graphDescription: (range, domain) => `A graph of ${range} against ${domain}.`,
  graphLines: 'Graph lines',
  imageUnavailable: (altText) => `${altText}. Image unavailable.`,
  imageUnavailableShort: 'Image unavailable',
  unsupportedTitle: 'This part needs a newer player',
  unsupportedMessage: (kind) =>
    `Update Classroom Widgets to display${kind ? ` the “${kind}” component` : ' this component'}.`,
  brokenReferenceTitle: (label) => `This ${label} is unavailable`,
  brokenReferenceMessage: 'The activity refers to a setting that could not be found.',
  brokenReferenceLabels: {
    'number control': 'number control',
    'toggle control': 'toggle control',
    'choice control': 'choice control',
  },
  chosen: 'Chosen',
  readyToChoose: (count) => `Ready to choose from ${count} options.`,
  choose: 'Choose',
  resetChoices: 'Reset choices',
  allChosen: 'Every option has been chosen. Reset to begin again.',
  taskProgress: (complete, total) => `${complete} of ${total} complete`,
  clearChecks: 'Clear checks',
  pause: 'Pause',
  startAgain: 'Start again',
  start: 'Start',
  reset: 'Reset',
  currentSignal: (label) => `Current signal: ${label}`,
  currentSignalBefore: 'Current signal:',
  reportWidget: 'Report this widget',
  reportThanks: 'Thank you. This widget has been flagged for review.',
  reportConcern: 'What is the concern?',
  reportReasons: {
    inappropriate: 'Inappropriate content',
    'personal-data': 'Personal information',
    copyright: 'Copyright concern',
    accessibility: 'Accessibility problem',
    other: 'Another safety concern',
  },
  sending: 'Sending…',
  sendReport: 'Send report',
  reportFailed: 'The report could not be sent. Check your connection and try again.',
  noPageTitle: 'This widget has no page to show',
  noPageMessage: 'Ask the teacher to republish the activity, then open the link again.',
};

const malay: PlayerCopy = {
  locale: 'ms',
  learningGoal: 'Matlamat pembelajaran',
  everythingCorrect: 'Semua jawapan betul.',
  reviewFeedback: 'Semak maklum balas, kemudian cuba lagi.',
  score: (correct, total) => `${correct} daripada ${total}`,
  tryAgain: 'Cuba lagi',
  checkAnswers: 'Semak jawapan',
  answerEveryQuestion: 'Jawab setiap soalan untuk menyemak jawapan anda.',
  activityPages: 'Halaman aktiviti',
  previous: 'Sebelumnya',
  next: 'Seterusnya',
  pageProgress: (current, total) => `Halaman ${current} daripada ${total}`,
  question: (number) => `Soalan ${number}`,
  matchingInstructions:
    'Pilih padanan bagi setiap item. Setiap menu boleh digunakan dengan sentuhan, papan kekunci atau pembaca skrin.',
  chooseMatch: 'Pilih padanan',
  sortingInstructions: 'Letakkan setiap item dalam satu kategori.',
  chooseCategory: 'Pilih kategori',
  sequencingInstructions: 'Gunakan butang anak panah untuk menyusun langkah mengikut urutan.',
  moveEarlier: (label) => `Alihkan ${label} ke atas`,
  moveLater: (label) => `Alihkan ${label} ke bawah`,
  moveBefore: 'Alihkan',
  earlierAfter: 'ke atas',
  laterAfter: 'ke bawah',
  interactivePoints: 'Titik interaktif',
  chooseNumberedPoint: 'Pilih titik bernombor untuk mengetahui lebih lanjut.',
  decrease: (label) => `Kurangkan ${label}`,
  increase: (label) => `Tambahkan ${label}`,
  decreaseBefore: 'Kurangkan',
  increaseBefore: 'Tambahkan',
  off: 'Tutup',
  on: 'Buka',
  unavailable: 'Tidak tersedia',
  graphDescription: (range, domain) => `Graf ${range} berbanding ${domain}.`,
  graphLines: 'Garis graf',
  imageUnavailable: (altText) => `${altText}. Imej tidak tersedia.`,
  imageUnavailableShort: 'Imej tidak tersedia',
  unsupportedTitle: 'Bahagian ini memerlukan pemain yang lebih baharu',
  unsupportedMessage: (kind) =>
    `Kemas kini Classroom Widgets untuk memaparkan${kind ? ` komponen “${kind}”` : ' komponen ini'}.`,
  brokenReferenceTitle: (label) => `${label} ini tidak tersedia`,
  brokenReferenceMessage: 'Aktiviti ini merujuk tetapan yang tidak dapat ditemukan.',
  brokenReferenceLabels: {
    'number control': 'Kawalan nombor',
    'toggle control': 'Kawalan togol',
    'choice control': 'Kawalan pilihan',
  },
  chosen: 'Dipilih',
  readyToChoose: (count) => `Sedia untuk memilih daripada ${count} pilihan.`,
  choose: 'Pilih',
  resetChoices: 'Tetapkan semula pilihan',
  allChosen: 'Setiap pilihan telah dipilih. Tetapkan semula untuk bermula lagi.',
  taskProgress: (complete, total) => `${complete} daripada ${total} selesai`,
  clearChecks: 'Kosongkan tanda',
  pause: 'Jeda',
  startAgain: 'Mula lagi',
  start: 'Mula',
  reset: 'Tetapkan semula',
  currentSignal: (label) => `Isyarat semasa: ${label}`,
  currentSignalBefore: 'Isyarat semasa:',
  reportWidget: 'Laporkan widget ini',
  reportThanks: 'Terima kasih. Widget ini telah ditandai untuk semakan.',
  reportConcern: 'Apakah masalahnya?',
  reportReasons: {
    inappropriate: 'Kandungan tidak sesuai',
    'personal-data': 'Maklumat peribadi',
    copyright: 'Masalah hak cipta',
    accessibility: 'Masalah kebolehcapaian',
    other: 'Masalah keselamatan lain',
  },
  sending: 'Sedang menghantar…',
  sendReport: 'Hantar laporan',
  reportFailed: 'Laporan tidak dapat dihantar. Semak sambungan anda dan cuba lagi.',
  noPageTitle: 'Widget ini tidak mempunyai halaman untuk dipaparkan',
  noPageMessage: 'Minta guru menerbitkan semula aktiviti, kemudian buka pautan sekali lagi.',
};

export function playerCopy(locale?: string): PlayerCopy {
  return locale?.toLowerCase().startsWith('ms') ? malay : english;
}
