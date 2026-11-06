export interface Fact { emoji: string; title: string; text: string }
export interface QuizQ { q: string; options: string[]; answer: number; why: string }
export interface Topic { id: string; title: string; emoji: string; tint: string; deep: string; blurb: string; facts: Fact[]; didYouKnow: string; ask: string; quiz: QuizQ[] }

export const TOPICS: Topic[] = [
  { id: 'space', title: 'Space', emoji: '🪐', tint: '#E4DAF5', deep: '#7d66ad', blurb: 'Planets, stars and the Moon', ask: 'Why does the Moon change shape?',
    facts: [
      { emoji: '☀️', title: 'The Sun is a star', text: 'The Sun is a huge ball of hot gas. It gives Earth light and warmth. It looks big only because it is the closest star.' },
      { emoji: '🌍', title: 'Earth spins', text: 'Earth turns around once every 24 hours. When your side faces the Sun it is day, and when it turns away it is night.' },
      { emoji: '🌙', title: 'The Moon shines borrowed light', text: 'The Moon makes no light of its own. It reflects sunlight. The shape we see changes as the Moon travels around Earth.' },
      { emoji: '🔴', title: 'Mars is the red planet', text: 'Mars looks red because its soil has rusty iron in it. Robots called rovers drive around on Mars taking pictures.' },
      { emoji: '🪐', title: "Saturn's rings", text: 'Saturn has beautiful rings made of billions of pieces of ice and rock, some as small as sugar grains and some as big as houses.' },
      { emoji: '🚀', title: 'Space has no air', text: 'There is no air in space, so astronauts carry air in their suits and spacecraft. Sound cannot travel there either.' }],
    didYouKnow: 'A day on Venus is longer than a year on Venus! Venus spins very slowly but goes around the Sun quickly.',
    quiz: [
      { q: 'What is the Sun?', options: ['A planet', 'A star', 'A moon', 'A comet'], answer: 1, why: 'The Sun is a star, a giant ball of hot glowing gas.' },
      { q: 'Why does Mars look red?', options: ['It is very hot', 'Rusty iron in its soil', 'It is covered in lava', 'It reflects red paint'], answer: 1, why: 'Iron in the soil has rusted, just like rusty metal on Earth.' },
      { q: 'What makes day and night on Earth?', options: ['Earth spinning', 'The Moon moving', 'Clouds', 'The Sun turning off'], answer: 0, why: 'Earth spins once every 24 hours, turning us toward and away from the Sun.' },
      { q: "What are Saturn's rings made of?", options: ['Gas', 'Water only', 'Ice and rock pieces', 'Metal wires'], answer: 2, why: 'Billions of bits of ice and rock circle Saturn together.' },
      { q: 'Can sound travel through space?', options: ['Yes, loudly', 'Yes, quietly', 'No, there is no air', 'Only near stars'], answer: 2, why: 'Sound needs air or something to travel through, and space is almost empty.' }] },
  { id: 'animals', title: 'Animals', emoji: '🦊', tint: '#FFDCC4', deep: '#c27a52', blurb: 'Wild and wonderful creatures', ask: 'How do animals survive in cold places?',
    facts: [
      { emoji: '🐘', title: 'Elephants never forget?', text: 'Elephants have excellent memories. They can remember where water is, and they remember friends for many years.' },
      { emoji: '🐙', title: 'Octopus hearts', text: 'An octopus has three hearts and blue blood. Two hearts send blood to the gills and one sends it around the body.' },
      { emoji: '🦇', title: 'Bats are mammals', text: 'Bats are the only mammals that can truly fly. They find food in the dark using echoes, called echolocation.' },
      { emoji: '🐧', title: 'Penguins stay warm', text: 'Penguins have thick waterproof feathers and a layer of fat. They huddle together in big groups to share warmth.' },
      { emoji: '🐝', title: 'Busy bees', text: 'A honeybee visits many flowers to make a tiny bit of honey. Bees also help plants grow fruit by carrying pollen.' },
      { emoji: '🐢', title: 'Turtle shells', text: 'A turtle shell is part of its skeleton. It is joined to the turtle’s ribs and spine, so a turtle cannot leave its shell.' }],
    didYouKnow: 'A group of flamingos is called a flamboyance! Flamingos are pink because of the tiny food they eat.',
    quiz: [
      { q: 'How many hearts does an octopus have?', options: ['One', 'Two', 'Three', 'Eight'], answer: 2, why: 'An octopus has three hearts.' },
      { q: 'Which is the only mammal that can truly fly?', options: ['Flying squirrel', 'Bat', 'Ostrich', 'Butterfly'], answer: 1, why: 'Bats are flying mammals. Flying squirrels only glide, and butterflies are insects.' },
      { q: 'How do penguins keep warm?', options: ['Waterproof feathers and fat', 'Wearing snow', 'Sleeping underground only', 'Running all day'], answer: 0, why: 'Feathers, fat and huddling together keep penguins cosy.' },
      { q: 'How do bees help plants?', options: ['They water them', 'They carry pollen', 'They eat the roots', 'They plant seeds in soil'], answer: 1, why: 'Pollen carried from flower to flower helps plants make seeds and fruit.' },
      { q: 'A turtle’s shell is…', options: ['A removable house', 'Part of its skeleton', 'Made of stone', 'Just skin'], answer: 1, why: 'The shell grows with the turtle and is joined to its bones.' }] },
  { id: 'body', title: 'My Body', emoji: '🫀', tint: '#FBDDE3', deep: '#b9647c', blurb: 'How your amazing body works', ask: 'Why do we need to sleep?',
    facts: [
      { emoji: '❤️', title: 'Your busy heart', text: 'Your heart is about the size of your fist. It pumps blood all around your body, beating many times every minute, even while you sleep.' },
      { emoji: '🫁', title: 'Lungs breathe air', text: 'When you breathe in, your lungs take oxygen from the air. Oxygen travels in your blood to every part of you.' },
      { emoji: '🦴', title: 'Strong skeleton', text: 'Babies are born with more bones than grown-ups because some bones join together as we grow. Bones are alive and keep growing.' },
      { emoji: '🧠', title: 'Your brain', text: 'Your brain sends messages along your nerves. It helps you think, remember, move and feel, and it never fully switches off.' },
      { emoji: '👂', title: 'Ears help you balance', text: 'Inside your ears are tiny tubes with liquid that help you keep your balance as well as hear.' },
      { emoji: '🍎', title: 'Food is fuel', text: 'Your stomach and intestines break food into tiny parts your body uses for energy, growing and fixing itself.' }],
    didYouKnow: 'Your fingerprints are one of a kind. Nobody else in the world has the same ones as you!',
    quiz: [
      { q: 'What does your heart do?', options: ['Digests food', 'Pumps blood', 'Makes sounds', 'Helps you see'], answer: 1, why: 'The heart is a strong muscle that pumps blood around the body.' },
      { q: 'What do your lungs take from the air?', options: ['Oxygen', 'Dust', 'Sugar', 'Water'], answer: 0, why: 'Lungs take in oxygen, which your blood carries to your body.' },
      { q: 'Who has more bones?', options: ['Grown-ups', 'Babies', 'Exactly the same', 'Only dogs'], answer: 1, why: 'Babies have more bones; several join together as they grow.' },
      { q: 'What does the brain do?', options: ['Only stores food', 'Sends and receives messages', 'Pumps air', 'Makes bones'], answer: 1, why: 'The brain is the control centre, working with your nerves.' },
      { q: 'Why do we eat food?', options: ['Only for taste', 'For energy and growing', 'To make us sleepy', 'To grow hair only'], answer: 1, why: 'Food gives us fuel and building blocks for our bodies.' }] },
  { id: 'weather', title: 'Weather', emoji: '⛈️', tint: '#D6EFE3', deep: '#4f8a70', blurb: 'Clouds, rain and rainbows', ask: 'How does a rainbow form?',
    facts: [
      { emoji: '☁️', title: 'Clouds are tiny water drops', text: 'A cloud is made of billions of tiny water droplets or ice crystals floating together high in the sky.' },
      { emoji: '🌧️', title: 'Where rain comes from', text: 'Water from seas and puddles warms up and rises as invisible vapour. High up it cools, makes clouds, and falls as rain. This is the water cycle.' },
      { emoji: '🌈', title: 'Rainbows', text: 'A rainbow appears when sunlight shines through raindrops. The drops split the light into seven colours.' },
      { emoji: '⚡', title: 'Lightning and thunder', text: 'Lightning is a giant spark of electricity. Light travels faster than sound, so you see lightning first and hear thunder later.' },
      { emoji: '🌬️', title: 'Wind is moving air', text: 'Wind happens when warm air rises and cooler air rushes in to take its place.' },
      { emoji: '❄️', title: 'Every snowflake', text: 'Snowflakes are ice crystals that form in clouds. They have six sides, and they come in many different patterns.' }],
    didYouKnow: 'Thunder happens because lightning heats the air so fast that it booms outwards!',
    quiz: [
      { q: 'What is a cloud made of?', options: ['Cotton', 'Tiny water drops or ice', 'Smoke', 'Air only'], answer: 1, why: 'Clouds are billions of tiny water droplets or ice crystals.' },
      { q: 'What do you need to see a rainbow?', options: ['Sun and raindrops', 'Wind and snow', 'Only clouds', 'Thunder'], answer: 0, why: 'Sunlight bends through raindrops and splits into colours.' },
      { q: 'Why do we see lightning before we hear thunder?', options: ['Thunder is lazy', 'Light travels faster than sound', 'Lightning is closer', 'Our eyes are faster'], answer: 1, why: 'Light is much faster than sound.' },
      { q: 'What is wind?', options: ['Moving air', 'Moving clouds', 'Cold water', 'Sun rays'], answer: 0, why: 'Wind is air moving from one place to another.' },
      { q: 'How many sides does a snowflake have?', options: ['Four', 'Five', 'Six', 'Eight'], answer: 2, why: 'Ice crystals form with six sides.' }] },
  { id: 'plants', title: 'Plants', emoji: '🌱', tint: '#CFEBDD', deep: '#4a8a6c', blurb: 'How seeds become giants', ask: 'How do plants make their own food?',
    facts: [
      { emoji: '🌞', title: 'Plants make food from light', text: 'Leaves catch sunlight and use it, with air and water, to make sugar for food. This is called photosynthesis.' },
      { emoji: '🌳', title: 'Roots drink', text: 'Roots hold a plant in the soil and soak up water and minerals that the plant needs.' },
      { emoji: '🌸', title: 'Flowers make seeds', text: 'Flowers help plants make seeds. Bright colours and sweet smells invite bees and butterflies to visit.' },
      { emoji: '🍃', title: 'Plants give us air', text: 'While making food, plants release oxygen, the part of the air that we breathe in.' },
      { emoji: '🌰', title: 'Tiny seed, big tree', text: 'Every seed holds a baby plant and some food. With water, warmth and soil, it sprouts.' },
      { emoji: '🌻', title: 'Sunflowers follow light', text: 'Young sunflowers turn their heads to face the Sun as it moves across the sky.' }],
    didYouKnow: 'Bamboo is a giant grass, and some kinds can grow almost a metre in a single day!',
    quiz: [
      { q: 'What do plants need to make food?', options: ['Sunlight, air and water', 'Only soil', 'Moonlight', 'Sweets'], answer: 0, why: 'Leaves use sunlight, air and water to make sugar.' },
      { q: 'What do roots do?', options: ['Make flowers', 'Soak up water', 'Catch bees', 'Make wind'], answer: 1, why: 'Roots take in water and minerals and hold the plant steady.' },
      { q: 'Which gas do plants give out?', options: ['Smoke', 'Oxygen', 'Steam only', 'Dust'], answer: 1, why: 'Plants release oxygen, which we need to breathe.' },
      { q: 'Why are many flowers bright and sweet-smelling?', options: ['To look nice for us', 'To invite insects', 'To scare animals', 'To keep warm'], answer: 1, why: 'Insects carry pollen from flower to flower.' },
      { q: 'What does a seed contain?', options: ['A baby plant and food', 'Only water', 'Air', 'Nothing'], answer: 0, why: 'A seed has a tiny plant inside plus stored food.' }] },
  { id: 'earth', title: 'Earth & Oceans', emoji: '🌋', tint: '#BFDCDC', deep: '#3f7f80', blurb: 'Volcanoes, mountains and seas', ask: 'How do volcanoes work?',
    facts: [
      { emoji: '🌊', title: 'Oceans are huge', text: 'Oceans cover more than two thirds of Earth. Most of that water is salty, and most of the ocean has never been explored.' },
      { emoji: '🌋', title: 'Volcanoes', text: 'Under the ground there is hot melted rock called magma. When it escapes through a volcano it is called lava.' },
      { emoji: '⛰️', title: 'Mountains grow slowly', text: 'Earth’s surface is in giant pieces that move very slowly. When pieces push together, mountains can rise up over millions of years.' },
      { emoji: '💧', title: 'Fresh water', text: 'Only a small part of Earth’s water is fresh water we can drink, so saving water is important.' },
      { emoji: '🪨', title: 'Rocks have stories', text: 'Layers of rock show how land changed over a very long time, and sometimes hold fossils of ancient animals.' },
      { emoji: '🐋', title: 'Whales breathe air', text: 'Whales live in the sea but they are mammals. They come up to breathe air through a blowhole.' }],
    didYouKnow: 'Some places on the sea floor are deeper than the tallest mountain is high!',
    quiz: [
      { q: 'What is melted rock under a volcano called?', options: ['Lava', 'Magma', 'Sand', 'Steam'], answer: 1, why: 'It is magma underground and lava once it comes out.' },
      { q: 'How much of Earth do oceans cover?', options: ['About a quarter', 'About half', 'More than two thirds', 'Only a tenth'], answer: 2, why: 'Oceans cover over two thirds of our planet.' },
      { q: 'Are whales fish?', options: ['Yes', 'No, they are mammals', 'Only baby whales', 'They are reptiles'], answer: 1, why: 'Whales breathe air and feed milk to their babies.' },
      { q: 'How can mountains form?', options: ['Giant pieces of land push together', 'Wind piles sand', 'Rain builds them overnight', 'Animals dig them'], answer: 0, why: 'Slow-moving pieces of Earth’s surface push up mountains.' },
      { q: 'What can rock layers show us?', options: ['The weather tomorrow', 'How land changed long ago', 'Our future', 'Nothing'], answer: 1, why: 'Rock layers, and fossils in them, are clues about the past.' }] },
  { id: 'maths', title: 'Maths', emoji: '🧮', tint: '#E4DAF5', deep: '#6d57a0', blurb: 'Patterns, shapes and clever numbers', ask: 'Why does multiplying always make numbers bigger?',
    facts: [
      { emoji: '✖️', title: 'Multiplication is repeated adding', text: '4 × 3 means four groups of three, or 3 + 3 + 3 + 3. It is a faster way to add equal groups.' },
      { emoji: '🔢', title: 'Place value matters', text: 'In 3,482 the 4 is worth 400 and the 8 is worth 80. Moving a digit one place left makes it ten times bigger.' },
      { emoji: '➗', title: 'Division shares equally', text: '12 ÷ 3 asks how many groups of 3 fit in 12, or how to share 12 into 3 equal groups. The answer is 4.' },
      { emoji: '⬛', title: 'Shapes have properties', text: 'A square has 4 equal sides and 4 right angles. A triangle has 3 sides. A circle is a curved shape with no corners.' },
      { emoji: '📏', title: 'Perimeter and area', text: 'Perimeter is the distance around the edge. Area is the space inside. A rectangle 5 cm by 3 cm has perimeter 16 cm and area 15 cm².' },
      { emoji: '🧩', title: 'Patterns help you predict', text: 'Number patterns follow rules. In 2, 5, 8, 11 the rule is add 3, so the next number is 14.' }],
    didYouKnow: 'Zero is a number with a huge job: it holds places in our number system. Without it, 105 and 15 would be hard to tell apart!',
    quiz: [
      { q: 'What is 6 × 4?', options: ['10', '20', '24', '28'], answer: 2, why: 'Six groups of four make 24.' },
      { q: 'In 7,265, what is the 2 worth?', options: ['2', '20', '200', '2000'], answer: 2, why: 'The 2 is in the hundreds place, so it is worth 200.' },
      { q: 'What is 15 ÷ 3?', options: ['3', '5', '6', '12'], answer: 1, why: 'Three groups of five make 15.' },
      { q: 'How many sides does a triangle have?', options: ['2', '3', '4', '5'], answer: 1, why: 'A triangle always has three sides.' },
      { q: 'What comes next: 2, 5, 8, 11, ?', options: ['12', '13', '14', '15'], answer: 2, why: 'The rule is add 3, so 11 + 3 = 14.' }] },
]

