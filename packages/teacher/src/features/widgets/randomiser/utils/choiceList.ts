export function normaliseChoiceList(rawInput: string): string[] {
  return rawInput
    .split('\n')
    .map((value) => value.trim())
    .filter((value, index, array) => {
      if (!value) {
        return false;
      }
      return array.indexOf(value) === index;
    });
}

export function stringifyChoiceList(choices: string[]): string {
  return choices.join('\n');
}

export function getActiveChoices(choices: string[], removed: string[]): string[] {
  return choices.filter((choice) => !removed.includes(choice));
}
