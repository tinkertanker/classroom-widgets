// Fun default poll questions for new widgets
export interface PollQuestion {
  question: string;
  options: string[];
}

export const classroomPulsePoll: PollQuestion = {
  question: 'How is the lesson for you right now?',
  options: ['Way too fast', 'Too fast', 'Just right', 'Too slow', 'Way too slow']
};

export const defaultPollQuestions: PollQuestion[] = [
  classroomPulsePoll,
  {
    question: "Why did the chicken cross the road?",
    options: ["To get to the other side", "It was escaping from KFC", "To prove it wasn't chicken", "Google Maps said it was faster"]
  },
  {
    question: "What's the best superpower?",
    options: ["Flying", "Invisibility", "Time travel", "Reading minds", "Unlimited WiFi"]
  },
  {
    question: "Which came first?",
    options: ["The chicken", "The egg", "The rooster", "The question"]
  },
  {
    question: "What's the most important meal of the day?",
    options: ["Breakfast", "Lunch", "Dinner", "Second breakfast", "Midnight snack"]
  },
  {
    question: "How many licks does it take to get to the center of a Tootsie Pop?",
    options: ["One", "Two", "Three", "The world may never know"]
  },
  {
    question: "Is a hot dog a sandwich?",
    options: ["Yes, obviously", "No way!", "It's a taco", "It's its own thing"]
  },
  {
    question: "Which way should toilet paper hang?",
    options: ["Over (correct)", "Under (chaotic)", "Sideways (creative)", "I don't use toilet paper"]
  },
  {
    question: "What's the best pizza topping?",
    options: ["Pepperoni", "Pineapple (controversial!)", "Mushrooms", "Extra cheese", "None - plain is best"]
  },
  {
    question: "How do you pronounce 'GIF'?",
    options: ["Jif (like peanut butter)", "Gif (with a hard G)", "It's actually pronounced 'yif'", "I just say 'moving picture'"]
  },
  {
    question: "What's the longest word in English?",
    options: ["Supercalifragilisticexpialidocious", "Pneumonoultramicroscopicsilicovolcanoconiosis", "Antidisestablishmentarianism", "Longest"]
  },
  {
    question: "What's the best day of the week?",
    options: ["Friday", "Saturday", "Sunday", "Payday", "Every day is a gift"]
  },
  {
    question: "Is water wet?",
    options: ["Yes, by definition", "No, it makes things wet", "Only when it's touching something", "This is too deep for me"]
  },
  {
    question: "What's the best way to eat Oreos?",
    options: ["Twist, lick, dunk", "Bite it whole", "Just eat the cream", "I don't eat Oreos", "Blend them in milk"]
  },
  {
    question: "Which bear is best?",
    options: ["Black bear", "Brown bear", "Polar bear", "Teddy bear", "Bears, beets, Battlestar Galactica"]
  },
  {
    question: "What happens when an unstoppable force meets an immovable object?",
    options: ["They pass through each other", "The universe explodes", "They become friends", "Chuck Norris wins"]
  },
  {
    question: "If you could time travel, where would you go?",
    options: ["The past to fix mistakes", "The future to see technology", "Yesterday to remember what I forgot", "Nowhere - too risky"]
  },
  {
    question: "What's the meaning of life?",
    options: ["42", "To be happy", "To help others", "Pizza", "Still figuring it out"]
  },
  {
    question: "Which season is the best?",
    options: ["Spring", "Summer", "Fall/Autumn", "Winter", "Depends on where you live"]
  },
  {
    question: "What's the best midnight snack?",
    options: ["Cereal", "Leftover pizza", "Cheese", "Cookies", "Sleep is the best midnight snack"]
  },
  {
    question: "If animals could talk, which would be the rudest?",
    options: ["Cats (obviously)", "Geese", "Llamas", "Honey badgers", "Seagulls"]
  }
];

export function getDefaultPollQuestion(): PollQuestion {
  return classroomPulsePoll;
}

// Function to get a random poll question
export function getRandomPollQuestion(): PollQuestion {
  const randomIndex = Math.floor(Math.random() * defaultPollQuestions.length);
  return defaultPollQuestions[randomIndex];
}