export interface QuestStep { kind: 'choice' | 'input'; prompt: string; options?: string[]; answer: number | string[]; hint: string; explain: string }
export interface Quest { id: string; title: string; emoji: string; tint: string; deep: string; intro: string; badge: string; steps: QuestStep[] }
export const QUESTS: Quest[] = [
  { id: 'moon', title: 'Moon Mission', emoji: '🚀', tint: '#E4DAF5', deep: '#7d66ad', badge: 'Moon Explorer', intro: 'Mallow needs your help to fly to the Moon and bring back a moon rock!',
    steps: [
      { kind: 'choice', prompt: 'Astronauts need something to breathe in space. What do they carry?', options: ['Air in their suit', 'A big balloon', 'Nothing, space has air', 'Water bottles'], answer: 0, hint: 'There is no air in space.', explain: 'Right! Space has no air, so suits carry air for breathing.' },
      { kind: 'input', prompt: 'Count down to launch: 10, 8, 6, 4, ... what comes next?', answer: ['2', 'two'], hint: 'It goes down by 2 each time.', explain: '10, 8, 6, 4, 2. You are counting in twos!' },
      { kind: 'choice', prompt: 'The Moon goes around which planet?', options: ['Mars', 'Earth', 'Venus', 'Saturn'], answer: 1, hint: 'It is the planet we live on.', explain: 'The Moon orbits Earth, which takes about a month.' },
      { kind: 'choice', prompt: 'Why does the Moon look bright at night?', options: ['It makes light like a lamp', 'It reflects sunlight', 'It is full of stars', 'It is on fire'], answer: 1, hint: 'Think about the Sun.', explain: 'The Moon bounces sunlight back to us.' },
      { kind: 'input', prompt: 'You collect 7 moon rocks, then 8 more. How many in all?', answer: ['15', 'fifteen'], hint: '7 + 8. Try 7 + 3 first.', explain: '7 + 8 = 15. Mission complete!' }] },
  { id: 'jungle', title: 'Jungle Detective', emoji: '🔍', tint: '#CFEBDD', deep: '#4a8a6c', badge: 'Animal Detective', intro: 'Strange footprints appeared in the jungle! Use clues to solve the mystery.',
    steps: [
      { kind: 'choice', prompt: 'Clue 1: it has a long trunk and big ears. Who is it?', options: ['Monkey', 'Elephant', 'Parrot', 'Frog'], answer: 1, hint: 'It is the biggest land animal.', explain: 'An elephant uses its trunk to smell, drink and pick things up.' },
      { kind: 'choice', prompt: 'Clue 2: it hangs upside down and finds food using echoes.', options: ['Bat', 'Sloth', 'Owl', 'Snake'], answer: 0, hint: 'It flies at night.', explain: 'Bats use echolocation to find food in the dark.' },
      { kind: 'choice', prompt: 'Clue 3: which animal is a mammal?', options: ['Frog', 'Eagle', 'Tiger', 'Lizard'], answer: 2, hint: 'Mammals have fur and feed their babies milk.', explain: 'Tigers are mammals. Frogs are amphibians, eagles are birds, lizards are reptiles.' },
      { kind: 'input', prompt: 'Clue 4: Five monkeys sit on a branch. Two jump away. How many are left?', answer: ['3', 'three'], hint: '5 take away 2.', explain: '5 − 2 = 3 monkeys.' },
      { kind: 'choice', prompt: 'Final clue: plants and animals need…', options: ['Sweets', 'Water', 'Phones', 'Toys'], answer: 1, hint: 'You drink it too!', explain: 'All living things need water.' }] },
  { id: 'body', title: 'Body Explorer', emoji: '🧬', tint: '#FBDDE3', deep: '#b9647c', badge: 'Body Expert', intro: 'Shrink down and travel through the human body with Mallow!',
    steps: [
      { kind: 'choice', prompt: 'First stop, the heart. What does it do?', options: ['Pumps blood', 'Thinks', 'Breathes air', 'Chews food'], answer: 0, hint: 'You can feel it beating.', explain: 'The heart is a muscle that pumps blood around the body.' },
      { kind: 'choice', prompt: 'Next, the lungs. What do they bring in?', options: ['Oxygen', 'Juice', 'Sunshine', 'Noise'], answer: 0, hint: 'You breathe it in.', explain: 'Lungs bring in oxygen and let out carbon dioxide.' },
      { kind: 'choice', prompt: 'Which part sends messages to the whole body?', options: ['Brain and nerves', 'Elbows', 'Teeth', 'Hair'], answer: 0, hint: 'It is inside your head.', explain: 'The brain and nerves carry messages super fast.' },
      { kind: 'input', prompt: 'How many fingers on two hands? (Count them!)', answer: ['10', 'ten'], hint: '5 + 5', explain: '5 + 5 = 10 fingers.' },
      { kind: 'choice', prompt: 'What helps keep your bones strong?', options: ['Food with calcium and playing outside', 'Only sitting still', 'Never eating', 'Skipping sleep'], answer: 0, hint: 'Milk, and moving your body.', explain: 'Good food, movement and sleep help bones grow strong.' }] },
  { id: 'storm', title: 'Storm Chaser', emoji: '🌪️', tint: '#D6EFE3', deep: '#4f8a70', badge: 'Weather Watcher', intro: 'Dark clouds are coming. Help Mallow predict and understand the weather.',
    steps: [
      { kind: 'choice', prompt: 'Dark grey clouds are rolling in. What is most likely coming?', options: ['Rain', 'A rainbow', 'Snow in summer', 'Nothing'], answer: 0, hint: 'Think about heavy clouds full of water.', explain: 'Thick dark clouds carry lots of water, so rain is likely.' },
      { kind: 'input', prompt: 'You count 3 seconds between lightning and thunder. If you see 2 more flashes, how many flashes in total if you saw 1 before?', answer: ['3', 'three'], hint: '1 + 2', explain: '1 + 2 = 3 flashes.' },
      { kind: 'choice', prompt: 'What is the water cycle?', options: ['Water moving between sea, sky and land', 'A bicycle for water', 'A swimming race', 'A tap'], answer: 0, hint: 'Evaporation, clouds, rain.', explain: 'Water rises, forms clouds, falls as rain and flows back to the sea.' },
      { kind: 'choice', prompt: 'Which weather helps you see a rainbow?', options: ['Sun and rain together', 'Fog', 'Thick snow', 'Wind only'], answer: 0, hint: 'Sunlight and raindrops.', explain: 'Sunlight through raindrops makes a rainbow.' },
      { kind: 'choice', prompt: 'During a thunderstorm, the safest place is…', options: ['Inside a building', 'Under a tall tree', 'In an open field', 'On a hilltop'], answer: 0, hint: 'Stay indoors.', explain: 'Stay inside a building during lightning and tell a grown-up.' }] },
  { id: 'castle', title: 'Number Castle', emoji: '🏰', tint: '#FFF0B8', deep: '#9b7f1f', badge: 'Number Knight', intro: 'The castle doors open only for brilliant maths minds. Can you unlock all five?',
    steps: [
      { kind: 'input', prompt: 'Door 1: 6 × 4 = ?', answer: ['24'], hint: '6 + 6 + 6 + 6', explain: '6 × 4 = 24.' },
      { kind: 'input', prompt: 'Door 2: Continue the pattern: 3, 6, 9, 12, ?', answer: ['15'], hint: 'Add 3 each time.', explain: 'Counting in threes: 15.' },
      { kind: 'input', prompt: 'Door 3: 45 − 18 = ?', answer: ['27'], hint: '45 − 20 = 25, then add 2.', explain: '45 − 18 = 27.' },
      { kind: 'choice', prompt: 'Door 4: Which shape has exactly 3 sides?', options: ['Square', 'Triangle', 'Circle', 'Hexagon'], answer: 1, hint: 'Think of a slice of pizza.', explain: 'A triangle has 3 sides and 3 corners.' },
      { kind: 'input', prompt: 'Door 5: 36 ÷ 6 = ?', answer: ['6', 'six'], hint: 'What times 6 makes 36?', explain: '6 × 6 = 36 so 36 ÷ 6 = 6.' }] },
]

