export interface Concept { title: string; text: string; example: string }
export interface Check { q: string; options: string[]; answer: number; why: string }
export interface Subject { id: string; title: string; emoji: string; tint: string; deep: string; blurb: string; concepts: Concept[]; checks: Check[] }

export const SUBJECTS: Subject[] = [
  { id: 'science', title: 'Science', emoji: '🔬', tint: '#D6EFE3', deep: '#3f7f66', blurb: 'Cells, forces and the universe',
    concepts: [
      { title: 'Cells are life’s building blocks', text: 'Every living thing is made of cells. Some living things are a single cell; you are made of trillions. Cells specialise: muscle cells contract, nerve cells carry signals, and red blood cells carry oxygen.', example: 'Think of cells as bricks, but bricks that can repair themselves and talk to their neighbours.' },
      { title: 'Forces change motion', text: 'A force is a push or a pull. Balanced forces keep an object still or moving at a steady speed. Unbalanced forces change its speed or direction. Friction and gravity are forces you feel every day.', example: 'A book resting on a table has gravity pulling down and the table pushing up equally.' },
      { title: 'Energy is conserved', text: 'Energy cannot be created or destroyed, only transferred or stored. A battery stores chemical energy, a lamp turns it into light and heat, and food stores energy your body uses.', example: 'When you climb stairs, chemical energy from food becomes movement and heat.' },
    ],
    checks: [
      { q: 'What is the basic building block of living things?', options: ['Atom', 'Cell', 'Organ', 'Molecule'], answer: 1, why: 'Cells are the smallest unit of life.' },
      { q: 'What happens when forces on an object are balanced?', options: ['It always speeds up', 'Its motion does not change', 'It disappears', 'It changes colour'], answer: 1, why: 'Balanced forces mean no change in motion.' },
      { q: 'Energy can be…', options: ['Created from nothing', 'Destroyed completely', 'Transferred and stored', 'Only electricity'], answer: 2, why: 'Energy is conserved: it moves between forms.' },
    ] },
  { id: 'maths', title: 'Maths', emoji: '📐', tint: '#E4DAF5', deep: '#6d57a0', blurb: 'Fractions, ratios and clever shortcuts',
    concepts: [
      { title: 'Fractions are division', text: 'A fraction like 3/4 means 3 parts out of 4 equal parts. It is also 3 ÷ 4. Equivalent fractions look different but have the same value: 1/2 = 2/4 = 50/100.', example: 'To compare 2/3 and 3/5, make denominators the same: 10/15 vs 9/15, so 2/3 is larger.' },
      { title: 'Ratios compare amounts', text: 'A ratio compares two quantities, such as 2 cups of flour to 3 cups of milk. Scaling both numbers by the same factor keeps the ratio the same.', example: '2:3 scaled by 4 becomes 8:12.' },
      { title: 'Percent means per hundred', text: 'Percent is a fraction with denominator 100. 25% = 25/100 = 0.25. To find 25% of 80, multiply 80 by 0.25 to get 20.', example: 'A ₹200 item at 15% off: 15% of 200 = 30, so you pay 170.' },
    ],
    checks: [
      { q: 'Which fraction is equivalent to 1/2?', options: ['2/3', '3/6', '4/6', '2/5'], answer: 1, why: '3/6 simplifies to 1/2.' },
      { q: 'What is 20% of 150?', options: ['15', '20', '30', '45'], answer: 2, why: '0.20 × 150 = 30.' },
      { q: 'A ratio 3:4 scaled by 5 is…', options: ['8:9', '15:20', '3:20', '5:4'], answer: 1, why: 'Multiply both parts by 5.' },
    ] },
  { id: 'history', title: 'History', emoji: '🏺', tint: '#FFF0B8', deep: '#8a6e18', blurb: 'Evidence, sources and turning points',
    concepts: [
      { title: 'Historians use evidence', text: 'History is built from sources: written records, objects, buildings and oral stories. Sources can be biased, so historians compare several and ask who made them and why.', example: 'A king’s monument and a farmer’s diary may describe the same event very differently.' },
      { title: 'Cause and consequence', text: 'Big changes usually have several causes, not one. The invention of the printing press, for example, had causes in trade, technology and demand for knowledge, and consequences for religion, science and politics.', example: 'Ask “what changed because of this?” and “who benefited?”' },
      { title: 'Continuity and change', text: 'Some things change quickly; others continue for centuries. Studying both helps avoid oversimplifying the past.', example: 'Transport changed rapidly, while family meals continued in many cultures.' },
    ],
    checks: [
      { q: 'What is a primary source?', options: ['A textbook summary', 'Something from the time being studied', 'A modern encyclopaedia', 'A fictional film'], answer: 1, why: 'Primary sources come from the period itself.' },
      { q: 'Why compare several sources?', options: ['To make history longer', 'To spot bias and check reliability', 'To avoid reading', 'Because one is always fake'], answer: 1, why: 'Comparing sources helps test claims and bias.' },
      { q: 'History usually has…', options: ['One simple cause', 'No causes', 'Several causes and consequences', 'Only dates'], answer: 2, why: 'Events usually have multiple causes and effects.' },
    ] },
  { id: 'tech', title: 'Technology', emoji: '🤖', tint: '#BFDCDC', deep: '#3f727f', blurb: 'How computers and AI work',
    concepts: [
      { title: 'Computers follow instructions', text: 'A computer stores data and follows programs: precise step-by-step instructions. A bug is a mistake in those instructions or in how they are used.', example: 'A recipe is a program; ingredients are data; the cook is the processor.' },
      { title: 'AI learns patterns', text: 'Many AI systems learn from examples rather than being told every rule. They can be useful but may make confident mistakes, reflect bias in their data, or be unable to explain their reasoning.', example: 'An AI trained on cat photos may fail on a hairless cat it has never seen.' },
      { title: 'Online safety is a skill', text: 'Strong passwords, careful sharing and checking sources protect you online. If something feels wrong, save evidence and tell a trusted adult rather than handling it alone.', example: 'Never share an address, school name or live location in a public chat.' },
    ],
    checks: [
      { q: 'What is a computer program?', options: ['A type of screen', 'Step-by-step instructions', 'A battery', 'A photo'], answer: 1, why: 'Programs are ordered instructions for a computer.' },
      { q: 'AI that learns from examples can…', options: ['Never be wrong', 'Make confident mistakes', 'Explain everything perfectly', 'Think like a human'], answer: 1, why: 'Pattern-learners can fail on unfamiliar or biased data.' },
      { q: 'If someone online asks for your address, you should…', options: ['Share it quickly', 'Tell a trusted adult and not share it', 'Post it publicly', 'Ignore all safety rules'], answer: 1, why: 'Personal details stay private; tell a trusted adult.' },
    ] },
]

