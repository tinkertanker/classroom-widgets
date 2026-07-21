export interface PlayerCopy {
  learningGoal: string;
  everythingCorrect: string;
  reviewFeedback: string;
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
  learningGoal: 'Learning goal',
  everythingCorrect: 'Everything is correct.',
  reviewFeedback: 'Review the feedback, then try again.',
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
  learningGoal: 'Matlamat pembelajaran',
  everythingCorrect: 'Semua jawapan betul.',
  reviewFeedback: 'Semak maklum balas, kemudian cuba lagi.',
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