export const SCRAMBLE = [
  { w: 'PLANET', h: 'Earth is one of these' }, { w: 'RAINBOW', h: 'Colours after rain' }, { w: 'ELEPHANT', h: 'Has a trunk' }, { w: 'VOLCANO', h: 'Mountain that erupts' },
  { w: 'DOLPHIN', h: 'Clever sea mammal' }, { w: 'GALAXY', h: 'Billions of stars together' }, { w: 'BUTTERFLY', h: 'Starts as a caterpillar' }, { w: 'THUNDER', h: 'Boom after lightning' },
  { w: 'JUNGLE', h: 'Thick rainforest' }, { w: 'PLANT', h: 'Needs sunlight and water' }, { w: 'ROCKET', h: 'Flies into space' }, { w: 'ISLAND', h: 'Land surrounded by water' },
  { w: 'SKELETON', h: 'All your bones' }, { w: 'CRAYON', h: 'You draw with it' }, { w: 'MAGNET', h: 'Attracts iron' }, { w: 'ANIMAL', h: 'Living thing that moves and eats' },
]
export const HANGMAN = ['TIGER', 'PLANET', 'BANANA', 'GARDEN', 'ROBOT', 'DRAGON', 'PIRATE', 'CASTLE', 'FOREST', 'PUZZLE', 'ORANGE', 'WIZARD', 'ROCKET', 'JUNGLE', 'COOKIE']
export const MEMORY_EMOJI = ['🦊', '🐼', '🐸', '🦄', '🐙', '🦋', '🐳', '🌻', '🍓', '🚀', '🍄', '⭐', '🐢', '🍉', '🎈', '🐝']
export const HEROES = ['a brave little robot', 'a curious young dragon', 'a clever fox', 'a kind giant', 'a space-travelling bunny', 'a tiny wizard']
export const PLACES = ['a floating island in the clouds', 'a glowing forest at night', 'a busy underwater city', 'a quiet mountain village', 'a spaceship near Saturn', 'a secret library']
export const PROBLEMS = ['lost a magic key', 'heard a mysterious song', 'found a map with a missing piece', 'wanted to make a new friend', 'discovered the stars had stopped twinkling', 'needed to deliver a very important letter']
export const STARTERS = [
  'One morning, the door of my school opened onto a place I had never seen…', 'The day my pet learned to talk, the first thing it said was…', 'If I could shrink to the size of an ant for one day, I would…',
  'Deep inside the old lighthouse, I found a glowing…', 'The rain stopped, and a ladder made of rainbow appeared…', 'My robot friend woke up and whispered a secret about…',
]
export const STICKERS = ['⭐', '🌈', '🦄', '🚀', '🐱', '🐶', '🦊', '🐼', '🌸', '🌻', '🍎', '🍕', '🎈', '🌙', '☀️', '☁️', '🏰', '🐉', '🤖', '🎨', '❤️', '🦋', '🐠', '🌳']
export const SHAPES: { id: string; label: string }[] = [{ id: 'circle', label: 'Circle' }, { id: 'square', label: 'Square' }, { id: 'triangle', label: 'Triangle' }, { id: 'star', label: 'Star' }]
export const POSTER_BG = ['#FFF8F0', '#FBDDE3', '#E4DAF5', '#D6EFE3', '#FFDCC4', '#FFF0B8', '#BFDCDC', '#C9E4FF']
export const INK_COLOURS = ['#4A3B4F', '#B87489', '#9D86C9', '#4F8A8B', '#E9A27E', '#6FB79A']