export const DEBATES = [
  { q: 'Should school start later in the day?', forPoints: ['Teen sleep cycles shift later', 'Better rest may improve focus'], againstPoints: ['Families rely on current schedules', 'Sports and transport need adjusting'] },
  { q: 'Should all homework be optional?', forPoints: ['Less stress and more free time', 'Students can follow their own interests'], againstPoints: ['Practice builds independence', 'Some students need structure'] },
  { q: 'Is it ever okay to keep a secret from a parent?', forPoints: ['Privacy matters as you grow', 'Surprises and safe boundaries'], againstPoints: ['Safety concerns should be shared', 'Trust grows through openness'] },
  { q: 'Should social media have a minimum age?', forPoints: ['Protects developing minds', 'Reduces pressure and comparison'], againstPoints: ['Age rules are easy to bypass', 'Teaches digital skills late'] },
  { q: 'Should humans spend money exploring space?', forPoints: ['Science and technology spin-offs', 'Long-term survival and curiosity'], againstPoints: ['Urgent problems on Earth', 'High cost and uncertain benefit'] },
  { q: 'Is competition or cooperation better for learning?', forPoints: ['Competition can motivate effort', 'Clear goals and feedback'], againstPoints: ['Cooperation builds deeper understanding', 'Reduces anxiety and comparison'] },
]

export const WRITING_PROMPTS = [
  'Write a scene where a machine learns to feel one emotion. What happens first?',
  'A door appears that was not there yesterday. Describe who opens it and why.',
  'Tell the same event twice: once as a rumour, once as the truth.',
  'Write a letter to your future self ten years from now.',
  'A city decides to ban all screens for a week. Write the first day.',
  'Describe a place using only sound and smell, never sight.',
  'Your best friend can suddenly hear thoughts for one hour. Write what happens.',
  'Write a short story that begins with the line: “The map was wrong on purpose.”',
]

export const FOCUS_STEPS = ['Choose one small task.', 'Put distractions away.', 'Work until the timer ends.', 'Take a short break.', 'Decide what to do next.']
