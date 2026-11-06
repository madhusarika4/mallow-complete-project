export interface Q { prompt: string; say: string; options: string[]; answer: number }
export const RIDDLES: { prompt: string; options: string[]; answer: string }[] = [
  { prompt: 'I have a long trunk and big ears.', options: ['🐘', '🐱', '🐸'], answer: '🐘' },
  { prompt: 'I say "meow" and I love milk.', options: ['🐶', '🐱', '🐮'], answer: '🐱' },
  { prompt: 'I am bright and yellow. I shine in the sky in the day.', options: ['🌙', '☀️', '⭐'], answer: '☀️' },
  { prompt: 'I live in the water and I have fins.', options: ['🐟', '🐦', '🐇'], answer: '🐟' },
  { prompt: 'You can eat me. I am red and round with a tiny leaf.', options: ['🍌', '🥕', '🍎'], answer: '🍎' },
  { prompt: 'I fall from the clouds and make puddles.', options: ['🌧️', '☀️', '🌈'], answer: '🌧️' },
  { prompt: 'I have wheels and I carry many people on the road.', options: ['🚌', '🚀', '⛵'], answer: '🚌' },
  { prompt: 'I have wings and I sing in the trees.', options: ['🐢', '🐦', '🐙'], answer: '🐦' },
  { prompt: 'I hop and I love carrots.', options: ['🐇', '🐘', '🐍'], answer: '🐇' },
  { prompt: 'I come out at night and change my shape.', options: ['🌙', '🌻', '🍎'], answer: '🌙' },
]
export const SOUNDS: { q: string; options: string[]; answer: string }[] = [
  { q: 'What sound does a cow make?', options: ['Moo', 'Woof', 'Quack'], answer: 'Moo' },
  { q: 'What sound does a dog make?', options: ['Meow', 'Woof', 'Moo'], answer: 'Woof' },
  { q: 'What sound does a duck make?', options: ['Quack', 'Roar', 'Buzz'], answer: 'Quack' },
  { q: 'Which animal says "meow"?', options: ['🐱', '🐶', '🐸'], answer: '🐱' },
  { q: 'Which animal can hop and croak?', options: ['🐸', '🐘', '🐟'], answer: '🐸' },
  { q: 'Which one is a fruit?', options: ['🍌', '🚗', '🧸'], answer: '🍌' },
  { q: 'Which one do we wear on our feet?', options: ['🧢', '👟', '🧤'], answer: '👟' },
  { q: 'What do bees make?', options: ['Honey', 'Milk', 'Juice'], answer: 'Honey' },
]
export const COLOURS = [{ n: 'red', c: '#E06C75' }, { n: 'blue', c: '#6FA8D9' }, { n: 'yellow', c: '#F2D56B' }, { n: 'green', c: '#7CC3A0' }, { n: 'purple', c: '#9D86C9' }, { n: 'orange', c: '#F2A97E' }, { n: 'pink', c: '#F4A6C0' }]
